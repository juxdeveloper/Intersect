/**
 * History Drawer Component for Intersect (Phase V10).
 *
 * Requirements (Section 10):
 * - Minimal, restrained, dark-themed responsive slide-in drawer.
 * - Lists calculations newest first with equations, timestamp, result badge, direction, and color swatch.
 * - Activating a row reopens it with one click/tap or keyboard Enter/Space.
 * - Delete button per row with event bubbling stopped.
 * - Explicit bulk clear with confirmation.
 * - Keyboard accessible: focus trap, Escape to close, focus returned to trigger.
 * - Real empty, degraded, blocked, and per-record incompatible states.
 * - Complete localization: 0% mixed language state in ES and EN.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { HistoryListingSummary, HistoryStoreStatus } from '../contracts';
import type { StorageNotice } from '../persistence';
import { translations, type SupportedLanguage } from '../i18n';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  summaries: readonly HistoryListingSummary[];
  activeRecordId: string | null;
  status: HistoryStoreStatus;
  notice: StorageNotice | null;
  onSelectRecord: (id: string) => void;
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
  onClearNotice?: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  lang?: SupportedLanguage;
}

function formatRelativeTime(timestamp: number, lang: SupportedLanguage = 'es'): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 45) return lang === 'es' ? 'Ahora mismo' : 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  const d = new Date(timestamp);
  return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' });
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  summaries,
  activeRecordId,
  status,
  notice,
  onSelectRecord,
  onDeleteRecord,
  onClearAll,
  onClearNotice,
  triggerRef,
  lang = 'es',
}) => {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);
  const t = translations[lang] ?? translations.es;

  // Reset confirm state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmClear(false);
    }
  }, [isOpen]);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    // Focus close button initially
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      // Return focus to trigger element on close
      triggerRef?.current?.focus();
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <div
      className="history-drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden={!isOpen}
    >
      <aside
        ref={drawerRef}
        className="history-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t.history.title}
      >
        {/* Drawer Header */}
        <div className="history-drawer-header">
          <div className="history-header-title-row">
            <h2 className="history-drawer-title">{t.history.title}</h2>
            <span
              className="history-count-badge"
              aria-label={`${summaries.length} ${lang === 'es' ? 'cálculos guardados' : 'saved calculations'}`}
            >
              {summaries.length}
            </span>
          </div>

          <div className="history-header-actions">
            {summaries.length > 0 && (
              <button
                type="button"
                id="clear-all-history-btn"
                className={`history-clear-btn ${confirmClear ? 'confirming' : ''}`}
                onClick={() => {
                  if (confirmClear) {
                    onClearAll();
                    setConfirmClear(false);
                  } else {
                    setConfirmClear(true);
                  }
                }}
                onBlur={() => setConfirmClear(false)}
                title={confirmClear ? t.history.confirmTitle : t.history.clearAll}
                aria-label={confirmClear ? t.history.confirmTitle : t.history.clearAll}
              >
                {confirmClear ? t.history.confirmClear : t.history.clearAll}
              </button>
            )}

            <button
              ref={closeBtnRef}
              type="button"
              id="close-history-drawer-btn"
              className="history-drawer-close-btn"
              onClick={onClose}
              aria-label={t.history.closeAria}
              title={t.history.closeTitle}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Status / Degraded Notice */}
        {status === 'degraded' && (
          <div className="history-status-banner warning" role="status">
            <span>{t.history.degradedNotice}</span>
          </div>
        )}
        {status === 'blocked' && (
          <div className="history-status-banner warning" role="status">
            <span>{t.history.blockedNotice}</span>
          </div>
        )}
        {notice && (
          <div className={`history-status-banner ${notice.type}`} role="status">
            <span>{notice.message}</span>
            {onClearNotice && (
              <button
                type="button"
                className="banner-dismiss-btn"
                onClick={onClearNotice}
                aria-label={t.history.dismissNotice}
              >
                &times;
              </button>
            )}
          </div>
        )}

        {/* Empty State */}
        {summaries.length === 0 ? (
          <div className="history-empty-state">
            <p className="history-empty-title">{t.history.empty}</p>
            <p className="history-empty-subtitle">{t.history.emptySubtitle}</p>
          </div>
        ) : (
          /* History Items List */
          <div className="history-items-list" role="list">
            {summaries.map((item) => {
              const isActive = item.id === activeRecordId;
              const isCurve = item.statusKind === 'verified-curve';

              return (
                <div
                  key={item.id}
                  className={`history-card-item ${isActive ? 'is-active' : ''} ${item.isCorrupt ? 'is-corrupt' : ''}`}
                  role="listitem"
                >
                  <button
                    type="button"
                    className="history-card-main-btn"
                    onClick={() => {
                      onSelectRecord(item.id);
                      onClose();
                    }}
                    aria-label={`${t.history.openCalcPrefix} F: ${item.surfaceF}, G: ${item.surfaceG}`}
                    title={t.history.clickToReopen}
                  >
                    <div className="history-card-top-row">
                      <div className="history-equations-col">
                        <span className="history-eq-line f-line" title={`Surface F: ${item.surfaceF}`}>
                          <strong className="eq-label">F:</strong> {item.surfaceF}
                        </span>
                        <span className="history-eq-line g-line" title={`Surface G: ${item.surfaceG}`}>
                          <strong className="eq-label">G:</strong> {item.surfaceG}
                        </span>
                      </div>

                      {isCurve && (
                        <span
                          className="history-color-swatch-circle"
                          style={{ backgroundColor: item.curveColor }}
                          title={`${t.history.curveColorSaved} ${item.curveColor}`}
                          aria-label={`${t.history.curveColorAria} ${item.curveColor}`}
                        />
                      )}
                    </div>

                    <div className="history-card-meta-row">
                      <div className="history-badges-group">
                        {item.statusKind === 'verified-curve' && (
                          <span className="hist-status-badge verified">{t.history.badgeVerified}</span>
                        )}
                        {item.statusKind === 'empty-bounded' && (
                          <span className="hist-status-badge empty">{t.history.badgeEmpty}</span>
                        )}
                        {item.statusKind === 'degenerate' && (
                          <span className="hist-status-badge degenerate">{t.history.badgeDegenerate}</span>
                        )}
                        {item.statusKind === 'inconclusive' && (
                          <span className="hist-status-badge inconclusive">{t.history.badgeInconclusive}</span>
                        )}
                        {item.statusKind === 'corrupt' && (
                          <span className="hist-status-badge corrupt">{t.history.badgeCorrupt}</span>
                        )}
                        {item.statusKind === 'incompatible' && (
                          <span className="hist-status-badge corrupt">{t.history.badgeIncompatible}</span>
                        )}

                        <span className="hist-direction-badge">
                          {item.direction === 'reverse' ? t.history.badgeRev : t.history.badgeFwd}
                        </span>

                        {isActive && (
                          <span className="hist-active-pill">{t.history.badgeActive}</span>
                        )}
                      </div>

                      <time className="history-timestamp" dateTime={new Date(item.createdAt).toISOString()}>
                        {formatRelativeTime(item.createdAt, lang)}
                      </time>
                    </div>
                  </button>

                  {/* Separate semantic Delete Button */}
                  <button
                    type="button"
                    id={`delete-record-${item.id}`}
                    className="history-row-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRecord(item.id);
                    }}
                    aria-label={`${t.history.deleteCalcPrefix} F: ${item.surfaceF}, G: ${item.surfaceG}`}
                    title={t.history.deleteThisRecord}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
};
