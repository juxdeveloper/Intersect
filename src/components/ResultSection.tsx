import React, { useState, useEffect, useRef } from 'react';
import {
  type ExactCurve,
  type DerivationRecord,
  type CalculationResult,
  DEFAULT_CURVE_PALETTE_COLOR,
} from '../contracts';
import { ColorEditorPopover } from './ColorEditorPopover';
import { pythonExprToLatex, formatIntervalToLatex } from '../math/latex-formatter';
import {
  translations,
  getLocalizedStepTitle,
  getLocalizedStepExplanation,
  getLocalizedSolverMessage,
  getLocalizedProofExplanation,
  type SupportedLanguage,
} from '../i18n';
import { ChevronDown } from 'lucide-react';

interface ResultSectionProps {
  result?: CalculationResult | null;
  calculationId?: string | number;
  curveColor?: string;
  onCurveColorChange?: (color: string) => void;
  onPreviewCurveColor?: (color: string) => void;
  curve?: ExactCurve;
  derivation?: DerivationRecord;
  isExample?: boolean;
  isDraftDirty?: boolean;
  submittedEquations?: { surfaceF: string; surfaceG: string } | null;
  lang?: SupportedLanguage;
}

export const ResultSection: React.FC<ResultSectionProps> = ({
  result,
  calculationId,
  curveColor = DEFAULT_CURVE_PALETTE_COLOR,
  onCurveColorChange,
  onPreviewCurveColor,
  curve: legacyCurve,
  derivation: _legacyDerivation,
  isDraftDirty = false,
  submittedEquations,
  lang = 'es',
}) => {
  const [derivationOpen, setDerivationOpen] = useState(false);
  const [isColorEditorOpen, setIsColorEditorOpen] = useState(false);
  const prevCalcIdRef = useRef<string | number | undefined>(calculationId);
  const editBtnRef = useRef<HTMLButtonElement | null>(null);

  const t = translations[lang] ?? translations.es;

  // Collapse derivation and close color editor on each new calculation
  useEffect(() => {
    if (calculationId !== undefined && calculationId !== prevCalcIdRef.current) {
      prevCalcIdRef.current = calculationId;
      setDerivationOpen(false);
      setIsColorEditorOpen(false);
    }
  }, [calculationId]);

  const handleToggleDerivation = () => {
    setDerivationOpen((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggleDerivation();
    }
  };

  // Branch 1: CalculationResult provided
  if (result) {
    if (result.status === 'verified-curve') {
      const curve = result.curve;
      const derivation = result.derivation;

      return (
        <div className="result-section">
          <div className="curve-header">
            <div className="curve-header-left">
              <span className="curve-label">{t.curve.yourCurve}</span>
              <div className="curve-color-control-wrapper" style={{ position: 'relative', display: 'inline-flex' }}>
                <button
                  ref={editBtnRef}
                  type="button"
                  id="curve-color-edit-btn"
                  className="curve-color-trigger-btn"
                  onClick={() => setIsColorEditorOpen((prev) => !prev)}
                  title={t.curve.editColor}
                  aria-label={t.curve.editColor}
                  aria-haspopup="dialog"
                  aria-expanded={isColorEditorOpen}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'none',
                    border: 'none',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="curve-swatch"
                    style={{
                      backgroundColor: curveColor,
                      boxShadow: `0 0 8px ${curveColor}44`,
                      display: 'inline-block',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                    }}
                  />
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>

                <ColorEditorPopover
                  isOpen={isColorEditorOpen}
                  currentColor={curveColor}
                  calculationId={calculationId ?? 'default'}
                  triggerRef={editBtnRef}
                  onCommit={(newColor) => {
                    onCurveColorChange?.(newColor);
                  }}
                  onPreview={(preview) => {
                    onPreviewCurveColor?.(preview);
                  }}
                  onClose={() => setIsColorEditorOpen(false)}
                  lang={lang}
                />
              </div>
            </div>
          </div>

          <div className={`curve-card ${isDraftDirty ? 'is-stale-draft' : ''}`}>
            {isDraftDirty && (
              <div className="draft-dirty-notice" role="status">
                <span className="dirty-indicator" aria-hidden="true">●</span>
                <span>
                  {t.results.draftEdited}
                  {submittedEquations ? ` (${submittedEquations.surfaceF} & ${submittedEquations.surfaceG})` : ''}
                </span>
              </div>
            )}

            {/* LaTeX Mathematical Formula Display */}
            <div className="curve-formula-box">
              <div className="curve-equation">
                <math-field
                  read-only
                  class="result-math-field"
                  style={{
                    display: 'block',
                    background: 'transparent',
                    border: 'none',
                    padding: '2px 0',
                    fontSize: '1.05rem',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                >
                  {`\\mathbf{r}(${curve.paramSymbol}) = \\left( ${pythonExprToLatex(curve.x)},\\; ${pythonExprToLatex(curve.y)},\\; ${pythonExprToLatex(curve.z)} \\right)`}
                </math-field>
              </div>
              <div className="curve-domain" style={{ marginTop: '4px' }}>
                <math-field
                  read-only
                  class="result-math-field"
                  style={{
                    display: 'block',
                    background: 'transparent',
                    border: 'none',
                    padding: '0',
                    fontSize: '0.95rem',
                    color: 'var(--text-secondary)',
                    outline: 'none',
                  }}
                >
                  {formatIntervalToLatex(curve.domain, curve.paramSymbol)}
                </math-field>
              </div>
            </div>

            {/* Derivation Disclosure */}
            {derivation && (
              <div className="derivation-container" style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  id="derivation-disclosure-toggle"
                  className="derivation-toggle-btn"
                  onClick={handleToggleDerivation}
                  onKeyDown={handleKeyDown}
                  aria-expanded={derivationOpen}
                  aria-controls="derivation-content-panel"
                  aria-label={derivationOpen ? t.results.hideDerivation : t.results.viewDerivation}
                >
                  <span style={{ fontWeight: 500 }}>
                    {derivationOpen ? t.results.hideDerivation : t.results.viewDerivation}
                  </span>
                  <ChevronDown
                    size={16}
                    style={{
                      transform: derivationOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                </button>

                {derivationOpen && (
                  <div
                    id="derivation-content-panel"
                    role="region"
                    aria-labelledby="derivation-disclosure-toggle"
                    className="derivation-content"
                  >
                    {derivation.steps.map((step) => {
                      return (
                        <div key={step.stepNumber} className="derivation-step-item">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span className="step-number-badge" aria-label={`${t.results.step} ${step.stepNumber}`}>
                              {step.stepNumber}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                              {getLocalizedStepTitle(step.title, lang)}
                            </span>
                          </div>
                          <div className="derivation-step-formula">
                            <math-field
                              read-only
                              class="result-math-field"
                              style={{
                                display: 'block',
                                background: 'transparent',
                                border: 'none',
                                padding: '0',
                                fontSize: '0.88rem',
                                color: 'var(--text-primary)',
                                outline: 'none',
                              }}
                            >
                              {pythonExprToLatex(step.formulaText)}
                            </math-field>
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', lineHeight: 1.45 }}>
                            {getLocalizedStepExplanation(step.explanation, lang)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (result.status === 'empty-bounded') {
      const isGlobal = result.proofScope === 'global';
      return (
        <div className="result-section">
          <div className="curve-header">
            <span className="curve-label">{t.results.title}</span>
          </div>
          <div className={`curve-card ${isDraftDirty ? 'is-stale-draft' : ''}`} style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {result.proofExplanation ? getLocalizedProofExplanation(result.proofExplanation, lang) : t.results.noIntersection}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {isGlobal ? t.results.globalProof : t.results.boundedRegion}
            </div>
          </div>
        </div>
      );
    }

    if (result.status === 'degenerate') {
      return (
        <div className="result-section">
          <div className="curve-header">
            <span className="curve-label">{t.results.title}</span>
          </div>
          <div className={`curve-card ${isDraftDirty ? 'is-stale-draft' : ''}`} style={{ borderColor: 'rgba(251, 191, 36, 0.3)' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              {result.message ? getLocalizedSolverMessage(result.message, lang) : t.results.isolatedPoint}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '2px' }}>
              {result.explanation ? getLocalizedStepExplanation(result.explanation, lang) : ''}
            </div>
            {result.points && result.points.length > 0 && (
              <div
                style={{
                  background: 'var(--bg-input)',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  marginTop: '6px',
                }}
              >
                {result.points.map((pt, i) => (
                  <div key={i} style={{ color: 'var(--text-primary)' }}>
                    P{result.points!.length > 1 ? ` ${i + 1}` : ''} = ({pt.x}, {pt.y}, {pt.z})
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (result.status === 'inconclusive' || result.status === 'unsupported') {
      return (
        <div className="result-section">
          <div className="curve-header">
            <span className="curve-label">{t.results.title}</span>
          </div>
          <div className={`curve-card ${isDraftDirty ? 'is-stale-draft' : ''}`} style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {result.message ? getLocalizedSolverMessage(result.message, lang) : t.results.inconclusive}
            </div>
          </div>
        </div>
      );
    }
  }

  // Fallback to legacy curve props if passed
  if (legacyCurve) {
    return (
      <div className="result-section">
        <div className="curve-header">
          <span className="curve-label">{t.curve.yourCurve}</span>
          <span
            className="curve-swatch"
            style={{ backgroundColor: curveColor, width: '14px', height: '14px', borderRadius: '50%', display: 'inline-block' }}
          />
        </div>
        <div className="curve-card">
          <div className="curve-formula-box">
            <math-field
              read-only
              class="result-math-field"
              style={{
                display: 'block',
                background: 'transparent',
                border: 'none',
                fontSize: '1.05rem',
                color: 'var(--text-primary)',
              }}
            >
              {`\\mathbf{r}(${legacyCurve.paramSymbol}) = \\left( ${pythonExprToLatex(legacyCurve.x)},\\; ${pythonExprToLatex(legacyCurve.y)},\\; ${pythonExprToLatex(legacyCurve.z)} \\right)`}
            </math-field>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
