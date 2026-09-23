import React from 'react';
import { Logo } from './Logo';
import { translations, type SupportedLanguage } from '../i18n';
import type { ThemePreference } from '../styles/theme';
import { Sun, Moon, Monitor, Globe, History, Download } from 'lucide-react';

interface HeaderProps {
  lang: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onOpenHistory: () => void;
  historyTriggerRef?: React.RefObject<HTMLButtonElement | null>;
  historyCount?: number;
  canInstall?: boolean;
  onInstall?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  onLanguageChange,
  theme,
  onThemeChange,
  onOpenHistory,
  historyTriggerRef,
  historyCount,
  canInstall,
  onInstall,
}) => {
  const t = translations[lang] ?? translations.es;

  const cycleTheme = () => {
    if (theme === 'auto') onThemeChange('dark');
    else if (theme === 'dark') onThemeChange('light');
    else onThemeChange('auto');
  };

  const toggleLanguage = () => {
    onLanguageChange(lang === 'es' ? 'en' : 'es');
  };

  return (
    <header className="app-header">
      <div className="header-brand-row">
        <div className="brand-identity">
          <div className="brand-logo-container">
            <Logo size={30} />
          </div>
          <div className="brand-text">
            <h1 className="app-title">{t.app.title}</h1>
            <p className="app-subtitle">{t.app.subtitle}</p>
          </div>
        </div>

        <div className="header-actions">
          {/* PWA Install Button */}
          {canInstall && (
            <button
              type="button"
              className="header-btn install-btn"
              onClick={onInstall}
              title={t.header.installApp}
              aria-label={t.header.installApp}
            >
              <Download size={13} />
              <span className="header-btn-label hide-on-narrow">{t.header.installApp}</span>
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            type="button"
            id="theme-toggle-btn"
            className="header-btn"
            onClick={cycleTheme}
            title={theme === 'auto' ? t.header.themeAuto : theme === 'dark' ? t.header.themeDark : t.header.themeLight}
            aria-label={theme === 'auto' ? t.header.themeAuto : theme === 'dark' ? t.header.themeDark : t.header.themeLight}
          >
            {theme === 'auto' ? <Monitor size={13} /> : theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
            <span className="header-btn-label">
              {theme === 'auto' ? t.header.themeLabelAuto : theme === 'dark' ? t.header.themeLabelDark : t.header.themeLabelLight}
            </span>
          </button>

          {/* Language Switch Button */}
          <button
            type="button"
            id="lang-toggle-btn"
            className="header-btn lang-btn"
            onClick={toggleLanguage}
            title={t.header.langToggleTitle}
            aria-label={t.header.langToggleAria}
          >
            <Globe size={13} />
            <span className="header-btn-label" style={{ fontWeight: 700 }}>{lang.toUpperCase()}</span>
          </button>

          {/* History Button */}
          <button
            ref={historyTriggerRef}
            type="button"
            id="history-entry-btn"
            className="header-btn history-btn"
            onClick={onOpenHistory}
            title={t.header.history}
            aria-label={t.header.history}
          >
            <History size={13} />
            <span className="header-btn-label">{t.header.history}</span>
            {typeof historyCount === 'number' && historyCount > 0 && (
              <span className="history-count-badge">
                {historyCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
