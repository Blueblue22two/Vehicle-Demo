## 基本信息

| 字段 | 内容 |
| --- | --- |
| 任务 ID | `NC-005-NC-009-BUGFIX` |
| 任务名称 | 场景背景与语音网络失败缺陷回归 |
| 任务优先级 | `P0` |
| 最终状态 | `BLOCKED` |
| 执行日期 | `2026-06-28` |
| 对应验收标准 | `AC-01` / `AC-09` / `AC-10` / `AC-15` |

## 1. 本阶段完成的任务

- 目标：将 3D 场景由黑色改为白灰色，并减少 Chrome 在麦克风授权后因在线识别服务不可达而直接失败的情况。
- 完成情况：代码、回归测试、全量质量门禁和 E2E 均完成。报告临时保持 `BLOCKED`，因为仓库工作流要求真实麦克风人工验收，当前环境无可用的带麦克风测试浏览器。
- 范围偏差：未引入云端 ASR、密钥或新依赖；符合 MVP 技术边界。

## 2. 修改了哪些文件

| 文件 | 变更类型 | 变更说明 |
| --- | --- | --- |
| `src/scene/VehicleScene.tsx` | 修改 | 统一 Canvas 清屏色、Canvas 样式和容器 fallback 为 `#e9ecef` |
| `src/scene/VehicleScene.test.tsx` | 修改 | 新增 WebGL 清屏色与 fallback 一致性回归测试 |
| `src/app/styles.css` | 修改 | 场景容器默认背景改为白灰色 |
| `src/features/voice/BrowserSpeechAdapter.ts` | 修改 | 优先准备 Chrome 本地中文识别，保留在线回退并防止陈旧事件 |
| `src/features/voice/BrowserSpeechAdapter.test.ts` | 修改 | 覆盖本地语言包可用、安装、不可用、安装失败、取消和陈旧回调 |
| `src/features/voice/types.ts` | 修改 | 新增 `preparing` 状态 |
| `src/types/speech.d.ts` | 修改 | 补充 `processLocally` / `available()` / `install()` 类型 |
| `src/components/VoiceControl.tsx` | 修改 | 展示本地语音准备状态和更准确的在线回退失败提示 |
| `src/components/VoiceControl.test.tsx` | 修改 | 更新网络错误可见文案断言 |

## 3. 实现了哪些关键逻辑

- 场景使用不透明白灰色 `#e9ecef` 作为 WebGL 清屏色，同时保留接地阴影。
- 如浏览器支持新版 `SpeechRecognition.available()` / `install()`，先检查并安装 `zh-CN` 本地语言包，然后设置 `processLocally = true`。
- 本地能力不可用或安装失败时回退到旧在线识别；如在线服务仍失败，明确提示检查网络或使用文本输入。
- 使用 session ID 与 recognition 实例身份验证，阻止取消后的异步准备或旧回调改写当前状态。

### Sub-agent 使用情况

- 委派内容：一个 Sub-agent 限定修改场景文件；一个 Sub-agent 限定修改语音适配层、类型与对应测试。
- 主代理审查：核对官方 Web Speech API 本地识别流程；补充语言包安装失败回退测试；调整网络错误提示；审查全部差异并独立执行验证。

## 4. 验证命令的结果

| 命令 | 退出码 | 结果 | 关键输出或证据 |
| --- | ---: | --- | --- |
| `npm run test -- --run src/scene/VehicleScene.test.tsx src/features/voice/BrowserSpeechAdapter.test.ts src/components/VoiceControl.test.tsx` | 0 | PASS | 3 files, 62 tests passed |
| `npm run typecheck` | 0 | PASS | TypeScript build completed |
| `npm run lint` | 0 | PASS | 0 errors; 4 pre-existing warnings in `WindowInteraction.tsx` |
| `npm run format:check` | 0 | PASS | All matched files use Prettier style |
| `npm run check` | 0 | PASS | 15 files / 202 tests passed; production build succeeded |
| `npm run test:e2e` | 0 | PASS | 33 Playwright scenarios passed |

总体结论：代码与自动化门禁全部通过；仅真实麦克风人工验收待用户环境执行。

## 5. 测试案例的结果

| 测试案例 | 类型 | 结果 | 证据或备注 |
| --- | --- | --- | --- |
| WebGL 与 fallback 均使用白灰色 | 单元 | PASS | `VehicleScene.test.tsx` |
| 本地中文包可用时启用 `processLocally` | 单元 | PASS | `BrowserSpeechAdapter.test.ts` |
| 可下载时安装语言包 | 单元 | PASS | `BrowserSpeechAdapter.test.ts` |
| 本地能力不可用或安装失败时在线回退 | 单元 | PASS | `BrowserSpeechAdapter.test.ts` |
| 停止后忽略待决准备与陈旧结果 | 单元 | PASS | `BrowserSpeechAdapter.test.ts` |
| 应用启动、布局、语音控件与文本降级 | E2E | PASS | Playwright 33/33 |
| 真实 Chrome 麦克风中文单窗/全窗命令 | 人工 | BLOCKED | 需用户在带麦克风的最新桌面 Chrome 中执行 |

覆盖的 PRD 验收项：`AC-01`、`AC-09`、`AC-10`、`AC-15`。

## 6. 是否有遗留问题

- 已知问题：浏览器无 `zh-CN` 本地语言包时仍需依赖其在线语音服务；网络或服务不可达时只能降级为文本输入。
- 已接受风险：Web Speech API 的本地识别能力与语言包可用性由 Chrome/操作系统决定，应用通过能力检测兼容。
- 阻塞项：用户完成真实麦克风 M-01/M-02 后可将报告更新为 `DONE`。

## 7. 下一步建议

- 下一任务：完成本缺陷的真实麦克风人工验收。
- 前置检查：使用最新桌面 Chrome，通过 `http://localhost:5173` 访问并允许麦克风。
- 建议动作：分别说“打开左前窗”和“打开全部车窗”，记录是否出现本地语言包准备、识别文本及车窗动画。

## 状态更新确认

- [x] `memory_bank/task-list.md` 中 NC-005 和 NC-009 原状态均为 `DONE`，本次缺陷回归未改变任务排期状态。
- [x] 总览与任务详情状态保持一致。
- [x] 报告中的命令和测试结果可复核。
