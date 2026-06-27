import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FeedbackKind } from './FeedbackDisplay';
import { useVehicleStore } from '../domain/vehicle';

// ---------------------------------------------------------------------------
// Shared mock state — set by the mocked class, read by tests
// ---------------------------------------------------------------------------

type Listener = (event: {
  type: string;
  state?: string;
  result?: { transcript: string; confidence: number };
  error?: string;
}) => void;

interface MockAdapter {
  supported: boolean;
  state: string;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  _emit(event: Parameters<Listener>[0]): void;
}

let currentMock: MockAdapter | null = null;

// ---------------------------------------------------------------------------
// Module mock — hoisted by Vitest
// ---------------------------------------------------------------------------

vi.mock('../features/voice', () => {
  // Must be defined inside factory so hoisting doesn't break references.

  function createMockAdapter(): MockAdapter {
    const listeners = new Set<Listener>();
    return {
      supported: true,
      state: 'idle',
      start: vi.fn(function (this: MockAdapter) {
        this.state = 'permission';
        for (const fn of listeners)
          fn({ type: 'statechange', state: 'permission' });
        setTimeout(() => {
          this.state = 'listening';
          for (const fn of listeners)
            fn({ type: 'statechange', state: 'listening' });
          for (const fn of listeners) fn({ type: 'start' });
        }, 0);
      }),
      stop: vi.fn(function (this: MockAdapter) {
        this.state = 'idle';
        for (const fn of listeners) fn({ type: 'statechange', state: 'idle' });
        for (const fn of listeners) fn({ type: 'end' });
      }),
      subscribe: vi.fn((fn: Listener) => {
        listeners.add(fn);
        return () => {
          listeners.delete(fn);
        };
      }),
      _emit(event: Parameters<Listener>[0]) {
        for (const fn of listeners) fn(event);
      },
    };
  }

  class MockBrowserSpeechAdapter {
    declare supported: boolean;
    declare state: string;
    declare start: ReturnType<typeof vi.fn>;
    declare stop: ReturnType<typeof vi.fn>;
    declare subscribe: ReturnType<typeof vi.fn>;
    declare _emit: (event: Parameters<Listener>[0]) => void;

    constructor() {
      const inst = createMockAdapter();
      this.supported = inst.supported;
      this.state = inst.state;
      this.start = inst.start;
      this.stop = inst.stop;
      this.subscribe = inst.subscribe;
      this._emit = inst._emit;
      currentMock = inst;
    }
  }

  return { BrowserSpeechAdapter: MockBrowserSpeechAdapter };
});

// ---------------------------------------------------------------------------
// Imports (after mock registration)
// ---------------------------------------------------------------------------

import { VoiceControl } from './VoiceControl';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMock(): MockAdapter {
  if (!currentMock) throw new Error('Mock not initialised');
  return currentMock;
}

function renderVoiceControl() {
  const feedbacks: FeedbackKind[] = [];
  const handleFeedback = (fb: FeedbackKind) => feedbacks.push(fb);
  const result = render(<VoiceControl onFeedback={handleFeedback} />);
  return { ...result, feedbacks };
}

async function flushMacroTasks() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VoiceControl', () => {
  beforeEach(() => {
    currentMock = null;
    useVehicleStore.getState().resetVehicleState();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders a microphone button when speech is supported', () => {
      renderVoiceControl();
      const button = screen.getByTestId('voice-button');
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it('renders status text in idle state', () => {
      renderVoiceControl();
      expect(screen.getByTestId('voice-status')).toHaveTextContent(
        '点击麦克风开始语音控制',
      );
    });
  });

  describe('click to start / stop', () => {
    it('calls adapter.start() when mic button is clicked', async () => {
      renderVoiceControl();
      await userEvent.click(screen.getByTestId('voice-button'));
      expect(getMock().start).toHaveBeenCalledOnce();
    });

    it('shows listening state after recognition starts', async () => {
      renderVoiceControl();
      await userEvent.click(screen.getByTestId('voice-button'));
      await flushMacroTasks();

      expect(screen.getByTestId('voice-status')).toHaveTextContent('正在聆听…');
      expect(screen.getByTestId('voice-button')).toHaveClass(
        'voice-control-button--active',
      );
    });

    it('calls adapter.stop() when button is clicked while listening', async () => {
      renderVoiceControl();
      await userEvent.click(screen.getByTestId('voice-button'));
      await flushMacroTasks();

      await userEvent.click(screen.getByTestId('voice-button'));
      expect(getMock().stop).toHaveBeenCalledOnce();
    });

    it('returns to idle after stopping', async () => {
      renderVoiceControl();

      await userEvent.click(screen.getByTestId('voice-button'));
      await flushMacroTasks();
      expect(screen.getByTestId('voice-status')).toHaveTextContent('正在聆听…');

      await userEvent.click(screen.getByTestId('voice-button'));
      expect(screen.getByTestId('voice-status')).toHaveTextContent(
        '点击麦克风开始语音控制',
      );
    });
  });

  describe('recognition result', () => {
    it('routes valid voice command through parse → execute → onFeedback', async () => {
      const { feedbacks } = renderVoiceControl();

      await userEvent.click(screen.getByTestId('voice-button'));
      await flushMacroTasks();

      act(() => {
        getMock()._emit({
          type: 'result',
          result: { transcript: '打开左前窗', confidence: 0.95 },
        });
        getMock()._emit({ type: 'statechange', state: 'success' });
      });

      const commandFeedback = feedbacks.find((f) => f.type === 'command');
      expect(commandFeedback).toBeDefined();
      if (commandFeedback?.type === 'command') {
        expect(commandFeedback.input).toBe('打开左前窗');
        expect(commandFeedback.result.status).toBe('accepted');
        expect(commandFeedback.result.started).toContain('frontLeft');
      }

      expect(useVehicleStore.getState().windows.frontLeft).toBe(
        'transitioning',
      );
    });

    it('routes parse errors through onFeedback without changing store', async () => {
      const { feedbacks } = renderVoiceControl();
      const initialWindows = { ...useVehicleStore.getState().windows };

      await userEvent.click(screen.getByTestId('voice-button'));
      await flushMacroTasks();

      act(() => {
        getMock()._emit({
          type: 'result',
          result: { transcript: '打开天窗', confidence: 0.8 },
        });
        getMock()._emit({ type: 'statechange', state: 'success' });
      });

      const parseError = feedbacks.find((f) => f.type === 'parse-error');
      expect(parseError).toBeDefined();
      if (parseError?.type === 'parse-error') {
        expect(parseError.reason).toBe('unsupported');
      }

      expect(useVehicleStore.getState().windows).toEqual(initialWindows);
    });
  });

  describe('error handling', () => {
    it('displays denied error and disables button', async () => {
      renderVoiceControl();

      await userEvent.click(screen.getByTestId('voice-button'));
      await flushMacroTasks();

      act(() => {
        getMock()._emit({ type: 'error', error: 'denied' });
        getMock()._emit({ type: 'statechange', state: 'error' });
      });

      expect(screen.getByTestId('voice-status')).toHaveTextContent(
        '麦克风权限被拒绝',
      );
      expect(screen.getByTestId('voice-button')).toBeDisabled();
    });

    it.each([
      ['no-speech', '未检测到语音'],
      ['network', '网络连接失败'],
      ['timeout', '识别超时'],
      ['aborted', '识别已取消'],
    ])('displays "%s" error message', async (errorCode, expectedText) => {
      renderVoiceControl();

      await userEvent.click(screen.getByTestId('voice-button'));
      await flushMacroTasks();

      act(() => {
        getMock()._emit({ type: 'error', error: errorCode });
        getMock()._emit({ type: 'statechange', state: 'error' });
      });

      expect(screen.getByTestId('voice-status')).toHaveTextContent(
        expectedText,
      );
      expect(screen.getByTestId('voice-button')).not.toBeDisabled();
    });

    it('does not change vehicle state on recognition error', async () => {
      const initialWindows = { ...useVehicleStore.getState().windows };
      renderVoiceControl();

      await userEvent.click(screen.getByTestId('voice-button'));
      await flushMacroTasks();

      act(() => {
        getMock()._emit({ type: 'error', error: 'no-speech' });
        getMock()._emit({ type: 'statechange', state: 'error' });
      });

      expect(useVehicleStore.getState().windows).toEqual(initialWindows);
    });
  });

  describe('cleanup', () => {
    it('stops adapter on unmount', () => {
      const { unmount } = renderVoiceControl();
      unmount();
      expect(getMock().stop).toHaveBeenCalled();
    });
  });

  describe('end event', () => {
    it('transitions back to idle when onend fires during listening', async () => {
      renderVoiceControl();

      await userEvent.click(screen.getByTestId('voice-button'));
      await flushMacroTasks();
      expect(screen.getByTestId('voice-status')).toHaveTextContent('正在聆听…');

      act(() => {
        getMock()._emit({ type: 'end' });
      });

      expect(screen.getByTestId('voice-status')).toHaveTextContent(
        '点击麦克风开始语音控制',
      );
    });
  });
});
