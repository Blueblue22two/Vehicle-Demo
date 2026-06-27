import { useCallback, useState } from 'react';
import { StatusPanel } from './StatusPanel';
import { TextCommandInput } from './TextCommandInput';
import { VoiceControl } from './VoiceControl';
import { FeedbackDisplay } from './FeedbackDisplay';
import type { FeedbackKind } from './FeedbackDisplay';

export function ControlPanel() {
  const [feedback, setFeedback] = useState<FeedbackKind>({ type: 'idle' });

  const handleFeedback = useCallback((fb: FeedbackKind) => {
    setFeedback(fb);
  }, []);

  return (
    <aside className="control-panel" aria-label="车控面板">
      <StatusPanel />
      <VoiceControl onFeedback={handleFeedback} />
      <TextCommandInput onFeedback={handleFeedback} />
      <FeedbackDisplay feedback={feedback} />
    </aside>
  );
}
