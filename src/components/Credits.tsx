import type { SupportedLanguage } from '../i18n';
import { translations } from '../i18n';
import { ArrowUpRight, Scale } from 'lucide-react';

/** Local SVG marks keep profile links independent of external icon services. */
function GithubMark() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03A9.58 9.58 0 0 1 12 6.83c.85 0 1.71.11 2.51.34 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.76c0 .26.18.58.69.48A10 10 0 0 0 12 2Z" />
  </svg>;
}

function InstagramMark() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
  </svg>;
}

export function Credits({ lang }: { lang: SupportedLanguage }) {
  const t = translations[lang].credits;
  return <footer className="app-credits" aria-label={t.label}>
    <div className="credits-heading"><span className="credits-accent" aria-hidden="true" />{t.label}</div>
    <p className="credits-person">
      <span className="credits-role">{t.creator} </span>
      <strong>Angel Joseph Estrada Santos </strong>
      <a className="credits-profile" href="https://github.com/juxdeveloper" target="_blank" rel="noopener noreferrer" aria-label="Angel Joseph Estrada Santos · GitHub @juxdeveloper">
        <GithubMark />(@juxdeveloper)<ArrowUpRight size={11} />
      </a>
    </p>
    <p className="credits-person">
      <span className="credits-role">{t.collaborator}: </span>
      <strong>Hanniel Cardoso Jaramillo </strong>
      <a className="credits-profile" href="https://github.com/HannDev2" target="_blank" rel="noopener noreferrer" aria-label="Hanniel Cardoso Jaramillo · GitHub @HannDev2">
        <GithubMark />(@HannDev2)<ArrowUpRight size={11} />
      </a>
    </p>
    <div className="credits-bottom">
      <a className="credits-social" href="https://www.instagram.com/juxdeveloper/" target="_blank" rel="noopener noreferrer" aria-label="Instagram @juxdeveloper">
        <InstagramMark /><span>@juxdeveloper</span><ArrowUpRight size={11} />
      </a>
      <a className="credits-license" href="./LICENSE" target="_blank" rel="noopener noreferrer" aria-label={t.license} title={t.license}>
        <Scale size={12} aria-hidden="true" /><span>GPL 3.0+</span>
      </a>
    </div>
    <small className="credits-license-note">{t.openSource}</small>
  </footer>;
}
