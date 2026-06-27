import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useVehicleStore } from '../domain/vehicle';
import { StatusPanel } from './StatusPanel';

describe('StatusPanel', () => {
  beforeEach(() => {
    useVehicleStore.getState().resetVehicleState();
  });

  it('shows all four windows initially closed', () => {
    render(<StatusPanel />);

    expect(screen.getByTestId('status-frontLeft')).toHaveTextContent('关闭');
    expect(screen.getByTestId('status-frontRight')).toHaveTextContent('关闭');
    expect(screen.getByTestId('status-rearLeft')).toHaveTextContent('关闭');
    expect(screen.getByTestId('status-rearRight')).toHaveTextContent('关闭');
  });

  it('shows Chinese labels for each window', () => {
    render(<StatusPanel />);

    expect(screen.getByText('左前窗')).toBeInTheDocument();
    expect(screen.getByText('右前窗')).toBeInTheDocument();
    expect(screen.getByText('左后窗')).toBeInTheDocument();
    expect(screen.getByText('右后窗')).toBeInTheDocument();
  });

  it('reflects open state after executing a command', () => {
    const store = useVehicleStore.getState();
    store.executeCommand({
      source: 'text',
      target: 'frontLeft',
      action: 'open',
    });
    store.completeWindowTransition('frontLeft');

    render(<StatusPanel />);

    expect(screen.getByTestId('status-frontLeft')).toHaveTextContent('打开');
    expect(screen.getByTestId('status-frontRight')).toHaveTextContent('关闭');
  });

  it('shows transitioning state while a window is animating', () => {
    const store = useVehicleStore.getState();
    store.executeCommand({
      source: 'text',
      target: 'frontLeft',
      action: 'open',
    });

    render(<StatusPanel />);

    expect(screen.getByTestId('status-frontLeft')).toHaveTextContent('操作中');
  });

  it('reflects all-window open after executing allWindows command', () => {
    const store = useVehicleStore.getState();
    const result = store.executeCommand({
      source: 'text',
      target: 'allWindows',
      action: 'open',
    });

    for (const windowId of result.started) {
      store.completeWindowTransition(windowId);
    }

    render(<StatusPanel />);

    for (const id of ['frontLeft', 'frontRight', 'rearLeft', 'rearRight']) {
      expect(screen.getByTestId(`status-${id}`)).toHaveTextContent('打开');
    }
  });
});
