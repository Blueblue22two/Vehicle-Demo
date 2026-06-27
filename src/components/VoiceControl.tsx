import { useCallback, useEffect, useState } from 'react';
import { BrowserSpeechAdapter } from '../features/voice';
import type { SpeechErrorType, SpeechState } from '../features/voice';
import {
  parseVehicleCommand,
  type ParseFailureReason,
} from '../features/command';
import { useVehicleStore } from '../domain/vehicle';
import type { FeedbackKind } from './FeedbackDisplay';

export interface VoiceControlProps {
  onFeedback: (feedback: FeedbackKind) => void;
}

// ---------------------------------------------------------------------------
// Status labels
// ---------------------------------------------------------------------------

const STATE_LABELS: Record<SpeechState, string> = {
  idle: '点击麦克风开始语音控制',
  permission: '等待麦克风授权…',
  preparing: '正在准备本地语音识别…',
  listening: '正在聆听…',
  success: '识别成功',
  error: '识别失败',
  unsupported: '您的浏览器不支持语音识别，请使用文本输入',
};

const ERROR_LABELS: Record<SpeechErrorType, string> = {
  denied: '麦克风权限被拒绝，请在浏览器设置中允许后重试',
  'no-speech': '未检测到语音，请重试',
  aborted: '识别已取消',
  network: '本地语音不可用，且在线识别连接失败；请检查网络或使用文本输入',
  timeout: '识别超时，请重试',
  'not-supported': '语音识别不可用',
};

// ---------------------------------------------------------------------------
// VoiceControl
// ---------------------------------------------------------------------------

/**
 * Microphone button that drives browser speech recognition via
 * {@link BrowserSpeechAdapter}.
 *
 * Recognised transcript → `parseVehicleCommand(text, 'voice')` →
 * `executeCommand()` → `onFeedback`.  All voice state UI (mic button,
 * listening pulse, error messages) is self-contained; command execution
 * results are routed through the shared feedback system so they appear
 * alongside text-command results.
 */
export function VoiceControl({ onFeedback }: VoiceControlProps) {
  const [adapter] = useState(() => new BrowserSpeechAdapter());

  const [speechState, setSpeechState] = useState<SpeechState>(
    adapter.supported ? 'idle' : 'unsupported',
  );
  const [errorType, setErrorType] = useState<SpeechErrorType | null>(null);

  // ---- Subscribe to adapter events ----
  useEffect(() => {
    const unsub = adapter.subscribe((event) => {
      switch (event.type) {
        case 'statechange':
          setSpeechState(event.state);
          if (event.state === 'idle') setErrorType(null);
          break;

        case 'result': {
          // Route recognised text through the existing parse → execute pipeline.
          const parsed = parseVehicleCommand(event.result.transcript, 'voice');
          if (parsed.ok) {
            const result = useVehicleStore
              .getState()
              .executeCommand(parsed.command);
            onFeedback({
              type: 'command',
              input: event.result.transcript,
              result,
            });
          } else {
            const reason: ParseFailureReason = parsed.reason;
            onFeedback({
              type: 'parse-error',
              input: event.result.transcript,
              reason,
            });
          }
          break;
        }

        case 'error':
          setErrorType(event.error);
          break;

        case 'end':
          // Recognition session ended — if still in listening/success, go idle.
          setSpeechState((prev) =>
            prev === 'listening' || prev === 'success' ? 'idle' : prev,
          );
          break;
      }
    });

    return () => {
      unsub();
      adapter.stop();
    };
  }, [adapter, onFeedback]);

  // ---- Click handler ----
  const handleClick = useCallback(() => {
    if (
      speechState === 'listening' ||
      speechState === 'permission' ||
      speechState === 'preparing'
    ) {
      adapter.stop();
      setSpeechState('idle');
      setErrorType(null);
    } else {
      adapter.start();
    }
  }, [adapter, speechState]);

  // ---- Render helpers ----

  const isDisabled = speechState === 'unsupported' || errorType === 'denied';
  const isActive =
    speechState === 'listening' ||
    speechState === 'permission' ||
    speechState === 'preparing';

  const statusText = (() => {
    if (speechState === 'error' && errorType) {
      return ERROR_LABELS[errorType];
    }
    if (speechState === 'unsupported') {
      return STATE_LABELS.unsupported;
    }
    if (errorType === 'denied') {
      return ERROR_LABELS.denied;
    }
    return STATE_LABELS[speechState];
  })();

  const buttonLabel = isActive ? '停止语音' : '开始语音';

  return (
    <div className="voice-control" data-testid="voice-control">
      <button
        className={`voice-control-button${isActive ? ' voice-control-button--active' : ''}`}
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={buttonLabel}
        data-testid="voice-button"
      >
        <span
          className={`voice-control-icon${isActive ? ' voice-control-icon--pulse' : ''}`}
          aria-hidden="true"
        >
          🎤
        </span>
      </button>
      <span
        className={`voice-control-status${isDisabled ? ' voice-control-status--error' : ''}`}
        data-testid="voice-status"
      >
        {statusText}
      </span>
    </div>
  );
}
