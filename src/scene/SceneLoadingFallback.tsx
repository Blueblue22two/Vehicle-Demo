import { useProgress } from '@react-three/drei';

/**
 * Suspense fallback that displays real loading progress via Drei's
 * `useProgress` hook.  Shows a percentage bar during asset loading and
 * a static "loading" message before progress reporting begins.
 */
export function SceneLoadingFallback() {
  const { progress, active } = useProgress();

  const percent = Math.round(progress);
  const label = active ? `正在加载 3D 车辆… ${percent}%` : '正在加载 3D 车辆…';

  return (
    <div
      className="scene-loading"
      role="status"
      aria-label="正在加载 3D 场景"
      data-testid="scene-loading"
    >
      <p className="scene-loading-text">{label}</p>
      <div
        className="scene-loading-bar"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="scene-loading-bar-fill"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
