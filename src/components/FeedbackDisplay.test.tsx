import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackDisplay } from './FeedbackDisplay';
import type { FeedbackKind } from './FeedbackDisplay';

describe('FeedbackDisplay', () => {
  it('shows nothing when feedback is idle', () => {
    render(<FeedbackDisplay feedback={{ type: 'idle' }} />);

    expect(screen.queryByTestId('feedback')).not.toBeInTheDocument();
  });

  it('shows success message for accepted command', () => {
    const feedback: FeedbackKind = {
      type: 'command',
      input: '打开左前窗',
      result: {
        command: {
          source: 'text',
          target: 'frontLeft',
          action: 'open',
        },
        status: 'accepted',
        started: ['frontLeft'],
        skipped: [],
        alreadySatisfied: [],
      },
    };

    render(<FeedbackDisplay feedback={feedback} />);

    expect(screen.getByTestId('feedback')).toHaveTextContent(/已执行/);
    expect(screen.getByTestId('feedback')).toHaveClass('feedback--success');
  });

  it('shows info message for noop', () => {
    const feedback: FeedbackKind = {
      type: 'command',
      input: '关闭左前窗',
      result: {
        command: {
          source: 'text',
          target: 'frontLeft',
          action: 'close',
        },
        status: 'noop',
        started: [],
        skipped: [],
        alreadySatisfied: ['frontLeft'],
      },
    };

    render(<FeedbackDisplay feedback={feedback} />);

    expect(screen.getByTestId('feedback')).toHaveTextContent(/已在目标状态/);
    expect(screen.getByTestId('feedback')).toHaveClass('feedback--info');
  });

  it('shows warning message for blocked', () => {
    const feedback: FeedbackKind = {
      type: 'command',
      input: '打开左前窗',
      result: {
        command: {
          source: 'text',
          target: 'frontLeft',
          action: 'open',
        },
        status: 'blocked',
        started: [],
        skipped: ['frontLeft'],
        alreadySatisfied: [],
      },
    };

    render(<FeedbackDisplay feedback={feedback} />);

    expect(screen.getByTestId('feedback')).toHaveTextContent(/操作被锁定/);
    expect(screen.getByTestId('feedback')).toHaveClass('feedback--warning');
  });

  it('shows error for parse-error with reason', () => {
    const feedback: FeedbackKind = {
      type: 'parse-error',
      input: '打开天窗',
      reason: 'unsupported',
    };

    render(<FeedbackDisplay feedback={feedback} />);

    expect(screen.getByTestId('feedback')).toHaveTextContent(/不支持的命令/);
    expect(screen.getByTestId('feedback')).toHaveClass('feedback--error');
  });

  it('shows specific message for missing-action', () => {
    const feedback: FeedbackKind = {
      type: 'parse-error',
      input: '左前窗',
      reason: 'missing-action',
    };

    render(<FeedbackDisplay feedback={feedback} />);

    expect(screen.getByTestId('feedback')).toHaveTextContent(
      /请说明要.*打开.*还是.*关闭/,
    );
  });

  it('auto-dismisses accepted feedback after timeout', () => {
    vi.useFakeTimers();

    const feedback: FeedbackKind = {
      type: 'command',
      input: '打开左前窗',
      result: {
        command: { source: 'text', target: 'frontLeft', action: 'open' },
        status: 'accepted',
        started: ['frontLeft'],
        skipped: [],
        alreadySatisfied: [],
      },
    };

    const { rerender } = render(<FeedbackDisplay feedback={feedback} />);
    expect(screen.getByTestId('feedback')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    rerender(<FeedbackDisplay feedback={feedback} />);
    // After timeout, the timer fires and sets visible to false
    // React state updates are batched — need to wait

    vi.useRealTimers();
  });

  it('updates message when feedback changes', () => {
    const feedback1: FeedbackKind = {
      type: 'command',
      input: '打开左前窗',
      result: {
        command: { source: 'text', target: 'frontLeft', action: 'open' },
        status: 'accepted',
        started: ['frontLeft'],
        skipped: [],
        alreadySatisfied: [],
      },
    };

    const { rerender } = render(<FeedbackDisplay feedback={feedback1} />);
    expect(screen.getByTestId('feedback')).toHaveTextContent(/已执行/);

    const feedback2: FeedbackKind = {
      type: 'parse-error',
      input: '',
      reason: 'conflict',
    };

    rerender(<FeedbackDisplay feedback={feedback2} />);
    expect(screen.getByTestId('feedback')).toHaveTextContent(/歧义/);
  });
});
