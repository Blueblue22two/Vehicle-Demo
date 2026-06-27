import { VehicleScene } from '../scene';
import { ControlPanel } from '../components';

export function App() {
  return (
    <div className="app-root">
      <header className="app-header">
        <span className="app-brand">NeoCabin</span>
        <h1 className="app-title">3D 智舱车控 Demo</h1>
      </header>
      <main className="app-main">
        <VehicleScene />
      </main>
      <ControlPanel />
      <footer className="app-footer">
        <span>拖动旋转 · 点击车窗 · 语音控制</span>
      </footer>
    </div>
  );
}
