/**
 * Rendering types and contracts for Intersect Phase V7.
 */

import type { WorldBounds } from '../contracts/bounds';
import type { GeometryView } from '../contracts/geometry';

export type ViewportStatusType =
  | 'ready'
  | 'generating'
  | 'empty-intersection'
  | 'partial-coverage'
  | 'webgl-unsupported'
  | 'context-lost'
  | 'error';

export interface ViewportStatus {
  readonly type: ViewportStatusType;
  readonly message?: string;
}

export interface CameraStateSnapshot {
  readonly position: { x: number; y: number; z: number };
  readonly target: { x: number; y: number; z: number };
  readonly distance: number;
}

import type { AnimationState } from './curve-animator';

export interface ThreeSceneControllerOptions {
  readonly container: HTMLElement;
  readonly initialCurveColor?: string | number;
  readonly onRegionChange?: (newRegion: WorldBounds) => void;
  readonly onViewChange?: (view: GeometryView) => void;
  readonly onStatusChange?: (status: ViewportStatus) => void;
  readonly onCameraChange?: (cameraState: CameraStateSnapshot) => void;
  readonly onAnimationStateChange?: (state: AnimationState) => void;
}
