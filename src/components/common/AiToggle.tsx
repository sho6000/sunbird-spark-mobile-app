import React from 'react';
import { useTranslation } from 'react-i18next';
import { SparkleIcon } from './SparkleIcon';
import './AiSearch.css';

interface AiToggleProps {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * In-bar "✦ AI" pill that toggles a search bar between keyword and semantic mode.
 * Sits on the trailing edge of the search input, separated by a vertical divider.
 * When active the pill is filled and the sparkle blinks.
 */
export const AiToggle: React.FC<AiToggleProps> = ({ active, onToggle, disabled = false }) => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className={`ai-toggle${active ? ' ai-toggle--active' : ''}`}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      aria-label={t('semanticMode')}
      title={disabled ? t('aiOfflineHint') : t('semanticMode')}
    >
      <SparkleIcon
        size={14}
        color={active ? '#ffffff' : 'var(--ion-color-primary)'}
      />
      <span className="ai-toggle__label">{t('semanticMode')}</span>
    </button>
  );
};

export default AiToggle;
