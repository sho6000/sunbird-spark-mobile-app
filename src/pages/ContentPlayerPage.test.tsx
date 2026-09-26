import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ContentPlayerPage from './ContentPlayerPage';

vi.mock('@ionic/react', () => ({
  IonPage: ({ children, className }: any) => <div data-testid="ion-page" className={className}>{children}</div>,
  IonHeader: ({ children, className }: any) => <div>{children}</div>,
  IonToolbar: ({ children, className }: any) => <div>{children}</div>,
  IonContent: ({ children, scrollY }: any) => <div>{children}</div>,
  IonIcon: ({ icon }: any) => <span data-icon={icon} />,
  IonImg: ({ src, alt, className }: any) => <img src={src} alt={alt} className={className} />,
  IonToast: () => null,
  IonAlert: () => null,
  useIonRouter: () => ({ push: vi.fn(), goBack: vi.fn() }),
}));

vi.mock('ionicons/icons', () => ({
  cloudOfflineOutline: 'cloud-offline',
  checkmarkCircle: 'checkmark-circle',
  alertCircleOutline: 'alert-circle',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: any) => key }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ contentId: 'do_test_123' }),
}));

vi.mock('@capacitor/screen-orientation', () => ({
  ScreenOrientation: {
    lock: vi.fn().mockResolvedValue(undefined),
    unlock: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../hooks/useContent', () => ({
  useContentRead: vi.fn(),
}));

vi.mock('../hooks/useQumlContent', () => ({
  useQumlContent: vi.fn(),
}));

vi.mock('../hooks/useContentSearch', () => ({
  useContentSearch: vi.fn(),
}));

vi.mock('../hooks/useDownloadState', () => ({
  useDownloadState: vi.fn(),
}));

vi.mock('../hooks/useIsContentLocal', () => ({
  useIsContentLocal: vi.fn(),
}));

vi.mock('../providers/NetworkProvider', () => ({
  useNetwork: vi.fn(),
}));

vi.mock('../components/players/ContentPlayer', () => ({
  // Exposes a button so tests can simulate the player's first event,
  // which clears the boot overlay. Also surfaces the received metadata as
  // JSON so tests can assert on what actually reaches the player.
  ContentPlayer: ({ onPlayerEvent, metadata }: any) => (
    <div data-testid="content-player">
      <pre data-testid="content-player-metadata">{JSON.stringify(metadata)}</pre>
      <button data-testid="fire-player-event" onClick={() => onPlayerEvent?.({ eid: 'RENDERED' })}>
        evt
      </button>
    </div>
  ),
}));

vi.mock('../components/common/DownloadProgressBadge', () => ({
  DownloadProgressBadge: ({ onDownload }: any) => (
    <div data-testid="download-progress-badge">
      <button data-testid="trigger-download" onClick={onDownload}>download</button>
    </div>
  ),
}));

vi.mock('../components/collection/RelatedContent', () => ({
  default: () => <div data-testid="related-content" />,
}));

vi.mock('../services/content/contentDownloadHelper', () => ({
  startContentDownload: vi.fn(),
}));

vi.mock('../services/content/contentDeleteHelper', () => ({
  deleteDownloadedContent: vi.fn(),
}));

vi.mock('../services/content/hierarchyUtils', () => ({
  NON_DOWNLOADABLE_MIME_TYPES: [],
}));

vi.mock('../services/content/contentPlaybackResolver', () => ({
  resolveContentForPlayer: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/db/ContentDbService', () => ({
  contentDbService: {
    getByIdentifier: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../services/relatedContentMapper', () => ({
  mapSearchContentToRelatedContentItems: vi.fn().mockReturnValue([]),
}));

vi.mock('../services/download_manager', () => ({
  downloadManager: {
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    getEntry: vi.fn().mockResolvedValue(null),
    retry: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  },
  importService: {
    downloadTranscripts: vi.fn().mockResolvedValue(undefined),
  },
  DownloadState: {
    QUEUED: 'QUEUED',
    DOWNLOADING: 'DOWNLOADING',
    PAUSED: 'PAUSED',
    DOWNLOADED: 'DOWNLOADED',
    IMPORTING: 'IMPORTING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    RETRY_WAIT: 'RETRY_WAIT',
  },
}));

vi.mock('../components/icons/CollectionIcons', () => ({
  BackIcon: () => (
    <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true">
      <path d="M10 2L2 10L10 18" />
    </svg>
  ),
}));

vi.mock('../components/common/PageLoader', () => ({
  default: ({ message, error }: any) =>
    message
      ? <div role="status" aria-live="polite">{message}</div>
      : error
        ? <div role="alert">{error}</div>
        : null,
}));

vi.mock('../services/TelemetryService', () => ({
  telemetryService: { save: vi.fn() },
}));

vi.mock('../components/telemetry/TelemetryTracker', () => ({
  TelemetryTracker: () => null,
}));

vi.mock('../hooks/useImpression', () => ({ default: vi.fn() }));
vi.mock('./ContentPlayerPage.css', () => ({}));

import { useContentRead } from '../hooks/useContent';
import { useQumlContent } from '../hooks/useQumlContent';
import { useContentSearch } from '../hooks/useContentSearch';
import { useDownloadState } from '../hooks/useDownloadState';
import { useIsContentLocal } from '../hooks/useIsContentLocal';
import { useNetwork } from '../providers/NetworkProvider';
import { contentDbService } from '../services/db/ContentDbService';
import { startContentDownload } from '../services/content/contentDownloadHelper';
import { importService } from '../services/download_manager';

describe('ContentPlayerPage — accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNetwork as any).mockReturnValue({ isOffline: false });
    (useContentRead as any).mockReturnValue({
      data: {
        data: {
          content: {
            name: 'Test Content',
            appIcon: '',
            mimeType: 'application/pdf',
            identifier: 'do_test_123',
            contentType: 'Resource',
          },
        },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      fetchStatus: 'idle',
    });
    (useQumlContent as any).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    (useContentSearch as any).mockReturnValue({ data: null, isLoading: false });
    (useDownloadState as any).mockReturnValue(null);
    (useIsContentLocal as any).mockReturnValue({ isLocal: false, isCheckPending: false });
  });

  it('back button has aria-label="back"', () => {
    render(<ContentPlayerPage />);
    const backBtn = screen.getByRole('button', { name: 'back' });
    expect(backBtn).toBeInTheDocument();
  });

  it('back button SVG icon has aria-hidden="true"', () => {
    const { container } = render(<ContentPlayerPage />);
    const backBtn = container.querySelector('[aria-label="back"]');
    const svg = backBtn?.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('play button has aria-label containing "playItem"', () => {
    render(<ContentPlayerPage />);
    const playBtn = screen.getByRole('button', { name: 'playItem' });
    expect(playBtn).toBeInTheDocument();
  });

  it('play icon SVG inside play button has aria-hidden="true"', () => {
    const { container } = render(<ContentPlayerPage />);
    const playBtn = container.querySelector('.cp-player-area');
    const svg = playBtn?.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows loading state when content is loading', () => {
    (useContentRead as any).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      fetchStatus: 'fetching',
    });
    render(<ContentPlayerPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows error state when content fails to load', () => {
    (useContentRead as any).mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: 'Network error' },
      refetch: vi.fn(),
      fetchStatus: 'idle',
    });
    render(<ContentPlayerPage />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows offline message when network is offline', () => {
    (useNetwork as any).mockReturnValue({ isOffline: true });
    render(<ContentPlayerPage />);
    // Offline state renders something - no crash
    expect(screen.getByTestId('ion-page')).toBeInTheDocument();
  });

  it('renders with downloadable content', () => {
    (useDownloadState as any).mockReturnValue({
      status: 'NOT_STARTED',
      progress: 0,
    });
    (useIsContentLocal as any).mockReturnValue({ isLocal: false, isCheckPending: false });
    render(<ContentPlayerPage />);
    expect(screen.getByTestId('ion-page')).toBeInTheDocument();
  });

  it('renders when content is locally available', () => {
    (useIsContentLocal as any).mockReturnValue({ isLocal: true, isCheckPending: false });
    render(<ContentPlayerPage />);
    expect(screen.getByTestId('ion-page')).toBeInTheDocument();
  });

  it('renders with video mimeType content', () => {
    (useContentRead as any).mockReturnValue({
      data: {
        data: {
          content: {
            name: 'Test Video',
            appIcon: '',
            mimeType: 'video/mp4',
            identifier: 'do_video_1',
            contentType: 'Resource',
          },
        },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      fetchStatus: 'idle',
    });
    render(<ContentPlayerPage />);
    expect(screen.getByTestId('ion-page')).toBeInTheDocument();
  });

  it('downloads with the enriched content (including enrichment.transcriptUrl) for video content', () => {
    (useContentRead as any).mockReturnValue({
      data: {
        data: {
          content: {
            name: 'Test Video',
            appIcon: '',
            mimeType: 'video/mp4',
            identifier: 'do_video_1',
            contentType: 'Resource',
            downloadUrl: 'https://cdn/do_video_1.ecar',
            enrichment: { transcriptUrl: 'https://cdn/do_video_1_transcripts.ecar' },
          },
        },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      fetchStatus: 'idle',
    });
    (useIsContentLocal as any).mockReturnValue({ isLocal: false, isCheckPending: false });

    render(<ContentPlayerPage />);
    fireEvent.click(screen.getByTestId('trigger-download'));

    expect(startContentDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'do_video_1',
        enrichment: { transcriptUrl: 'https://cdn/do_video_1_transcripts.ecar' },
      }),
      expect.anything(),
    );
  });

  it('backfills the caption download for already-downloaded content whose transcripts were not ready at download time', async () => {
    (useContentRead as any).mockReturnValue({
      data: {
        data: {
          content: {
            name: 'Test Video',
            mimeType: 'video/mp4',
            identifier: 'do_test_123',
            contentType: 'Resource',
            enrichment: { transcriptUrl: 'https://cdn/do_test_123_transcripts.ecar' },
            transcripts: [{ language: 'English', identifier: 'do_test_123_en', languageCode: 'en', artifactUrl: 'https://cdn/en.vtt' }],
          },
        },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      fetchStatus: 'idle',
    });
    (useIsContentLocal as any).mockReturnValue({ isLocal: true, isCheckPending: false });
    (contentDbService.getByIdentifier as any).mockResolvedValue({
      identifier: 'do_test_123',
      // local_data was written before transcripts existed - no transcripts field at all.
      local_data: JSON.stringify({ identifier: 'do_test_123', mimeType: 'video/mp4' }),
    });

    await act(async () => {
      render(<ContentPlayerPage />);
    });

    // The raw (remote-URL) transcripts from the enriched read are forwarded so
    // downloadTranscripts can seed local_data/server_data with them directly,
    // instead of depending on ContentService.contentRead's DB-write side effect
    // having already run first.
    await vi.waitFor(() => {
      expect(importService.downloadTranscripts).toHaveBeenCalledWith(
        'do_test_123',
        'https://cdn/do_test_123_transcripts.ecar',
        [{ language: 'English', identifier: 'do_test_123_en', languageCode: 'en', artifactUrl: 'https://cdn/en.vtt' }],
      );
    });
  });

  it('does not re-download captions when local_data already has transcripts', async () => {
    (useContentRead as any).mockReturnValue({
      data: {
        data: {
          content: {
            name: 'Test Video',
            mimeType: 'video/mp4',
            identifier: 'do_test_123',
            contentType: 'Resource',
            enrichment: { transcriptUrl: 'https://cdn/do_test_123_transcripts.ecar' },
          },
        },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      fetchStatus: 'idle',
    });
    (useIsContentLocal as any).mockReturnValue({ isLocal: true, isCheckPending: false });
    (contentDbService.getByIdentifier as any).mockResolvedValue({
      identifier: 'do_test_123',
      local_data: JSON.stringify({
        identifier: 'do_test_123',
        mimeType: 'video/mp4',
        transcripts: [{ language: 'English', identifier: 'c_en', languageCode: 'en', artifactUrl: 'transcripts/en/captions.vtt' }],
      }),
    });

    await act(async () => {
      render(<ContentPlayerPage />);
    });

    expect(importService.downloadTranscripts).not.toHaveBeenCalled();
  });
});

describe('ContentPlayerPage — player loading states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNetwork as any).mockReturnValue({ isOffline: false });
    (useContentRead as any).mockReturnValue({
      data: {
        data: {
          content: {
            name: 'Test Content',
            appIcon: '',
            mimeType: 'application/pdf',
            identifier: 'do_test_123',
            contentType: 'Resource',
          },
        },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      fetchStatus: 'idle',
    });
    (useQumlContent as any).mockReturnValue({ data: null, isLoading: false, error: null, refetch: vi.fn() });
    (useContentSearch as any).mockReturnValue({ data: null, isLoading: false });
    (useDownloadState as any).mockReturnValue(null);
    (useIsContentLocal as any).mockReturnValue({ isLocal: false, isCheckPending: false });
  });

  it('shows the download progress loader when playing content that is still downloading', () => {
    (useDownloadState as any).mockReturnValue({ state: 'DOWNLOADING', progress: 42 });
    render(<ContentPlayerPage />);

    // Tap play before the download has finished.
    fireEvent.click(screen.getByRole('button', { name: 'playItem' }));

    // Progress loader is shown instead of the (not-yet-ready) player.
    expect(screen.getByText('download.downloading')).toBeInTheDocument();
    expect(screen.queryByTestId('content-player')).not.toBeInTheDocument();
  });

  it('shows the boot overlay until the player emits its first event, then clears it', () => {
    render(<ContentPlayerPage />);

    fireEvent.click(screen.getByRole('button', { name: 'playItem' }));

    // Overlay loader covers the player while it boots.
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(screen.getByTestId('content-player')).toBeInTheDocument();

    // The player's first event clears the overlay.
    fireEvent.click(screen.getByTestId('fire-player-event'));
    expect(screen.queryByText('loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('content-player')).toBeInTheDocument();
  });

  it('keeps the loader up (does not mount the player) while a captions refetch is in flight, even though isLoading is already false', () => {
    // Base read resolves immediately (video content, already downloaded once
    // before - this is a refetch scenario, e.g. handleRetry's post-download
    // refetchEnrichedVideo()). The enriched read has already succeeded once
    // (isLoading: false) but is now mid-refetch (isFetching: true) - React
    // Query's isLoading only ever covers the FIRST fetch, so a naive
    // `isCaptionsPending = isEnrichedVideoLoading` would miss this refetch
    // entirely and let the player mount with stale/captions-less data.
    (useContentRead as any).mockImplementation((_id: string, options?: any) => {
      if (options?.enrichTranscripts) {
        return {
          data: { data: { content: { identifier: 'do_test_123', mimeType: 'video/mp4' } } },
          isLoading: false,
          isFetching: true,
          error: null,
          refetch: vi.fn(),
          fetchStatus: 'fetching',
        };
      }
      return {
        data: {
          data: {
            content: {
              name: 'Test Video',
              mimeType: 'video/mp4',
              identifier: 'do_test_123',
              contentType: 'Resource',
            },
          },
        },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
        fetchStatus: 'idle',
      };
    });

    render(<ContentPlayerPage />);
    fireEvent.click(screen.getByRole('button', { name: 'playItem' }));

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(screen.queryByTestId('content-player')).not.toBeInTheDocument();
  });
});

describe('ContentPlayerPage — offline local_data fallback merges transcripts from server_data', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { resolveContentForPlayer } = await import('../services/content/contentPlaybackResolver');
    // Pass metadata through unchanged instead of the module-level mockResolvedValue({}),
    // so this test can assert on the transcripts merged in by the fallback effect.
    (resolveContentForPlayer as any).mockImplementation((_id: string, metadata: any) => Promise.resolve(metadata));

    (useNetwork as any).mockReturnValue({ isOffline: true });
    // React Query pauses queries entirely when offline (networkMode: 'online') -
    // queryFn (and therefore ContentService) never runs, so contentData stays
    // undefined and the component must fall back to reading contentDbService directly.
    (useContentRead as any).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      fetchStatus: 'paused',
    });
    (useQumlContent as any).mockReturnValue({ data: null, isLoading: false, error: null, refetch: vi.fn() });
    (useContentSearch as any).mockReturnValue({ data: null, isLoading: false });
    (useDownloadState as any).mockReturnValue(null);
    (useIsContentLocal as any).mockReturnValue({ isLocal: true, isCheckPending: false });
    (contentDbService.getByIdentifier as any).mockResolvedValue({
      identifier: 'do_test_123',
      mime_type: 'video/mp4',
      // local_data is the ECAR manifest item - never has transcripts.
      local_data: JSON.stringify({ name: 'Offline Video', mimeType: 'video/mp4', identifier: 'do_test_123' }),
      // server_data was cached by a prior online enrich=all read.
      server_data: JSON.stringify({
        name: 'Offline Video', mimeType: 'video/mp4', identifier: 'do_test_123',
        transcripts: [{ language: 'English', identifier: 'c_en', languageCode: 'en', artifactUrl: 'https://x/en.vtt' }],
      }),
    });
  });

  it('merges transcripts from server_data into the local_data-based fallback metadata reaching the player', async () => {
    render(<ContentPlayerPage />);

    // localFallbackMeta/resolvedMetadata are populated via async effects (contentDbService
    // lookups) - wait for the play button to actually appear before clicking it.
    const playButton = await screen.findByRole('button', { name: 'playItem' });
    fireEvent.click(playButton);

    const metadataEl = await screen.findByTestId('content-player-metadata');
    const metadata = JSON.parse(metadataEl.textContent || '{}');
    expect(metadata.transcripts).toEqual([
      { language: 'English', identifier: 'c_en', languageCode: 'en', artifactUrl: 'https://x/en.vtt' },
    ]);
  });
});
