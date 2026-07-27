# SmartSpace AI Workflow Rules

## Required Reading Order

在实现或作出架构决策前，必须依次阅读：

1. `context/project-overview.md`
2. `context/architecture.md`
3. `context/ai-workflow-rules.md`
4. `context/progress-tracker.md`

## Approach

- 使用规格驱动、纵向切片的增量开发方式。
- 上下文文件定义产品边界、架构约束和当前状态；不要凭空补充行为。
- 每个实现单元必须能独立运行和验证，完成后再进入下一单元。
- 将工作拆成尽可能小、可以独立验收和提交的功能模块；一个模块只交付一个明确行为。
- 优先建立任务功能和稳定的桌面外壳，再处理高风险的窗口嵌入能力。
- 外部窗口嵌入是实验性功能；兼容性结论必须来自实际测试，不能依靠猜测。

## Required Frontend Guidance

- 每次编写、修改或审查 React 组件时，必须使用 `vercel-react-best-practices`。
- 该技能负责 React 性能与实现质量，不作为视觉风格来源。
- 优先检查直接导入、按需加载、事件监听去重、派生状态、effect 依赖、重渲染边界和长列表渲染。
- 只采用与当前 Tauri/Vite 客户端相关的规则；Next.js 服务端、RSC 和 hydration 规则在本项目中不适用时不得机械套用。
- 视觉微交互参考 [Amicro](https://github.com/Subhan-code/Amicro--Micro-transitions-)；只能按需引入与当前组件状态相关的实现。
- 引入 Amicro 代码时必须核对 MIT 许可、保留必要声明，并适配设计令牌、键盘操作和减少动态效果设置。
- 禁止为了“使用动画库”而添加无意义的循环动画、复杂卡片特效或影响操作速度的过渡。

## Small Module Lifecycle

每个最小功能模块严格按以下顺序执行：

1. 在 `context/progress-tracker.md` 中登记模块名称、范围、验收条件和状态 `In Progress`。
2. 只实现该模块，不顺带修改下一个模块；实施途中出现新事实或风险时立即更新进度文件。
3. 运行与风险相称的自动化测试、构建和人工验证，并把结果写入进度文件。
4. 启动一个 sub-agent 对该模块进行独立 review。review 必须检查正确性、回归、测试缺口、架构不变量；涉及 React 时还要检查 `vercel-react-best-practices`，涉及动画时检查 Amicro 适配和减少动态效果。
5. review 有问题时，当前模块保持 `In Progress`；主 agent 修复、更新进度并再次交由一个 sub-agent review。
6. review 无阻塞问题且验证通过后，将模块标记为 `Completed`，记录 review 结论和提交范围。
7. 只提交该模块相关文件，创建一个独立 Git commit，然后推送到已配置的 GitHub 远程分支。
8. commit 和 push 均成功后，才开始下一个功能模块。

sub-agent 只负责 review，默认不修改文件。review 结果必须由主 agent 复核，不能仅以 sub-agent 的“通过”替代测试证据。

## Scoping Rules

- 一次只处理一个清晰的功能单元。
- 不在同一实现步骤中混合无关的 UI、存储、桌面集成和 Win32 嵌入变更。
- 修改必须遵循 `context/architecture.md` 中的组件边界与不变量。
- 不进行与当前目标无关的重构、依赖替换或功能扩张。
- 新依赖必须有明确用途，并优先复用已选技术栈和标准库能力。

## When to Split Work

出现以下任一情况时，必须拆分实现步骤：

- 同时修改任务领域逻辑和外部窗口嵌入逻辑。
- 同时引入数据库结构变更和新的 Windows 系统行为。
- 同时实现多个无法通过同一条用户流程验证的功能。
- 需求尚未写入上下文文件，或存在两种合理解释。
- 无法在一次短反馈循环中完成构建、测试和人工验证。

## Handling Missing Requirements

- 不实现上下文文件中未定义的产品行为。
- 需求不明确时先询问用户，并在实现前更新对应上下文文件。
- 暂时无法解决的问题写入 `context/progress-tracker.md` 的 `Open Questions`。
- Windows API 的实际行为与设计假设不一致时，先记录证据并更新架构或范围，再继续。

## Protected Areas

- 不修改第三方依赖或生成的库代码。
- 不手工编辑 SQLite 数据库文件；结构变化只能通过迁移完成。
- 不绕过类型化 Tauri Command 让 UI 直接调用系统能力。
- 不在没有备份和校验的情况下改变导入格式或执行破坏性数据迁移。

## Verification Requirements

每个功能单元至少完成与风险相称的验证：

1. 格式化、类型检查和 lint 通过。
2. 相关 TypeScript 或 Rust 单元测试通过。
3. 涉及 SQLite 时，迁移和仓库集成测试通过。
4. 涉及窗口、托盘、快捷键或嵌入时，在 Windows 上完成实际运行验证。
5. 完整项目构建通过；建立脚本后以仓库中定义的标准命令为准。
6. 视觉改动需检查常规窗口、快速窗口及窄尺寸下的布局和文本溢出。

## Embedded Application Testing

- 使用一个受控的 Win32 测试程序验证窗口发现、附加、输入、缩放、隐藏、恢复和关闭。
- 维护实际兼容性矩阵，至少覆盖记事本、计算器、VS Code、一个 Chromium 桌面应用、一个多进程启动器和一个管理员权限程序。
- 不兼容程序必须产生可恢复错误，且不得影响任务功能或数据完整性。
- 不把单个程序成功嵌入推断为对同类程序的普遍兼容。

## Keeping Context in Sync

- 每个最小功能模块开始时、实施途中出现范围或风险变化时、验证完成时、review 结束时以及 commit/push 后，都更新 `context/progress-tracker.md`。
- 产品范围变化时先更新 `context/project-overview.md`。
- 系统边界、存储模型、不变量或技术决策变化时先更新 `context/architecture.md`。
- 开发标准或交付流程变化时更新本文件。
- 文档中的完成状态必须与仓库中可运行、可验证的实际状态一致。

## Before Moving to the Next Unit

1. 当前单元在其定义范围内端到端工作。
2. 相关自动化测试和人工检查通过。
3. 没有违反架构不变量。
4. `context/progress-tracker.md` 已记录结果、限制和下一步。
5. 没有把实验性行为描述为已保证的能力。
6. 一个 sub-agent 已完成独立 review，且所有阻塞问题已关闭。
7. 当前模块已独立提交并成功推送到 GitHub；若远程不可用，则不得把模块标记为交付完成。
