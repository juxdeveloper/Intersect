import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import '../mathlive/setup';
import type { MathfieldElement } from '../mathlive/setup';
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

    // Setup element listeners and lifecycle
    useEffect(() => {
      const mf = mathFieldRef.current;
      if (!mf) return;

      // Guarantee initial value is populated on mount
      if (mf.value !== value) {
        mf.setValue(value, { silenceNotifications: true });
        lastEmittedValueRef.current = value;
      }

      // Explicitly set manual policy so physical keyboard users don't get unwanted popups
      mf.mathVirtualKeyboardPolicy = 'manual';

      const handleInput = (e: Event) => {
        const target = e.target as MathfieldElement;
        const currentLatex = target.value;
        lastEmittedValueRef.current = currentLatex;
        onChange(currentLatex);
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        // Submit on Enter key if not composing with IME
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          if (onSubmit) {
            onSubmit();
          }
        }
      };

      const updateKeyboardStatus = () => {
        if (
          typeof window !== 'undefined' &&
          'mathVirtualKeyboard' in window &&
          window.mathVirtualKeyboard
        ) {
          const kbdVisible = Boolean(window.mathVirtualKeyboard.visible);
          const hasFieldFocus = document.activeElement === mf || mf.matches(':focus-within');
          setIsKeyboardActive(kbdVisible && hasFieldFocus);
        }
      };

      const handleFocusIn = () => {
        setIsFocused(true);
        // On mobile / touch device, auto-show the math virtual keyboard just like mobile apps
        const isTouch =
          typeof window !== 'undefined' &&
          (window.matchMedia('(pointer: coarse)').matches ||
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0);
        if (
          isTouch &&
          typeof window !== 'undefined' &&
          'mathVirtualKeyboard' in window &&
          window.mathVirtualKeyboard
        ) {
          window.mathVirtualKeyboard.show();
        }
        updateKeyboardStatus();
      };

      const handleFocusOut = () => {
        setIsFocused(false);
        setIsKeyboardActive(false);

        // Delay to check if focus moved to virtual keyboard or related button
        setTimeout(() => {
          const active = document.activeElement;
          const isStillInMathfield =
            active?.tagName === 'MATH-FIELD' || active?.closest('math-field');
          const isInsideKbd =
            active?.closest('.ML__keyboard') || active?.closest('mathlive-virtual-keyboard');
          if (!isStillInMathfield && !isInsideKbd) {
            if (
              typeof window !== 'undefined' &&
              'mathVirtualKeyboard' in window &&
              window.mathVirtualKeyboard?.visible
            ) {
              window.mathVirtualKeyboard.hide();
            }
          }
        }, 120);
      };

      const handleGlobalPointerDown = (e: PointerEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        // If click is outside this mathfield and not inside virtual keyboard or toggle button
        const isInsideField = mf.contains(target) || target.closest('math-field');
        const isInsideToggle = target.closest('.keyboard-icon-btn');
        const isInsideKbd =
          target.closest('.ML__keyboard') || target.closest('mathlive-virtual-keyboard');

        if (!isInsideField && !isInsideToggle && !isInsideKbd) {
          if (
            typeof window !== 'undefined' &&
            'mathVirtualKeyboard' in window &&
            window.mathVirtualKeyboard?.visible
          ) {
            window.mathVirtualKeyboard.hide();
            setIsKeyboardActive(false);
          }
        }
      };

      mf.addEventListener('input', handleInput);
      mf.addEventListener('keydown', handleKeyDown);
      mf.addEventListener('focusin', handleFocusIn);
      mf.addEventListener('focusout', handleFocusOut);
      document.addEventListener('pointerdown', handleGlobalPointerDown);

      // Listen to geometry changes on the virtual keyboard singleton
      const handleGeometryChange = () => {
        updateKeyboardStatus();
      };

      if (
        typeof window !== 'undefined' &&
        'mathVirtualKeyboard' in window &&
        window.mathVirtualKeyboard
      ) {
        window.mathVirtualKeyboard.addEventListener('geometrychange', handleGeometryChange);
      }

      return () => {
        mf.removeEventListener('input', handleInput);
        mf.removeEventListener('keydown', handleKeyDown);
        mf.removeEventListener('focusin', handleFocusIn);
        mf.removeEventListener('focusout', handleFocusOut);
        document.removeEventListener('pointerdown', handleGlobalPointerDown);
        if (
          typeof window !== 'undefined' &&
          'mathVirtualKeyboard' in window &&
          window.mathVirtualKeyboard
        ) {
          window.mathVirtualKeyboard.removeEventListener('geometrychange', handleGeometryChange);
        }
      };
    }, [onChange, onSubmit, value]);

    // Handle virtual keyboard toggle button click
    const handleToggleVirtualKeyboard = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const mf = mathFieldRef.current;
      if (!mf) return;

      if (typeof window === 'undefined' || !('mathVirtualKeyboard' in window)) return;
      const kbd = window.mathVirtualKeyboard;

      const hasFieldFocus = document.activeElement === mf || mf.matches(':focus-within');

      if (kbd.visible && hasFieldFocus) {
        kbd.hide();
        setIsKeyboardActive(false);
      } else {
        mf.focus();
        kbd.show();
        setIsKeyboardActive(true);
      }
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
