import { beforeEach, describe, expect, it } from 'vitest';
import {
  WINDOW_IDS,
  useVehicleStore,
  type VehicleCommand,
  type WindowId,
} from './vehicleStore';

const command = (
  target: VehicleCommand['target'],
  action: VehicleCommand['action'],
): VehicleCommand => ({ source: 'text', target, action });

const stateOf = (windowId: WindowId) =>
  useVehicleStore.getState().windows[windowId];

describe('vehicle store', () => {
  beforeEach(() => {
    useVehicleStore.getState().resetVehicleState();
  });

  it('starts with all four windows closed', () => {
    expect(useVehicleStore.getState().windows).toEqual({
      frontLeft: 'closed',
      frontRight: 'closed',
      rearLeft: 'closed',
      rearRight: 'closed',
    });
  });

  it('opens, closes, and toggles one window through a transition', () => {
    const store = useVehicleStore.getState();

    expect(store.executeCommand(command('frontLeft', 'open')).status).toBe(
      'accepted',
    );
    expect(stateOf('frontLeft')).toBe('transitioning');
    expect(store.completeWindowTransition('frontLeft')).toBe(true);
    expect(stateOf('frontLeft')).toBe('open');

    expect(store.executeCommand(command('frontLeft', 'toggle')).status).toBe(
      'accepted',
    );
    expect(store.completeWindowTransition('frontLeft')).toBe(true);
    expect(stateOf('frontLeft')).toBe('closed');

    store.executeCommand(command('frontLeft', 'open'));
    store.completeWindowTransition('frontLeft');
    store.executeCommand(command('frontLeft', 'close'));
    store.completeWindowTransition('frontLeft');
    expect(stateOf('frontLeft')).toBe('closed');
  });

  it('returns noop when a stable window already satisfies the command', () => {
    const result = useVehicleStore
      .getState()
      .executeCommand(command('frontLeft', 'close'));

    expect(result).toMatchObject({
      status: 'noop',
      started: [],
      skipped: [],
      alreadySatisfied: ['frontLeft'],
    });
    expect(stateOf('frontLeft')).toBe('closed');
    expect(useVehicleStore.getState().lastCommandResult).toEqual(result);
  });

  it('blocks the same transitioning window but allows another window', () => {
    const store = useVehicleStore.getState();

    store.executeCommand(command('frontLeft', 'open'));
    const blocked = store.executeCommand(command('frontLeft', 'close'));
    const accepted = store.executeCommand(command('frontRight', 'open'));

    expect(blocked).toMatchObject({
      status: 'blocked',
      started: [],
      skipped: ['frontLeft'],
    });
    expect(accepted).toMatchObject({
      status: 'accepted',
      started: ['frontRight'],
    });
    expect(stateOf('frontLeft')).toBe('transitioning');
    expect(stateOf('frontRight')).toBe('transitioning');
  });

  it('partially executes an all-window command around locked windows', () => {
    const store = useVehicleStore.getState();

    store.executeCommand(command('frontLeft', 'open'));
    store.executeCommand(command('rearLeft', 'open'));
    store.completeWindowTransition('rearLeft');

    const result = store.executeCommand(command('allWindows', 'open'));

    expect(result).toEqual({
      command: command('allWindows', 'open'),
      status: 'partial',
      started: ['frontRight', 'rearRight'],
      skipped: ['frontLeft'],
      alreadySatisfied: ['rearLeft'],
    });
  });

  it('fully executes and completes an all-window command in stable order', () => {
    const store = useVehicleStore.getState();

    const result = store.executeCommand(command('allWindows', 'open'));

    expect(result).toMatchObject({
      status: 'accepted',
      started: WINDOW_IDS,
      skipped: [],
      alreadySatisfied: [],
    });
    expect(WINDOW_IDS.map(stateOf)).toEqual([
      'transitioning',
      'transitioning',
      'transitioning',
      'transitioning',
    ]);

    for (const windowId of WINDOW_IDS) {
      expect(store.completeWindowTransition(windowId)).toBe(true);
    }
    expect(WINDOW_IDS.map(stateOf)).toEqual(['open', 'open', 'open', 'open']);
  });

  it('returns blocked when every actionable target is transitioning', () => {
    const store = useVehicleStore.getState();

    for (const windowId of WINDOW_IDS) {
      store.executeCommand(command(windowId, 'open'));
    }

    const result = store.executeCommand(command('allWindows', 'close'));

    expect(result.status).toBe('blocked');
    expect(result.started).toEqual([]);
    expect(result.skipped).toEqual(WINDOW_IDS);
  });

  it('rolls a failed animation back to its previous stable state', () => {
    const store = useVehicleStore.getState();

    store.executeCommand(command('frontLeft', 'open'));
    expect(store.failWindowTransition('frontLeft')).toBe(true);
    expect(stateOf('frontLeft')).toBe('closed');

    store.executeCommand(command('frontLeft', 'open'));
    store.completeWindowTransition('frontLeft');
    store.executeCommand(command('frontLeft', 'close'));
    expect(store.failWindowTransition('frontLeft')).toBe(true);
    expect(stateOf('frontLeft')).toBe('open');
  });

  it('safely rejects completion and failure without a transition', () => {
    const before = useVehicleStore.getState().windows;

    expect(
      useVehicleStore.getState().completeWindowTransition('frontLeft'),
    ).toBe(false);
    expect(useVehicleStore.getState().failWindowTransition('frontLeft')).toBe(
      false,
    );
    expect(useVehicleStore.getState().windows).toEqual(before);
  });

  it('resets windows, transitions, and command feedback', () => {
    const store = useVehicleStore.getState();

    store.executeCommand(command('frontLeft', 'open'));
    store.executeCommand(command('frontRight', 'open'));
    store.completeWindowTransition('frontRight');
    store.resetVehicleState();

    expect(useVehicleStore.getState().windows).toEqual({
      frontLeft: 'closed',
      frontRight: 'closed',
      rearLeft: 'closed',
      rearRight: 'closed',
    });
    expect(useVehicleStore.getState().lastCommandResult).toBeNull();
    expect(
      useVehicleStore.getState().completeWindowTransition('frontLeft'),
    ).toBe(false);
  });
});
