import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SearchPage from './SearchPage';

// ── Mock react-i18next ──
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        searchPlaceholder: 'Search courses, textbooks...',
        search: 'Search',
        close: 'Close',
        cancel: 'Cancel',
        searching: 'Searching...',
        searchResultsFor: 'Results for',
        noResultsFor: 'No results for',
        viewAllResults: 'View All Results',
        searchPageHint: 'Search for courses, textbooks, and more',
      };
      return translations[key] ?? key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

// ── Mock NetworkProvider ──
vi.mock('../providers/NetworkProvider', () => ({
  useNetwork: () => ({ connected: true, isOffline: false }),
}));

// ── Mock router ──
const mockPush = vi.fn();
const mockGoBack = vi.fn();

// ── Mock Ionic components ──
vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: any) => <div data-testid="ion-page">{children}</div>,
  IonHeader: ({ children }: any) => <div data-testid="ion-header">{children}</div>,
  IonToolbar: ({ children }: any) => <div data-testid="ion-toolbar">{children}</div>,
  IonContent: ({ children }: any) => <div data-testid="ion-content">{children}</div>,
  IonInput: ({ value, placeholder, onIonInput, ...rest }: any) => (
    <input
      data-testid="ion-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })}
      {...rest}
    />
  ),
  IonSpinner: () => <div data-testid="ion-spinner" />,
  useIonRouter: () => ({ push: mockPush, goBack: mockGoBack, canGoBack: () => true }),
}));

// ── Mock CSS ──
vi.mock('./SearchPage.css', () => ({}));

// ── Mock child cards ──
vi.mock('../components/content/CollectionCard', () => ({
  default: ({ item }: any) => <div data-testid="collection-card">{item.name}</div>,
}));
vi.mock('../components/content/ResourceCard', () => ({
  default: ({ item }: any) => <div data-testid="resource-card">{item.name}</div>,
}));

// ── Mock useImpression (requires Router context) ──
vi.mock('../hooks/useImpression', () => ({
  default: () => {},
}));

// ── Mock useDebounce to return value immediately ──
vi.mock('../hooks/useDebounce', () => ({
  default: (value: string) => value,
}));

// ── Mock useContentSearch ──
const defaultSearchReturn = {
  data: undefined as any,
  isLoading: false,
  error: null,
};

vi.mock('../hooks/useContentSearch', () => ({
  useContentSearch: vi.fn(() => defaultSearchReturn),
}));

import { useContentSearch } from '../hooks/useContentSearch';

const COLLECTION_MIME = 'application/vnd.ekstep.content-collection';

const makeItems = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    identifier: `do_${i}`,
    name: `Item ${i}`,
    mimeType: i === 0 ? COLLECTION_MIME : 'application/pdf',
  }));

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useContentSearch as any).mockReturnValue({ ...defaultSearchReturn });
  });

  it('renders page structure', () => {
    render(<SearchPage />);
    expect(screen.getByTestId('ion-page')).toBeInTheDocument();
    expect(screen.getByTestId('ion-header')).toBeInTheDocument();
    expect(screen.getByTestId('ion-content')).toBeInTheDocument();
  });

  it('renders search input with placeholder', () => {
    render(<SearchPage />);
    expect(screen.getByPlaceholderText('Search courses, textbooks...')).toBeInTheDocument();
  });

  it('renders back button', () => {
    render(<SearchPage />);
    expect(screen.getByLabelText('back')).toBeInTheDocument();
  });

  it('shows default state when no search query', () => {
    render(<SearchPage />);
    expect(screen.getByText('Search for courses, textbooks, and more')).toBeInTheDocument();
  });

  it('navigates back when back button is clicked', () => {
    render(<SearchPage />);
    fireEvent.click(screen.getByLabelText('back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows clear button when search query has text', () => {
    render(<SearchPage />);
    const input = screen.getByPlaceholderText('Search courses, textbooks...');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  it('clears search query when clear button is clicked', () => {
    render(<SearchPage />);
    const input = screen.getByPlaceholderText('Search courses, textbooks...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByLabelText('Close'));
    expect(input.value).toBe('');
  });

  it('shows loading spinner when searching', () => {
    (useContentSearch as any).mockReturnValue({
      ...defaultSearchReturn,
      isLoading: true,
    });

    render(<SearchPage />);
    const input = screen.getByPlaceholderText('Search courses, textbooks...');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(screen.getByTestId('ion-spinner')).toBeInTheDocument();
    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  it('shows error message on search failure', () => {
    (useContentSearch as any).mockReturnValue({
      ...defaultSearchReturn,
      error: new Error('Network error'),
    });

    render(<SearchPage />);
    const input = screen.getByPlaceholderText('Search courses, textbooks...');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(screen.getByText('failedToLoad')).toBeInTheDocument();
  });

  it('shows "No results" when search returns empty', () => {
    (useContentSearch as any).mockReturnValue({
      ...defaultSearchReturn,
      data: { data: { content: [], count: 0 } },
    });

    render(<SearchPage />);
    const input = screen.getByPlaceholderText('Search courses, textbooks...');
    fireEvent.change(input, { target: { value: 'xyz' } });

    expect(screen.getByText(/No results for/)).toBeInTheDocument();
  });

  it('renders results heading with query text', () => {
    (useContentSearch as any).mockReturnValue({
      ...defaultSearchReturn,
      data: { data: { content: makeItems(2), count: 2 } },
    });

    render(<SearchPage />);
    const input = screen.getByPlaceholderText('Search courses, textbooks...');
    fireEvent.change(input, { target: { value: 'data' } });

    expect(screen.getByText(/Results for/)).toBeInTheDocument();
  });

  it('renders CollectionCard for collection mimeType and ResourceCard for others', () => {
    const items = makeItems(3);
    (useContentSearch as any).mockReturnValue({
      ...defaultSearchReturn,
      data: { data: { content: items, count: 10 } },
    });

    render(<SearchPage />);
    const input = screen.getByPlaceholderText('Search courses, textbooks...');
    fireEvent.change(input, { target: { value: 'data' } });

    // Item 0 is collection, items 1-2 are resources
    expect(screen.getAllByTestId('collection-card')).toHaveLength(1);
    expect(screen.getAllByTestId('resource-card')).toHaveLength(2);
  });

  it('shows "View All Results" when total count exceeds preview limit', () => {
    (useContentSearch as any).mockReturnValue({
      ...defaultSearchReturn,
      data: { data: { content: makeItems(3), count: 15 } },
    });

    render(<SearchPage />);
    const input = screen.getByPlaceholderText('Search courses, textbooks...');
    fireEvent.change(input, { target: { value: 'data' } });

    expect(screen.getByText(/View All Results/)).toBeInTheDocument();
  });

  it('does not show "View All Results" when total count is within preview limit', () => {
    (useContentSearch as any).mockReturnValue({
      ...defaultSearchReturn,
      data: { data: { content: makeItems(2), count: 2 } },
    });

    render(<SearchPage />);
    const input = screen.getByPlaceholderText('Search courses, textbooks...');
    fireEvent.change(input, { target: { value: 'data' } });

    expect(screen.queryByText(/View All Results/)).not.toBeInTheDocument();
  });

  it('navigates to explore page with query when "View All Results" is clicked', () => {
    (useContentSearch as any).mockReturnValue({
      ...defaultSearchReturn,
      data: { data: { content: makeItems(3), count: 15 } },
    });

    render(<SearchPage />);
    const input = screen.getByPlaceholderText('Search courses, textbooks...');
    fireEvent.change(input, { target: { value: 'data science' } });

    fireEvent.click(screen.getByText(/View All Results/));
    expect(mockPush).toHaveBeenCalledWith('/explore?query=data%20science', 'forward', 'push');
  });

  // ── Accessibility Tests ──

  describe('accessibility', () => {
    it('search input has aria-label', () => {
      render(<SearchPage />);
      const input = screen.getByPlaceholderText('Search courses, textbooks...');
      expect(input).toHaveAttribute('aria-label', 'Search courses, textbooks...');
    });

    it('loading state has role="status" and aria-live', () => {
      (useContentSearch as any).mockReturnValue({
        ...defaultSearchReturn,
        isLoading: true,
      });

      render(<SearchPage />);
      const input = screen.getByPlaceholderText('Search courses, textbooks...');
      fireEvent.change(input, { target: { value: 'test' } });

      const loadingDiv = screen.getByText('Searching...').closest('[role="status"]');
      expect(loadingDiv).toBeInTheDocument();
      expect(loadingDiv).toHaveAttribute('aria-live', 'polite');
    });

    it('error state has role="alert"', () => {
      (useContentSearch as any).mockReturnValue({
        ...defaultSearchReturn,
        error: new Error('Network error'),
      });

      render(<SearchPage />);
      const input = screen.getByPlaceholderText('Search courses, textbooks...');
      fireEvent.change(input, { target: { value: 'test' } });

      const errorDiv = screen.getByText('failedToLoad').closest('[role="alert"]');
      expect(errorDiv).toBeInTheDocument();
    });

    it('no-results message has role="status" and aria-live', () => {
      (useContentSearch as any).mockReturnValue({
        ...defaultSearchReturn,
        data: { data: { content: [], count: 0 } },
      });

      render(<SearchPage />);
      const input = screen.getByPlaceholderText('Search courses, textbooks...');
      fireEvent.change(input, { target: { value: 'xyz' } });

      const noResults = screen.getByText(/No results for/);
      expect(noResults).toHaveAttribute('role', 'status');
      expect(noResults).toHaveAttribute('aria-live', 'polite');
    });

    it('search results section has aria-live for screen reader announcement', () => {
      (useContentSearch as any).mockReturnValue({
        ...defaultSearchReturn,
        data: { data: { content: makeItems(2), count: 2 } },
      });

      render(<SearchPage />);
      const input = screen.getByPlaceholderText('Search courses, textbooks...');
      fireEvent.change(input, { target: { value: 'data' } });

      const resultsSection = screen.getByText(/Results for/).closest('[aria-live="polite"]');
      expect(resultsSection).toBeInTheDocument();
    });

    it('clear button has aria-label for screen readers', () => {
      render(<SearchPage />);
      const input = screen.getByPlaceholderText('Search courses, textbooks...');
      fireEvent.change(input, { target: { value: 'test' } });
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });
  });
});
