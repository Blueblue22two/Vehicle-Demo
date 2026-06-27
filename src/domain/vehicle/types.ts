export type WindowId = 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight';

export type WindowStableState = 'open' | 'closed';
export type WindowState = WindowStableState | 'transitioning';
export type CommandSource = 'pointer' | 'voice' | 'text';
export type CommandAction = 'open' | 'close' | 'toggle';
export type CommandTarget = WindowId | 'allWindows';

export interface VehicleCommand {
  source: CommandSource;
  target: CommandTarget;
  action: CommandAction;
}

export interface VehicleState {
  windows: Record<WindowId, WindowState>;
}

export type CommandResultStatus = 'accepted' | 'partial' | 'noop' | 'blocked';

export interface CommandExecutionResult {
  command: VehicleCommand;
  status: CommandResultStatus;
  readonly started: readonly WindowId[];
  readonly skipped: readonly WindowId[];
  readonly alreadySatisfied: readonly WindowId[];
}
