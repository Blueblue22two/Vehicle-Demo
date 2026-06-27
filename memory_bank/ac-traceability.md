# AC 验收追踪矩阵

| 项目 | 内容 |
| --- | --- |
| 文档版本 | V1.0 |
| 对应 PRD | `docs/3d-vehicle-control-demo-prd.md` V1.0 |
| 生成日期 | 2026-06-27 |
| 状态约定 | ✅ 已覆盖 / 🔧 人工验收 / ⬜ 待覆盖 |

## 覆盖状态

| AC | 验收项 | 单元/组件测试 | 集成测试 | E2E 测试 | 人工验收 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-01 | 页面启动 | `App.test.tsx` (header/shell), `main.test.tsx` (mount) | — | `app.spec.ts` (heading visible) | Chrome 启动无控制台错误 | ✅ |
| AC-02 | 初始状态 | `vehicleStore.test.ts` (all closed), `StatusPanel.test.tsx` (4 labels) | `integration.test.ts` (initial state) | `app.spec.ts` (status panel) | Chrome 中模型完整可见 | ✅ |
| AC-03 | 拖动旋转 | `cameraControls.test.tsx` (OrbitControls props) | — | — | Chrome 中拖动旋转车辆 | 🔧 |
| AC-04 | 拖动防误触 | `cameraControls.test.tsx` (dragDetector 5px) | `integration.test.ts` (block) | `app.spec.ts` (drag >5px scenario) | — | ✅ |
| AC-05 | 重置视角 | ⬜ P1 功能 (NC-012) | — | — | — | ⬜ |
| AC-06 | 车窗命中 | `windowSystem.test.tsx` (node discovery, click→toggle) | `integration.test.ts` (single window) | — | Chrome 中四窗悬停/点击 | 🔧 |
| AC-07 | 单窗动画 | `windowSystem.test.tsx` (animation duration, offset) | `integration.test.ts` (complete/fail) | — | Chrome 中动画方向/时长正确 | 🔧 |
| AC-08 | 点击状态同步 | `windowSystem.test.tsx` (store consistency) | `integration.test.ts` (cross-source sync) | `app.spec.ts` (text→status panel) | Chrome 中 3D 与面板一致 | 🔧 |
| AC-09 | 单窗语音 | `BrowserSpeechAdapter.test.ts` (adapter), `VoiceControl.test.tsx` (parse→execute) | `integration.test.ts` (voice source) | `app.spec.ts` (voice button) | Chrome 真实麦克风 | 🔧 |
| AC-10 | 全窗语音 | 同上（同一链路） | `integration.test.ts` (voice allWindows) | — | Chrome 真实麦克风 | 🔧 |
| AC-11 | 文本降级 | `commandParser.test.ts` (all commands), `TextCommandInput.test.tsx` (submit→execute) | `integration.test.ts` (text source) | `app.spec.ts` (text→open all) | — | ✅ |
| AC-12 | 统一状态 | — | `integration.test.ts` (20-op stress) | — | — | ✅ |
| AC-13 | 重复命令 | `vehicleStore.test.ts` (blocked/noop), `windowSystem.test.tsx` (block) | `integration.test.ts` (concurrency) | — | — | ✅ |
| AC-14 | 无效口令 | `commandParser.test.ts` (4 failure types), `TextCommandInput.test.tsx` (parse-error), `VoiceControl.test.tsx` (voice parse-error) | `integration.test.ts` (noop) | `app.spec.ts` (invalid input) | — | ✅ |
| AC-15 | 语音异常 | `BrowserSpeechAdapter.test.ts` (9 error codes), `VoiceControl.test.tsx` (5 error displays) | — | `app.spec.ts` (voice button presence) | Chrome 权限拒绝/超时 | 🔧 |
| AC-16 | 模型失败 | `VehicleScene.test.tsx` (error boundary, retry) | — | `app.spec.ts` (404 simulation + retry) | — | ✅ |

## 人工验收项清单

以下验收项无法在 CI 中自动化，需在最新版桌面 Chrome (localhost/HTTPS) 中人工执行：

| ID | 验收项 | 步骤 | 预期结果 |
| --- | --- | --- | --- |
| M-01 | 真实麦克风-单窗 | 1. 点击麦克风按钮 2. 授权麦克风 3. 说出"打开左前窗" | 识别原文展示，左前窗执行打开动画，状态面板更新 |
| M-02 | 真实麦克风-全窗 | 说出"打开全部车窗" | 四窗依次打开，反馈"部分执行"或"已执行" |
| M-03 | 真实麦克风-无效口令 | 说出"打开天窗" | 不执行命令，提示不支持的命令 |
| M-04 | 麦克风权限拒绝 | 1. 点击麦克风 2. 浏览器弹窗点"拒绝" | 显示"麦克风权限被拒绝"，按钮禁用，文本/点击仍可用 |
| M-05 | 麦克风超时 | 1. 点击麦克风 2. 不说话等待 10 秒 | 显示"识别超时，请重试"，可重新点击 |
| M-06 | 3D 旋转观察 | 1. 拖动旋转车辆 2. 从四个方向观察 | 旋转流畅，不翻转，不进入地面，四窗可从不同角度辨识 |
| M-07 | 车窗悬停 | 将鼠标悬停在四个车窗上 | 车窗高亮（青蓝色提亮），光标变为 pointer |
| M-08 | 车窗点击-四窗 | 依次点击四个车窗 | 每个车窗独立动画（<1s），方向正确（玻璃下降） |
| M-09 | 3D 与面板同步 | 点击打开→语音关闭→文本打开同一车窗 | 每次操作后 3D 位置与状态面板一致 |
| M-10 | 动画穿模检查 | 从四个方向观察车窗打开过程 | 玻璃不穿出车门、不悬浮，动画平滑 |

## 自动化 E2E 验收场景

以下场景通过 Playwright 在 Chromium headless 中自动执行：

| 场景 | 对应 AC | 测试文件 |
| --- | --- | --- |
| 页面正常启动，标题可见 | AC-01 | `app.spec.ts` |
| 初始状态面板四窗均关闭 | AC-02 | `app.spec.ts` |
| 文本输入"打开全部车窗"并验证状态变化 | AC-11 | `app.spec.ts` |
| 文本输入无效命令并验证错误反馈 | AC-14 | `app.spec.ts` |
| 模型加载失败显示错误+重试 | AC-16 | `app.spec.ts` |
| 拖动超过 5px 不触发车窗操作 | AC-04 | `app.spec.ts` |
| 1280×720 / 1440×900 / 1920×1080 视口无横向滚动 | — | `app.spec.ts` |
| 语音按钮渲染且非 disabled（支持状态） | AC-15 | `app.spec.ts` |
