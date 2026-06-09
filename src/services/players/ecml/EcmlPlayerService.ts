import _ from 'lodash';
import { EcmlPlayerConfig, EcmlPlayerContextProps, EcmlPlayerMetadata } from './types';
import { buildEcmlPlayerContext } from '../PlayerContextService';
import { NativeConfigServiceInstance } from '../../NativeConfigService';
import { toAssetsPublicPath } from '../../content/contentPlaybackResolver';

// webview=true: renderer enters preview mode (needed for postMessage config delivery)
const PREVIEW_URL = '/content-player/preview.html?webview=true';

export class EcmlPlayerService {
  async createConfig(
    metadata: EcmlPlayerMetadata,
    contextProps?: EcmlPlayerContextProps
  ) {
    const context = await buildEcmlPlayerContext(metadata.identifier, contextProps);

    const isLocal = !!metadata.isAvailableLocally && !!metadata.basePath;
    const rawBasePath = (isLocal ? metadata.basePath || '' : '').trim();
    const mimeType = String(metadata.mimeType || '');
    const isH5pOrHtml = mimeType === 'application/vnd.ekstep.h5p-archive' || mimeType === 'application/vnd.ekstep.html-archive';
    const isScorm = mimeType === 'application/vnd.ekstep.scorm-archive';

    // Extreme sanitation: ensure exactly one trailing slash and no surrounding whitespace
    const safeBaseDir = rawBasePath ? (rawBasePath.replace(/\/+$/, '') + '/') : '';
    const basePath = safeBaseDir;

    // Standard core plugins directory relative to the app origin.
    const corePluginsRepo = '/content-player/coreplugins';
    const repos: string[] = [corePluginsRepo];

    const config: EcmlPlayerConfig["config"] = {
      showEndPage: false,
      endPage: [{ template: 'assessment', contentType: ['SelfAssess'] }],
      showStartPage: true,
      apislug: '/action',
      overlay: { showUser: false },
      splash: {
        text: '',
        icon: '',
        bgImage: 'assets/icons/splacebackground_1.png',
        webLink: '',
      },
      plugins: [
        { id: 'org.sunbird.player.endpage', ver: 1.1, type: 'plugin' },
        { id: 'org.sunbird.iframeEvent', ver: 1.0, type: 'plugin' },
      ],
      sideMenu: {
        showShare: false,
        showDownload: false,
        showExit: true,
        showPrint: false,
        showReplay: true,
      },
      enableTelemetryValidation: false,
      telemetryConfig: {
        origin: 'sunbird-portal',
        pdata: context.pdata,
        env: 'contentplayer',
        channel: context.channel,
        did: context.did,
        sid: context.sid,
        uid: context.uid,
        endpoint: '',
        host: '',
        authtoken: '',
        dispatcher: 'postMessage'
      }
    };

    if (isLocal && basePath) {
      // --- LOCAL (OFFLINE) CONFIGURATION ---
      config.host = basePath;
      config.baseURL = basePath;

      // Use asset-path to keep standard stage assets pointing to the root assets folder
      config['asset-path'] = `${basePath}assets/`;

      // Use numeric dummy values to prevent 'BUILD_NUMBER' fallback string in query params
      config.build_number = '1.0';
      config.version = '1.0';

      // Use '/widgets/content-plugins' for device plugins to match the legacy mobile ECAR structure
      config.devicePluginspath = '/widgets/content-plugins';
      config.previewPluginspath = '/content-plugins';

      // Order: 1. Content-specific plugins, 2. Legacy assets/content-plugins, 3. Content Root, ...
      repos.unshift(`${basePath}content-plugins`);
      repos.unshift(`${basePath}assets/content-plugins`);
      repos.unshift(`${basePath}widgets/content-plugins`);
      repos.push(basePath);

      try {
        const parts = basePath.trim().replace(/\/+$/, '').split('/');
        if (parts.length > 2) {
          const sharedRepo = parts.slice(0, -1).join('/') + '/';
          repos.push(sharedRepo);
        }
      } catch (e) {
        console.warn('[EcmlPlayerService] Could not resolve shared content repo:', e);
      }
    } else {
      // --- ONLINE (STREAMING) CONFIGURATION ---
      config.host = '';
      config.baseURL = '';

      // H5P/HTML: the renderer uses streamingUrl as the iframe src base path.
      // CDN streamingUrls (blob storage) cause cross-origin errors. Rewrite to
      // a same-origin /assets/public/... path that the Android proxy intercepts.
      if ((isH5pOrHtml || isScorm) && metadata.streamingUrl) {
        const sameOriginPath = toAssetsPublicPath(metadata.streamingUrl);
        if (sameOriginPath) {
          metadata = { ...metadata, streamingUrl: sameOriginPath };
        }
      }
    }

    config.repos = _.uniq(repos);

    // Flatten metadata at the root level for the renderer's GlobalContext
    const wrappedMetadata: Record<string, unknown> = {
      ...metadata,
      contentData: {
        ...metadata,
        build_number: '',
        version: '',
      },
      path: basePath, // <--- CRITICAL: Overwrite path as renderer uses t.path for e.path local resolution
      basePath: basePath,
      baseDir: basePath,
      isAvailableLocally: isLocal,
      build_number: '',
      version: '',
    };

    // Ensure the legacy renderer's GlobalContext.user is populated for plugin compatibility (like Endpage)
    if (context && !context['user']) {
      context['user'] = {
        name: context.userData?.firstName || 'Guest',
        handle: context.userData?.firstName || 'Guest',
      };
    }

    // YouTube embeds require an origin parameter matching the hosting domain
    // for the IFrame API to work. Pass the base_url from native config.
    if (metadata.mimeType === 'video/x-youtube') {
      try {
        const nativeConfig = await NativeConfigServiceInstance.load();
        if (nativeConfig.baseUrl) {
          context.origin = nativeConfig.baseUrl;
        }
      } catch {
        console.warn('[EcmlPlayerService] Could not resolve native config for YouTube origin');
      }
    }

    // Determine body structure. Passing an empty object {} makes the renderer assume
    // the JSON is already there, skipping an AJAX fetch for index.json. Passing null
    // forces an AJAX fetch to globalConfig.basepath (streamingUrl).
    // For H5P/HTML online, we must pass {} because there is no index.json and pulling
    // from an external streamingUrl via AJAX crashes the player due to CORS.
    let dataPayload: Record<string, any> | null = !_.isEmpty(metadata.body) ? metadata.body : null;

    if ((isH5pOrHtml || isScorm) && !isLocal && !dataPayload) {
      dataPayload = {};
    }

    return {
      context,
      config,
      metadata: wrappedMetadata,
      data: dataPayload,
    };
  }

  buildPlayerUrl(): string {
    return PREVIEW_URL;
  }
}