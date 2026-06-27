# NeoCabin 3D 智舱车控 Demo 技术栈文档

| 项目 | 内容 |
| --- | --- |
| 文档版本 | V1.0 |
| 对应 PRD | `docs/3d-vehicle-control-demo-prd.md` V1.0 |
| 目标平台 | 桌面端 Web / 最新版 Chrome |
| 交付阶段 | MVP |

## 1. 技术选型原则

- **Web 优先**：无需安装客户端，适合评审、现场演示和快速部署。
- **3D 能力成熟**：优先采用已有 glTF、PBR、射线拾取和相机控制能力的生态。
- **单一状态源**：点击、语音和文本命令共用车辆状态机，杜绝模型和 UI 状态分叉。
- **资产可替换**：业务逻辑只依赖稳定的车窗节点映射，不绑定特定车型。
- **可测试和可降级**：命令解析、状态机与浏览器 API 解耦；语音不可用时保留文本控制。
- **依赖克制**：能由 React、Three.js 或小型纯函数完成的能力，不新增大型运行时依赖。

## 2. 技术栈总览

| 层级 | 选择 | 用途 | 选择原因 |
| --- | --- | --- | --- |
| 运行环境 | Node.js LTS + npm | 本地开发、构建、测试 | 生态成熟，便于团队和 CI 复现 |
| 开发语言 | TypeScript | 全部业务与 3D 交互代码 | 固化车窗、命令和状态契约，减少映射错误 |
| UI 框架 | React | 页面布局、状态面板、语音与反馈 UI | 组件模型适合组合二维 UI 与 3D Canvas |
| 构建工具 | Vite | 开发服务器和生产构建 | 启动快、配置轻、原生支持 React/TypeScript |
| 3D 引擎 | Three.js | WebGL 渲染、材质、灯光、射线拾取 | Web 3D 生态成熟，原生支持 glTF 2.0 和 PBR |
| React 3D 渲染器 | React Three Fiber | 以 React 方式组织 Three.js 场景 | 让 3D 场景与 React 状态共享生命周期和数据流 |
| 3D 辅助库 | Drei | 模型加载、相机控制、环境和加载进度 | 减少基础设施代码，保留 Three.js 扩展能力 |
| 状态管理 | Zustand | 车辆状态、命令执行和反馈状态 | API 小、无 Provider 嵌套，适合跨 2D/3D 组件共享状态 |
| 语音能力 | Web Speech API | 中文单句语音识别 | Chrome 可直接使用，无需后端、账号或云端密钥 |
| 单元测试 | Vitest | 命令解析、状态机、工具函数测试 | 与 Vite 配置兼容，反馈速度快 |
| 组件测试 | Testing Library + jsdom | UI 状态、文本输入和语音降级测试 | 以用户可见行为验证 React 组件 |
| 端到端测试 | Playwright | 页面启动、布局、点击和浏览器兼容流程 | 可设置视口、拦截资源并模拟浏览器能力 |
| 静态检查 | ESLint + TypeScript | 代码规范和类型检查 | 在构建前发现未处理分支和不安全类型 |
| 格式化 | Prettier | 统一代码与 Markdown 格式 | 降低无意义格式差异 |

## 3. 版本与环境策略

- 开发和 CI 使用仍处于官方维护期的 Node.js LTS；推荐 Node.js 24 LTS，最低不低于 Node.js 22 LTS。
- 依赖初始化时选择相互兼容的稳定版本，并提交 `package-lock.json`；后续安装统一使用 `npm ci`。
- `package.json` 使用 `engines.node` 声明支持范围，不以个人机器上的非 LTS Node 版本作为基准。
- 不在本文硬编码补丁版本；实际版本以仓库中的 `package.json` 和 `package-lock.json` 为唯一依据。
- 正式验收浏览器为最新版桌面 Chrome；语音功能运行地址必须是 `localhost` 或 HTTPS。

建议的基础环境声明：

```json
{
  "engines": {
    "node": ">=22 <25",
    "npm": ">=10"
  }
}
```

## 4. 关键依赖

### 4.1 生产依赖

| 包名 | 作用 | 使用边界 |
| --- | --- | --- |
| `react` | 页面组件和应用生命周期 | 二维 UI 与应用入口 |
| `react-dom` | 将 React 挂载到浏览器 DOM | 仅浏览器入口 |
| `three` | 场景、相机、灯光、材质、动画和射线拾取 | 3D 基础能力 |
| `@react-three/fiber` | React 与 Three.js 的声明式桥接 | 3D Canvas 和场景组件 |
| `@react-three/drei` | `useGLTF`、`OrbitControls`、环境光照、加载进度等 | 仅使用 MVP 必需能力 |
| `zustand` | 统一车辆状态、命令执行和 UI 反馈 | 不存储 Three.js 原生对象，不做持久化 |

MVP 不引入云端 ASR SDK、后端框架、数据库、全量 UI 组件库或重量级通用动画库。

### 4.2 开发与测试依赖

| 包名 | 作用 |
| --- | --- |
| `typescript` | 类型检查和编译期契约 |
| `vite` | 开发服务器和生产构建 |
| `@vitejs/plugin-react` | React JSX 转换与热更新 |
| `vitest` | 单元测试运行器 |
| `@testing-library/react` | React 组件行为测试 |
| `@testing-library/user-event` | 模拟真实用户输入 |
| `@testing-library/jest-dom` | DOM 断言扩展 |
| `jsdom` | 组件测试浏览器环境 |
| `@playwright/test` | 端到端及多视口验收 |
| `eslint` | JavaScript/TypeScript 静态检查 |
| `typescript-eslint` | TypeScript ESLint 规则 |
| `eslint-plugin-react-hooks` | React Hooks 规则 |
| `prettier` | 代码与文档格式化 |

### 4.3 浏览器原生能力

- `SpeechRecognition` / `webkitSpeechRecognition`：中文单次语音识别。
- WebGL 2：Three.js 渲染。
- Pointer Events：鼠标拖动、悬停和点击判定。
- `requestAnimationFrame`：渲染和车窗动画时钟。
- `performance` API：首次可交互时间和运行帧率采样。

浏览器原生能力必须通过适配层访问，业务组件不得直接散落调用带前缀的语音 API。

## 5. 前端架构

```text
src/
├── app/                 # 应用入口、页面骨架、全局样式
├── domain/vehicle/      # 类型、状态机、命令执行器、节点配置
├── features/voice/      # SpeechRecognition 适配器与语音状态
├── features/command/    # 中文命令标准化与解析
├── scene/               # Canvas、车模、灯光、相机、车窗动画
├── components/          # 状态面板、文本输入、反馈、控制按钮
├── test/                # 测试初始化、mock 和 fixture
└── types/               # 浏览器 API 类型补充

public/
├── models/vehicle.glb
└── assets/              # 本地环境贴图和静态资源
```

### 5.1 数据流

```text
车窗点击 ─┐
语音结果 ─┼─> 命令解析/标准化 ─> VehicleCommand ─> 命令执行器
文本输入 ─┘                                      │
                                                 v
                                        单一 VehicleState
                                          │           │
                                          v           v
                                       3D 动画      UI/反馈
```

- `VehicleCommand` 是所有输入方式进入车控逻辑的唯一协议。
- 命令执行器负责合法性、幂等、动画锁和全窗部分执行策略。
- 稳定状态只包含 `open` / `closed`；动画时使用 `transitioning` 并保留目标状态与上一个稳定状态。
- 3D 层通过 `WindowId` 与节点配置取模型对象，不通过中文名称或 UI 文案查找节点。

### 5.2 核心接口

```ts
type WindowId = 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight';
type WindowState = 'open' | 'closed' | 'transitioning';
type CommandSource = 'pointer' | 'voice' | 'text';
type CommandAction = 'open' | 'close' | 'toggle';
type CommandTarget = WindowId | 'allWindows';

interface VehicleCommand {
  source: CommandSource;
  target: CommandTarget;
  action: CommandAction;
}

type ParseResult =
  | { ok: true; command: VehicleCommand; normalizedText: string }
  | { ok: false; reason: 'missing-action' | 'missing-target' | 'conflict' | 'unsupported' };

interface SpeechAdapter {
  readonly supported: boolean;
  start(): void;
  stop(): void;
  subscribe(listener: (event: SpeechEvent) => void): () => void;
}
```

## 6. 3D 技术方案

### 6.1 资产格式和节点

- 使用 glTF 2.0，交付优先为单个 `vehicle.glb`。
- 四个车窗节点必须能独立拾取和移动：
  - `window_front_left`
  - `window_front_right`
  - `window_rear_left`
  - `window_rear_right`
- 节点映射集中在配置文件中；模型节点名变化只修改配置，不修改命令和 UI 逻辑。
- 资产接入时校验节点完整性、包围盒、坐标轴、材质透明度、贴图大小和许可证。

### 6.2 渲染和交互

- 使用透视相机和受控 `OrbitControls`；水平环绕，极角限制为 PRD 规定的 15°–75°。
- 禁用平移；缩放若启用，必须设置最小和最大距离。
- 通过 Three.js Raycaster（由 React Three Fiber 事件封装）命中真实车窗 Mesh。
- 使用 Pointer Events 的位移阈值区分拖动和点击，阈值为 5 px。
- 车窗动画由渲染帧驱动，采用 ease-in-out，在 600–900 ms 内插值本地位置。
- P0 使用材质提亮完成悬停反馈；精细描边可作为 P1，避免过早引入后处理管线。

### 6.3 性能策略

- 首屏 3D 资源建议不超过 15 MB，优先压缩几何、纹理和非交互网格。
- 像素比上限默认设为 1.5；低性能时可降至 1.0。
- 仅必要灯光投射阴影，限制阴影贴图尺寸和接收阴影对象数量。
- 缓存 glTF 结果，不在状态更新时重新加载或克隆整车。
- 开发期使用浏览器 Performance 面板和帧率采样验证首次可交互时间与 45 FPS 目标。

## 7. 语音技术方案

- 使用 `SpeechRecognition`，兼容检测时同时检查 `webkitSpeechRecognition`。
- 参数固定为 `lang = 'zh-CN'`、`continuous = false`、`interimResults = false`。
- 语音适配器只负责能力检测、启动/停止和标准事件输出，不直接修改车辆状态。
- 最终文本进入与文本输入完全相同的纯函数解析器。
- 权限拒绝、无语音、超时、网络错误和不支持状态映射为明确的 UI 错误类型。
- 不支持或无权限时禁用语音按钮，但始终保留点击和文本入口。

## 8. 测试策略

| 测试层级 | 重点 | 工具 |
| --- | --- | --- |
| 类型与静态检查 | 命令联合类型、未处理状态、Hooks 规则 | TypeScript、ESLint |
| 单元测试 | 文本归一化、同义词、无效命令、幂等、动画锁、全窗部分执行 | Vitest |
| 组件测试 | 状态面板、文本提交、语音支持/拒绝/失败 UI | Testing Library |
| 场景集成测试 | 节点映射、点击命令、动画结束状态 | Vitest + Three.js fixture |
| E2E | 页面加载、三种视口、拖动防误触、文本完整链路、模型失败重试 | Playwright |
| 人工验收 | 真实麦克风、四向观察、动画穿模、主观视觉与帧率 | 最新版 Chrome |

Web Speech API 的真实识别结果受设备、权限和环境影响，不作为 CI 的非确定性输入。CI 使用可注入的 `SpeechAdapter` mock；真实麦克风流程在人工验收中覆盖。

## 9. 构建与质量命令

项目实现后应提供以下 npm scripts：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --pretty false",
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "validate:model": "node scripts/validate-model.mjs",
    "check": "npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build"
  }
}
```

标准质量门禁：

```bash
npm ci
npm run validate:model
npm run check
npm run test:e2e
```

## 10. 安全、隐私与资产合规

- 只有用户主动点击麦克风按钮后才请求或启动语音能力。
- Demo 不保存、不上传音频和识别文本；页面应明确语音能力由浏览器提供。
- 不在前端代码或仓库中存放云服务密钥。
- 所有运行所需静态资产本地打包，避免演示依赖第三方 CDN。
- `README` 或独立资产清单记录模型、HDRI、图标、字体的来源和许可证。
- 无法确认授权的模型或纹理不得进入最终构建。

## 11. 明确不选用的方案

| 方案 | 暂不选原因 |
| --- | --- |
| 原生 App / Unity | 构建和交付成本高于桌面 Web MVP，不利于快速评审 |
| 云端 ASR SDK | 需要账号、密钥、网络和额外隐私说明，MVP 无此必要 |
| 后端服务与数据库 | 当前状态只需单会话内存，不存在服务端业务 |
| Redux Toolkit | 当前状态域较小，Zustand 足以提供单一状态源和可测试 action |
| 通用大型 UI 组件库 | 容易增加包体并限制座舱视觉定制，MVP 组件数量有限 |
| 重量级动画库 | 车窗仅需单轴、短时插值，渲染帧动画即可完成 |

