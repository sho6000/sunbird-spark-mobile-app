import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import CollectionContentPlayer from './CollectionContentPlayer';
import { contentDbService } from '../../services/db/ContentDbService';
import { importService } from '../../services/download_manager';

// Mock Ionic components
vi.mock('@ionic/react', () => ({
  IonPage: ({ children, className }: any) => <div data-testid="ion-page" className={className}>{children}</div>,
  IonContent: ({ children, scrollY }: any) => <div data-testid="ion-content" data-scroll-y={scrollY}>{children}</div>,
}));

// Mock ScreenOrientation
const mockLock = vi.fn().mockResolvedValue(undefined);
const mockUnlock = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor/screen-orientation', () => ({
  ScreenOrientation: {
    lock: (...args: any[]) => mockLock(...args),
    unlock: (...args: any[]) => mockUnlock(...args),
  },
}));

// Mock ContentPlayer
let capturedOnPlayerEvent: ((event: any) => void) | undefined;
vi.mock('../players/ContentPlayer', () => ({
  ContentPlayer: ({ mimeType, metadata, onPlayerEvent, onTelemetryEvent }: any) => {
    capturedOnPlayerEvent = onPlayerEvent;
    return (
      <div
        data-testid="content-player"
        data-mimetype={mimeType}
        data-name={metadata?.name}
        data-transcripts={metadata?.transcripts ? JSON.stringify(metadata.transcripts) : undefined}
      >
        ContentPlayer
      </div>
    );
  },
}));

// Mock PageLoader
vi.mock('../common/PageLoader', () => ({
  default: ({ message, error, onRetry }: any) => (
    <div data-testid="page-loader" data-message={message} data-error={error}>
      {error && onRetry && (
        <button data-testid="retry-btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  ),
}));

// Mock hooks
const mockRefetch = vi.fn();
const mockRefetchQuml = vi.fn();

let mockUseContentReadReturn: any = {
  data: null,
  isLoading: true,
  error: null,
  refetch: mockRefetch,
};

let mockUseQumlContentReturn: any = {
  data: null,
  isLoading: false,
  error: null,
  refetch: mockRefetchQuml,
};

vi.mock('../../hooks/useContent', () => ({
  useContentRead: () => mockUseContentReadReturn,
}));

vi.mock('../../hooks/useQumlContent', () => ({
  useQumlContent: () => mockUseQumlContentReturn,
}));

// Mock useContentStateUpdate hook (uses useQueryClient internally)
vi.mock('../../hooks/useContentStateUpdate', () => ({
  useContentStateUpdate: () => vi.fn(),
}));

// Mock useIsContentLocal
let mockIsLocal = false;
vi.mock('../../hooks/useIsContentLocal', () => ({
  useIsContentLocal: () => ({ isLocal: mockIsLocal, isCheckPending: false }),
}));

// Mock resolveContentForPlayer
const mockResolveContentForPlayer = vi.fn();
vi.mock('../../services/content/contentPlaybackResolver', () => ({
  resolveContentForPlayer: (...args: any[]) => mockResolveContentForPlayer(...args),
}));

// Mock contentDbService (used for offline metadata fallback)
vi.mock('../../services/db/ContentDbService', () => ({
  contentDbService: {
    getByIdentifier: vi.fn().mockResolvedValue(null),
  },
}));

// Mock download_manager's importService (used for the caption backfill effect)
vi.mock('../../services/download_manager', () => ({
  importService: {
    downloadTranscripts: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock CSS import
vi.mock('../../pages/ContentPlayerPage.css', () => ({}));

// Mock useAuth — component needs userId for telemetry/sync calls
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ userId: 'test-user', isAuthenticated: true }),
}));

const mockOnClose = vi.fn();

const defaultContentData = {
  name: 'Test Video',
  mimeType: 'video/mp4',
  appIcon: 'icon.png',
};

const qumlContentData = {
  name: 'Test Quiz',
  mimeType: 'application/vnd.sunbird.questionset',
};

describe('CollectionContentPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnPlayerEvent = undefined;
    mockIsLocal = false;

    mockUseContentReadReturn = {
      data: null,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
    };

    mockUseQumlContentReturn = {
      data: null,
      isLoading: false,
      error: null,
      refetch: mockRefetchQuml,
    };
  });

  it('locks screen orientation to landscape on mount', () => {
    render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);
    expect(mockLock).toHaveBeenCalledWith({ orientation: 'landscape' });
  });

  it('unlocks screen orientation on unmount', async () => {
    const { unmount } = render(
      <CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />
    );
    unmount();
    // Orientation unlock is deferred via requestAnimationFrame
    await vi.waitFor(() => {
      expect(mockUnlock).toHaveBeenCalled();
    });
  });

  it('shows loading state while content is loading', () => {
    render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);
    const loader = screen.getByTestId('page-loader');
    expect(loader).toHaveAttribute('data-message', 'Loading content...');
  });

  it('shows error state when content fails to load', () => {
    mockUseContentReadReturn = {
      data: null,
      isLoading: false,
      error: { message: 'Network error' },
      refetch: mockRefetch,
    };

    render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);
    const loader = screen.getByTestId('page-loader');
    expect(loader).toHaveAttribute('data-error', 'Failed to load content: Network error');
  });

  it('shows fallback error when no metadata available', () => {
    mockUseContentReadReturn = {
      data: { data: { content: null } },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    };

    render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);
    const loader = screen.getByTestId('page-loader');
    expect(loader).toHaveAttribute('data-error', 'No content data available.');
  });

  it('keeps the loader up (does not mount the player) while a captions refetch is in flight, even though isLoading is already false', () => {
    // The enriched (enrich=all) read has already succeeded once (isLoading: false)
    // but is now mid-refetch (isFetching: true) - React Query's isLoading only
    // ever covers the FIRST fetch, so a naive `isCaptionsPending = isLoading`
    // would miss this refetch entirely and let the player mount with
    // stale/captions-less data it can never pick up after mount.
    mockUseContentReadReturn = {
      data: { data: { content: defaultContentData } },
      isLoading: false,
      isFetching: true,
      error: null,
      refetch: mockRefetch,
    };

    render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);

    const loader = screen.getByTestId('page-loader');
    expect(loader).toHaveAttribute('data-message', 'Loading content...');
    expect(screen.queryByTestId('content-player')).not.toBeInTheDocument();
  });

  it('renders ContentPlayer when content is loaded', () => {
    mockUseContentReadReturn = {
      data: { data: { content: defaultContentData } },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    };

    render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);
    const player = screen.getByTestId('content-player');
    expect(player).toHaveAttribute('data-mimetype', 'video/mp4');
    expect(player).toHaveAttribute('data-name', 'Test Video');
  });

  it('closes player on EXIT player event', () => {
    mockUseContentReadReturn = {
      data: { data: { content: defaultContentData } },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    };

    render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);

    expect(capturedOnPlayerEvent).toBeDefined();
    act(() => {
      // Simulate the actual wrapped event shape from player services:
      // { type: customEvent.detail.eid, data: customEvent.detail, ... }
      capturedOnPlayerEvent!({
        type: 'EXIT',
        data: { eid: 'EXIT', edata: {} },
        playerId: 'pdf-player',
        timestamp: Date.now(),
      });
    });

    expect(mockUnlock).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not close player on non-EXIT player events', () => {
    mockUseContentReadReturn = {
      data: { data: { content: defaultContentData } },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    };

    render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);

    act(() => {
      // Simulate a non-EXIT event with the actual wrapped shape
      capturedOnPlayerEvent!({
        type: 'INTERACT',
        data: { eid: 'INTERACT', edata: { type: 'TOUCH' } },
        playerId: 'pdf-player',
        timestamp: Date.now(),
      });
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('calls refetch on retry for regular content', () => {
    mockUseContentReadReturn = {
      data: null,
      isLoading: false,
      error: { message: 'Error' },
      refetch: mockRefetch,
    };

    render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId('retry-btn'));

    expect(mockRefetch).toHaveBeenCalled();
  });

  describe('QUML content', () => {
    it('shows loading when both content and QUML are loading', () => {
      mockUseContentReadReturn = {
        data: { data: { content: qumlContentData } },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      mockUseQumlContentReturn = {
        data: null,
        isLoading: true,
        error: null,
        refetch: mockRefetchQuml,
      };

      render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);
      const loader = screen.getByTestId('page-loader');
      expect(loader).toHaveAttribute('data-message', 'Loading content...');
    });

    it('uses QUML data for player metadata when content is QUML type', () => {
      const qumlPlayerData = {
        name: 'QUML Quiz',
        mimeType: 'application/vnd.sunbird.questionset',
      };

      mockUseContentReadReturn = {
        data: { data: { content: qumlContentData } },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      mockUseQumlContentReturn = {
        data: qumlPlayerData,
        isLoading: false,
        error: null,
        refetch: mockRefetchQuml,
      };

      render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);
      const player = screen.getByTestId('content-player');
      expect(player).toHaveAttribute('data-name', 'QUML Quiz');
      expect(player).toHaveAttribute('data-mimetype', 'application/vnd.sunbird.questionset');
    });

    it('shows QUML error when QUML fetch fails', () => {
      mockUseContentReadReturn = {
        data: { data: { content: qumlContentData } },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      mockUseQumlContentReturn = {
        data: null,
        isLoading: false,
        error: { message: 'QUML fetch failed' },
        refetch: mockRefetchQuml,
      };

      render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);
      const loader = screen.getByTestId('page-loader');
      expect(loader).toHaveAttribute('data-error', 'Failed to load content: QUML fetch failed');
    });

    it('calls both refetch and refetchQuml on retry for QUML content', () => {
      mockUseContentReadReturn = {
        data: { data: { content: qumlContentData } },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      mockUseQumlContentReturn = {
        data: null,
        isLoading: false,
        error: { message: 'Error' },
        refetch: mockRefetchQuml,
      };

      render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('retry-btn'));

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('renders close button in error state', () => {
    mockUseContentReadReturn = {
      data: null,
      isLoading: false,
      error: { message: 'Error' },
      refetch: mockRefetch,
    };

    render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);
    expect(screen.getByLabelText('Close player')).toBeInTheDocument();
  });

  it('calls onClose from error state close button', () => {
    mockUseContentReadReturn = {
      data: null,
      isLoading: false,
      error: { message: 'Error' },
      refetch: mockRefetch,
    };

    render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);
    fireEvent.click(screen.getByLabelText('Close player'));

    expect(mockUnlock).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  describe('offline playback', () => {
    it('shows loading state while waiting for offline URL resolution', () => {
      mockIsLocal = true;
      // resolveContentForPlayer returns a pending promise (never resolves during this test)
      mockResolveContentForPlayer.mockReturnValue(new Promise(() => { }));

      mockUseContentReadReturn = {
        data: { data: { content: { ...defaultContentData, identifier: 'do_1' } } },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);

      // Should show the loader, NOT the player
      const loader = screen.getByTestId('page-loader');
      expect(loader).toHaveAttribute('data-message', 'Loading content...');
      expect(screen.queryByTestId('content-player')).not.toBeInTheDocument();
    });

    it('resolves content for player when content is local', async () => {
      const resolvedData = {
        name: 'Test Video',
        mimeType: 'video/mp4',
        identifier: 'do_1',
        artifactUrl: 'file:///local/path/video.mp4',
        isAvailableLocally: true,
      };
      mockResolveContentForPlayer.mockResolvedValue(resolvedData);
      mockIsLocal = true;

      mockUseContentReadReturn = {
        data: { data: { content: { ...defaultContentData, identifier: 'do_1' } } },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);

      await act(async () => { });

      expect(mockResolveContentForPlayer).toHaveBeenCalledWith(
        'do_1',
        expect.objectContaining({ identifier: 'do_1', mimeType: 'video/mp4' }),
      );
      const player = screen.getByTestId('content-player');
      expect(player).toHaveAttribute('data-name', 'Test Video');
    });

    it('does not resolve content when not local', () => {
      mockIsLocal = false;

      mockUseContentReadReturn = {
        data: { data: { content: { ...defaultContentData, identifier: 'do_1' } } },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);

      expect(mockResolveContentForPlayer).not.toHaveBeenCalled();
    });

    it('merges transcripts from server_data into the local_data-based fallback metadata reaching the player', async () => {
      mockIsLocal = true;
      // Pass metadata through unchanged so the merged transcripts survive to the player.
      mockResolveContentForPlayer.mockImplementation((_id: string, metadata: any) => Promise.resolve(metadata));

      // React Query pauses queries entirely when offline - contentData stays
      // undefined and the component must fall back to reading contentDbService directly.
      mockUseContentReadReturn = {
        data: undefined,
        isLoading: false,
        error: null,
        fetchStatus: 'paused',
        refetch: mockRefetch,
      };

      (contentDbService.getByIdentifier as any).mockResolvedValue({
        identifier: 'do_1',
        mime_type: 'video/mp4',
        // local_data is the ECAR manifest item - never has transcripts.
        local_data: JSON.stringify({ name: 'Offline Video', mimeType: 'video/mp4', identifier: 'do_1' }),
        // server_data was cached by a prior online enrich=all read.
        server_data: JSON.stringify({
          name: 'Offline Video', mimeType: 'video/mp4', identifier: 'do_1',
          transcripts: [{ language: 'English', identifier: 'c_en', languageCode: 'en', artifactUrl: 'https://x/en.vtt' }],
        }),
      });

      render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);

      const player = await screen.findByTestId('content-player');
      expect(player).toHaveAttribute(
        'data-transcripts',
        JSON.stringify([{ language: 'English', identifier: 'c_en', languageCode: 'en', artifactUrl: 'https://x/en.vtt' }]),
      );
    });

    it('backfills the caption download when transcripts were not ready at download time', async () => {
      mockIsLocal = true;
      mockResolveContentForPlayer.mockImplementation((_id: string, metadata: any) => Promise.resolve(metadata));

      const rawTranscripts = [{ language: 'English', identifier: 'do_1_en', languageCode: 'en', artifactUrl: 'https://cdn/en.vtt' }];
      mockUseContentReadReturn = {
        data: {
          data: {
            content: {
              ...defaultContentData, identifier: 'do_1',
              enrichment: { transcriptUrl: 'https://cdn/do_1_transcripts.ecar' },
              transcripts: rawTranscripts,
            },
          },
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      (contentDbService.getByIdentifier as any).mockResolvedValue({
        identifier: 'do_1',
        // local_data was written before transcripts existed - no transcripts field at all.
        local_data: JSON.stringify({ name: 'Test Video', mimeType: 'video/mp4', identifier: 'do_1' }),
      });

      render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);

      // The raw (remote-URL) transcripts from the enriched read are forwarded so
      // downloadTranscripts can seed local_data/server_data with them directly,
      // instead of depending on ContentService.contentRead's DB-write side effect
      // having already run first.
      await vi.waitFor(() => {
        expect(importService.downloadTranscripts).toHaveBeenCalledWith('do_1', 'https://cdn/do_1_transcripts.ecar', rawTranscripts);
      });
    });

    it('does not re-download captions when local_data already has transcripts', async () => {
      mockIsLocal = true;
      mockResolveContentForPlayer.mockImplementation((_id: string, metadata: any) => Promise.resolve(metadata));

      mockUseContentReadReturn = {
        data: {
          data: {
            content: {
              ...defaultContentData, identifier: 'do_1',
              enrichment: { transcriptUrl: 'https://cdn/do_1_transcripts.ecar' },
            },
          },
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };

      (contentDbService.getByIdentifier as any).mockResolvedValue({
        identifier: 'do_1',
        local_data: JSON.stringify({
          name: 'Test Video', mimeType: 'video/mp4', identifier: 'do_1',
          transcripts: [{ language: 'English', identifier: 'c_en', languageCode: 'en', artifactUrl: 'transcripts/en/captions.vtt' }],
        }),
      });

      render(<CollectionContentPlayer contentId="do_1" onClose={mockOnClose} />);
      await act(async () => { });

      expect(importService.downloadTranscripts).not.toHaveBeenCalled();
    });
  });
});
