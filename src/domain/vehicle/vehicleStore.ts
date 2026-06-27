import { create } from 'zustand';
import type {
  CommandAction,
  CommandExecutionResult,
  VehicleCommand,
  VehicleState,
  WindowId,
  WindowStableState,
} from './types';

export type {
  CommandAction,
  CommandExecutionResult,
  CommandResultStatus,
  CommandSource,
  CommandTarget,
  VehicleCommand,
  VehicleState,
  WindowId,
  WindowStableState,
  WindowState,
} from './types';

export const WINDOW_IDS = [
  'frontLeft',
  'frontRight',
  'rearLeft',
  'rearRight',
] as const satisfies readonly WindowId[];

interface WindowTransition {
  previous: WindowStableState;
  target: WindowStableState;
}

interface VehicleStore extends VehicleState {
  lastCommandResult: CommandExecutionResult | null;
  executeCommand: (command: VehicleCommand) => CommandExecutionResult;
  completeWindowTransition: (windowId: WindowId) => boolean;
  failWindowTransition: (windowId: WindowId) => boolean;
  resetVehicleState: () => void;
}

interface InternalVehicleStore extends VehicleStore {
  transitions: Partial<Record<WindowId, WindowTransition>>;
}

const createInitialWindows = (): VehicleState['windows'] => ({
  frontLeft: 'closed',
  frontRight: 'closed',
  rearLeft: 'closed',
  rearRight: 'closed',
});

const targetFor = (
  current: WindowStableState,
  action: CommandAction,
): WindowStableState => {
  if (action === 'toggle') {
    return current === 'open' ? 'closed' : 'open';
  }

  return action === 'open' ? 'open' : 'closed';
};

const classifyResult = (
  started: WindowId[],
  skipped: WindowId[],
): CommandExecutionResult['status'] => {
  if (started.length > 0) {
    return skipped.length > 0 ? 'partial' : 'accepted';
  }

  return skipped.length > 0 ? 'blocked' : 'noop';
};

export const useVehicleStore = create<InternalVehicleStore>((set, get) => ({
  windows: createInitialWindows(),
  transitions: {},
  lastCommandResult: null,

  executeCommand: (command) => {
    const state = get();
    const targets =
      command.target === 'allWindows' ? WINDOW_IDS : [command.target];
    const started: WindowId[] = [];
    const skipped: WindowId[] = [];
    const alreadySatisfied: WindowId[] = [];
    const transitions = { ...state.transitions };
    const windows = { ...state.windows };

    for (const windowId of targets) {
      const current = state.windows[windowId];

      if (current === 'transitioning') {
        skipped.push(windowId);
        continue;
      }

      const target = targetFor(current, command.action);
      if (target === current) {
        alreadySatisfied.push(windowId);
        continue;
      }

      transitions[windowId] = { previous: current, target };
      windows[windowId] = 'transitioning';
      started.push(windowId);
    }

    const result: CommandExecutionResult = {
      command,
      status: classifyResult(started, skipped),
      started,
      skipped,
      alreadySatisfied,
    };

    set({ windows, transitions, lastCommandResult: result });
    return result;
  },

  completeWindowTransition: (windowId) => {
    const state = get();
    const transition = state.transitions[windowId];
    if (!transition) {
      return false;
    }

    const transitions = { ...state.transitions };
    delete transitions[windowId];
    set({
      windows: { ...state.windows, [windowId]: transition.target },
      transitions,
    });
    return true;
  },

  failWindowTransition: (windowId) => {
    const state = get();
    const transition = state.transitions[windowId];
    if (!transition) {
      return false;
    }

    const transitions = { ...state.transitions };
    delete transitions[windowId];
    set({
      windows: { ...state.windows, [windowId]: transition.previous },
      transitions,
    });
    return true;
  },

  resetVehicleState: () => {
    set({
      windows: createInitialWindows(),
      transitions: {},
      lastCommandResult: null,
    });
  },
}));
