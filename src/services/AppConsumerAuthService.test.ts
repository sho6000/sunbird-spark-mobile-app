import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppConsumerAuthService } from './AppConsumerAuthService';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { SignJWT, decodeProtectedHeader } from 'jose';

// Mock dependencies
vi.mock('capacitor-secure-storage-plugin', () => ({
  SecureStoragePlugin: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('./device/deviceService', () => ({
  deviceService: {
    getHashedDeviceId: vi.fn().mockResolvedValue('mock-device-id'),
  },
}));

vi.mock('./NativeConfigService', () => ({
  NativeConfigServiceInstance: {
    load: vi.fn().mockResolvedValue({
      mobileAppKey: 'test-key',
      mobileAppSecret: 'test-secret',
      mobileAppConsumer: 'test-consumer',
      producerId: 'test-producer',
    }),
  },
}));

vi.mock('../lib/http-client', () => ({
  getClient: vi.fn().mockReturnValue({
    updateHeaders: vi.fn(),
    post: vi.fn().mockResolvedValue({
      data: {
        secret: 'mock-device-secret'
      }
    }),
  }),
}));

describe('AppConsumerAuthService', () => {
  let service: AppConsumerAuthService;
  let mockSecureStorage: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSecureStorage = SecureStoragePlugin;
    service = AppConsumerAuthService.getInstance();
    
    // Reset singleton instance for each test
    (AppConsumerAuthService as any).instance = null;
    service = AppConsumerAuthService.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AppConsumerAuthService.getInstance();
      const instance2 = AppConsumerAuthService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance if none exists', () => {
      (AppConsumerAuthService as any).instance = null;
      const instance = AppConsumerAuthService.getInstance();
      expect(instance).toBeInstanceOf(AppConsumerAuthService);
    });
  });

  describe('init', () => {
    it('should initialize successfully with valid config', async () => {
      mockSecureStorage.get.mockResolvedValue({ value: null });
      
      await service.init();
      
      expect(mockSecureStorage.get).toHaveBeenCalledTimes(2);
    });

    it('should throw error when producer ID is missing', async () => {
      const { NativeConfigServiceInstance } = await import('./NativeConfigService');
      vi.mocked(NativeConfigServiceInstance.load).mockResolvedValueOnce({
        mobileAppKey: 'test-key',
        mobileAppSecret: 'test-secret',
        mobileAppConsumer: 'test-consumer',
        producerId: '',
      });

      await expect(service.init()).rejects.toThrow('Producer ID is not configured');
    });

    it('should load valid cached app JWT', async () => {
      const validToken = await new SignJWT({ test: 'data' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
        .sign(new TextEncoder().encode('test-secret'));

      mockSecureStorage.get
        .mockResolvedValueOnce({ value: validToken })
        .mockResolvedValueOnce({ value: null });

      await service.init();
      
      expect(mockSecureStorage.get).toHaveBeenCalledTimes(2);
    });

    it('should clear expired app JWT from storage', async () => {
      const expiredToken = await new SignJWT({ test: 'data' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(new TextEncoder().encode('test-secret'));

      mockSecureStorage.get
        .mockResolvedValueOnce({ value: expiredToken })
        .mockResolvedValueOnce({ value: null });

      await service.init();
      
      expect(mockSecureStorage.remove).toHaveBeenCalledWith({
        key: 'APP_CONSUMER_JWT',
      });
    });

    it('should load valid cached device JWT', async () => {
      const validToken = await new SignJWT({ test: 'data' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
        .sign(new TextEncoder().encode('test-secret'));

      mockSecureStorage.get
        .mockResolvedValueOnce({ value: null })
        .mockResolvedValueOnce({ value: validToken });

      await service.init();
      
      expect(mockSecureStorage.get).toHaveBeenCalledTimes(2);
    });

    it('should clear expired device JWT from storage', async () => {
      const expiredToken = await new SignJWT({ test: 'data' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(new TextEncoder().encode('test-secret'));

      mockSecureStorage.get
        .mockResolvedValueOnce({ value: null })
        .mockResolvedValueOnce({ value: expiredToken });

      await service.init();
      
      expect(mockSecureStorage.remove).toHaveBeenCalledWith({
        key: 'DEVICE_CONSUMER_JWT',
      });
    });

    it('should handle storage errors gracefully', async () => {
      mockSecureStorage.get.mockRejectedValue(new Error('Storage error'));
      
      await expect(service.init()).resolves.not.toThrow();
    });

    it('should generate app JWT when not cached', async () => {
      mockSecureStorage.get.mockResolvedValue({ value: null });

      await service.init();

      expect(mockSecureStorage.set).toHaveBeenCalledWith({
        key: 'APP_CONSUMER_JWT',
        value: expect.any(String),
      });
    });

    it('should include kid=mobileAppKey in app JWT protected header', async () => {
      mockSecureStorage.get.mockResolvedValue({ value: null });

      await service.init();

      const appJwtCall = mockSecureStorage.set.mock.calls.find(
        ([arg]: [{ key: string; value: string }]) => arg.key === 'APP_CONSUMER_JWT',
      );
      expect(appJwtCall).toBeTruthy();
      const header = decodeProtectedHeader(appJwtCall[0].value);
      expect(header.alg).toBe('HS256');
      expect(header.kid).toBe('test-key');
    });
  });

  describe('generateAppJwt', () => {
    beforeEach(async () => {
      mockSecureStorage.get.mockResolvedValue({ value: null });
      await service.init();
    });

    it('should throw error when mobile app secret is empty', async () => {
      // Reset singleton to create a fresh instance
      (AppConsumerAuthService as any).instance = null;
      
      const { NativeConfigServiceInstance } = await import('./NativeConfigService');
      vi.mocked(NativeConfigServiceInstance.load).mockResolvedValueOnce({
        mobileAppKey: 'test-key',
        mobileAppSecret: '',
        mobileAppConsumer: 'test-consumer',
        producerId: 'test-producer',
      });

      mockSecureStorage.get.mockResolvedValue({ value: null });

      const newService = AppConsumerAuthService.getInstance();
      await expect(newService.init()).rejects.toThrow('Mobile app secret is not configured');
    });

    it('should throw error when mobile app secret is whitespace', async () => {
      // Reset singleton to create a fresh instance
      (AppConsumerAuthService as any).instance = null;
      
      const { NativeConfigServiceInstance } = await import('./NativeConfigService');
      vi.mocked(NativeConfigServiceInstance.load).mockResolvedValueOnce({
        mobileAppKey: 'test-key',
        mobileAppSecret: '   ',
        mobileAppConsumer: 'test-consumer',
        producerId: 'test-producer',
      });

      mockSecureStorage.get.mockResolvedValue({ value: null });

      const newService = AppConsumerAuthService.getInstance();
      await expect(newService.init()).rejects.toThrow('Mobile app secret is not configured');
    });
  });

  describe('getAuthenticatedToken', () => {
    beforeEach(async () => {
      mockSecureStorage.get.mockResolvedValue({ value: null });
      await service.init();
    });

    it('should return valid cached device JWT', async () => {
      const validToken = await new SignJWT({ test: 'data' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
        .sign(new TextEncoder().encode('test-secret'));

      // Set device JWT directly for testing
      (service as any).deviceJwt = validToken;

      const token = await service.getAuthenticatedToken();
      expect(token).toBe(validToken);
    });

    it('should clear invalid device JWT and generate new one', async () => {
      const expiredToken = await new SignJWT({ test: 'data' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(new TextEncoder().encode('test-secret'));

      // Set expired device JWT
      (service as any).deviceJwt = expiredToken;

      const token = await service.getAuthenticatedToken();
      
      expect(mockSecureStorage.remove).toHaveBeenCalledWith({
        key: 'DEVICE_CONSUMER_JWT',
      });
      expect(token).toBeTruthy();
    });

    it('should generate app JWT when not available', async () => {
      // Clear app JWT
      (service as any).appJwt = null;

      const token = await service.getAuthenticatedToken();
      
      expect(mockSecureStorage.set).toHaveBeenCalledWith({
        key: 'APP_CONSUMER_JWT',
        value: expect.any(String),
      });
      expect(token).toBeTruthy();
    });

    it('should register device and get device JWT', async () => {
      const token = await service.getAuthenticatedToken();

      expect(mockSecureStorage.set).toHaveBeenCalledWith({
        key: 'DEVICE_CONSUMER_JWT',
        value: expect.any(String),
      });
      expect(token).toBeTruthy();
      // The token should be different from app JWT since it's generated with device secret
      expect(token).not.toBe((service as any).appJwt);
    });

    it('should include kid=deviceId in device JWT protected header', async () => {
      const token = await service.getAuthenticatedToken();

      const header = decodeProtectedHeader(token);
      expect(header.alg).toBe('HS256');
      expect(header.kid).toBe('mock-device-id');
    });

    it('should fallback to app JWT when device registration fails', async () => {
      // Mock HTTP client to simulate registration failure
      const { getClient } = await import('../lib/http-client');
      const mockClient = vi.mocked(getClient());
      mockClient.post = vi.fn().mockRejectedValue(new Error('Registration failed'));

      const token = await service.getAuthenticatedToken();
      
      expect(token).toBe((service as any).appJwt);
    });
  });

  describe('isTokenValid', () => {
    it('should return false for null token', () => {
      const result = (service as any).isTokenValid(null);
      expect(result).toBe(false);
    });

    it('should return true for token without expiration', async () => {
      const tokenWithoutExp = await new SignJWT({ test: 'data' })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(new TextEncoder().encode('test-secret'));

      const result = (service as any).isTokenValid(tokenWithoutExp);
      expect(result).toBe(true);
    });

    it('should return true for valid token with future expiration', async () => {
      const validToken = await new SignJWT({ test: 'data' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
        .sign(new TextEncoder().encode('test-secret'));

      const result = (service as any).isTokenValid(validToken);
      expect(result).toBe(true);
    });

    it('should return false for expired token', async () => {
      const expiredToken = await new SignJWT({ test: 'data' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(new TextEncoder().encode('test-secret'));

      const result = (service as any).isTokenValid(expiredToken);
      expect(result).toBe(false);
    });

    it('should return false for invalid token', () => {
      const result = (service as any).isTokenValid('invalid-token');
      expect(result).toBe(false);
    });
  });

  describe('clearExpiredTokenFromStorage', () => {
    it('should remove token from storage', async () => {
      await (service as any).clearExpiredTokenFromStorage('test-key');
      
      expect(mockSecureStorage.remove).toHaveBeenCalledWith({
        key: 'test-key',
      });
    });

    it('should handle storage errors gracefully', async () => {
      mockSecureStorage.remove.mockRejectedValue(new Error('Storage error'));
      
      await expect((service as any).clearExpiredTokenFromStorage('test-key')).resolves.not.toThrow();
    });
  });

  describe('getHttpClient', () => {
    it('should return http client', async () => {
      mockSecureStorage.get.mockResolvedValue({ value: null });
      await service.init();
      
      const client = service.getHttpClient();
      expect(client).toBeDefined();
    });
  });
});