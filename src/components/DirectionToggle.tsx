import React, { useRef } from 'react';
import type { TraversalDirection } from '../contracts';
import { translations, type SupportedLanguage } from '../i18n';
import { ArrowRight, ArrowLeft } from 'lucide-react';

interface DirectionToggleProps {
  direction: TraversalDirection;
  onChange: (direction: TraversalDirection) => void;
  disabled?: boolean;
  lang?: SupportedLanguage;
}

export const DirectionToggle: React.FC<DirectionToggleProps> = ({
  direction,
  onChange,
  disabled = false,
  lang = 'es',
}) => {
  const forwardBtnRef = useRef<HTMLButtonElement | null>(null);
  const reverseBtnRef = useRef<HTMLButtonElement | null>(null);
  const t = translations[lang] ?? translations.es;

  const handleKeyDown = (e: React.KeyboardEvent, currentDir: TraversalDirection) => {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const nextDir: TraversalDirection = currentDir === 'forward' ? 'reverse' : 'forward';
      onChange(nextDir);
      if (nextDir === 'forward') {
        forwardBtnRef.current?.focus();
      } else {
        reverseBtnRef.current?.focus();
      }
    }
  };

  return (
    <div className="direction-group">
      <div className="section-label-row">
        <span className="section-label" id="direction-group-label">{t.orientation.title}</span>
      </div>
      <div
        className="direction-buttons"
        role="radiogroup"
        aria-labelledby="direction-group-label"
      >
        <button
          ref={forwardBtnRef}
          type="button"
          id="forward-direction-btn"
          role="radio"
          className={`direction-btn ${direction === 'forward' ? 'active' : ''}`}
          onClick={() => onChange('forward')}
          onKeyDown={(e) => handleKeyDown(e, 'forward')}
          aria-checked={direction === 'forward'}
          tabIndex={direction === 'forward' ? 0 : -1}
          aria-label={t.orientation.forwardHint}
          disabled={disabled}
          title={t.orientation.forwardHint}
        >
          <ArrowRight size={14} style={{ marginRight: '6px' }} />
          {t.orientation.forward}
        </button>
        <button
          ref={reverseBtnRef}
          type="button"
          id="reverse-direction-btn"
          role="radio"
          className={`direction-btn ${direction === 'reverse' ? 'active' : ''}`}
          onClick={() => onChange('reverse')}
          onKeyDown={(e) => handleKeyDown(e, 'reverse')}
          aria-checked={direction === 'reverse'}
          tabIndex={direction === 'reverse' ? 0 : -1}
          aria-label={t.orientation.reverseHint}
          disabled={disabled}
          title={t.orientation.reverseHint}
        >
          <ArrowLeft size={14} style={{ marginRight: '6px' }} />
          {t.orientation.reverse}
        </button>
      </div>
    </div>
  );
};
