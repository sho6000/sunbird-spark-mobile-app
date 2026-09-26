import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonImg,
  IonPage,
  IonToolbar,
  IonToast,
  IonAlert,
} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useIonRouter } from '@ionic/react';
import { cloudOfflineOutline, checkmarkCircle, alertCircleOutline } from 'ionicons/icons';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { useTranslation } from 'react-i18next';
import { ContentPlayer } from '../components/players/ContentPlayer';
import { useContentRead } from '../hooks/useContent';
import { useQumlContent } from '../hooks/useQumlContent';
import { useContentSearch } from '../hooks/useContentSearch';
import { useDownloadState } from '../hooks/useDownloadState';
import { useIsContentLocal } from '../hooks/useIsContentLocal';
import { useNetwork } from '../providers/NetworkProvider';
import { DownloadProgressBadge } from '../components/common/DownloadProgressBadge';
import RelatedContent from '../components/collection/RelatedContent';
import { startContentDownload } from '../services/content/contentDownloadHelper';
import { deleteDownloadedContent } from '../services/content/contentDeleteHelper';
import { NON_DOWNLOADABLE_MIME_TYPES } from '../services/content/hierarchyUtils';
import { resolveContentForPlayer } from '../services/content/contentPlaybackResolver';
import { contentDbService } from '../services/db/ContentDbService';
import { mergeTranscriptsFromServerData } from '../services/ContentService';
import { mapSearchContentToRelatedContentItems } from '../services/relatedContentMapper';
import { downloadManager, DownloadState, importService } from '../services/download_manager';
import { BackIcon } from '../components/icons/CollectionIcons';
import PageLoader from '../components/common/PageLoader';
import { telemetryService } from '../services/TelemetryService';
import './ContentPlayerPage.css';
import useImpression from '../hooks/useImpression';
import { TelemetryTracker } from '../components/telemetry/TelemetryTracker';

const QUML_MIME_TYPES = [
  'application/vnd.sunbird.questionset',
  'application/vnd.sunbird.question',
];

const ContentPlayerPage: React.FC = () => {
  useImpression({ pageid: 'ContentPlayerPage', env: 'contentplayer' });
  const { contentId } = useParams<{ contentId: string }>();
  const router = useIonRouter();
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t('pageTitle.contentPlayer')}`;
  }, [t]);

  const { isOffline } = useNetwork();
  const [isPlaying, setIsPlaying] = useState(false);
  // False from the moment "play" is tapped until the embedded player paints its
  // first frame (signalled by its first player/telemetry event). Drives an opaque
  // loading overlay so there's no blank/black flash while the player boots.
  const [playerReady, setPlayerReady] = useState(false);

  type ToastConfig = { message: string; color: 'success' | 'danger' | 'warning' | 'primary' | 'dark'; icon?: string };
  const [toastConfig, setToastConfig] = useState<ToastConfig | null>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const { data, isLoading, error, refetch, fetchStatus } = useContentRead(contentId);
  const contentData = data?.data?.content;

  // Offline, the content-read API is paused so contentData is undefined. Read the
  // mime type from the local DB so QuML detection still works for downloaded content.
  const [localMimeType, setLocalMimeType] = useState<string | undefined>();
  useEffect(() => {
    if (!contentId) return;
    let cancelled = false;
    contentDbService
      .getByIdentifier(contentId)
      .then((entry) => { if (!cancelled) setLocalMimeType(entry?.mime_type || undefined); })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [contentId]);

  const effectiveMimeType = contentData?.mimeType ?? localMimeType;
  const isQumlContent = QUML_MIME_TYPES.includes(effectiveMimeType as string);
  const isNonDownloadable = !!(effectiveMimeType && NON_DOWNLOADABLE_MIME_TYPES.includes(effectiveMimeType));
  const isVideoContent = !!effectiveMimeType?.startsWith('video/');

  const {
    data: qumlData,
    isLoading: isQumlLoading,
    error: qumlError,
    refetch: refetchQuml,
  } = useQumlContent(contentId, { enabled: isQumlContent });

  // enrich=all (transcripts) is only fetched for actual video content - this
  // page also renders PDF/EPUB/ECML/QUML, which have no use for it. Fired as
  // a second read (mimeType isn't known until the base read above resolves),
  // and only blocks the fullscreen player mount below (isCaptionsPending),
  // not the detail-view loading state - browsing the detail page shouldn't
  // wait on captions that are only needed once playback actually starts.
  const {
    data: enrichedVideoData,
    isLoading: isEnrichedVideoLoading,
    isFetching: isEnrichedVideoFetching,
    refetch: refetchEnrichedVideo,
  } = useContentRead(contentId, { enrichTranscripts: true, enabled: isVideoContent });
  // isLoading only covers the FIRST fetch (React Query: isPending && isFetching) -
  // once this query has succeeded once, isLoading goes false even while a later
  // refetch (e.g. handleRetry's post-download refetchEnrichedVideo()) is still in
  // flight. Checking isFetching too closes that gap - otherwise the player could
  // mount mid-refetch with stale/captions-less data it will never pick up (it reads
  // config once on mount, see the comment above the fullscreen mount guard below).
  const isCaptionsPending = isVideoContent && (isEnrichedVideoLoading || isEnrichedVideoFetching);

  const playerIsLoading = isLoading || (isQumlContent && isQumlLoading);

  // Download state (with optimistic UI override for post-delete snapping)
  const rawDownloadState = useDownloadState(contentId);
  const { isLocal: rawIsLocal, isCheckPending: isLocalCheckPending } = useIsContentLocal(contentId);

  // Track which contentId was optimistically marked as deleted.
  // Storing the ID (not a boolean) means it auto-resets when contentId changes.
  const [deletedContentId, setDeletedContentId] = useState<string | null>(null);
  const deletedLocal = deletedContentId === contentId;

  const isLocal = deletedLocal ? false : rawIsLocal;
  const downloadState = deletedLocal ? null : rawDownloadState;

  // True while a download/import is actively running for this content. Used to
  // show a progress loader instead of a blank player when the user opens/plays
  // content that hasn't finished downloading yet.
  const isDownloadInProgress = !!downloadState && (
    downloadState.state === DownloadState.QUEUED ||
    downloadState.state === DownloadState.DOWNLOADING ||
    downloadState.state === DownloadState.DOWNLOADED ||
    downloadState.state === DownloadState.IMPORTING
  );
  const downloadingMessage = downloadState?.state === DownloadState.DOWNLOADING
    ? t('download.downloading', 'Downloading {{pct}}%', { pct: Math.round(downloadState.progress) })
    : downloadState?.state === DownloadState.QUEUED
      ? t('download.queued', 'Queued')
      : t('download.processing', 'Processing…');

  // API is unavailable when it errored, paused (offline), or completed with no data
  const isApiUnavailable = !!error || fetchStatus === 'paused'
    || (!isLoading && !contentData && fetchStatus === 'idle');

  // Offline fallback: when API is unavailable but content is downloaded locally,
  // load metadata from the ContentDb local_data field (saved during import).
  const [localFallbackMeta, setLocalFallbackMeta] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!isLocal || !isApiUnavailable || contentData) return;
    let cancelled = false;
    contentDbService.getByIdentifier(contentId).then((entry) => {
      if (cancelled || !entry?.local_data) return;
      try {
        const parsed = JSON.parse(entry.local_data);
        parsed.identifier = entry.identifier;
        if (!parsed.mimeType && entry.mime_type) parsed.mimeType = entry.mime_type;
        mergeTranscriptsFromServerData(parsed, entry.server_data);
        if (!cancelled) setLocalFallbackMeta(parsed);
      } catch { /* ignore parse errors */ }
    });
    return () => { cancelled = true; };
  }, [contentId, isLocal, isApiUnavailable, contentData]);

  // Backfill: transcripts are generated asynchronously, sometimes a few minutes
  // after the content goes Live - so the enrich=all read at download time can
  // legitimately have no transcriptUrl yet. Whenever a fresh enriched read comes
  // back with one for content that's already downloaded, and no local transcripts
  // were ever captured, retry the caption download in the background so captions
  // still end up available offline without requiring a full re-download.
  useEffect(() => {
    const enrichedContent = enrichedVideoData?.data?.content as
      { enrichment?: { transcriptUrl?: string }; transcripts?: Record<string, unknown>[] } | undefined;
    const transcriptUrl = enrichedContent?.enrichment?.transcriptUrl;
    if (!contentId || !isLocal || !isVideoContent || !transcriptUrl) return;
    let cancelled = false;
    contentDbService.getByIdentifier(contentId).then((entry) => {
      if (cancelled || !entry?.local_data) return;
      try {
        const parsed = JSON.parse(entry.local_data);
        const needsBackfill = !Array.isArray(parsed.transcripts) || parsed.transcripts.length === 0;
        if (needsBackfill) {
          importService.downloadTranscripts(contentId, transcriptUrl, enrichedContent?.transcripts).catch((err) => {
            console.warn('[ContentPlayerPage] Backfill transcript download failed:', err);
          });
        }
      } catch { /* ignore parse errors */ }
    });
    return () => { cancelled = true; };
  }, [contentId, isLocal, isVideoContent, enrichedVideoData]);

  const apiMetadata = isQumlContent
    ? qumlData
    : (isVideoContent ? (enrichedVideoData?.data?.content ?? contentData) : contentData);
  const rawPlayerMetadata = apiMetadata ?? localFallbackMeta;
  // Don't show API error if we have local fallback data
  const playerError = rawPlayerMetadata ? null : (error || (isQumlContent ? qumlError : null));
  const mimeType = rawPlayerMetadata?.mimeType;

  // Resolve URLs to local filesystem paths when content is downloaded.
  // The resolver rewrites artifactUrl/streamingUrl/basePath to local Capacitor
  // webview URLs so players can load files from disk (both online and offline).
  const [resolvedMetadata, setResolvedMetadata] = useState<{ id: string; data: Record<string, unknown> } | null>(null);

  // Reset stale fallback/resolved state when navigating to a different content item.
  // Without this, rawPlayerMetadata could briefly reuse the previous content's local data.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setLocalFallbackMeta(null);
    setResolvedMetadata(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [contentId]);
  useEffect(() => {
    // QuML resolves its own media to local URLs inside loadLocalQumlContent, so
    // it must NOT go through resolveContentForPlayer (which sets isAvailableLocally
    // and would push the player onto a different image-resolution branch).
    if (!rawPlayerMetadata?.identifier || !isLocal || isQumlContent) {
      return;
    }
    let cancelled = false;
    resolveContentForPlayer(rawPlayerMetadata.identifier, rawPlayerMetadata).then((resolved) => {
      if (!cancelled) setResolvedMetadata({ id: rawPlayerMetadata.identifier, data: resolved });
    });
    return () => { cancelled = true; };
  }, [rawPlayerMetadata, isLocal, isQumlContent]);

  const playerMetadata = (isLocal && resolvedMetadata != null && resolvedMetadata.id === rawPlayerMetadata?.identifier) ? resolvedMetadata.data : rawPlayerMetadata;

  // Loading guards for offline fallback pipeline
  const isLocalFallbackPending = isLocal && isApiUnavailable && !contentData && !localFallbackMeta;
  const isResolving = !isQumlContent && isLocal && (resolvedMetadata == null || resolvedMetadata.id !== rawPlayerMetadata?.identifier) && !!rawPlayerMetadata?.identifier;

  // Related content
  const contentLoaded = !isLoading && !!contentData;
  const { data: searchData } = useContentSearch({
    request: { limit: 20, offset: 0 },
    enabled: contentLoaded,
  });
  const relatedItems = useMemo(
    () => mapSearchContentToRelatedContentItems(searchData?.data?.content, contentId, 3),
    [searchData, contentId],
  );

  const handleRetry = useCallback(() => {
    refetch();
    if (isQumlContent) {
      refetchQuml();
    }
    // Re-run the enriched read too, not just on error retry but also after a
    // download completes (see downloadManager.subscribe below): the first
    // enriched fetch typically happens before download, when the content row
    // doesn't exist yet, so ContentService.contentRead has nothing to persist
    // transcripts onto. Once the row exists post-download, re-fetching lets
    // it actually cache transcripts into server_data for offline use.
    if (isVideoContent) {
      refetchEnrichedVideo();
    }
  }, [refetch, refetchQuml, isQumlContent, isVideoContent, refetchEnrichedVideo]);

  useEffect(() => {
    if (!contentId) return;
    const unsub = downloadManager.subscribe(async (event) => {
      if (event.identifier === contentId && event.type === 'state_change') {
        const entry = await downloadManager.getEntry(contentId);
        if (entry?.state === 'COMPLETED') {
          setToastConfig({ message: t('download.downloadSuccess', 'Content downloaded successfully'), color: 'success', icon: checkmarkCircle });
          // Re-fetch so the player swaps from the in-progress loader to the
          // now-downloaded content (QuML rebuilds its metadata from local files).
          handleRetry();
        } else if (entry?.state === 'FAILED') {
          setToastConfig({ message: t('download.downloadFailed', 'Failed to download content.'), color: 'danger', icon: alertCircleOutline });
        }
      }
    });
    return unsub;
  }, [contentId, t, handleRetry]);

  const handleDownload = useCallback(async () => {
    setDeletedContentId(null);
    if (isOffline) {
      setToastConfig({ message: t('download.noInternet', 'No Internet connection'), color: 'dark' });
      return;
    }
    if (!contentData) return;
    try {
      // Use the enriched content (with enrichment.transcriptUrl) when available so
      // ImportService can download the caption ECAR alongside the video - falls
      // back to the base content for non-video/not-yet-enriched cases. If the
      // enriched read hasn't resolved yet (it's a second, later-firing query),
      // ImportService.import() itself falls back to fetching transcriptUrl
      // directly for video content, so this doesn't need to await/race it here.
      const downloadMeta = isVideoContent ? (enrichedVideoData?.data?.content ?? contentData) : contentData;
      const result = await startContentDownload(downloadMeta, { priority: 10 });
      console.debug('[ContentPlayerPage] download result:', result, 'for', contentId);
      switch (result) {
        case 'started':
          setToastConfig({ message: t('download.started', 'Download started'), color: 'dark' });
          break;
        case 'already_downloaded':
          setToastConfig({ message: t('download.alreadyDownloaded', 'Already downloaded'), color: 'success', icon: checkmarkCircle });
          break;
        case 'in_progress':
          setToastConfig({ message: t('download.inProgress', 'Download in progress'), color: 'dark' });
          break;
        case 'not_available':
          setToastConfig({ message: t('download.notAvailable', 'Not available for download'), color: 'dark' });
          break;
      }
    } catch (error) {
      console.error('[ContentPlayerPage] download failed for', contentId, error);
      setToastConfig({ message: t('download.downloadFailed', 'Failed to download content.'), color: 'danger', icon: alertCircleOutline });
    }
  }, [isOffline, contentData, contentId, t, isVideoContent, enrichedVideoData]);

  const requestDelete = useCallback(() => setShowDeleteAlert(true), []);

  const confirmDeleteDownload = useCallback(async () => {
    setShowDeleteAlert(false);
    if (!contentId) return;
    try {
      const result = await deleteDownloadedContent(contentId);
      console.debug('[ContentPlayerPage] delete result:', result, 'for', contentId);
      if (result.deleted) {
        setDeletedContentId(contentId);
        setToastConfig({ message: t('download.deleted', 'Content deleted'), color: 'success', icon: checkmarkCircle });
      }
    } catch (error) {
      console.error('[ContentPlayerPage] delete failed for', contentId, error);
      setToastConfig({ message: t('download.deleteFailed', 'Failed to delete'), color: 'danger', icon: alertCircleOutline });
    }
  }, [contentId, t]);

  const handleRetryDownload = useCallback(() => {
    if (contentId) {
      console.debug('[ContentPlayerPage] retrying download for', contentId);
      downloadManager.retry(contentId);
    }
  }, [contentId]);

  const handlePauseDownload = useCallback(() => {
    if (contentId) downloadManager.pause(contentId);
  }, [contentId]);

  const handleResumeDownload = useCallback(() => {
    if (contentId) downloadManager.resume(contentId);
  }, [contentId]);

  const handlePlay = useCallback(() => {
    setPlayerReady(false);
    setIsPlaying(true);
    ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => { });
  }, []);

  // Safety net: if the player never emits an event, drop the overlay anyway so
  // it can't get stuck covering a working player.
  useEffect(() => {
    if (!isPlaying || playerReady) return;
    const id = setTimeout(() => setPlayerReady(true), 6000);
    return () => clearTimeout(id);
  }, [isPlaying, playerReady]);

  const handleClosePlayer = useCallback(() => {
    setIsPlaying(false);
    ScreenOrientation.unlock().catch(() => { });
  }, []);



  // Unlock orientation on unmount
  useEffect(() => {
    return () => {
      ScreenOrientation.unlock().catch(() => { });
    };
  }, []);

  const handlePlayerEvent = (event: any) => {
    console.debug('[ContentPlayerPage] Player event:', event);
    setPlayerReady(true); // first event ⇒ player has rendered; hide the overlay
    // Check all possible event shapes across player types:
    // - event.data.edata.type: raw web component event structure (pdf, epub, quml, video, ecml)
    // - event.type / event.data.type: wrapped event from player services
    // - event.eid / event.data.eid: telemetry event structure
    const eid = ((
      event?.data?.edata?.type
      ?? event?.eid
      ?? event?.data?.eid
      ?? event?.data?.type
      ?? event?.type
    ) ?? '').toUpperCase();
    if (eid === 'EXIT') {
      handleClosePlayer();
    }
  };

  const handleTelemetryEvent = (event: any) => {
    console.debug('[ContentPlayerPage] Telemetry event:', event);
    setPlayerReady(true); // first event ⇒ player has rendered; hide the overlay
    void telemetryService.save(event);
  };

  const telemetryObject = contentData
    ? { id: contentId, type: contentData.contentType || 'Content', ver: String(contentData.pkgVersion || '1') }
    : undefined;

  // ── Downloading: show a progress loader instead of a blank player ──
  // When the user plays content that's still downloading (common for QuML, which
  // must read its questions/media from disk), the player metadata isn't ready yet.
  // Show download progress until it finishes, then handleRetry() (on COMPLETED)
  // re-fetches and the player renders.
  if (isPlaying && isDownloadInProgress && !isLocal) {
    return (
      <IonPage className="cp-fullscreen">
        <IonContent scrollY={false}>
          <PageLoader message={downloadingMessage} />
        </IonContent>
      </IonPage>
    );
  }

  // ── Fullscreen player mode (landscape, no header) ──
  if (isPlaying && playerMetadata && mimeType) {
    // While the DB check or captions fetch is still pending, show a loader —
    // don't mount the player before transcripts are ready (it bakes metadata
    // into the player config once at init and won't pick up a later update).
    if (isLocalCheckPending || isCaptionsPending) {
      return (
        <IonPage className="cp-fullscreen">
          <IonContent scrollY={false}>
            <PageLoader message={t('loading')} />
          </IonContent>
        </IonPage>
      );
    }

    // Offline guard: if offline and content not downloaded, show message
    if (isOffline && !isLocal) {
      return (
        <IonPage className="cp-fullscreen">
          <IonContent scrollY={false}>
            <div className="cp-offline-guard">
              <IonIcon icon={cloudOfflineOutline} className="cp-offline-icon" />
              <h2>{t('download.youreOffline')}</h2>
              <p>{t('download.downloadToPlayOffline')}</p>
              {!isNonDownloadable && (
                <DownloadProgressBadge
                  downloadState={downloadState}
                  isLocal={isLocal}
                  onDownload={handleDownload}
                  onRetry={handleRetryDownload}
                  onDelete={requestDelete}
                  onPause={handlePauseDownload}
                  onResume={handleResumeDownload}
                />
              )}
              <button className="cp-offline-back" onClick={handleClosePlayer}>
                {t('back')}
              </button>
            </div>
          </IonContent>
        </IonPage>
      );
    }

    return (
      <IonPage className="cp-fullscreen">
        <IonContent scrollY={false}>
          <div className="cp-player-fullscreen-container">
            {!playerReady && (
              <div className="cp-player-loading-overlay">
                <PageLoader message={t('loading')} />
              </div>
            )}
            <ContentPlayer
              mimeType={mimeType}
              metadata={playerMetadata}
              onPlayerEvent={handlePlayerEvent}
              onTelemetryEvent={handleTelemetryEvent}
              contentMeta={telemetryObject}
            />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ── Detail view (portrait, with header) ──
  return (
    <IonPage className="cp-page">
      <TelemetryTracker
        disabled={!contentData}
        startEventInput={{ type: 'START', mode: 'play', pageid: 'ContentPlayerPage' }}
        endEventInput={{ type: 'END', mode: 'play', pageid: 'ContentPlayerPage', summary: [] }}
        startOptions={telemetryObject ? { object: telemetryObject } : undefined}
        endOptions={telemetryObject ? { object: telemetryObject } : undefined}
        summaryOptions={telemetryObject ? { object: telemetryObject } : undefined}
      />
      <IonHeader className="ion-no-border">
        <IonToolbar className="cp-toolbar">
          <div className="cp-toolbar-inner">
            <button type="button"
              onClick={() => router.goBack()}
              className="cp-icon-btn"
              aria-label={t('back')}
            >
              <BackIcon />
            </button>
            <div className="cp-header-actions">
              {!isNonDownloadable && (
                <DownloadProgressBadge
                  downloadState={downloadState}
                  isLocal={isLocal}
                  onDownload={handleDownload}
                  onRetry={handleRetryDownload}
                  onDelete={requestDelete}
                  onPause={handlePauseDownload}
                  onResume={handleResumeDownload}
                />
              )}
            </div>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <main id="main-content">
        {playerIsLoading || isLocalFallbackPending || isResolving ? (
          <PageLoader message="Loading content..." />
        ) : playerError || !playerMetadata || !mimeType ? (
          <PageLoader
            error={playerError ? `Failed to load content: ${playerError.message}` : 'No content data available.'}
            onRetry={handleRetry}
          />
        ) : (
          <div className="cp-container">
            {/* Hero Section */}
            <div className="cp-hero">
              <div className="cp-meta">
                <h1>{playerMetadata.name}</h1>
                {playerMetadata.description && (
                  <p className="cp-description">{playerMetadata.description}</p>
                )}
              </div>

              {/* Thumbnail with play button */}
              <button
                type="button"
                className="cp-player-area"
                onClick={handlePlay}
                aria-label={t('playItem', { name: playerMetadata.name })}
              >
                {(playerMetadata.posterImage || playerMetadata.appIcon) && (
                  <IonImg
                    src={playerMetadata.posterImage || playerMetadata.appIcon}
                    alt={playerMetadata.name}
                    className="cp-thumbnail"
                  />
                )}
                <div className="cp-play-button">
                  <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M12 7L0.75 13.4952L0.75 0.504809L12 7Z" fill="var(--ion-color-primary)" />
                  </svg>
                </div>
              </button>
            </div>

            <RelatedContent items={relatedItems} t={t} />
          </div>
        )}
        </main>
      </IonContent>

      <IonToast
        isOpen={!!toastConfig}
        message={toastConfig?.message || ''}
        color={toastConfig?.color}
        icon={toastConfig?.icon}
        duration={2500}
        onDidDismiss={() => setToastConfig(null)}
        position="bottom"
      />
      <IonAlert
        isOpen={showDeleteAlert}
        onDidDismiss={() => setShowDeleteAlert(false)}
        header={t('download.deleteTitle', 'Delete Content')}
        message={t('download.deleteMessage', 'Delete {{name}}? This will delete the downloaded content.', { name: playerMetadata?.name || 'this content' })}
        buttons={[
          { text: t('cancel', 'Cancel'), role: 'cancel' },
          { text: t('download.delete', 'Delete'), role: 'destructive', handler: confirmDeleteDownload },
        ]}
      />
    </IonPage>
  );
};

export default ContentPlayerPage;
