import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiToggle } from './AiToggle';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        semanticMode: 'AI',
        aiOfflineHint: 'AI Search needs internet',
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock('./AiSearch.css', () => ({}));

describe('AiToggle', () => {
  it('renders the AI label', () => {
    render(<AiToggle active={false} onToggle={vi.fn()} />);
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('has aria-label "AI"', () => {
    render(<AiToggle active={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'AI' })).toBeInTheDocument();
  });

  it('is not active by default (no active modifier class)', () => {
    render(<AiToggle active={false} onToggle={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'AI' });
    expect(btn).not.toHaveClass('ai-toggle--active');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies active modifier class and aria-pressed when active', () => {
    render(<AiToggle active onToggle={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'AI' });
    expect(btn).toHaveClass('ai-toggle--active');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<AiToggle active={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'AI' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('is disabled and does not fire onToggle when disabled', () => {
    const onToggle = vi.fn();
    render(<AiToggle active={false} onToggle={onToggle} disabled />);
    const btn = screen.getByRole('button', { name: 'AI' });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('shows the offline hint as title when disabled', () => {
    render(<AiToggle active={false} onToggle={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'AI' })).toHaveAttribute('title', 'AI Search needs internet');
  });

  it('shows the mode label as title when enabled', () => {
    render(<AiToggle active={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'AI' })).toHaveAttribute('title', 'AI');
  });
});
