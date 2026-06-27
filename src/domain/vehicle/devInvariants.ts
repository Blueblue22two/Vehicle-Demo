import type { VehicleState, WindowId } from './types';
import { WINDOW_IDS } from './vehicleStore';

// ---------------------------------------------------------------------------
// Dev-mode state invariant checks
//
// These assertions are designed to be called in development / test
// environments to detect store-model divergences early.
// ---------------------------------------------------------------------------

/** Window-to-transition consistency check result. */
export interface InvariantViolation {
  message: string;
  windowId?: WindowId;
}

/**
 * Verify that every `transitioning` window has a corresponding transition
 * entry and every transition entry points to a `transitioning` window.
 *
 * A mismatch indicates the store and transition map have silently diverged —
 * the most common cause is an effect cleanup that modified state but left
 * stale transition entries, or vice versa.
 */
export function checkTransitionConsistency(
  windows: VehicleState['windows'],
  transitions: Partial<Record<WindowId, { target: string; previous: string }>>,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  for (const id of WINDOW_IDS) {
    const state = windows[id];
    const hasTransition = transitions[id] !== undefined;

    if (state === 'transitioning' && !hasTransition) {
      violations.push({
        message: `Window "${id}" is transitioning but has no transition entry`,
        windowId: id,
      });
    }

    if (state !== 'transitioning' && hasTransition) {
      violations.push({
        message: `Window "${id}" has state "${state}" but still has a transition entry`,
        windowId: id,
      });
    }
  }

  return violations;
}

/**
 * Verify all window states are valid.
 * (TypeScript prevents this at compile time but runtime checks catch
 * deserialisation or external mutation edge cases.)
 */
export function checkValidStates(
  windows: VehicleState['windows'],
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const validStates = new Set(['open', 'closed', 'transitioning']);

  for (const id of WINDOW_IDS) {
    if (!validStates.has(windows[id])) {
      violations.push({
        message: `Window "${id}" has invalid state "${windows[id]}"`,
        windowId: id,
      });
    }
  }

  return violations;
}

/**
 * Run all invariant checks against the current store state.
 * Returns a list of violations; empty array means the store is consistent.
 *
 * Call this in development after any state-modifying operation:
 * ```ts
 * const violations = checkAllInvariants(useVehicleStore.getState());
 * if (violations.length > 0) console.error('[Invariant]', violations);
 * ```
 */
export function checkAllInvariants(state: {
  windows: VehicleState['windows'];
  transitions: Partial<Record<WindowId, { target: string; previous: string }>>;
}): InvariantViolation[] {
  return [
    ...checkValidStates(state.windows),
    ...checkTransitionConsistency(state.windows, state.transitions),
  ];
}
