import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NativeConfigServiceInstance } from './NativeConfigService';

const mockRead = vi.hoisted(() => vi.fn());
const mockGetPlatform = vi.hoisted(() => vi.fn(() => 'android'));

vi.mock('@capacitor/core', () => ({
  registerPlugin: vi.fn(() => ({ read: mockRead })),
  Capacitor: { getPlatform: mockGetPlatform },
}));

describe('NativeConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRead.mockReset();
    mockGetPlatform.mockReturnValue('android');
    (NativeConfigServiceInstance as any).config = null;
    (NativeConfigServiceInstance as any).loadPromise = null;
  });

  describe('load', () => {
    it('should return cached config if already loaded', async () => {
      const cachedConfig = {
        baseUrl: 'cached-url',
        mobileAppConsumer: 'cached-consumer',
        mobileAppKey: 'cached-key',
        mobileAppSecret: 'cached-secret',
        producerId: 'cached-producer',
        appVersion: 'cached-version',
      };

      (NativeConfigServiceInstance as any).config = cachedConfig;

      const result = await NativeConfigServiceInstance.load();
      expect(result).toBe(cachedConfig);
      expect(mockRead).not.toHaveBeenCalled();
    });

    it('should return empty config on non-android platforms', async () => {
      mockGetPlatform.mockReturnValue('web');

      const result = await NativeConfigServiceInstance.load();

      expect(result).toEqual({
        baseUrl: '',
        mobileAppConsumer: '',
        mobileAppKey: '',
        mobileAppSecret: '',
        producerId: '',
        appVersion: '',
        enableAiSearch: true,
      });
      expect(mockRead).not.toHaveBeenCalled();
    });

    it('should read native settings in parallel on android', async () => {
      mockRead
        .mockResolvedValueOnce({ value: 'https://api.sunbird.org' })
        .mockResolvedValueOnce({ value: 'mobile_device' })
        .mockResolvedValueOnce({ value: 'mobile_app' })
        .mockResolvedValueOnce({ value: 'secret123' })
        .mockResolvedValueOnce({ value: 'sunbird.app' })
        .mockResolvedValueOnce({ value: '1.0.0' })
        .mockResolvedValueOnce({ value: 'true' });

      const result = await NativeConfigServiceInstance.load();

      expect(result).toEqual({
        baseUrl: 'https://api.sunbird.org',
        mobileAppConsumer: 'mobile_device',
        mobileAppKey: 'mobile_app',
        mobileAppSecret: 'secret123',
        producerId: 'sunbird.app',
        appVersion: '1.0.0',
        enableAiSearch: true,
      });

      expect(mockRead).toHaveBeenCalledTimes(7);
      expect(mockRead).toHaveBeenCalledWith({ key: 'base_url' });
      expect(mockRead).toHaveBeenCalledWith({ key: 'mobile_app_consumer' });
      expect(mockRead).toHaveBeenCalledWith({ key: 'mobile_app_key' });
      expect(mockRead).toHaveBeenCalledWith({ key: 'mobile_app_secret' });
      expect(mockRead).toHaveBeenCalledWith({ key: 'producer_id' });
      expect(mockRead).toHaveBeenCalledWith({ key: 'app_version' });
      expect(mockRead).toHaveBeenCalledWith({ key: 'enable_ai_search' });
    });

    it('should handle null/undefined values from native settings', async () => {
      mockRead.mockResolvedValue({ value: undefined });

      const result = await NativeConfigServiceInstance.load();

      expect(result).toEqual({
        baseUrl: '',
        mobileAppConsumer: '',
        mobileAppKey: '',
        mobileAppSecret: '',
        producerId: '',
        appVersion: '',
        enableAiSearch: true,
      });
    });

    it('should return empty config and allow retry when native reading fails', async () => {
      mockRead.mockRejectedValue(new Error('Native read failed'));

      const result = await NativeConfigServiceInstance.load();

      expect(result).toEqual({
        baseUrl: '',
        mobileAppConsumer: '',
        mobileAppKey: '',
        mobileAppSecret: '',
        producerId: '',
        appVersion: '',
        enableAiSearch: true,
      });

      expect((NativeConfigServiceInstance as any).loadPromise).toBeNull();
    });

    it('should cache config after successful load', async () => {
      mockRead
        .mockResolvedValueOnce({ value: 'https://api.sunbird.org' })
        .mockResolvedValueOnce({ value: 'mobile_device' })
        .mockResolvedValueOnce({ value: 'mobile_app' })
        .mockResolvedValueOnce({ value: 'secret123' })
        .mockResolvedValueOnce({ value: 'sunbird.app' })
        .mockResolvedValueOnce({ value: '1.0.0' })
        .mockResolvedValueOnce({ value: 'true' });

      const result1 = await NativeConfigServiceInstance.load();
      const result2 = await NativeConfigServiceInstance.load();

      expect(result1).toBe(result2);
      expect(mockRead).toHaveBeenCalledTimes(7);
    });

    it('should deduplicate concurrent calls', async () => {
      mockRead
        .mockResolvedValueOnce({ value: 'https://api.sunbird.org' })
        .mockResolvedValueOnce({ value: 'mobile_device' })
        .mockResolvedValueOnce({ value: 'mobile_app' })
        .mockResolvedValueOnce({ value: 'secret123' })
        .mockResolvedValueOnce({ value: 'sunbird.app' })
        .mockResolvedValueOnce({ value: '1.0.0' })
        .mockResolvedValueOnce({ value: 'true' });

      const [result1, result2] = await Promise.all([
        NativeConfigServiceInstance.load(),
        NativeConfigServiceInstance.load(),
      ]);

      expect(result1).toBe(result2);
      expect(mockRead).toHaveBeenCalledTimes(7);
    });

    it('should handle partial native setting failures', async () => {
      mockRead.mockRejectedValue(new Error('Failed to read consumer'));

      const result = await NativeConfigServiceInstance.load();

      expect(result).toEqual({
        baseUrl: '',
        mobileAppConsumer: '',
        mobileAppKey: '',
        mobileAppSecret: '',
        producerId: '',
        appVersion: '',
        enableAiSearch: true,
      });
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(NativeConfigServiceInstance).toBeDefined();
      expect(typeof NativeConfigServiceInstance.load).toBe('function');
    });

    it('should maintain state across calls', async () => {
      mockRead
        .mockResolvedValueOnce({ value: 'https://api.sunbird.org' })
        .mockResolvedValueOnce({ value: 'mobile_device' })
        .mockResolvedValueOnce({ value: 'mobile_app' })
        .mockResolvedValueOnce({ value: 'secret123' })
        .mockResolvedValueOnce({ value: 'sunbird.app' })
        .mockResolvedValueOnce({ value: '1.0.0' })
        .mockResolvedValueOnce({ value: 'true' });

      await NativeConfigServiceInstance.load();
      const config = (NativeConfigServiceInstance as any).config;

      expect(config).toBeDefined();
      expect(config.baseUrl).toBe('https://api.sunbird.org');
    });
  });
});
