import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVehicleStore } from '../domain/vehicle';
import { TextCommandInput } from './TextCommandInput';

describe('TextCommandInput', () => {
  beforeEach(() => {
    useVehicleStore.getState().resetVehicleState();
  });

  it('renders input field and submit button', () => {
    render(<TextCommandInput onFeedback={vi.fn()} />);

    expect(
      screen.getByRole('textbox', { name: '文本命令输入' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '发送命令' }),
    ).toBeInTheDocument();
  });

  it('parses and executes a valid command on button click', async () => {
    const onFeedback = vi.fn();
    render(<TextCommandInput onFeedback={onFeedback} />);

    const input = screen.getByRole('textbox', { name: '文本命令输入' });
    await userEvent.type(input, '打开左前窗');
    await userEvent.click(screen.getByRole('button', { name: '发送命令' }));

    // Command should have been executed
    expect(useVehicleStore.getState().windows.frontLeft).toBe('transitioning');

    // Feedback should have been emitted
    expect(onFeedback).toHaveBeenCalledTimes(1);
    expect(onFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'command' }),
    );

    // Input should be cleared
    expect(input).toHaveValue('');
  });

  it('submits on Enter key', async () => {
    const onFeedback = vi.fn();
    render(<TextCommandInput onFeedback={onFeedback} />);

    const input = screen.getByRole('textbox', { name: '文本命令输入' });
    await userEvent.type(input, '打开全部车窗');
    await userEvent.keyboard('{Enter}');

    expect(onFeedback).toHaveBeenCalledTimes(1);
    expect(onFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'command' }),
    );
    expect(useVehicleStore.getState().windows).toEqual(
      expect.objectContaining({
        frontLeft: 'transitioning',
        frontRight: 'transitioning',
        rearLeft: 'transitioning',
        rearRight: 'transitioning',
      }),
    );
  });

  it('reports parse error for invalid commands', async () => {
    const onFeedback = vi.fn();
    render(<TextCommandInput onFeedback={onFeedback} />);

    const input = screen.getByRole('textbox', { name: '文本命令输入' });
    await userEvent.type(input, '打开天窗');
    await userEvent.click(screen.getByRole('button', { name: '发送命令' }));

    expect(onFeedback).toHaveBeenCalledWith({
      type: 'parse-error',
      input: '打开天窗',
      reason: 'unsupported',
    });

    // Store should not have changed
    expect(useVehicleStore.getState().windows.frontLeft).toBe('closed');
  });

  it('does not submit empty input', async () => {
    const onFeedback = vi.fn();
    render(<TextCommandInput onFeedback={onFeedback} />);

    await userEvent.click(screen.getByRole('button', { name: '发送命令' }));

    expect(onFeedback).not.toHaveBeenCalled();
  });

  it('clears input after successful submission', async () => {
    const onFeedback = vi.fn();
    render(<TextCommandInput onFeedback={onFeedback} />);

    const input = screen.getByRole('textbox', { name: '文本命令输入' });
    await userEvent.type(input, '打开左前窗');
    await userEvent.click(screen.getByRole('button', { name: '发送命令' }));

    expect(input).toHaveValue('');
  });
});
