import { describe, it, expect, afterEach, vi } from 'vitest';
import { BrowserSpeechAdapter } from './BrowserSpeechAdapter';
import type { SpeechState } from './types';

// ---------------------------------------------------------------------------
// Mock utilities
// ---------------------------------------------------------------------------

/** Reference to the most-recently-created mock SpeechRecognition instance. */
let inst: SpeechRecognition | null = null;

function createMockInstance(this: SpeechRecognition): void {
  this.lang = '';
  this.continuous = false;
  this.interimResults = false;
  this.onstart = null;
  this.onresult = null;
  this.onerror = null;
  this.onend = null;
  this.start = vi.fn();
  this.stop = vi.fn();
  this.abort = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-this-alias -- constructor stores instance for test access
  inst = this;
}

function installGlobalMock(): void {
  inst = null;
  (window as unknown as Record<string, unknown>).SpeechRecognition =
    createMockInstance as unknown as new () => SpeechRecognition;
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition =
    undefined;
}

function installThrowingMock(): void {
  inst = null;
  const Throwing = function (this: SpeechRecognition) {
    createMockInstance.call(this);
    const origStart = this.start;
    this.start = vi.fn(() => {
      // Call the original so it's tracked, then throw
      origStart();
      throw new Error('Not supported');
    });
  } as unknown as new () => SpeechRecognition;
  (window as unknown as Record<string, unknown>).SpeechRecognition = Throwing;
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition =
    undefined;
}

function installWebkitMock(): void {
  inst = null;
  (window as unknown as Record<string, unknown>).SpeechRecognition = undefined;
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition =
    createMockInstance as unknown as new () => SpeechRecognition;
}

function uninstallMock(): void {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  inst = null;
}

function assertInst(): SpeechRecognition {
  if (!inst) throw new Error('No mock instance — call installGlobalMock first');
  return inst;
}

function fireOnstart(): void {
  assertInst().onstart?.(new Event('start'));
}

function fireOnresult(
  transcript: string,
  confidence = 1,
  isFinal = true,
): void {
  const event: SpeechRecognitionEvent = {
    type: 'result',
    results: {
      length: 1,
      item: (i: number) =>
        i === 0
          ? {
              isFinal,
              length: 1,
              item: () => ({ transcript, confidence }),
              0: { transcript, confidence },
            }
          : null,
      0: {
        isFinal,
        length: 1,
        item: () => ({ transcript, confidence }),
        0: { transcript, confidence },
      },
    },
    resultIndex: 0,
  } as unknown as SpeechRecognitionEvent;
  assertInst().onresult?.(event);
}

function fireOnerror(code: string): void {
  assertInst().onerror?.({
    type: 'error',
    error: code,
    message: `Error: ${code}`,
  } as SpeechRecognitionErrorEvent);
}

function fireOnend(): void {
  assertInst().onend?.(new Event('end'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BrowserSpeechAdapter', () => {
  afterEach(() => {
    uninstallMock();
  });

  // ---- supported detection ----

  describe('supported detection', () => {
    it('reports supported=true when SpeechRecognition is available', () => {
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();
      expect(adapter.supported).toBe(true);
      expect(adapter.state).toBe('idle');
    });

    it('reports supported=true with webkit prefix only', () => {
      installWebkitMock();
      const adapter = new BrowserSpeechAdapter();
      expect(adapter.supported).toBe(true);
    });

    it('reports supported=false and state=unsupported with no API', () => {
      const adapter = new BrowserSpeechAdapter();
      expect(adapter.supported).toBe(false);
      expect(adapter.state).toBe('unsupported');
    });
  });

  // ---- start() ----

  describe('start()', () => {
    it('transitions: idle → permission → listening', () => {
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();
      const states: SpeechState[] = [];
      adapter.subscribe((e) => {
        if (e.type === 'statechange') states.push(e.state);
      });

      adapter.start();
      expect(states).toContain('permission');
      expect(assertInst().start).toHaveBeenCalledOnce();

      fireOnstart();
      expect(states).toContain('listening');
      expect(adapter.state).toBe('listening');
    });

    it('stays in unsupported when API is absent', () => {
      const adapter = new BrowserSpeechAdapter();
      const states: SpeechState[] = [];
      adapter.subscribe((e) => {
        if (e.type === 'statechange') states.push(e.state);
      });

      adapter.start();
      expect(states).toEqual(['unsupported']);
    });

    it('emits start event after onstart fires', () => {
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();
      const events: string[] = [];
      adapter.subscribe((e) => events.push(e.type));

      adapter.start();
      fireOnstart();
      expect(events).toContain('start');
    });

    it('aborts previous recognition on second start()', () => {
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();

      adapter.start();
      fireOnstart();
      const firstInst = assertInst();
      expect(firstInst.start).toHaveBeenCalledTimes(1);

      adapter.start();
      // The first instance should have been aborted
      expect(firstInst.abort).toHaveBeenCalledOnce();
    });
  });

  // ---- result handling ----

  describe('result handling', () => {
    it('emits result with transcript and confidence', () => {
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();
      const results: Array<{ transcript: string; confidence: number }> = [];
      adapter.subscribe((e) => {
        if (e.type === 'result') results.push(e.result);
      });

      adapter.start();
      fireOnstart();
      fireOnresult('打开左前窗', 0.95);

      expect(results).toHaveLength(1);
      expect(results[0].transcript).toBe('打开左前窗');
      expect(results[0].confidence).toBe(0.95);
    });

    it('sets state to success after final result', () => {
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();

      adapter.start();
      fireOnstart();
      fireOnresult('关闭全部车窗');

      expect(adapter.state).toBe('success');
    });

    it('ignores non-final (interim) results', () => {
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();
      const results: unknown[] = [];
      adapter.subscribe((e) => {
        if (e.type === 'result') results.push(e.result);
      });

      adapter.start();
      fireOnstart();
      fireOnresult('打开', 0.5, false);

      expect(results).toHaveLength(0);
      expect(adapter.state).toBe('listening');
    });
  });

  // ---- error handling ----

  describe('error handling', () => {
    it.each([
      ['not-allowed', 'denied'],
      ['service-not-allowed', 'denied'],
      ['no-speech', 'no-speech'],
      ['aborted', 'aborted'],
      ['network', 'network'],
      ['audio-capture', 'not-supported'],
      ['bad-grammar', 'not-supported'],
      ['language-not-supported', 'not-supported'],
      ['unknown-code', 'not-supported'],
    ])('maps "%s" → "%s"', (code, expected) => {
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();
      const errors: string[] = [];
      adapter.subscribe((e) => {
        if (e.type === 'error') errors.push(e.error);
      });

      adapter.start();
      fireOnstart();
      fireOnerror(code);

      expect(errors).toEqual([expected]);
      expect(adapter.state).toBe('error');
    });

    it('does not fire timeout after error', () => {
      vi.useFakeTimers();
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();

      adapter.start();
      fireOnstart();
      fireOnerror('no-speech');

      vi.advanceTimersByTime(15_000);
      expect(adapter.state).toBe('error');
      vi.useRealTimers();
    });
  });

  // ---- timeout ----

  describe('timeout', () => {
    it('emits timeout error 10 s after onstart with no result', () => {
      vi.useFakeTimers();
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();
      const errors: string[] = [];
      adapter.subscribe((e) => {
        if (e.type === 'error') errors.push(e.error);
      });

      adapter.start();
      fireOnstart();
      vi.advanceTimersByTime(10_000);

      expect(errors).toEqual(['timeout']);
      expect(adapter.state).toBe('error');
      vi.useRealTimers();
    });

    it('does not fire timeout when result arrives in time', () => {
      vi.useFakeTimers();
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();

      adapter.start();
      fireOnstart();
      vi.advanceTimersByTime(5_000);
      fireOnresult('打开左前窗');
      vi.advanceTimersByTime(10_000);

      expect(adapter.state).toBe('success');
      vi.useRealTimers();
    });
  });

  // ---- stop() ----

  describe('stop()', () => {
    it('aborts and nullifies handlers', () => {
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();

      adapter.start();
      fireOnstart();
      expect(assertInst().onstart).toBeDefined();

      adapter.stop();
      expect(assertInst().abort).toHaveBeenCalled();
      expect(assertInst().onstart).toBeNull();
      expect(assertInst().onresult).toBeNull();
      expect(assertInst().onerror).toBeNull();
      expect(assertInst().onend).toBeNull();
    });

    it('clears the 10 s timeout', () => {
      vi.useFakeTimers();
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();
      const errors: string[] = [];
      adapter.subscribe((e) => {
        if (e.type === 'error') errors.push(e.error);
      });

      adapter.start();
      fireOnstart();
      adapter.stop();
      vi.advanceTimersByTime(15_000);

      expect(errors).toHaveLength(0);
      vi.useRealTimers();
    });
  });

  // ---- onend ----

  describe('onend', () => {
    it('emits end event', () => {
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();
      const events: string[] = [];
      adapter.subscribe((e) => events.push(e.type));

      adapter.start();
      fireOnstart();
      fireOnend();

      expect(events).toContain('end');
    });

    it('clears timeout when onend fires', () => {
      vi.useFakeTimers();
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();
      const errors: string[] = [];
      adapter.subscribe((e) => {
        if (e.type === 'error') errors.push(e.error);
      });

      adapter.start();
      fireOnstart();
      fireOnend();
      vi.advanceTimersByTime(15_000);

      expect(errors).toHaveLength(0);
      vi.useRealTimers();
    });
  });

  // ---- subscribe / unsubscribe ----

  describe('subscribe / unsubscribe', () => {
    it('stops delivery after unsubscribe', () => {
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();
      const calls: string[] = [];

      const unsub = adapter.subscribe((e) => calls.push(e.type));
      adapter.start();
      fireOnstart();
      expect(calls).toContain('start');

      const countBefore = calls.length;
      unsub();
      fireOnresult('打开左前窗');
      expect(calls).toHaveLength(countBefore);
    });

    it('delivers to multiple subscribers', () => {
      installGlobalMock();
      const adapter = new BrowserSpeechAdapter();
      const a: string[] = [];
      const b: string[] = [];

      adapter.subscribe((e) => {
        if (e.type === 'statechange') a.push(e.state);
      });
      adapter.subscribe((e) => {
        if (e.type === 'statechange') b.push(e.state);
      });

      adapter.start();
      fireOnstart();

      expect(a).toContain('listening');
      expect(b).toContain('listening');
    });
  });

  // ---- throwing start ----

  describe('constructor error handling', () => {
    it('catches synchronous errors from recognition.start()', () => {
      installThrowingMock();
      const adapter = new BrowserSpeechAdapter();
      const errors: string[] = [];
      adapter.subscribe((e) => {
        if (e.type === 'error') errors.push(e.error);
      });

      adapter.start();
      expect(errors).toEqual(['not-supported']);
      expect(adapter.state).toBe('error');
    });
  });
});
