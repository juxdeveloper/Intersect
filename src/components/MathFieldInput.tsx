import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import '../mathlive/setup';
import type { MathfieldElement } from '../mathlive/setup';
import { registerKeyboardField, showKeyboard, toggleKeyboard } from '../mathlive/keyboard';
import type { EquationDiagnostic } from '../contracts/expressions';
import { translations, getLocalizedDiagnosticMessage, type SupportedLanguage } from '../i18n';

export interface MathFieldInputHandle {
  focus: () => void;
  blur: () => void;
  getValue: () => string;
  getElement: () => MathfieldElement | null;
}

interface MathFieldInputProps {
  id: string;
  label: 'Surface F' | 'Surface G' | string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  diagnostic?: EquationDiagnostic | null;
  surfaceTag?: 'f' | 'g';
  lang?: SupportedLanguage;
}

export const MathFieldInput = forwardRef<MathFieldInputHandle, MathFieldInputProps>(
  (
    {
      id,
      label,
      value,
      onChange,
      onSubmit,
      placeholder = 'e.g. x^2 + y^2 = 4',
      diagnostic,
      surfaceTag = 'f',
      lang = 'es',
    },
    ref,
  ) => {
    const t = translations[lang] ?? translations.es;
    const mathFieldRef = useRef<MathfieldElement | null>(null);
    const lastEmittedValueRef = useRef<string>(value);
    const callbacksRef = useRef({ onChange, onSubmit });
    callbacksRef.current = { onChange, onSubmit };
    const [isKeyboardActive, setIsKeyboardActive] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // Expose focus/blur and element retrieval to parent components
    useImperativeHandle(ref, () => ({
      focus: () => {
        if (mathFieldRef.current) {
          mathFieldRef.current.focus();
        }
      },
      blur: () => {
        if (mathFieldRef.current) {
          mathFieldRef.current.blur();
        }
      },
      getValue: () => mathFieldRef.current?.value ?? '',
      getElement: () => mathFieldRef.current,
    }));

    // Synchronize programmatic value changes without destroying cursor or undo history
    useEffect(() => {
      const mf = mathFieldRef.current;
      if (!mf) return;

      // Update when external prop differs from current element value and isn't just what user typed
      if (mf.value !== value) {
        if (value !== lastEmittedValueRef.current || !mf.value) {
          lastEmittedValueRef.current = value;
          mf.setValue(value, { silenceNotifications: true });
        }
      }
    }, [value]);

    // Register each editor once; React value updates must not reset keyboard focus.
    useEffect(() => {
      const mf = mathFieldRef.current;
      if (!mf) return;
      const updateStatus = () => {
        const focused = document.activeElement === mf;
        setIsFocused(focused);
        setIsKeyboardActive(focused && window.mathVirtualKeyboard.visible);
      };
      const unregister = registerKeyboardField(mf, updateStatus);
      const handleInput = () => {
        lastEmittedValueRef.current = mf.value;
        callbacksRef.current.onChange(mf.value);
      };
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' && !event.isComposing) {
          event.preventDefault();
          callbacksRef.current.onSubmit?.();
        }
      };
      const handleFocus = () => {
        if (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0) {
          showKeyboard(mf);
        }
        updateStatus();
      };
      mf.addEventListener('input', handleInput);
      mf.addEventListener('keydown', handleKeyDown);
      mf.addEventListener('focusin', handleFocus);
      mf.addEventListener('focusout', updateStatus);
      return () => {
        mf.removeEventListener('input', handleInput);
        mf.removeEventListener('keydown', handleKeyDown);
        mf.removeEventListener('focusin', handleFocus);
        mf.removeEventListener('focusout', updateStatus);
        unregister();
      };
    }, []);

    const handleToggleVirtualKeyboard = (event: React.MouseEvent) => {
      event.preventDefault();
      if (mathFieldRef.current) toggleKeyboard(mathFieldRef.current);
    };

    const hasError = Boolean(diagnostic);

    return (
      <div className={`form-section ${hasError ? 'has-error' : ''}`}>
        <div className="section-label-row">
          <label htmlFor={id} className="section-label">
            <span
              className={`surface-indicator-dot surface-${surfaceTag}`}
              aria-hidden="true"
            />
            {label}
          </label>
          {diagnostic && (
            <span className="diagnostic-badge" role="status">
              [{diagnostic.reasonCode}]
            </span>
          )}
        </div>

        <div
          className={`input-container mathfield-container ${isFocused ? 'is-focused' : ''} ${
            hasError ? 'is-invalid' : ''
          }`}
        >
          <math-field
            id={id}
            ref={mathFieldRef}
            class="intersect-mathfield"
            inputMode="none"
            placeholder={placeholder}
            aria-label={`${t.inputs.mathEquationAria} ${label}`}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${id}-error` : `${id}-instruction`}
          >
            {value}
          </math-field>

          <button
            type="button"
            className={`keyboard-icon-btn ${isKeyboardActive ? 'is-active' : ''}`}
            onPointerDown={(event) => event.preventDefault()}
            onClick={handleToggleVirtualKeyboard}
            aria-label={
              isKeyboardActive
                ? `${t.inputs.closeKeyboardTitle} (${label})`
                : `${t.inputs.openKeyboardTitle} (${label})`
            }
            aria-pressed={isKeyboardActive}
            title={
              isKeyboardActive
                ? `${t.inputs.closeKeyboardTitle} (${label})`
                : `${t.inputs.openKeyboardTitle} (${label})`
            }
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
              <line x1="6" y1="8" x2="6" y2="8" />
              <line x1="10" y1="8" x2="10" y2="8" />
              <line x1="14" y1="8" x2="14" y2="8" />
              <line x1="18" y1="8" x2="18" y2="8" />
              <line x1="6" y1="12" x2="6" y2="12" />
              <line x1="10" y1="12" x2="10" y2="12" />
              <line x1="14" y1="12" x2="14" y2="12" />
              <line x1="18" y1="12" x2="18" y2="12" />
              <line x1="7" y1="16" x2="17" y2="16" />
            </svg>
          </button>
        </div>

        {diagnostic && (
          <p id={`${id}-error`} className="input-error-message" role="alert">
            {getLocalizedDiagnosticMessage(diagnostic, lang)}
          </p>
        )}
      </div>
    );
  },
);

MathFieldInput.displayName = 'MathFieldInput';
