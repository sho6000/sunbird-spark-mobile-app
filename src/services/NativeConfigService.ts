import { Capacitor, registerPlugin } from '@capacitor/core';

const PLUGIN_NAME = 'NativeSetting';

const NativeSetting = registerPlugin<{
  read(options: { key: string }): Promise<{ value: string | undefined }>;
}>(PLUGIN_NAME);

export type NativeConfig = {
  baseUrl: string;
  mobileAppConsumer: string;
  mobileAppKey: string;
  mobileAppSecret: string;
  producerId: string;
  appVersion: string;
  enableAiSearch: boolean;
};

const EMPTY_CONFIG: NativeConfig = {
  baseUrl: '',
  mobileAppConsumer: '',
  mobileAppKey: '',
  mobileAppSecret: '',
  producerId: '',
  appVersion: '',
  enableAiSearch: true,
};

class NativeConfigService {
  private config: NativeConfig | null = null;
  private loadPromise: Promise<NativeConfig> | null = null;

  async load(): Promise<NativeConfig> {
    if (this.config) return this.config;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.doLoad();
    return this.loadPromise;
  }

  private async doLoad(): Promise<NativeConfig> {
    if (Capacitor.getPlatform() !== 'android') {
      return { ...EMPTY_CONFIG };
    }

    try {
      const [baseUrl, mobileAppConsumer, mobileAppKey, mobileAppSecret, producerId, appVersion, enableAiSearchRaw] =
        await Promise.all(
          [
            'base_url',
            'mobile_app_consumer',
            'mobile_app_key',
            'mobile_app_secret',
            'producer_id',
            'app_version',
            'enable_ai_search',
          ].map((key) => NativeSetting.read({ key }).then((r) => r.value ?? '')),
        );

      this.config = { baseUrl, mobileAppConsumer, mobileAppKey, mobileAppSecret, producerId, appVersion, enableAiSearch: enableAiSearchRaw.toLowerCase() !== 'false', };
      return this.config;
    } catch (error) {
      console.error('[NativeConfigService] Failed to load config:', error);
      this.loadPromise = null;
      return { ...EMPTY_CONFIG };
    }
  }
}

export const NativeConfigServiceInstance = new NativeConfigService();
