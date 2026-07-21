import React, { useState, useEffect, useRef, useMemo, useReducer } from 'react';
import {
    IonPage, IonHeader, IonContent, IonModal,
    IonInfiniteScroll, IonInfiniteScrollContent, IonRefresher,
    IonRefresherContent, IonSpinner, useIonViewDidEnter,
} from '@ionic/react';
import { useLocation, useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BottomNavigation } from '../components/layout/BottomNavigation';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { QRScanButton } from '../components/common/QRScanButton';
import { useContentSearch } from '../hooks/useContentSearch';
import { useFormRead } from '../hooks/useFormRead';
import useDebounce from '../hooks/useDebounce';
import type { ContentSearchItem, SearchMode } from '../types/contentTypes';
import { AiToggle } from '../components/common/AiToggle';
import { useAiSearchEnabled } from '../hooks/useAiSearchEnabled';
import { SemanticSuggestions } from '../components/common/SemanticSuggestions';
import { SparkleIcon } from '../components/common/SparkleIcon';
import { AppBackIcon } from '../components/common/AppBackIcon';
import { useNetwork } from '../providers/NetworkProvider';
import type { ExploreFilterGroup, ExploreFilterOption, FilterState } from '../types/formTypes';
import { resolveLabel } from '../utils/formLocaleResolver';
import CollectionCard from '../components/content/CollectionCard';
import ResourceCard from '../components/content/ResourceCard';
import PageLoader from '../components/common/PageLoader';
import './ExplorePage.css';
import useImpression from '../hooks/useImpression';

// ── Icons ──
const FilterIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M2 2H16V0H2V2ZM2 3.58997V2H0V3.58997H2ZM6.41003 8L2 3.58997L0.589966 5L5 9.41003L6.41003 8ZM5 9.41003V16.3101H7V9.41003H5ZM5 16.3101C5 17.3301 5.99997 18.05 6.96997 17.73L6.33997 15.83C6.66997 15.72 7 15.9701 7 16.3101H5ZM6.96997 17.73L11.97 16.0601L11.34 14.17L6.33997 15.83L6.96997 17.73ZM11.97 16.0601C12.59 15.8601 13 15.29 13 14.64H11C11 14.42 11.14 14.23 11.34 14.17L11.97 16.0601ZM13 14.64V9.41003H11V14.64H13ZM16 3.58997L11.59 8L13 9.41003L17.41 5L16 3.58997ZM16 2V3.58997H18V2H16ZM17.41 5C17.79 4.62 18 4.11997 18 3.58997H16L17.41 5ZM13 9.41003L11.59 8C11.21 8.38 11 8.88003 11 9.41003H13ZM5 9.41003H7C7 8.88003 6.79003 8.38 6.41003 8L5 9.41003ZM0 3.58997C0 4.11997 0.209966 4.62 0.589966 5L2 3.58997H0ZM16 2H18C18 0.9 17.1 0 16 0V2ZM2 0C0.9 0 0 0.9 0 2H2V0Z" fill="var(--ion-color-primary)" />
    </svg>
);

const SearchIcon = () => (
    <svg width="19" height="19" viewBox="0 0 19 19" fill="var(--ion-color-primary)" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M13.5 12H12.71L12.43 11.73C13.41 10.59 14 9.11 14 7.5C14 3.91 11.09 1 7.5 1C3.91 1 1 3.91 1 7.5C1 11.09 3.91 14 7.5 14C9.11 14 10.59 13.41 11.73 12.43L12 12.71V13.5L17 18.49L18.49 17L13.5 12ZM7.5 12C5.01 12 3 9.99 3 7.5C3 5.01 5.01 3 7.5 3C9.99 3 12 5.01 12 7.5C12 9.99 9.99 12 7.5 12Z" />
    </svg>
);

const CloseIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M1 1L13 13M13 1L1 13" stroke="var(--ion-color-primary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// Small grey "clear text" icon shown inside the search bar.
const ClearIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="var(--ion-color-medium, #757575)" />
    </svg>
);


// ── Helpers ──
const COLLECTION_MIME_TYPE = 'application/vnd.ekstep.content-collection';

const SORT_OPTIONS = [
    { labelKey: 'newestFirst', value: { lastUpdatedOn: 'desc' } },
    { labelKey: 'oldestFirst', value: { lastUpdatedOn: 'asc' } },
];

const LIMIT = 9;

const getValues = (option: ExploreFilterOption): string[] =>
    Array.isArray(option.value) ? option.value : option.value ? [option.value] : [];

// ── Pagination reducer ──
interface PaginationState {
    offset: number;
    displayItems: ContentSearchItem[];
    hasMore: boolean;
}

type PaginationAction =
    | { type: 'RESET' }
    | { type: 'LOAD_MORE' }
    | { type: 'APPEND_ITEMS'; items: ContentSearchItem[]; isFirstPage: boolean };

function paginationReducer(state: PaginationState, action: PaginationAction): PaginationState {
    switch (action.type) {
        case 'RESET':
            return { offset: 0, displayItems: [], hasMore: true };
        case 'LOAD_MORE':
            return { ...state, offset: state.offset + LIMIT };
        case 'APPEND_ITEMS': {
            const newHasMore = action.items.length >= LIMIT;
            if (action.isFirstPage) {
                return { ...state, displayItems: action.items, hasMore: newHasMore };
            }
            const existingIds = new Set(state.displayItems.map((i) => i.identifier));
            const uniqueNew = action.items.filter((i) => !existingIds.has(i.identifier));
            return { ...state, displayItems: [...state.displayItems, ...uniqueNew], hasMore: newHasMore };
        }
        default:
            return state;
    }
}

// ── Component ──
const ExplorePage: React.FC = () => {
    useImpression({ pageid: 'ExplorePage', env: 'explore' });
    const { t, i18n } = useTranslation();

    useEffect(() => {
        document.title = `${t('pageTitle.explore')}`;
    }, [t]);

    // ── Read query param from URL ──
    const location = useLocation();
    const history = useHistory();
    const urlQuery = useMemo(() => new URLSearchParams(location.search).get('query') || '', [location.search]);
    const urlDialCode = useMemo(() => {
        const rawDialCode = new URLSearchParams(location.search).get('dialCode') || '';
        return /^[A-Za-z0-9]+$/.test(rawDialCode) ? rawDialCode : '';
    }, [location.search]);
    const urlMode: SearchMode = useMemo(
        () => (new URLSearchParams(location.search).get('mode') === 'semantic' ? 'semantic' : 'keyword'),
        [location.search]
    );

    // ── Search ──
    const [showSearch, setShowSearch] = useState(!!urlQuery || urlMode === 'semantic');
    const [searchQuery, setSearchQuery] = useState(urlQuery);
    const [searchMode, setSearchMode] = useState<SearchMode>(urlMode);
    const debouncedQuery = useDebounce(searchQuery, 600);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const { isOffline } = useNetwork();
    const isSemantic = searchMode === 'semantic';
    const semanticEmpty = isSemantic && !debouncedQuery.trim();

    // AI search is gated by the native build config (gradle.properties → NativeSetting).
    const aiSearchEnabled = useAiSearchEnabled();

    // Keep search state in sync with URL params so deep-linking works
    useEffect(() => {
        setShowSearch(!!urlQuery || urlMode === 'semantic');
        setSearchQuery(urlQuery);
        setSearchMode(urlMode);
    }, [urlQuery, urlMode]);

    // AI search needs connectivity; fall back to keyword if we go offline.
    useEffect(() => {
        if (isOffline && isSemantic) setSearchMode('keyword');
    }, [isOffline, isSemantic]);

    // If AI search is disabled (incl. a stale ?mode=semantic deep link), force keyword.
    useEffect(() => {
        if (!aiSearchEnabled && isSemantic) setSearchMode('keyword');
    }, [aiSearchEnabled, isSemantic]);

    const handleToggleMode = () => {
        const next: SearchMode = isSemantic ? 'keyword' : 'semantic';
        setSearchMode(next);
        // Reflect the mode in the URL so back/forward and copy-paste preserve it.
        const params = new URLSearchParams(location.search);
        if (next === 'semantic') params.set('mode', 'semantic');
        else params.delete('mode');
        const qs = params.toString();
        history.replace({ search: qs ? `?${qs}` : '' });
    };

    // ── Filters & Sort (applied immediately on selection, like the portal) ──
    const [filters, setFilters] = useState<FilterState>({});
    const [sortBy, setSortBy] = useState<Record<string, string>>({ lastUpdatedOn: 'desc' });

    // ── Filter Sheet state ──
    const [showFilter, setShowFilter] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('');

    // ── Pagination (reducer avoids setState-in-effect) ──
    const [pagination, dispatch] = useReducer(paginationReducer, {
        offset: 0,
        displayItems: [],
        hasMore: true,
    });
    const infiniteScrollRef = useRef<HTMLIonInfiniteScrollElement>(null);

    // ── Form read for filter groups ──
    const { data: formData, isLoading: isFormLoading, refetch: refetchForm } = useFormRead({
        request: {
            type: 'app',
            subType: 'explorepage',
            action: 'filters',
            component: 'app',
        },
    });

    const filterGroups: ExploreFilterGroup[] = useMemo(() => {
        const rawData = formData?.data as unknown as Record<string, unknown> | undefined;
        const rawForm = rawData?.form as Record<string, unknown> | undefined;
        const filtersData = (rawForm?.data as Record<string, unknown>)?.filters;
        return Array.isArray(filtersData) ? [...filtersData].sort((a, b) => a.index - b.index) : [];
    }, [formData]);

    // Derive the effective active tab: fall back to the first group when unset
    const effectiveActiveTab = activeTab || (filterGroups.length > 0 ? filterGroups[0].id : '');

    // ── Build active filters for content search ──
    const activeFilters = useMemo(() => ({
        objectType: ['Content', 'QuestionSet'],
        ...Object.fromEntries(
            Object.entries(filters).filter(([, values]) => values.length > 0)
        ),
        ...(urlDialCode ? { dialcodes: [urlDialCode] } : {}),
    }), [filters, urlDialCode]);

    // ── Reset pagination when search params change ──
    const searchParamsKey = useMemo(
        () => `${searchMode}|${debouncedQuery}|${JSON.stringify(activeFilters)}|${JSON.stringify(sortBy)}`,
        [searchMode, debouncedQuery, activeFilters, sortBy]
    );

    useEffect(() => {
        dispatch({ type: 'RESET' });
    }, [searchParamsKey]);

    // ── Content search ──
    const { data, isLoading: isQueryLoading, error: queryError, refetch } = useContentSearch({
        searchMode,
        enabled: !semanticEmpty,
        request: {
            limit: LIMIT,
            offset: pagination.offset,
            query: debouncedQuery,
            sort_by: sortBy,
            filters: activeFilters,
        },
    });

    // ── Refetch form filters when tab becomes active (e.g. after coming online) ──
    useIonViewDidEnter(() => {
        refetchForm();
    });

    // ── Accumulate items as pages load ──
    useEffect(() => {
        if (!data) return;
        const content = data.data?.content ?? [];
        const questionSets = data.data?.QuestionSet ?? [];
        const newItems = [...content, ...questionSets];

        dispatch({
            type: 'APPEND_ITEMS',
            items: newItems,
            isFirstPage: pagination.offset === 0,
        });

        infiniteScrollRef.current?.complete();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    // ── Handlers ──
    const handleLoadMore = () => {
        if (pagination.hasMore && !isQueryLoading) {
            dispatch({ type: 'LOAD_MORE' });
        } else {
            infiniteScrollRef.current?.complete();
        }
    };

    const handleRefresh = async (e: CustomEvent) => {
        dispatch({ type: 'RESET' });
        await refetch();
        (e.target as HTMLIonRefresherElement).complete();
    };

    const handleSearchToggle = () => {
        setShowSearch((prev) => {
            if (!prev) setTimeout(() => searchInputRef.current?.focus(), 50);
            return !prev;
        });
        if (showSearch) {
            setSearchQuery('');
            setSearchMode('keyword');
        }
    };

    const handleOpenFilter = () => {
        if (filterGroups.length > 0) setActiveTab(filterGroups[0].id);
        setShowFilter(true);
    };

    const handleClearFilters = () => {
        setFilters({});
        setSortBy({ lastUpdatedOn: 'desc' });
    };

    const handleCheckboxChange = (option: ExploreFilterOption, checked: boolean) => {
        const values = getValues(option);
        setFilters((prev) => {
            const current = prev[option.code] ?? [];
            const updated = checked
                ? [...new Set([...current, ...values])]
                : current.filter((v) => !values.includes(v));
            return { ...prev, [option.code]: updated };
        });
    };

    const isChecked = (option: ExploreFilterOption): boolean => {
        const values = getValues(option);
        const current = filters[option.code] ?? [];
        return values.every((v) => current.includes(v));
    };

    const getGroupItems = (group: ExploreFilterGroup): ExploreFilterOption[] =>
        [...(group.options ?? group.list ?? [])].sort((a, b) => a.index - b.index);

    // Split into masonry columns
    const leftCol = pagination.displayItems.filter((_, i) => i % 2 === 0);
    const rightCol = pagination.displayItems.filter((_, i) => i % 2 !== 0);

    // While the debounce hasn't caught up (e.g. just after clearing the query on
    // back), treat the page as loading so the empty-state ("No content found")
    // doesn't flash in the gap before the real fetch runs.
    const isQuerySettling = searchQuery.trim() !== debouncedQuery.trim();
    const isInitialLoading = (isQueryLoading || isQuerySettling) && pagination.offset === 0 && pagination.displayItems.length === 0;
    const activeFilterCount = Object.values(filters).flat().length;

    // ── Active filter tab group ──
    const isSortTab = effectiveActiveTab === '__sort__';
    const activeGroup = filterGroups.find((g) => g.id === effectiveActiveTab);

    // All sidebar tabs = form groups + Sort By
    const sidebarTabs = [
        ...filterGroups.map((g) => ({ id: g.id, label: resolveLabel(g.label, i18n.language) })),
        { id: '__sort__', label: t('sortBy') },
    ];

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <div className="page-header">
                    {showSearch ? (
                        <div className="explore-search-row">
                            <button className="explore-search-back" onClick={handleSearchToggle} aria-label={t('back')}>
                                <AppBackIcon />
                            </button>
                            <div className={`explore-search-bar${isSemantic ? ' explore-search-bar--ai' : ''}`}>
                                {isSemantic
                                    ? <SparkleIcon className="ai-blink" size={18} color="var(--ion-color-primary)" />
                                    : <SearchIcon />}
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('searchContentPlaceholder')}
                                    aria-label={t('searchContentPlaceholder')}
                                    className="explore-search-input"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        className="explore-clear-btn"
                                        onClick={() => setSearchQuery('')}
                                        aria-label={t('close')}
                                    >
                                        <ClearIcon />
                                    </button>
                                )}
                                {aiSearchEnabled && (
                                    <AiToggle active={isSemantic} onToggle={handleToggleMode} disabled={isOffline} />
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            <h1 className="explore-page-title">
                                {t('exploreTitle')}
                            </h1>
                            <div className="page-header__actions">
                                <button onClick={handleSearchToggle} className="explore-icon-btn" aria-label={t('search')}>
                                    <SearchIcon />
                                </button>
                                <QRScanButton />
                                <button
                                    onClick={handleOpenFilter}
                                    aria-label={t('filters')}
                                    className="explore-filter-btn"
                                >
                                    <FilterIcon />
                                    {activeFilterCount > 0 && (
                                        <span className="explore-filter-badge">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </button>
                                <LanguageSelector />
                            </div>
                        </>
                    )}
                </div>
            </IonHeader>

            <IonContent fullscreen className="explore-content">
                <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
                    <IonRefresherContent />
                </IonRefresher>

                <main id="main-content">
                    {urlDialCode && (
                        <div className="explore-dial-banner">
                            {t('dialCodeResults')}: {urlDialCode}
                        </div>
                    )}

                    {semanticEmpty && (
                        <SemanticSuggestions onPick={(q) => setSearchQuery(q)} offline={isOffline} />
                    )}

                    {!semanticEmpty && isInitialLoading && (
                        <PageLoader message={t('loading')} />
                    )}

                    {!semanticEmpty && queryError && pagination.displayItems.length === 0 && (
                        <PageLoader error={t('failedToLoad')} onRetry={() => refetch()} />
                    )}

                    {!semanticEmpty && !isInitialLoading && !queryError && pagination.displayItems.length === 0 && (
                        <div className="explore-empty-state" role="status" aria-live="polite">
                            <p>{t('noContentFound')}</p>
                        </div>
                    )}

                    {!semanticEmpty && pagination.displayItems.length > 0 && (
                        <div className="masonry-grid">
                            <div className="masonry-col">
                                {leftCol.map((item) =>
                                    item.mimeType === COLLECTION_MIME_TYPE
                                        ? <CollectionCard key={item.identifier} item={item} />
                                        : <ResourceCard key={item.identifier} item={item} />
                                )}
                            </div>
                            <div className="masonry-col">
                                {rightCol.map((item) =>
                                    item.mimeType === COLLECTION_MIME_TYPE
                                        ? <CollectionCard key={item.identifier} item={item} />
                                        : <ResourceCard key={item.identifier} item={item} />
                                )}
                            </div>
                        </div>
                    )}

                    <div className="explore-bottom-spacer" />

                    <IonInfiniteScroll
                        ref={infiniteScrollRef}
                        onIonInfinite={handleLoadMore}
                        disabled={semanticEmpty || !pagination.hasMore || isInitialLoading}
                    >
                        <IonInfiniteScrollContent loadingSpinner="bubbles" />
                    </IonInfiniteScroll>
                </main>
            </IonContent>

            <BottomNavigation />

            {/* ── Filter Bottom Sheet Modal ── */}
            <IonModal
                isOpen={showFilter}
                onDidDismiss={() => setShowFilter(false)}
                breakpoints={[0, 0.75, 1]}
                initialBreakpoint={0.75}
                className="filter-modal"
                aria-labelledby="filter-modal-title"
            >
                <div className="filter-sheet-container">
                    {/* Header */}
                    <div className="filter-sheet-header">
                        <h2 id="filter-modal-title">{t('filters')}</h2>
                        <button onClick={() => setShowFilter(false)} className="close-btn" aria-label={t('close')}>
                            <CloseIcon />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="filter-sheet-body">
                        {/* Sidebar */}
                        <div className="filter-sidebar" role="tablist" aria-label={t('filters')}>
                            {isFormLoading
                                ? [1, 2, 3].map((n) => (
                                    <div key={n} className="explore-filter-skeleton" aria-hidden="true" />
                                ))
                                : sidebarTabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        className={`filter-tab ${effectiveActiveTab === tab.id ? 'active' : ''}`}
                                        onClick={() => setActiveTab(tab.id)}
                                        role="tab"
                                        aria-selected={effectiveActiveTab === tab.id}
                                    >
                                        {tab.label}
                                    </button>
                                ))
                            }
                        </div>

                        {/* Options Pane */}
                        <div className="filter-options">
                            {isSortTab && (
                                <div className="checkbox-list">
                                    {SORT_OPTIONS.map((opt) => {
                                        const isSelected = JSON.stringify(sortBy) === JSON.stringify(opt.value);
                                        return (
                                            <label key={opt.labelKey} className="checkbox-item">
                                                <input
                                                    type="checkbox"
                                                    className="custom-checkbox"
                                                    checked={isSelected}
                                                    onChange={() => setSortBy(opt.value)}
                                                />
                                                <span>{t(opt.labelKey)}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}

                            {!isSortTab && activeGroup && (
                                <div className="checkbox-list">
                                    {getGroupItems(activeGroup).map((option) => (
                                        <label key={option.id} className="checkbox-item">
                                            <input
                                                type="checkbox"
                                                className="custom-checkbox"
                                                checked={isChecked(option)}
                                                onChange={(e) => handleCheckboxChange(option, e.target.checked)}
                                            />
                                            <span>{resolveLabel(option.label, i18n.language)}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {!isSortTab && !activeGroup && !isFormLoading && (
                                <p className="explore-filter-no-results">
                                    {t('noResults')}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="filter-sheet-footer">
                        <button className="clear-filters-btn" onClick={handleClearFilters}>
                            {t('clearFilters')}
                        </button>
                        <button className="apply-filters-btn" onClick={() => setShowFilter(false)}>
                            {t('close')}
                        </button>
                    </div>
                </div>
            </IonModal>
        </IonPage>
    );
};

export default ExplorePage;
