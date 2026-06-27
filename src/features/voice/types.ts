/**
 * Speech recognition state machine states.
 *
 * - `idle`: ready to start, no active recognition
 * - `permission`: waiting for browser microphone permission dialog
 * - `listening`: actively capturing and recognizing speech
 * - `success`: recognition produced a final transcript
 * - `error`: recognition failed with a recoverable or permanent error
 * - `unsupported`: Web Speech API not available in this browser
 */
export type SpeechState =
  | 'idle'
  | 'permission'
  | 'listening'
  | 'success'
  | 'error'
  | 'unsupported';

/**
 * Normalised error types from the SpeechRecognition error event.
 *
 * - `denied`: user or browser denied microphone access
 * - `no-speech`: recognition started but detected no speech
 * - `aborted`: recognition was intentionally stopped via `abort()`
 * - `network`: network error during cloud-based recognition
 * - `timeout`: no result within the configured timeout window
 * - `not-supported`: browser API missing or failed to initialise
 */
export type SpeechErrorType =
  | 'denied'
  | 'no-speech'
  | 'aborted'
  | 'network'
  | 'timeout'
  | 'not-supported';

/** Result produced by a successful recognition. */
export interface SpeechResult {
  transcript: string;
  confidence: number;
}

/** Normalised event emitted by the speech adapter. */
export type SpeechEvent =
  | { type: 'start' }
  | { type: 'result'; result: SpeechResult }
  | { type: 'error'; error: SpeechErrorType }
  | { type: 'end' }
  | { type: 'statechange'; state: SpeechState };

/**
 * Adapter interface for browser speech recognition.
 *
 * All browser-specific details (prefixes, event mapping, timeout) are
 * contained inside the implementation.  Consumers only depend on this
 * interface so the adapter can be replaced for testing or future
 * cloud-ASR integrations.
 */
export interface SpeechAdapter {
  /** Whether the browser exposes a usable SpeechRecognition constructor. */
  readonly supported: boolean;
  /** Current state of the recognition state machine. */
  readonly state: SpeechState;
  /**
   * Begin a single-shot recognition session.
   *
   * Must be called from a user-gesture handler (click) so the browser
   * allows the microphone permission prompt.
   */
  start(): void;
  /** Stop the active recognition session and clean up. */
  stop(): void;
  /**
   * Subscribe to speech events.  Returns an unsubscribe function.
   * The listener is called synchronously when the adapter state changes.
   */
  subscribe(listener: (event: SpeechEvent) => void): () => void;
}
