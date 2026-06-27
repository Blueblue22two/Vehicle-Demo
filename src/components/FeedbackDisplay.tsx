import { useEffect, useState } from 'react';
import type {
  CommandExecutionResult,
  CommandResultStatus,
} from '../domain/vehicle';
import type { ParseFailureReason } from '../features/command';

export type FeedbackKind =
  | { type: 'command'; input: string; result: CommandExecutionResult }
  | { type: 'parse-error'; input: string; reason: ParseFailureReason }
  | { type: 'idle' };

interface FeedbackDisplayProps {
  feedback: FeedbackKind;
}

const STATUS_MESSAGES: Record<CommandResultStatus, string> = {
  accepted: '已执行',
  partial: '部分执行',
  noop: '已在目标状态',
  blocked: '操作被锁定',
};

const PARSE_ERROR_MESSAGES: Record<ParseFailureReason, string> = {
  'missing-action': '请说明要"打开"还是"关闭"车窗',
  'missing-target': '请指定车窗，如"左前窗"或"全部车窗"',
  conflict: '命令有歧义，请重新表达',
  unsupported: '不支持的命令，请使用"打开/关闭 车窗名"',
};

function formatCommandResult(result: CommandExecutionResult): string {
  const targets =
    result.started.length > 0
      ? result.started.join('、')
      : result.alreadySatisfied.length > 0
        ? result.alreadySatisfied.join('、')
        : result.skipped.join('、');

  return `${STATUS_MESSAGES[result.status]}：${targets}`;
}

/**
 * Shows operation feedback with auto-dismiss.
 * Visibility is driven by `feedback` prop changes:
 * - non-idle feedback → show immediately
 * - idle → hide immediately
 * - accepted / parse-error → auto-hide after 3–4 s
 */
export function FeedbackDisplay({ feedback }: FeedbackDisplayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (feedback.type === 'idle') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);

    const delay =
      feedback.type === 'parse-error'
        ? 4000
        : feedback.result.status === 'accepted' ||
            feedback.result.status === 'noop'
          ? 3000
          : 5000;

    const timer = setTimeout(() => setVisible(false), delay);
    return () => clearTimeout(timer);
  }, [feedback]);

  if (!visible || feedback.type === 'idle') return null;

  const message =
    feedback.type === 'command'
      ? formatCommandResult(feedback.result)
      : PARSE_ERROR_MESSAGES[feedback.reason];

  const variant =
    feedback.type === 'parse-error'
      ? 'error'
      : feedback.result.status === 'noop'
        ? 'info'
        : feedback.result.status === 'blocked'
          ? 'warning'
          : 'success';

  return (
    <output
      className={`feedback feedback--${variant}`}
      role="status"
      aria-live="polite"
      data-testid="feedback"
    >
      {message}
    </output>
  );
}
