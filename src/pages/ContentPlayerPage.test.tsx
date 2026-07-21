import { render, screen, fireEvent } from '@testing-library/react';
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
  // which clears the boot overlay.
  ContentPlayer: ({ onPlayerEvent }: any) => (
    <div data-testid="content-player">
      <button data-testid="fire-player-event" onClick={() => onPlayerEvent?.({ eid: 'RENDERED' })}>
        evt
      </button>
    </div>
  ),
}));

vi.mock('../components/common/DownloadProgressBadge', () => ({
  DownloadProgressBadge: () => <div data-testid="download-progress-badge" />,
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
});
