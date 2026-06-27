import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVehicleStore } from '../../domain/vehicle';
import { WINDOW_NODE_CONFIGS, ANIMATION_DURATION_MS } from '../windowConfig';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockMesh {
  isMesh: true;
  name: string;
  position: { y: number };
  material: {
    emissive: { set: ReturnType<typeof vi.fn> };
    emissiveIntensity: number;
  };
}

interface MockNode {
  name: string;
  traverse: (fn: (child: MockMesh) => void) => void;
}

function createMockMesh(name: string): MockMesh {
  return {
    isMesh: true,
    name,
    position: { y: 0.5 },
    material: {
      emissive: { set: vi.fn() },
      emissiveIntensity: 0,
    },
  };
}

function createWindowScene() {
  const nodes: Record<string, MockNode> = {};
  const meshes: Record<string, MockMesh> = {};

  for (const config of WINDOW_NODE_CONFIGS) {
    const mesh = createMockMesh(`${config.nodeName}_mesh`);
    meshes[config.nodeName] = mesh;
    nodes[config.nodeName] = {
      name: config.nodeName,
      traverse: (fn: (child: MockMesh) => void) => fn(mesh),
    };
  }

  return {
    traverse: vi.fn(),
    getObjectByName: (name: string) => nodes[name] ?? meshes[name] ?? null,
    _nodes: nodes,
    _meshes: meshes,
  };
}

/** Shorthand for fresh store state. */
const s = () => useVehicleStore.getState();

function resetStore() {
  s().resetVehicleState();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('windowConfig', () => {
  it('maps all four WindowIds', () => {
    const ids = WINDOW_NODE_CONFIGS.map((c) => c.windowId).sort();
    expect(ids).toEqual(['frontLeft', 'frontRight', 'rearLeft', 'rearRight']);
  });

  it('has unique node names matching the model contract', () => {
    const names = WINDOW_NODE_CONFIGS.map((c) => c.nodeName);
    expect(names).toEqual([
      'window_front_left',
      'window_front_right',
      'window_rear_left',
      'window_rear_right',
    ]);
  });

  it('defines negative open offsets (glass moves down)', () => {
    for (const config of WINDOW_NODE_CONFIGS) {
      expect(config.openOffset).toBeLessThan(0);
    }
  });

  it('specifies animation duration within 600–900 ms', () => {
    expect(ANIMATION_DURATION_MS).toBeGreaterThanOrEqual(600);
    expect(ANIMATION_DURATION_MS).toBeLessThanOrEqual(900);
  });
});

describe('WindowInteraction registry', () => {
  beforeEach(() => {
    resetStore();
  });

  it('discovers all four window meshes from a named scene', () => {
    const root = createWindowScene();
    for (const config of WINDOW_NODE_CONFIGS) {
      const node = root.getObjectByName(config.nodeName);
      expect(node).toBeTruthy();
      expect(node!.name).toBe(config.nodeName);
    }
  });

  it('getObjectByName returns null for missing nodes', () => {
    const root = createWindowScene();
    expect(root.getObjectByName('nonexistent')).toBeNull();
  });
});

describe('WindowInteraction click → store', () => {
  beforeEach(() => {
    resetStore();
  });

  it('dispatches a toggle command to open a closed window', () => {
    expect(s().windows.frontLeft).toBe('closed');

    const result = s().executeCommand({
      source: 'pointer',
      target: 'frontLeft',
      action: 'toggle',
    });

    expect(result.status).toBe('accepted');
    expect(s().windows.frontLeft).toBe('transitioning');

    s().completeWindowTransition('frontLeft');
    expect(s().windows.frontLeft).toBe('open');
  });

  it('dispatches a toggle command to close an open window', () => {
    s().executeCommand({
      source: 'pointer',
      target: 'frontLeft',
      action: 'open',
    });
    s().completeWindowTransition('frontLeft');
    expect(s().windows.frontLeft).toBe('open');

    const result = s().executeCommand({
      source: 'pointer',
      target: 'frontLeft',
      action: 'toggle',
    });

    expect(result.status).toBe('accepted');
    s().completeWindowTransition('frontLeft');
    expect(s().windows.frontLeft).toBe('closed');
  });

  it('blocks the same window when already transitioning', () => {
    s().executeCommand({
      source: 'pointer',
      target: 'frontLeft',
      action: 'toggle',
    });
    expect(s().windows.frontLeft).toBe('transitioning');

    const result = s().executeCommand({
      source: 'pointer',
      target: 'frontLeft',
      action: 'toggle',
    });

    expect(result.status).toBe('blocked');
    expect(s().windows.frontLeft).toBe('transitioning');
  });

  it('allows a different window while one is transitioning', () => {
    s().executeCommand({
      source: 'pointer',
      target: 'frontLeft',
      action: 'toggle',
    });
    expect(s().windows.frontLeft).toBe('transitioning');

    const result = s().executeCommand({
      source: 'pointer',
      target: 'frontRight',
      action: 'toggle',
    });

    expect(result.status).toBe('accepted');
    expect(s().windows.frontRight).toBe('transitioning');
  });

  it('returns noop when already at target state', () => {
    expect(s().windows.frontLeft).toBe('closed');

    const result = s().executeCommand({
      source: 'pointer',
      target: 'frontLeft',
      action: 'close',
    });

    expect(result.status).toBe('noop');
    expect(s().windows.frontLeft).toBe('closed');
  });
});

describe('WindowInteraction all-window commands', () => {
  beforeEach(() => {
    resetStore();
  });

  it('opens all four windows with an allWindows command', () => {
    const result = s().executeCommand({
      source: 'pointer',
      target: 'allWindows',
      action: 'open',
    });

    expect(result.status).toBe('accepted');
    expect(result.started).toHaveLength(4);

    for (const windowId of result.started) {
      s().completeWindowTransition(windowId);
    }

    const state = s();
    for (const windowId of result.started) {
      expect(state.windows[windowId]).toBe('open');
    }
  });

  it('returns partial when some windows are transitioning', () => {
    s().executeCommand({
      source: 'pointer',
      target: 'frontLeft',
      action: 'toggle',
    });

    const result = s().executeCommand({
      source: 'pointer',
      target: 'allWindows',
      action: 'open',
    });

    expect(result.status).toBe('partial');
    expect(result.skipped).toContain('frontLeft');
    expect(result.started.length).toBeGreaterThan(0);
  });
});

describe('WindowInteraction animation state', () => {
  beforeEach(() => {
    resetStore();
  });

  it('completes a transition successfully', () => {
    s().executeCommand({
      source: 'pointer',
      target: 'frontLeft',
      action: 'toggle',
    });
    expect(s().windows.frontLeft).toBe('transitioning');

    const ok = s().completeWindowTransition('frontLeft');
    expect(ok).toBe(true);
    expect(s().windows.frontLeft).toBe('open');
  });

  it('rolls back on animation failure', () => {
    s().executeCommand({
      source: 'pointer',
      target: 'frontLeft',
      action: 'toggle',
    });
    expect(s().windows.frontLeft).toBe('transitioning');

    const ok = s().failWindowTransition('frontLeft');
    expect(ok).toBe(true);
    expect(s().windows.frontLeft).toBe('closed');
  });

  it('rejects completion when no transition is active', () => {
    expect(s().completeWindowTransition('frontLeft')).toBe(false);
    expect(s().failWindowTransition('frontLeft')).toBe(false);
  });

  it('resets all state on resetVehicleState', () => {
    s().executeCommand({
      source: 'pointer',
      target: 'frontLeft',
      action: 'toggle',
    });
    s().executeCommand({
      source: 'pointer',
      target: 'frontRight',
      action: 'toggle',
    });
    s().completeWindowTransition('frontRight');

    s().resetVehicleState();

    const state = s();
    expect(state.windows.frontLeft).toBe('closed');
    expect(state.windows.frontRight).toBe('closed');
    expect(state.lastCommandResult).toBeNull();
    expect(state.completeWindowTransition('frontLeft')).toBe(false);
  });
});
