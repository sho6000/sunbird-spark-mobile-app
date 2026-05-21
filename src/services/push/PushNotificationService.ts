import { PushNotifications } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { getClient } from '../../lib/http-client';
import { deviceService } from '../device/deviceService';
import { NativeConfigServiceInstance } from '../NativeConfigService';

const FCM_TOKEN_KEY = 'FCM_TOKEN';
const LAST_REGISTERED_FCM_TOKEN_KEY = 'FCM_TOKEN_LAST_REGISTERED';

class PushNotificationService {
  private static instance: PushNotificationService;
  private initialized = false;
  private listeners: PluginListenerHandle[] = [];
  // Single-flight: concurrent registerDevice() callers share the same in-flight
  // POST so we never hit the backend twice during the brief window where the
  // FCM 'registration' listener and AuthContext's post-login call race.
  private inFlightRegistration: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): PushNotificationService {
    if (!this.instance) {
      this.instance = new PushNotificationService();
    }
    return this.instance;
  }

  /**
   * Call once during app init.
   * Requests OS permission, registers with FCM, and sets up all listeners.
   * Safe to call on web — exits early if not on a native platform.
   * Guard prevents duplicate listener registration if called more than once.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (!Capacitor.isNativePlatform()) return;

    const { receive } = await PushNotifications.requestPermissions();
    if (receive !== 'granted') return;

    await PushNotifications.register();

    // FCM token issued (or refreshed by Google) — store it and register device
    this.listeners.push(
      await PushNotifications.addListener('registration', async (token) => {
        await this.storeFcmToken(token.value);
        // Anonymous device registration (no user token yet)
        await this.registerDevice();
      }),
    );

    this.listeners.push(
      await PushNotifications.addListener('registrationError', (err) => {
        console.error('[PushNotificationService] FCM registration error:', err);
      }),
    );

    // App is in FOREGROUND when notification arrives — update unread badge + telemetry
    this.listeners.push(
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        window.dispatchEvent(
          new CustomEvent('push:received', { detail: notification.data ?? {} }),
        );
      }),
    );

    // User tapped a notification from the OS tray (background or killed app)
    this.listeners.push(
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        window.dispatchEvent(
          new CustomEvent('push:tapped', { detail: action.notification.data }),
        );
      }),
    );

    this.initialized = true;
  }

  /**
   * Removes all active push notification listeners.
   * Call this if the service needs to be torn down (e.g. in tests or future hot-reload support).
   */
  async cleanup(): Promise<void> {
    const listeners = this.listeners;
    this.listeners = [];
    try {
      await Promise.all(
        listeners.map((l) =>
          l.remove().catch((err) => {
            console.warn('[PushNotificationService] Failed to remove listener', err);
          }),
        ),
      );
    } finally {
      this.initialized = false;
    }
  }

  /**
   * Call after every login so the backend links this FCM token to the logged-in user.
   * The user's auth token in the HTTP headers identifies the user — no userId param needed.
   */
  async registerDevice(): Promise<void> {
    if (this.inFlightRegistration) return this.inFlightRegistration;

    this.inFlightRegistration = this.doRegisterDevice().finally(() => {
      this.inFlightRegistration = null;
    });
    return this.inFlightRegistration;
  }

  private async doRegisterDevice(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const fcmToken = await this.getFcmToken();
    if (!fcmToken) return;

    const lastRegistered = await this.getLastRegisteredToken();
    if (lastRegistered === fcmToken) return;

    const deviceId = await deviceService.getHashedDeviceId();
    if (!deviceId) return;
    const deviceSpec = this.buildDeviceSpec(deviceService.getSpec());
    const config = await NativeConfigServiceInstance.load();

    // Backend stores device_spec and uaspec as Postgres `json` columns and
    // expects stringified JSON in the request (matches Sunbird DeviceController).
    const body = {
      request: {
        fcmToken,
        producer_id: config.producerId,
        device_spec: JSON.stringify(deviceSpec),
        uaspec: JSON.stringify({ agent: navigator.userAgent }),
      },
    };

    try {
      await getClient().post(`/user/device/v1/register/${deviceId}`, body);
      await Preferences.set({ key: LAST_REGISTERED_FCM_TOKEN_KEY, value: fcmToken });
    } catch (err) {
      console.warn('[PushNotificationService] Device registration failed', err);
    }
  }

  private buildDeviceSpec(raw: Record<string, unknown>): Record<string, unknown> {
    const trimmed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value === 0 || value === '' || (Array.isArray(value) && value.length === 0)) continue;
      trimmed[key] = value;
    }
    return trimmed;
  }

  private async getLastRegisteredToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: LAST_REGISTERED_FCM_TOKEN_KEY });
    return value;
  }

  private async storeFcmToken(token: string): Promise<void> {
    await Preferences.set({ key: FCM_TOKEN_KEY, value: token });
  }

  async getFcmToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: FCM_TOKEN_KEY });
    return value;
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
