import type {
  SpeechAdapter,
  SpeechErrorType,
  SpeechEvent,
  SpeechState,
} from './types';

/** Browser-native SpeechRecognition constructor (standard or webkit-prefixed). */
type SpeechRecognitionCtor = new () => SpeechRecognition;

/** Milliseconds before a listening session times out with no result. */
const NO_SPEECH_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveConstructor(): SpeechRecognitionCtor | null {
  const w = window as unknown as Record<string, unknown>;
  const SR =
    (w.SpeechRecognition as SpeechRecognitionCtor | undefined) ??
    (w.webkitSpeechRecognition as SpeechRecognitionCtor | undefined);
  return SR ?? null;
}

function mapError(error: string): SpeechErrorType {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied';
    case 'no-speech':
      return 'no-speech';
    case 'aborted':
      return 'aborted';
    case 'network':
      return 'network';
    case 'audio-capture':
    case 'bad-grammar':
    case 'language-not-supported':
    default:
      return 'not-supported';
  }
}

// ---------------------------------------------------------------------------
// BrowserSpeechAdapter
// ---------------------------------------------------------------------------

/**
 * Wraps the browser Web Speech API (`SpeechRecognition` /
 * `webkitSpeechRecognition`) behind the {@link SpeechAdapter} interface.
 *
 * Configured for single-shot Mandarin Chinese recognition.  Permission
 * requests are triggered by calling `start()` from a user-gesture handler.
 *
 * State machine:
 * ```
 * idle ──start()──> permission ──onstart──> listening ──onresult──> success ──(auto)──> idle
 *   │                  │                      │                  │
 *   │                  └──onerror(denied)──────┴──onerror──────────┴──onerror──> error ──(user retry)──> idle
 *   └──constructor unsupported──> unsupported
 * ```
 */
export class BrowserSpeechAdapter implements SpeechAdapter {
  private recognition: SpeechRecognition | null = null;
  private _state: SpeechState;
  private _supported: boolean;
  private listeners = new Set<(event: SpeechEvent) => void>();
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private ctor: SpeechRecognitionCtor | null;

  constructor() {
    this.ctor = resolveConstructor();
    this._supported = this.ctor !== null;
    this._state = this._supported ? 'idle' : 'unsupported';
  }

  // ---- public getters ----

  get supported(): boolean {
    return this._supported;
  }

  get state(): SpeechState {
    return this._state;
  }

  // ---- public API ----

  start(): void {
    if (!this._supported || !this.ctor) {
      this.setState('unsupported');
      return;
    }

    // Guard against parallel sessions: stop any active recognition first.
    this.stopRecognition();

    const recognition = new this.ctor();
    this.recognition = recognition;

    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      this.clearTimeout();
      this.setState('listening');
      this.emit({ type: 'start' });

      // Arm no-speech timeout once listening begins.
      this.timeoutId = setTimeout(() => {
        if (this._state === 'listening') {
          this.stop();
          this.setState('error');
          this.emit({ type: 'error', error: 'timeout' });
        }
      }, NO_SPEECH_TIMEOUT_MS);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.clearTimeout();
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) return;

      const alternative = last[0];
      this.setState('success');
      this.emit({
        type: 'result',
        result: {
          transcript: alternative.transcript,
          confidence: alternative.confidence,
        },
      });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.clearTimeout();
      const errorType = mapError(event.error);
      this.setState('error');
      this.emit({ type: 'error', error: errorType });
    };

    recognition.onend = () => {
      this.clearTimeout();
      this.emit({ type: 'end' });
    };

    this.setState('permission');
    try {
      recognition.start();
    } catch {
      this.setState('error');
      this.emit({ type: 'error', error: 'not-supported' });
    }
  }

  stop(): void {
    this.clearTimeout();
    this.stopRecognition();
  }

  subscribe(listener: (event: SpeechEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---- internal helpers ----

  private setState(state: SpeechState): void {
    this._state = state;
    this.emit({ type: 'statechange', state });
  }

  private emit(event: SpeechEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private stopRecognition(): void {
    if (this.recognition) {
      // Detach all handlers to avoid stale-event races during teardown.
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition.abort();
      this.recognition = null;
    }
  }

  private clearTimeout(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
