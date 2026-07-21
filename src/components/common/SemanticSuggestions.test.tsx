import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SemanticSuggestions } from './SemanticSuggestions';

const SUGGESTIONS = ['Teach fractions', 'Science experiments', 'Learn programming'];

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, any> = {
        semanticSuggestTitle: 'Try AI Search',
        semanticSuggestSubtitle: 'Ask in natural language — or pick a suggestion below',
        aiOfflineHint: 'AI Search needs internet',
        semanticSuggestions: SUGGESTIONS,
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock('./AiSearch.css', () => ({}));

describe('SemanticSuggestions', () => {
  it('renders the title and subtitle', () => {
    render(<SemanticSuggestions onPick={vi.fn()} />);
    expect(screen.getByText('Try AI Search')).toBeInTheDocument();
    expect(screen.getByText('Ask in natural language — or pick a suggestion below')).toBeInTheDocument();
  });

  it('exposes a region labelled by the title', () => {
    render(<SemanticSuggestions onPick={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Try AI Search' })).toBeInTheDocument();
  });

  it('renders a chip for each suggestion', () => {
    render(<SemanticSuggestions onPick={vi.fn()} />);
    SUGGESTIONS.forEach((s) => {
      expect(screen.getByText(s)).toBeInTheDocument();
    });
  });

  it('calls onPick with the suggestion text when a chip is clicked', () => {
    const onPick = vi.fn();
    render(<SemanticSuggestions onPick={onPick} />);
    fireEvent.click(screen.getByText('Science experiments'));
    expect(onPick).toHaveBeenCalledWith('Science experiments');
  });

  it('shows the offline hint and no chips when offline', () => {
    render(<SemanticSuggestions onPick={vi.fn()} offline />);
    expect(screen.getByText('AI Search needs internet')).toBeInTheDocument();
    SUGGESTIONS.forEach((s) => {
      expect(screen.queryByText(s)).not.toBeInTheDocument();
    });
  });

  it('does not call onPick when offline (no chips rendered)', () => {
    const onPick = vi.fn();
    render(<SemanticSuggestions onPick={onPick} offline />);
    expect(onPick).not.toHaveBeenCalled();
  });
});
