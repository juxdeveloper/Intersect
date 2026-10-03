import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { GeometryResult, GeometryView } from '../contracts/geometry';
import type { WorldBounds } from '../contracts/bounds';
import { DEFAULT_CURVE_PALETTE_COLOR } from '../contracts/appearance';
import { ThreeSceneController, type ViewportStatus, type AnimationState } from '../rendering';
import { translations, type SupportedLanguage } from '../i18n';
import { RotateCcw, Play, Pause, Focus, Zap, Sparkles } from 'lucide-react';

export type QualityLevel = 'auto' | 'low';

export interface GraphViewportProps {
  surfaceFText: string;
  surfaceGText: string;
  curveColor?: string;
  geometryResult?: GeometryResult | null;
  isGeometryGenerating?: boolean;
  onRegionChange?: (newRegion: WorldBounds) => void;
  onViewChange?: (view: GeometryView) => void;
  quality?: QualityLevel;
  onQualityChange?: (quality: QualityLevel) => void;
  lang?: SupportedLanguage;
  theme?: 'light' | 'dark';
}

export const GraphViewport: React.FC<GraphViewportProps> = ({
  surfaceFText,
  surfaceGText,
  curveColor = DEFAULT_CURVE_PALETTE_COLOR,
  geometryResult,
  isGeometryGenerating,
  onRegionChange,
  onViewChange,
  quality = 'auto',
  onQualityChange,
  lang = 'es',
  theme = 'dark',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<ThreeSceneController | null>(null);
  const [viewportStatus, setViewportStatus] = useState<ViewportStatus>({ type: 'ready' });
  const [animationState, setAnimationState] = useState<AnimationState>('unavailable');

  const t = translations[lang] ?? translations.es;

  // Initialize ThreeSceneController on mount
  useEffect(() => {
    if (!mountRef.current) return;

    const controller = new ThreeSceneController({
      container: mountRef.current,
      initialCurveColor: curveColor,
      onRegionChange: (region) => {
        onRegionChange?.(region);
      },
      onViewChange,
      onStatusChange: (status) => {
        setViewportStatus(status);
      },
      onAnimationStateChange: (state) => {
        setAnimationState(state);
      },
    });

    controller.setTheme(theme);
    controller.setLanguage(lang);
    controller.setQuality(quality);
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => { controllerRef.current?.setLanguage(lang); }, [lang]);

  // Sync theme changes to WebGL scene
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.setTheme(theme);
    }
  }, [theme]);

  // Sync quality changes to WebGL scene (resolution, pixel ratio, line resolution)
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.setQuality(quality);
    }
  }, [quality]);

  // Synchronize curve color updates
  useEffect(() => {
    if (controllerRef.current && curveColor) {
      controllerRef.current.setCurveColor(curveColor);
    }
  }, [curveColor]);

  // Synchronize geometry result updates
  useEffect(() => {
    if (controllerRef.current && geometryResult !== undefined) {
      controllerRef.current.updateGeometry(geometryResult);
    }
  }, [geometryResult]);

  const handleResetView = useCallback(() => {
    controllerRef.current?.resetView();
  }, []);

  const handleTogglePlayback = useCallback(() => {
    if (!controllerRef.current) return;
    if (animationState === 'playing') {
      controllerRef.current.pauseAnimation();
    } else if (animationState === 'paused') {
      controllerRef.current.resumeAnimation();
    } else {
      controllerRef.current.replayAnimation();
    }
  }, [animationState]);

  // Keyboard shortcut listener (R to reset, Space to toggle replay)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'MATH-FIELD' ||
        activeEl?.closest('math-field');

      if (isInput) return;

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleResetView();
      } else if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        if (animationState !== 'unavailable') {
          e.preventDefault();
          handleTogglePlayback();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResetView, handleTogglePlayback, animationState]);

  const getQualityIcon = (q: QualityLevel) => {
    switch (q) {
      case 'low':
        return <Zap size={13} style={{ marginRight: '4px' }} />;
      case 'auto':
      default:
        return <Sparkles size={13} style={{ marginRight: '4px' }} />;
    }
  };

  const getQualityLabel = (q: QualityLevel) => {
    switch (q) {
      case 'low':
        return t.viewport.detailLow;
      case 'auto':
      default:
        return t.viewport.detailAuto;
    }
  };

  const cycleQuality = useCallback(() => {
    if (!onQualityChange) return;
    onQualityChange(quality === 'auto' ? 'low' : 'auto');
  }, [onQualityChange, quality]);

  const screenReaderSummary = useMemo(() => {
    if (lang === 'es') {
      if (!geometryResult) return 'Área de visualización 3D lista.';
      const fStatus = geometryResult.surfaceF.status === 'success' ? 'Superficie F renderizada' : 'Superficie F pendiente';
      const gStatus = geometryResult.surfaceG.status === 'success' ? 'Superficie G renderizada' : 'Superficie G pendiente';
      const cStatus = geometryResult.curve ? 'Curva de intersección renderizada' : 'Sin curva';
      return `${fStatus}, ${gStatus}, ${cStatus}. Coordenadas dextrógiras con Z hacia arriba.`;
    }
    if (!geometryResult) return '3D viewport ready.';
    const fStatus = geometryResult.surfaceF.status === 'success' ? 'Surface F rendered' : 'Surface F pending';
    const gStatus = geometryResult.surfaceG.status === 'success' ? 'Surface G rendered' : 'Surface G pending';
    const cStatus = geometryResult.curve ? 'Intersection curve rendered' : 'No curve';
    return `${fStatus}, ${gStatus}, ${cStatus}. Right-handed coordinates with Z up.`;
  }, [geometryResult, lang]);

  return (
    <div className="graph-viewport-container">
      <div className="graph-canvas-area" ref={mountRef}>
        {/* WebGL Error State */}
        {viewportStatus.type === 'webgl-unsupported' && (
          <div className="graph-fallback-banner" role="alert">
            <h3>{t.viewport.webglNotSupported}</h3>
            <p>{viewportStatus.message ?? t.viewport.webglRequired}</p>
          </div>
        )}

        {isGeometryGenerating && viewportStatus.type !== 'webgl-unsupported' && (
          <div className="graph-status-pill loading" role="status" aria-live="polite">
            <span className="graph-spinner" />
            <span>{t.viewport.generatingGeometry}</span>
          </div>
        )}

        {/* Top-Right Graph Controls */}
        <div className="graph-controls-overlay">
          {animationState !== 'unavailable' && (
            <button
              type="button"
              id="animation-playback-btn"
              className={`graph-control-btn playback-btn ${animationState}`}
              onClick={handleTogglePlayback}
              title={
                animationState === 'playing'
                  ? t.viewport.pauseTitle
                  : animationState === 'paused'
                    ? t.viewport.resumeTitle
                    : `${t.viewport.replay} (Space)`
              }
              aria-label={t.viewport.replay}
            >
              <span className="btn-icon" aria-hidden="true">
                {animationState === 'playing' ? <Pause size={13} /> : animationState === 'paused' ? <Play size={13} /> : <RotateCcw size={13} />}
              </span>
              <span>
                {animationState === 'playing'
                  ? t.viewport.pause
                  : animationState === 'paused'
                    ? t.viewport.resume
                    : t.viewport.replay}
              </span>
            </button>
          )}

          {onQualityChange && (
            <button
              type="button"
              id="quality-toggle-btn"
              className="graph-control-btn"
              onClick={cycleQuality}
              title={`${t.viewport.detail}: ${getQualityLabel(quality)}`}
              aria-label={`${t.viewport.detail}: ${getQualityLabel(quality)}`}
              aria-pressed={quality === 'auto'}
            >
              {getQualityIcon(quality)}
              <span>{`${t.viewport.detail}: ${getQualityLabel(quality)}`}</span>
            </button>
          )}

          <button
            type="button"
            className="graph-control-btn"
            onClick={handleResetView}
            title={t.viewport.resetViewTitle}
            aria-label={t.viewport.resetView}
          >
            <Focus size={13} style={{ marginRight: '4px' }} />
            {t.viewport.resetView}
          </button>
        </div>

        {/* Screen Reader Announcement */}
        <div className="sr-only" aria-live="polite">
          {screenReaderSummary}
        </div>
      </div>

      {/* Legend Bar matching reference design */}
      <footer className="graph-legend-bar" aria-label={t.viewport.legendAria}>
        <div className="legend-item">
          <span className="legend-swatch surface-f" />
          <span>{t.viewport.legendF}:</span>
          <span className="legend-math">{surfaceFText || 'x² + y² = 4'}</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch surface-g" />
          <span>{t.viewport.legendG}:</span>
          <span className="legend-math">{surfaceGText || 'z = x + y'}</span>
        </div>
        <div className="legend-item">
          <span
            className="legend-swatch curve"
            style={{ backgroundColor: curveColor ?? DEFAULT_CURVE_PALETTE_COLOR }}
          />
          <span>{t.viewport.legendCurve}</span>
        </div>
      </footer>
    </div>
  );
};
