import { useProgress } from '@react-three/drei';

/**
 * Suspense fallback displayed while the 3D model is loading.
 * Uses Drei's `useProgress` to show actual loading percentage
 * instead of a static wait message.
 */
export function SceneLoadingFallback() {
  const { progress, active } = useProgress();

  const rounded = Math.round(progress);
  const label = active ? `正在加载 3D 车辆… ${rounded}%` : '正在准备场景…';

  return (
    <div
      className="scene-loading"
      role="status"
      aria-label="正在加载 3D 场景"
      data-testid="scene-loading"
    >
      <p className="scene-loading-text">{label}</p>
      <div className="scene-loading-bar" aria-hidden="true">
        <div
          className="scene-loading-bar-fill"
          style={{ width: `${rounded}%` }}
        />
      </div>
    </div>
  );
}
