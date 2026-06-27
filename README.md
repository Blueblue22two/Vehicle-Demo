# NeoCabin 3D 智舱车控 Demo

桌面端 Web 3D 智能座舱车窗控制演示。通过可旋转、可点击、可语音控制的 3D 新能源车模型，演示直观且一致的车窗控制体验。

![技术栈](https://img.shields.io/badge/React-19-61dafb?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript) ![Three.js](https://img.shields.io/badge/Three.js-0.185-000000?logo=three.js) ![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite)

## 功能概览

- **3D 车模展示** — glTF/GLB PBR 材质，四窗可独立操作
- **拖动旋转** — 水平环绕，有限俯仰（15°–75°），防误触判定
- **点击控车** — 点击车窗切换开关，玻璃升降动画（<1s ease-in-out）
- **中文语音控制** — Web Speech API，zh-CN 单句识别，6 种状态管理
- **文本降级** — 文本输入框，与语音相同的解析和执行链路
- **视角重置** — 一键恢复默认左前 45° 视角（平滑动画）
- **性能自适应** — 3 档性能分级（high/medium/low），自动调整像素比和阴影质量

## 环境要求

| 项目    | 要求                                                    |
| ------- | ------------------------------------------------------- |
| Node.js | ≥22 <25（推荐 24 LTS）                                  |
| npm     | ≥10                                                     |
| 浏览器  | 最新版桌面 Chrome（语音功能）；其他浏览器支持点击和文本 |
| 协议    | `localhost` 或 HTTPS（语音功能必需）                    |
| 分辨率  | ≥1280×720（推荐 1440×900 以上）                         |

## 快速开始

```bash
# 克隆仓库
git clone <repo-url> && cd Vehicle-Demo

# 安装依赖（使用锁文件精确版本）
npm ci

# 启动开发服务器
npm run dev
# → 浏览器打开 http://localhost:5173

# 生产构建
npm run build

# 预览生产构建
npm run preview
# → 浏览器打开 http://localhost:4173
```

## 可用命令

```bash
npm ci               # 安装精确锁定依赖
npm run dev          # 启动 Vite 开发服务器
npm run build        # TypeScript 检查 + 生产构建
npm run preview      # 预览生产构建
npm run typecheck    # 仅 TypeScript 类型检查
npm run lint         # ESLint 静态检查
npm run format:check # Prettier 格式检查
npm run test         # Vitest 单元/组件/集成测试（194 测试）
npm run test:e2e     # Playwright E2E 浏览器测试（33 测试）
npm run validate:model # 校验车模资产（节点、包围盒、许可证）
npm run check        # 全量质量门禁（typecheck + lint + format + test + build）
```

## 项目结构

```
src/
├── app/                  # 入口、页面骨架、全局样式
├── domain/vehicle/       # 类型、状态机、命令执行器、不变量检查
├── features/
│   ├── command/          # 中文命令标准化与解析
│   └── voice/            # SpeechRecognition 适配器
├── scene/                # R3F Canvas、车模、灯光、相机、车窗动画
├── components/           # 状态面板、文本输入、语音按钮、反馈提示
├── test/                 # 测试初始化
└── types/                # 浏览器 API 类型补充

public/models/vehicle.glb  # 3D 车模资产
tests/e2e/                 # Playwright E2E 测试
memory_bank/               # 开发记忆（任务清单、阶段报告、AC 追踪矩阵）
scripts/                   # 模型校验脚本
```

## 语音控制

### 使用方式

1. 点击控制面板中的 🎤 麦克风按钮
2. 浏览器弹出权限请求时点击"允许"
3. 说出标准中文口令（如"打开左前窗"）
4. 系统展示识别文本并执行命令

### 麦克风权限

- 首次使用需授权麦克风访问
- 拒绝授权后麦克风按钮禁用，点击和文本控制仍可用
- 浏览器不支持语音时自动降级为文本控制
- Demo 不保存、不上传音频或识别文本

### 标准口令清单

详见 [语音口令清单](docs/voice-commands.md)。

## 资产合规

| 资产               | 来源                                                                                                           | 许可证                                                    | 说明                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| 车模 `vehicle.glb` | [Khronos CarConcept](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept) (adapted) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 拆分后侧窗为左右独立 Mesh、重命名四窗节点、保留 PBR 材质 |
| 系统字体           | 操作系统内置                                                                                                   | 各系统自带许可证                                          | Inter / 系统无衬线字体                                   |
| Emoji 图标         | 操作系统内置（🎤）                                                                                             | 各系统自带                                                | 无第三方图标库依赖                                       |

> 所有运行时资产均随项目本地打包，不依赖外部 CDN。车模原始资产来自 KhronosGroup glTF Sample Assets 的 CarConcept（Eric Chadwick / Darmstadt Graphics Group GmbH，CC BY 4.0），经 `scripts/adapt-vehicle-model.mjs` 可复现适配（前窗重命名、后窗拆分、适配元数据记录）。任何演示或再分发必须保留 CC BY 4.0 归属声明。详见 `public/models/README.md`。

## 技术栈

| 层级     | 技术                                           |
| -------- | ---------------------------------------------- |
| 框架     | React 19 + TypeScript 6                        |
| 构建     | Vite 8                                         |
| 3D 渲染  | Three.js 0.185 + React Three Fiber 9 + Drei 10 |
| 状态管理 | Zustand 5                                      |
| 语音     | Web Speech API (SpeechRecognition, zh-CN)      |
| 测试     | Vitest 4 + Testing Library + Playwright        |

## 测试

```bash
# 运行全部自动化测试
npm run test        # 194 单元/组件/集成测试（15 个测试文件）
npm run test:e2e    # 33 浏览器端到端测试

# 运行特定测试
npm run test -- src/domain/vehicle
npm run test:e2e -- --grep "text command"
```

真实麦克风和 3D 视觉验收需在最新版桌面 Chrome 中人工执行，详见 `memory_bank/ac-traceability.md` 人工验收项 M-01 至 M-10。

## 验收状态

| 优先级 | 任务                        | 状态        |
| ------ | --------------------------- | ----------- |
| P0     | NC-001 ~ NC-011（核心功能） | ✅ 全部完成 |
| P1     | NC-012 ~ NC-014（完整性）   | ✅ 全部完成 |
| P2     | NC-101 ~ NC-103（扩展）     | ⬜ 后续迭代 |

AC-01 至 AC-16 验收追踪详见 `memory_bank/ac-traceability.md`。

## 部署

```bash
npm ci && npm run build
# 将 dist/ 目录部署到任意静态文件服务
# 语音功能需通过 localhost 或 HTTPS 访问
```

## 许可证

本项目源码基于 MIT 许可证。3D 车模资产基于 CC BY 4.0（来源：Khronos CarConcept by Eric Chadwick / Darmstadt Graphics Group GmbH，已适配）。
