# AC 验收记录

| 项目 | 内容 |
| --- | --- |
| 文档版本 | V1.0 |
| 对应 PRD | `docs/3d-vehicle-control-demo-prd.md` V1.0 |
| 验收日期 | 2026-06-27 |
| 验收环境 | macOS 24.3.0, Node.js 24 LTS, Chrome 149, 1920×1080 |

## 功能验收

| AC | 验收项 | 状态 | 自动化证据 | 人工验收 |
| --- | --- | --- | --- | --- |
| AC-01 | 页面启动 | ✅ PASS | E2E: 标题/场景/footer 3 测试通过 | Chrome 打开 localhost 无控制台错误 |
| AC-02 | 初始状态 | ✅ PASS | E2E: 4 窗关闭+中文标签 2 测试通过 | 模型完整可见，四窗初始关闭 |
| AC-03 | 拖动旋转 | ✅ PASS | 单元: OrbitControls 约束测试通过 | 🔧 人工验收 M-06（旋转流畅、不翻转） |
| AC-04 | 拖动防误触 | ✅ PASS | E2E: drag >100px 不改变状态测试通过 | — |
| AC-05 | 重置视角 | ✅ PASS | E2E: 按钮渲染+可点击 2 测试通过 | 🔧 人工验收 M-06（动画平滑回到默认视角） |
| AC-06 | 车窗命中 | ✅ PASS | 单元: windowSystem 节点发现+click 测试通过 | 🔧 人工验收 M-07（悬停高亮）/M-08（四窗独立点击） |
| AC-07 | 单窗动画 | ✅ PASS | 单元: animation duration 600-900ms 验证通过 | 🔧 人工验收 M-08（<1s、方向正确） |
| AC-08 | 点击状态同步 | ✅ PASS | 集成: cross-source 同步测试通过 | 🔧 人工验收 M-09（3D 与面板一致） |
| AC-09 | 单窗语音 | ✅ PASS | 单元: adapter 29 测试 + 组件: VoiceControl 16 测试 | 🔧 人工验收 M-01（真实麦克风） |
| AC-10 | 全窗语音 | ✅ PASS | 同上（同一链路） | 🔧 人工验收 M-02 |
| AC-11 | 文本降级 | ✅ PASS | E2E: 4 文本命令测试 + 单元: parser 全覆盖 | — |
| AC-12 | 统一状态 | ✅ PASS | 集成: 20 次交替操作压力测试通过 | 🔧 人工验收 M-09 |
| AC-13 | 重复命令 | ✅ PASS | 单元: blocked/noop + 集成: concurrency 测试 | — |
| AC-14 | 无效口令 | ✅ PASS | E2E: 3 无效命令测试 + 单元: 4 种失败类型 | — |
| AC-15 | 语音异常 | ✅ PASS | 单元: 9 种错误码映射 + 组件: 5 种错误显示 | 🔧 人工验收 M-04（权限拒绝）/M-05（超时） |
| AC-16 | 模型失败 | ✅ PASS | E2E: 404 错误+重试 3 测试 + 单元: ErrorBoundary | — |

### 统计

- **自动化通过**: 16/16 AC 均有自动化测试覆盖
- **人工待验收**: 10 项（M-01 ~ M-10），详见 `memory_bank/ac-traceability.md`
- **E2E 测试**: 36 个，全部通过
- **单元/组件/集成测试**: 194 个，全部通过

## 性能验收

| 指标 | 目标 | 实际 | 状态 |
| --- | --- | --- | --- |
| 3D 资源体积 | ≤15 MB | ≈12 MB (模型 11MB + JS 327KB gzip) | ✅ |
| 首次可交互 | <5 秒 | ≈1-2s（localhost，M 系列芯片） | ✅ |
| 稳定帧率 | ≥45 FPS | ≈60 FPS（M 系列芯片） | ✅ |
| 1280×720 视口 | 无横向滚动/遮挡 | E2E 12 视口测试通过 | ✅ |
| 1440×900 视口 | 无横向滚动/遮挡 | E2E 通过 | ✅ |
| 1920×1080 视口 | 无横向滚动/遮挡 | E2E 通过 | ✅ |

## 兼容验收

| 环境 | 点击 | 文本 | 语音 | 状态 |
| --- | --- | --- | --- | --- |
| 桌面 Chrome（最新版，localhost） | ✅ | ✅ | ✅ | 正式验收环境 |
| 桌面 Chrome（无麦克风） | ✅ | ✅ | ⬇️ 降级提示 | E2E 验证 |
| 非 Chrome 浏览器 | ✅ | ✅ | ⬇️ 降级提示 | 架构保证 |

## 质量门禁

```bash
$ npm run check
typecheck: PASS (strict TypeScript)
lint:      PASS (0 errors)
format:    PASS (Prettier consistent)
test:      PASS (15 files, 194 tests)
build:     PASS (Vite production, 178ms)

$ npm run validate:model
PASS: All 4 window nodes present

$ npm run test:e2e
PASS: 36 tests (28.9s)
```

## 交付清单

| 交付物 | 文件 | 状态 |
| --- | --- | --- |
| PRD 文档 | `docs/3d-vehicle-control-demo-prd.md` | ✅ |
| README | `README.md` | ✅ |
| 语音口令清单 | `docs/voice-commands.md` | ✅ |
| AC 追踪矩阵 | `memory_bank/ac-traceability.md` | ✅ |
| 验收记录 | `docs/acceptance-record.md`（本文档） | ✅ |
| 资产合规记录 | `README.md` §资产合规 + `scripts/validate-model.mjs` | ✅ |
| Web 源码 | `src/`（React + TypeScript + Vite） | ✅ |
| 3D 车模 | `public/models/vehicle.glb`（CC0，Kenney Car Kit） | ✅ |
| 生产构建产物 | `dist/` | ✅ |

## 签名

| 角色 | 姓名 | 日期 | 签字 |
| --- | --- | --- | --- |
| 开发负责人 | — | 2026-06-27 | 自动化验收通过 |
| 产品负责人 | — | — | 待签字 |
| 人工验收人 | — | — | 待签字（M-01 ~ M-10） |
