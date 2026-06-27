import { useCallback, useRef } from 'react';
import { useVehicleStore } from '../domain/vehicle';
import { parseVehicleCommand } from '../features/command';
import type { FeedbackKind } from './FeedbackDisplay';

interface TextCommandInputProps {
  onFeedback: (fb: FeedbackKind) => void;
}

export function TextCommandInput({ onFeedback }: TextCommandInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const text = inputRef.current?.value.trim();
    if (!text) return;

    const parsed = parseVehicleCommand(text, 'text');

    if (!parsed.ok) {
      onFeedback({ type: 'parse-error', input: text, reason: parsed.reason });
      return;
    }

    const store = useVehicleStore.getState();
    const result = store.executeCommand(parsed.command);

    onFeedback({ type: 'command', input: text, result });

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [onFeedback]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="text-command">
      <label htmlFor="text-command-input" className="text-command-label">
        文本控车
      </label>
      <div className="text-command-row">
        <input
          id="text-command-input"
          ref={inputRef}
          className="text-command-input"
          type="text"
          placeholder={'输入命令，如“打开左前窗”'}
          aria-label="文本命令输入"
          onKeyDown={handleKeyDown}
        />
        <button
          className="text-command-submit"
          type="button"
          aria-label="发送命令"
          onClick={handleSubmit}
        >
          发送
        </button>
      </div>
    </div>
  );
}
