import { memo } from 'react';
import { useVehicleStore } from '../domain/vehicle';
import type { WindowId, WindowState } from '../domain/vehicle';

const WINDOW_LABELS: Record<WindowId, string> = {
  frontLeft: '左前窗',
  frontRight: '右前窗',
  rearLeft: '左后窗',
  rearRight: '右后窗',
};

const STATE_LABELS: Record<WindowState, string> = {
  closed: '关闭',
  open: '打开',
  transitioning: '操作中',
};

const WINDOW_ORDER: readonly WindowId[] = [
  'frontLeft',
  'frontRight',
  'rearLeft',
  'rearRight',
];

function statusClass(state: WindowState): string {
  return `window-status window-status--${state}`;
}

export const StatusPanel = memo(function StatusPanel() {
  const windows = useVehicleStore((s) => s.windows);

  return (
    <section className="status-panel" aria-label="车窗状态">
      <h2 className="status-panel-title">车窗状态</h2>
      <ul className="status-panel-list">
        {WINDOW_ORDER.map((id) => (
          <li key={id} className="status-panel-item">
            <span className="status-panel-label">{WINDOW_LABELS[id]}</span>
            <span
              className={statusClass(windows[id])}
              data-testid={`status-${id}`}
            >
              {STATE_LABELS[windows[id]]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
});
