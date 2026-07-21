import React, { useState, useEffect } from 'react';
import {
    IonPage, IonHeader, IonToolbar, IonContent, IonInput, IonSpinner, useIonRouter,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useContentSearch } from '../hooks/useContentSearch';
import useDebounce from '../hooks/useDebounce';
import { ContentSearchItem, SearchMode } from '../types/contentTypes';
import CollectionCard from '../components/content/CollectionCard';
import ResourceCard from '../components/content/ResourceCard';
import { AiToggle } from '../components/common/AiToggle';
import { useAiSearchEnabled } from '../hooks/useAiSearchEnabled';
import { SemanticSuggestions } from '../components/common/SemanticSuggestions';
import { SparkleIcon } from '../components/common/SparkleIcon';
import { AppBackIcon } from '../components/common/AppBackIcon';
import { useNetwork } from '../providers/NetworkProvider';
import './SearchPage.css';
import useImpression from '../hooks/useImpression';

// ── Constants ──
const PREVIEW_LIMIT = 3;
const COLLECTION_MIME_TYPE = 'application/vnd.ekstep.content-collection';

// ── Icons ──
const SearchInputIcon = () => (
    <svg width="19" height="19" viewBox="0 0 19 19" fill="var(--ion-color-primary)" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M13.5 12H12.71L12.43 11.73C13.41 10.59 14 9.11 14 7.5C14 3.91 11.09 1 7.5 1C3.91 1 1 3.91 1 7.5C1 11.09 3.91 14 7.5 14C9.11 14 10.59 13.41 11.73 12.43L12 12.71V13.5L17 18.49L18.49 17L13.5 12ZM7.5 12C5.01 12 3 9.99 3 7.5C3 5.01 5.01 3 7.5 3C9.99 3 12 5.01 12 7.5C12 9.99 9.99 12 7.5 12Z" />
    </svg>
);

const ClearIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="var(--ion-color-medium, #757575)" />
    </svg>
);

const ArrowRightIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
    </svg>
);

const SearchPage: React.FC = () => {
    useImpression({ pageid: 'SearchPage', env: 'search' });
    const router = useIonRouter();
    const { t } = useTranslation();

    useEffect(() => {
        document.title = `${t('pageTitle.search')}`;
    }, [t]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState<SearchMode>('keyword');
    const debouncedQuery = useDebounce(searchQuery.trim(), 600);

    const { isOffline } = useNetwork();
    const isSemantic = searchMode === 'semantic';
    const showSuggestions = isSemantic && !debouncedQuery;

    // AI search is gated by the native build config (gradle.properties → NativeSetting).
    const aiSearchEnabled = useAiSearchEnabled();

    // AI search needs connectivity; fall back to keyword if we go offline mid-session.
    useEffect(() => {
        if (isOffline && isSemantic) setSearchMode('keyword');
    }, [isOffline, isSemantic]);

    const handleToggleMode = () => {
        setSearchMode((prev) => (prev === 'semantic' ? 'keyword' : 'semantic'));
    };

    const { data, isLoading, error } = useContentSearch({
        searchMode,
        request: debouncedQuery ? {
            query: debouncedQuery,
            limit: PREVIEW_LIMIT,
            filters: {
                status: ['Live'],
            },
        } : undefined,
        enabled: !!debouncedQuery,
    });

    const results = data?.data?.content || [];
    const totalCount = data?.data?.count || 0;

    const handleCancel = () => {
        if (router.canGoBack()) {
            router.goBack();
        } else {
            router.push('/home', 'back', 'replace');
        }
    };

    const handleClear = () => {
        setSearchQuery('');
    };

    const handleViewAllResults = () => {
        const modeParam = isSemantic ? '&mode=semantic' : '';
        router.push(`/explore?query=${encodeURIComponent(debouncedQuery)}${modeParam}`, 'forward', 'push');
    };

    const renderResultCard = (item: ContentSearchItem) => {
        if (item.mimeType === COLLECTION_MIME_TYPE) {
            return <CollectionCard key={item.identifier} item={item} />;
        }
        return <ResourceCard key={item.identifier} item={item} />;
    };

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar style={{ '--background': 'var(--color-white)', '--padding-top': 'var(--safe-area-top)', '--padding-end': '0', padding: '12px 16px', boxShadow: 'none' }}>
                    <div className="search-header">
                        <button className="search-back-btn" onClick={handleCancel} aria-label={t('back')}>
                            <AppBackIcon />
                        </button>
                        <div className={`search-input-box${isSemantic ? ' search-input-box--ai' : ''}`}>
                            {isSemantic
                                ? <SparkleIcon className="ai-blink" size={18} color="var(--ion-color-primary)" />
                                : <SearchInputIcon />}
                            <IonInput
                                type="text"
                                className="search-text-input"
                                placeholder={isSemantic ? t('aiPlaceholder') : t('searchPlaceholder')}
                                aria-label={isSemantic ? t('aiPlaceholder') : t('searchPlaceholder')}
                                value={searchQuery}
                                onIonInput={(e) => setSearchQuery(e.detail.value || '')}
                                // eslint-disable-next-line jsx-a11y/no-autofocus
                                autoFocus
                            />
                            {searchQuery && (
                                <button className="search-clear-btn" onClick={handleClear} aria-label={t('close')}>
                                    <ClearIcon />
                                </button>
                            )}
                            {aiSearchEnabled && (
                                <AiToggle active={isSemantic} onToggle={handleToggleMode} disabled={isOffline} />
                            )}
                        </div>
                    </div>
                </IonToolbar>
            </IonHeader>

            <IonContent fullscreen style={{ '--background': 'var(--ion-color-light)' }}>
                <main id="main-content">
                <div className="search-container">
                    {/* AI search suggestions (semantic mode, empty query) */}
                    {showSuggestions && (
                        <SemanticSuggestions onPick={(q) => setSearchQuery(q)} offline={isOffline} />
                    )}

                    {/* Loading State */}
                    {!showSuggestions && isLoading && (
                        <div className="search-loading" role="status" aria-live="polite">
                            <IonSpinner name="crescent" />
                            <span>{t('searching')}</span>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="search-error" role="alert">
                            <p>{t('failedToLoad')}</p>
                        </div>
                    )}

                    {/* Search Results */}
                    {debouncedQuery && !isLoading && !error && results.length > 0 && (
                        <div className="search-results-section" aria-live="polite">
                            <h2 className="search-results-heading">
                                {t('searchResultsFor')} &quot;{debouncedQuery}&quot;
                            </h2>
                            <div className="search-results-row">
                                {results.map(renderResultCard)}
                            </div>
                            {totalCount > PREVIEW_LIMIT && (
                                <button className="search-view-all" onClick={handleViewAllResults}>
                                    {t('viewAllResults')} <ArrowRightIcon />
                                </button>
                            )}
                        </div>
                    )}

                    {/* No Results */}
                    {debouncedQuery && !isLoading && !error && results.length === 0 && (
                        <p className="search-no-results" role="status" aria-live="polite">{t('noResultsFor')} &quot;{debouncedQuery}&quot;</p>
                    )}

                    {/* Default State */}
                    {!showSuggestions && !debouncedQuery && !isLoading && (
                        <div className="recommended-section">
                            <h2 className="recommended-title">{t('searchPageHint')}</h2>
                        </div>
                    )}
                </div>
                </main>
            </IonContent>
        </IonPage>
    );
};

export default SearchPage;
