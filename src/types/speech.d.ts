/**
 * Type declarations for the browser Web Speech API (SpeechRecognition).
 *
 * These interfaces are not yet included in TypeScript's standard DOM lib
 * (as of TS 5.x).  They cover the subset needed by the NeoCabin voice
 * adapter — single-shot recognition with final results and error mapping.
 */

export {};

declare global {
  /** Constructor for the browser SpeechRecognition API. */
  interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;

    start(): void;
    stop(): void;
    abort(): void;

    onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
    onresult:
      | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void)
      | null;
    onerror:
      | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void)
      | null;
    onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  }

  /** Exposed on `window` in Chromium-based browsers. */
  var SpeechRecognition: {
    new (): SpeechRecognition;
  };

  /** Legacy prefixed constructor (Safari / older Chrome). */
  var webkitSpeechRecognition: {
    new (): SpeechRecognition;
  };

  /** Event fired when recognition produces results. */
  interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
    readonly resultIndex: number;
  }

  /** List of recognition results (typically one for `continuous: false`). */
  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  /** A single recognition result containing one or more alternatives. */
  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  /** A single recognition alternative (transcript + confidence). */
  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  /** Event fired when recognition encounters an error. */
  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
  }
}
