/**
 * Performance tier detection and configuration for the 3D scene.
 *
 * On low-end devices we progressively degrade visual fidelity while
 * keeping core interaction (click, drag, text, voice) intact.
 *
 * Degradation order (PRD §11.2):
 *   1. Pixel ratio reduced to 1.0
 *   2. Shadow map resolution halved to 1024
 *   3. Shadow map disabled entirely
 *
 * Core interaction is NEVER degraded.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PerformanceTier = 'high' | 'medium' | 'low';

export interface PerformanceConfig {
  tier: PerformanceTier;
  /** Maximum device pixel ratio for the Canvas renderer. */
  maxDpr: number;
  /** Shadow map width/height in pixels. */
  shadowMapSize: number;
  /** Whether shadows are enabled at all. */
  shadowsEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Detection heuristics
// ---------------------------------------------------------------------------

/**
 * Heuristic detection of device performance tier based on hardware
 * concurrency and available memory (where the browser exposes it).
 *
 * - High: ≥8 cores or ≥4 GB device memory
 * - Medium: ≥4 cores
 * - Low: <4 cores
 */
function detectPerformanceTier(): PerformanceTier {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  const cores: number | undefined = nav.hardwareConcurrency;
  const memoryGB: number | undefined = nav.deviceMemory;

  if (cores === undefined) return 'medium'; // unknown → assume medium

  if ((memoryGB !== undefined && memoryGB >= 4) || cores >= 8) {
    return 'high';
  }
  if (cores >= 4) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Tier → config mapping
// ---------------------------------------------------------------------------

function configForTier(tier: PerformanceTier): PerformanceConfig {
  switch (tier) {
    case 'high':
      return {
        tier: 'high',
        maxDpr: 1.5,
        shadowMapSize: 2048,
        shadowsEnabled: true,
      };
    case 'medium':
      return {
        tier: 'medium',
        maxDpr: 1.5,
        shadowMapSize: 1024,
        shadowsEnabled: true,
      };
    case 'low':
      return {
        tier: 'low',
        maxDpr: 1.0,
        shadowMapSize: 512,
        shadowsEnabled: false,
      };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Cached performance config for the current device. */
let _config: PerformanceConfig | null = null;

/** Get the performance configuration for the current device. */
export function getPerformanceConfig(): PerformanceConfig {
  if (!_config) {
    _config = configForTier(detectPerformanceTier());
  }
  return _config;
}

/** Reset cached config (useful for testing). */
export function resetPerformanceConfig(): void {
  _config = null;
}

// ---------------------------------------------------------------------------
// FPS monitor (dev-only)
// ---------------------------------------------------------------------------

/**
 * Lightweight FPS counter that samples `delta` values from `useFrame`.
 *
 * Usage:
 * ```ts
 * const fps = usePerformanceMonitor(delta);
 * if (fps !== null) console.log(`FPS: ${fps}`);
 * ```
 *
 * Returns the current smoothed FPS, or `null` until enough samples are collected.
 */
export function createFpsSampler(sampleWindowMs = 1000): {
  push: (deltaSec: number) => number | null;
  reset: () => void;
} {
  const samples: number[] = [];

  const push = (deltaSec: number): number | null => {
    if (deltaSec <= 0) return null;
    samples.push(deltaSec);

    // Prune samples outside the window
    let total = 0;
    while (samples.length > 0) {
      total = samples.reduce((a, b) => a + b, 0);
      if (total <= sampleWindowMs / 1000) break;
      samples.shift();
    }

    if (total <= 0 || samples.length < 2) return null;
    return Math.round(samples.length / total);
  };

  const reset = () => {
    samples.length = 0;
  };

  return { push, reset };
}
