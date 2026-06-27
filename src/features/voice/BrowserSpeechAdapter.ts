import type {
  SpeechAdapter,
  SpeechErrorType,
  SpeechEvent,
  SpeechState,
} from './types';

/** Browser-native SpeechRecognition constructor (standard or webkit-prefixed). */
type SpeechRecognitionCtor = (new () => SpeechRecognition) & {
  available?: SpeechRecognitionConstructor['available'];
  install?: SpeechRecognitionConstructor['install'];
};

/** Milliseconds before a listening session times out with no result. */
const NO_SPEECH_TIMEOUT_MS = 10_000;
const RECOGNITION_LANGUAGE = 'zh-CN';

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
  /** Invalidates callbacks and asynchronous preparation from older sessions. */
  private sessionId = 0;

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

    // Guard against parallel sessions and invalidate callbacks from the old one.
    this.clearTimeout();
    this.stopRecognition();
    const sessionId = ++this.sessionId;
    this.setState('permission');

    // Older implementations do not expose the on-device capability API. Start
    // synchronously to preserve their user-gesture permission behaviour.
    if (!this.ctor.available) {
      this.beginRecognition(sessionId, false);
      return;
    }

    void this.prepareLocalRecognition(sessionId);
  }

  stop(): void {
    ++this.sessionId;
    this.clearTimeout();
    this.stopRecognition();
    if (this._supported) this.setState('idle');
  }

  subscribe(listener: (event: SpeechEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---- recognition lifecycle ----

  private async prepareLocalRecognition(sessionId: number): Promise<void> {
    const ctor = this.ctor;
    if (!ctor?.available) return;

    let processLocally = false;
    try {
      this.setStateIfCurrent(sessionId, 'preparing');
      const availability = await ctor.available({
        langs: [RECOGNITION_LANGUAGE],
        processLocally: true,
      });
      if (!this.isCurrentSession(sessionId)) return;

      if (availability === 'available') {
        processLocally = true;
      } else if (
        (availability === 'downloadable' || availability === 'downloading') &&
        ctor.install
      ) {
        processLocally = await ctor.install({
          langs: [RECOGNITION_LANGUAGE],
        });
        if (!this.isCurrentSession(sessionId)) return;
      }
    } catch {
      // Capability checks may be blocked by Permissions Policy. The legacy
      // online recognizer remains a valid best-effort fallback.
      processLocally = false;
    }

    if (!this.isCurrentSession(sessionId)) return;
    this.setState('permission');
    this.beginRecognition(sessionId, processLocally);
  }

  private beginRecognition(sessionId: number, processLocally: boolean): void {
    if (!this.ctor || !this.isCurrentSession(sessionId)) return;

    const recognition = new this.ctor();
    this.recognition = recognition;

    recognition.lang = RECOGNITION_LANGUAGE;
    recognition.continuous = false;
    recognition.interimResults = false;
    if (processLocally) recognition.processLocally = true;

    recognition.onstart = () => {
      if (!this.isCurrentRecognition(sessionId, recognition)) return;
      this.clearTimeout();
      this.setState('listening');
      this.emit({ type: 'start' });

      // Arm no-speech timeout once listening begins.
      this.timeoutId = setTimeout(() => {
        if (
          this._state === 'listening' &&
          this.isCurrentRecognition(sessionId, recognition)
        ) {
          this.stopRecognition();
          this.setState('error');
          this.emit({ type: 'error', error: 'timeout' });
        }
      }, NO_SPEECH_TIMEOUT_MS);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!this.isCurrentRecognition(sessionId, recognition)) return;
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
      if (!this.isCurrentRecognition(sessionId, recognition)) return;
      this.clearTimeout();
      const errorType = mapError(event.error);
      this.setState('error');
      this.emit({ type: 'error', error: errorType });
    };

    recognition.onend = () => {
      if (!this.isCurrentRecognition(sessionId, recognition)) return;
      this.clearTimeout();
      this.recognition = null;
      this.emit({ type: 'end' });
    };

    try {
      recognition.start();
    } catch {
      if (!this.isCurrentRecognition(sessionId, recognition)) return;
      this.stopRecognition();
      this.setState('error');
      this.emit({ type: 'error', error: 'not-supported' });
    }
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

  private isCurrentSession(sessionId: number): boolean {
    return this.sessionId === sessionId;
  }

  private isCurrentRecognition(
    sessionId: number,
    recognition: SpeechRecognition,
  ): boolean {
    return this.isCurrentSession(sessionId) && this.recognition === recognition;
  }

  private setStateIfCurrent(sessionId: number, state: SpeechState): void {
    if (this.isCurrentSession(sessionId)) this.setState(state);
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
