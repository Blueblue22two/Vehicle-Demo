## 基本信息

| 字段 | 内容 |
| --- | --- |
| 任务 ID | `NC-005-NC-007-NC-010-BUGFIX-2` |
| 任务名称 | 可见地板、场景补光与多入口车窗动画修复 |
| 任务优先级 | `P0` |
| 最终状态 | `DONE` |
| 执行日期 | `2026-06-28` |
| 对应验收标准 | `AC-01` / `AC-07` / `AC-09` / `AC-10` / `AC-13` |

## 1. 本阶段完成的任务

- 目标：在灰白场景中显示实体地板，小幅增强车模光照，并修复语音/文本命令后车窗永久停留在“操作中”的问题。
- 完成情况：代码、专项测试、全量门禁和 E2E 已完成；用户已在真实浏览器中确认 3D 地板/光照和麦克风命令动画通过。
- 范围偏差：无；未修改车辆状态机公共契约，未新增依赖。

## 2. 修改了哪些文件

| 文件 | 变更类型 | 变更说明 |
| --- | --- | --- |
| `src/scene/VehicleScene.tsx` | 修改 | 新增始终可见的灰白哑光地板，保留接地阴影并小幅提升三点布光 |
| `src/scene/VehicleScene.test.tsx` | 修改 | 新增实体地板材质和灯光强度回归测试 |
| `src/scene/WindowInteraction.tsx` | 修改 | 将动画启动从 pointer 私有路径改为统一消费 store transition |
| `src/scene/vehicle/windowSystem.test.tsx` | 修改 | 真实挂载 Hook 并推进帧回调，覆盖 voice/text/pointer/allWindows 与异常恢复 |

## 3. 实现了哪些关键逻辑

- 地板使用 `meshStandardMaterial`：`#d9dde1`、`roughness=0.92`、`metalness=0`；低性能档仍显示地板，只降级实时投影。
- 地板与 `ContactShadows` 使用轻微高度差，避免深度闪烁；接地阴影仍保留。
- 环境光 `0.5 -> 0.65`，主光 `3.0 -> 3.3`，补光在各性能档小幅提升。
- `WindowInteraction` 订阅 store 的 transition，任何来源的被接受命令都会创建对应 mesh 动画，750 ms 后统一完成状态转换。
- 活动动画 map 防止重复启动；reset、卸载、transition 失效或 mesh 缺失时取消并回滚，不再留下永久 `transitioning`。

### Sub-agent 使用情况

- 委派内容：一个 Sub-agent 负责地板/灯光及测试；一个 Sub-agent 负责统一动画消费链路及 Hook 回归测试。
- 主代理审查：确认语音识别层无需修改；复核 transition 目标与 mesh 位置的同步；调整地板/接触阴影高度差；清理所修文件中 3 条旧 Lint 警告。

## 4. 验证命令的结果

| 命令 | 退出码 | 结果 | 关键输出或证据 |
| --- | ---: | --- | --- |
| `npm run test -- --run src/scene/VehicleScene.test.tsx src/scene/vehicle/windowSystem.test.tsx src/components/VoiceControl.test.tsx` | 0 | PASS | 3 files / 53 tests passed |
| `npm run check` | 0 | PASS | 15 files / 212 tests passed; typecheck, format and production build succeeded |
| `npm run lint` | 0 | PASS | 0 errors; 1 pre-existing Fast Refresh warning |
| `npm run test:e2e` | 0 | PASS | 33 Playwright scenarios passed |

总体结论：所有自动化门禁通过；真实画面与麦克风命令动画待用户人工确认。

## 5. 测试案例的结果

| 测试案例 | 类型 | 结果 | 证据或备注 |
| --- | --- | --- | --- |
| 地板使用不透明灰白哑光材质 | 单元 | PASS | `VehicleScene.test.tsx` |
| 环境光、主光和补光按预期提亮 | 单元 | PASS | `VehicleScene.test.tsx` |
| voice/text 单窗命令启动动画并最终稳定 | Hook | PASS | `windowSystem.test.tsx` |
| voice 全窗命令同时完成四窗动画 | Hook | PASS | `windowSystem.test.tsx` |
| pointer 复用相同动画链路 | Hook | PASS | `windowSystem.test.tsx` |
| 无关 store 更新不重启动画 | Hook | PASS | `windowSystem.test.tsx` |
| reset、卸载和缺失 mesh 时回滚 | Hook | PASS | `windowSystem.test.tsx` |
| 完整浏览器回归 | E2E | PASS | 33/33 |
| 真实 3D 地板、阴影和亮度 | 人工 | PASS | 用户确认通过 |
| 真实麦克风命令后车窗完成动画 | 人工 | PASS | 用户确认通过 |

覆盖的 PRD 验收项：`AC-01`、`AC-07`、`AC-09`、`AC-10`、`AC-13`。

## 6. 是否有遗留问题

- 已知问题：无已知代码阻断。
- 已接受风险：无。
- 阻塞项：无。

## 7. 下一步建议

- 下一任务：本缺陷的真实视觉与麦克风验收。
- 前置检查：使用最新桌面 Chrome 打开 `http://localhost:5173`。
- 建议动作：观察地板边界、车底阴影与车身高光；再说“打开左前窗”，确认状态由“操作中”转为“已打开”且玻璃下降。

## 状态更新确认

- [x] `memory_bank/task-list.md` 中相关原任务已为 `DONE`，本次缺陷回归不改变排期状态。
- [x] 总览与详情状态保持一致。
- [x] 报告中命令与结果可复核。
