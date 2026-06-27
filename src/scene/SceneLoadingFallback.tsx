export function SceneLoadingFallback() {
  return (
    <div
      className="scene-loading"
      role="status"
      aria-label="正在加载 3D 场景"
      data-testid="scene-loading"
    >
      <p className="scene-loading-text">正在加载 3D 车辆…</p>
    </div>
  );
}
