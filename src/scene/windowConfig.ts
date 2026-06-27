import type { WindowId } from '../domain/vehicle';

export interface WindowNodeConfig {
  windowId: WindowId;
  nodeName: string;
  /** Local Y displacement when open (negative = glass moves down). */
  openOffset: number;
}

/**
 * Maps each PRD WindowId to the corresponding glTF node name and animation
 * endpoint.  The four node names are the contract established by NC-004 and
 * validated by `scripts/validate-model.mjs`.
 */
export const WINDOW_NODE_CONFIGS: readonly WindowNodeConfig[] = [
  {
    windowId: 'frontLeft',
    nodeName: 'window_front_left',
    openOffset: -0.35,
  },
  {
    windowId: 'frontRight',
    nodeName: 'window_front_right',
    openOffset: -0.35,
  },
  {
    windowId: 'rearLeft',
    nodeName: 'window_rear_left',
    openOffset: -0.3,
  },
  {
    windowId: 'rearRight',
    nodeName: 'window_rear_right',
    openOffset: -0.3,
  },
];

/** Animation duration range (ms) required by PRD AC-07. */
export const ANIMATION_DURATION_MS = 750;
