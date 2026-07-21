import React from 'react';
import { useTranslation } from 'react-i18next';
import { SparkleIcon } from './SparkleIcon';
import './AiSearch.css';

interface SemanticSuggestionsProps {
  onPick: (query: string) => void;
  offline?: boolean;
}

/**
 * Empty-state shown when AI search is active but the query is empty.
 * Title + subtitle + a list of example prompts (chips). No content cards.
 */
export const SemanticSuggestions: React.FC<SemanticSuggestionsProps> = ({ onPick, offline = false }) => {
  const { t } = useTranslation();
  const raw = t('semanticSuggestions', { returnObjects: true });
  const suggestions: string[] = Array.isArray(raw) ? (raw as string[]) : [];

  return (
    <div className="ai-suggest" role="region" aria-label={t('semanticSuggestTitle')}>
      <div className="ai-suggest__head">
        <SparkleIcon className="ai-blink" size={20} color="var(--ion-color-primary)" />
        <h2 className="ai-suggest__title">{t('semanticSuggestTitle')}</h2>
        <SparkleIcon className="ai-blink" size={20} color="var(--ion-color-primary)" />
      </div>
      <p className="ai-suggest__subtitle">{t('semanticSuggestSubtitle')}</p>

      {offline ? (
        <p className="ai-suggest__offline" role="status">{t('aiOfflineHint')}</p>
      ) : (
        <div className="ai-suggest__chips">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="ai-suggest__chip"
              onClick={() => onPick(s)}
            >
              <SparkleIcon size={13} color="var(--ion-color-primary)" />
              <span>{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SemanticSuggestions;
