/**
 * ColorEditorPopover Component for Intersect Phase V9.
 *
 * Responsibilities:
 * 1. Compact, accessible custom popover for active curve color customization.
 * 2. Displays curated palette swatches and an editable hex text field.
 * 3. Live previews changes immediately on the curve, swatch, and legend marker.
 * 4. Commit/cancel semantics: Apply commits, Cancel / Escape restores initial color.
 * 5. Outside-click commits the currently previewed color and closes cleanly.
 * 6. Traps/manages focus and restores focus to the trigger element on close.
 * 7. Bounded by calculationId: automatically resets if a new calculation replaces it.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CURVE_PALETTE,
  normalizeHexColor,
} from '../contracts/appearance';
import { translations, type SupportedLanguage } from '../i18n';

export interface ColorEditorPopoverProps {
  isOpen: boolean;
  currentColor: string;
  calculationId: string | number;
  triggerRef: React.RefObject<HTMLElement | null>;
  onCommit: (color: string) => void;
  onPreview: (color: string) => void;
  onClose: () => void;
  lang?: SupportedLanguage;
}

export const ColorEditorPopover: React.FC<ColorEditorPopoverProps> = ({
  isOpen,
  currentColor,
  calculationId,
  triggerRef,
  onCommit,
  onPreview,
  onClose,
  lang = 'es',
}) => {
  const t = translations[lang] ?? translations.es;
  const [initialColor, setInitialColor] = useState<string>(currentColor);
  const [previewColor, setPreviewColor] = useState<string>(currentColor);
  const [hexInput, setHexInput] = useState<string>(currentColor);
  const [hexError, setHexError] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const activeCalcIdRef = useRef<string | number>(calculationId);
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);

  // Sync state whenever editor opens or calculation changes
  useEffect(() => {
    if (isOpen) {
      setInitialColor(currentColor);
      setPreviewColor(currentColor);
      setHexInput(currentColor);
      setHexError(null);
      activeCalcIdRef.current = calculationId;
    }
  }, [isOpen, currentColor, calculationId]);

  // If calculationId changes while popover is open, close without applying stale edits
  useEffect(() => {
    if (isOpen && calculationId !== activeCalcIdRef.current) {
      onClose();
    }
  }, [calculationId, isOpen, onClose]);

  const wasOpenRef = useRef(false);

  // Focus management on open and restore on close
  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      // Focus first element or swatch
      const timer = setTimeout(() => {
        firstFocusableRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      // Restore focus to trigger only after user closed popover
      triggerRef.current?.focus();
    }
  }, [isOpen, triggerRef]);

  // Outside click listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        // Outside click commits current preview and closes
        const valid = normalizeHexColor(previewColor);
        if (valid) {
          onCommit(valid);
        } else {
          onPreview(initialColor);
        }
        onClose();
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isOpen, previewColor, initialColor, onCommit, onPreview, onClose, triggerRef]);

  // Global Escape key listener to ensure dismiss works regardless of intermediate focus state
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onPreview(initialColor);
        onClose();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [isOpen, initialColor, onPreview, onClose]);

  // Keyboard navigation & accessibility (Escape to cancel, Tab trap)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onPreview(initialColor);
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!popoverRef.current) return;
        const focusables = popoverRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;

        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [initialColor, onPreview, onClose],
  );

  const handleSwatchSelect = (swatch: string) => {
    setPreviewColor(swatch);
    setHexInput(swatch);
    setHexError(null);
    onPreview(swatch);
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setHexInput(raw);

    const norm = normalizeHexColor(raw);
    if (norm) {
      setHexError(null);
      setPreviewColor(norm);
      onPreview(norm);
    } else {
      if (raw.trim().length > 0 && raw.trim() !== '#') {
        setHexError(t.curve.hexError);
      } else {
        setHexError(null);
      }
    }
  };

  const handleApply = () => {
    const valid = normalizeHexColor(previewColor);
    if (valid) {
      onCommit(valid);
      onClose();
    }
  };

  const handleCancel = () => {
    onPreview(initialColor);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="color-editor-popover"
      role="dialog"
      aria-label={t.curve.editColor}
      aria-modal="true"
      onKeyDown={handleKeyDown}
    >
      <div className="color-editor-header">
        <span className="color-editor-title">{t.curve.colorPickerTitle}</span>
        <button
          type="button"
          className="color-editor-close-btn"
          onClick={handleCancel}
          aria-label={t.curve.closeEsc}
          title={t.curve.closeEsc}
        >
          &times;
        </button>
      </div>

      {/* Curated Swatches Grid */}
      <div className="color-swatches-grid" role="group" aria-label={t.curve.presetColors}>
        {CURVE_PALETTE.map((swatch, idx) => {
          const isSelected = previewColor.toLowerCase() === swatch.toLowerCase();
          return (
            <button
              key={swatch}
              ref={idx === 0 ? firstFocusableRef : undefined}
              type="button"
              className={`color-swatch-item ${isSelected ? 'is-selected' : ''}`}
              style={{ backgroundColor: swatch }}
              onClick={() => handleSwatchSelect(swatch)}
              aria-label={`${t.curve.swatchColorAria} ${swatch}`}
              aria-pressed={isSelected}
              title={swatch}
            >
              {isSelected && (
                <svg
                  className="swatch-check-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={swatch === '#f5eedb' || swatch === '#fbbf24' ? '#111' : '#fff'}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom Hex Value Field with Live Preview Swatch */}
      <div className="color-custom-row">
        <div
          className="color-custom-preview"
          style={{ backgroundColor: previewColor }}
          title={`${t.curve.activePreview} ${previewColor}`}
          aria-hidden="true"
        />
        <div className="color-input-wrapper">
          <label htmlFor="curve-hex-input" className="sr-only">
            {t.curve.hexColorLabel}
          </label>
          <input
            id="curve-hex-input"
            type="text"
            className={`color-hex-input ${hexError ? 'is-invalid' : ''}`}
            value={hexInput}
            onChange={handleHexChange}
            placeholder="#RRGGBB"
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={Boolean(hexError)}
          />
        </div>
      </div>

      {hexError && (
        <div className="color-error-text" role="alert">
          {hexError}
        </div>
      )}

      {/* Action Buttons: Apply & Cancel */}
      <div className="color-editor-actions">
        <button
          type="button"
          className="color-action-btn cancel"
          onClick={handleCancel}
          aria-label={t.curve.cancel}
        >
          {t.curve.cancel}
        </button>
        <button
          type="button"
          className="color-action-btn apply"
          onClick={handleApply}
          aria-label={t.curve.apply}
        >
          {t.curve.apply}
        </button>
      </div>
    </div>
  );
};
