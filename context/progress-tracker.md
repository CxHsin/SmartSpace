# SmartSpace Progress Tracker

每次有意义的实现变更后更新本文件。只有已经运行并验证的工作才能列入 `Completed`。

## Current Phase

- 模块 28（前端任务跨分类移动 IPC 客户端）已提交并推送；模块 29 待登记。

## Current Goal

- 以最小、可独立验收的功能模块实现 SmartSpace 首版；每个模块通过验证和独立 review 后独立提交并推送到 GitHub。

## Completed

- 确认产品定位：Windows 本地优先的任务清单与第三方桌面应用嵌入工具。
- 确认任务范围：标题、状态、截止日期、单层分类和四个智能视图。
- 确认桌面行为：快速模式、常规模式、托盘、全局快捷键和开机启动。
- 确认应用容器：多个标签页、单个可见嵌入窗口、允许添加任意传统桌面应用。
- 确认技术方向：Tauri 2、React、TypeScript、Rust、SQLite 和 Win32 APIs。
- 确认本地备份方向：带版本号的 JSON、完整替换、导入前恢复点。
- 用真实项目内容替换四个初始上下文模板。
- 确认 React 实现与 review 必须应用 `vercel-react-best-practices`。
- 确认前端微交互按需参考 Amicro；其仓库采用 MIT 许可，依赖 React、Tailwind CSS 和 Motion。
- 确认交付流程：最小功能模块、持续更新本文件、一个 sub-agent 独立 review、通过后独立 commit 并推送 GitHub。
- 锁定首版产品名称为 `SmartSpace`，公开 GitHub 目标仓库为 `CxHsin/SmartSpace`。
- 锁定默认全局快捷键为 `Ctrl+Shift+Space`；未来发生冲突时必须提示用户重新设置。
- 锁定首版开发与验证仅在开发机运行；跟随系统主题。
- 锁定 Amicro 采用 registry/源码按需复制方式，不安装整包；任何引入均须保留 MIT 许可要求。
- 锁定 Token Monitor 为嵌入模块的验收对象；其嵌入不稳定或失败将阻塞该嵌入模块完成，不能降级为仅外部打开。
- **模块 1：基础工程** 已完成：公开 Git/GitHub 基线、Tauri 2 + React 19 + TypeScript + Vite + Tailwind CSS 4 应用壳、架构目录、前后端测试和构建门禁均已建立；`gpt-5.6-sol medium` 首轮 review 的 TypeScript 假门禁、Rust lint 覆盖和 CSP 问题均已修复，复审结果为 `APPROVE`。前端、Rust、Tauri release 构建及双视口视觉验证全部通过。
- **模块 2：任务领域模型与分类不变量** 已完成：新增强类型 UUID、任务标题/分类名校验、固定收件箱身份与删除保护、任务状态和日期/时间字段、纯状态变更以及守卫反序列化；14 个 Rust 测试、Rust format/test/clippy/check、前端回归和 Tauri release 构建通过。`gpt-5.6-sol medium` 独立 review 未发现缺陷，结果为 `APPROVE`。
- **模块 3：SQLite schema bootstrap 与迁移** 已完成：新增 bundled `rusqlite`、连接配置、单例 schema 版本表、顺序且原子的内嵌迁移执行器、未来版本拒绝、迁移目录一致性保护，以及带固定收件箱种子的 categories/tasks 初始结构、约束和索引。修复了并发首次打开重复迁移、拒绝未来版本前持久修改 journal mode、目录版本失配和正常重开无谓写锁问题；25 个 Rust 测试、20 轮并发压力复跑、Rust/前端门禁与 Tauri release 构建均通过。`gpt-5.6-sol medium` 第三轮复审结果为 `APPROVE`，无 findings。
- **模块 4：分类持久化仓库** 已完成：实现分类列表、按 ID 读取、创建、重命名、完整集合重排和原子删除；删除用户分类时按原相对顺序把任务追加到收件箱、按时间语义单调更新 `updated_at` 并压缩分类位置。仓库在写锁内保证 Unicode caseless 名称唯一，并在所有公开读写路径验证固定收件箱、连续位置和名称不变量。37 个 Rust 测试、双连接并发压力复跑、Rust/前端门禁和 Tauri release 构建通过；`gpt-5.6-sol medium` 复审结果为 `APPROVE`，无 findings。
- **模块 5：任务持久化仓库** 已完成：实现任务完整/分类/ID 读取、创建、重命名、完成/恢复、截止日期、跨分类移动、完整集合重排和删除；即时写事务维护位置，延迟读事务提供一致 WAL 快照，任务日期/时间与规范文本使用类型化守卫。修复了纳秒截断、复合读取快照不一致和静默修剪问题；49 个 Rust 测试、并发快照 20 轮复跑、Rust/前端门禁和 Tauri release 构建通过。`gpt-5.6-sol medium` 复审结果为 `APPROVE`，无 findings。
- **模块 6：用户数据目录与数据库运行时初始化** 已完成实现与审查：通过 Tauri `app_data_dir` 解析用户数据目录，在 `setup` 阶段递归创建目录、打开固定的 `smartspace.sqlite3`、执行迁移，并把唯一的 `Database` 包装为带类型化锁错误的 Tauri managed state。4 个模块测试与全量 53 个 Rust 测试通过；Rust fmt/clippy/check、前端 format/lint/typecheck/Vitest/Vite build 及 `tauri build --no-bundle` 全部通过。`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；缺少直接取回 managed state 的 Tauri mock 测试是非阻塞残余风险，setup 接线已有编译约束且初始化逻辑已独立覆盖。
- **模块 7：分类列表 Tauri command** 已完成实现与审查：注册只读 `list_categories`，通过 managed `DatabaseState` 返回有序分类领域 DTO，并建立 `database_unavailable`、`data_corrupt` 和 `database_operation_failed` 可序列化错误代码。首轮 review 发现持久数据解码错误误分类，修复后领域守卫、UUID、分类类型、时间戳、任务状态/日期和仓库不变量均归为 `data_corrupt`，非法 UUID 回归测试覆盖真实遗漏路径。4 个 command 测试与全量 57 个 Rust 测试、Rust/前端门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 复审结果为 `APPROVE`，无 findings。后续写命令必须将用户输入的领域校验错误与读取持久数据损坏分开映射。
- **模块 8：任务列表 Tauri command** 已完成实现与审查：注册只读 `list_tasks`，通过 managed `DatabaseState` 返回按分类及分类内位置稳定排序的任务领域 DTO，并复用类型化 command 错误契约。首轮 review 发现完整 DTO 测试覆盖不足，修复后使用带截止日期、完成状态和不同纳秒更新时间的任务逐字段断言 8 字段 JSON，并保留非法持久任务 UUID 的 `data_corrupt` 回归测试。2 个 command 测试与全量 59 个 Rust 测试、Rust/前端门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 复审结果为 `APPROVE`，无 findings。
- **模块 9：创建任务 Tauri command** 已完成实现与审查：注册 `create_task`，由 Rust 生成 UTC 时间；command 层在获取数据库锁前校验并规范化标题与分类 UUID，再通过即时事务持久化任务。新增 `invalid_input` 与 `category_not_found` 稳定错误码，并保持持久损坏为 `data_corrupt`。4 个新增测试与全量 63 个 Rust 测试、Rust/前端门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings。
- **模块 10：创建分类 Tauri command** 已完成实现与审查：注册 `create_category`，在获取数据库锁前校验并规范化名称，再通过即时事务持久化分类。新增 `duplicate_category_name` 稳定错误码，并保持持久损坏与用户输入错误分离；Unicode caseless 唯一性及并发继续由仓库事务保证。4 个新增测试与全量 67 个 Rust 测试、Rust/前端门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings。
- **模块 11：任务完成/恢复 Tauri command** 已完成实现与审查：注册 `set_task_status`，在获取数据库锁前校验任务 UUID 与 `open`/`completed` 状态，由 Rust 生成 UTC 更新时间，再通过即时事务完成或恢复任务。新增 `task_not_found` 稳定错误码，并保证重复设置同一状态不改变 `updatedAt`。4 个新增测试与全量 71 个 Rust 测试、Rust/前端门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings。
- **模块 12：任务重命名 Tauri command** 已完成实现与审查：注册 `rename_task`，在获取数据库锁前校验任务 UUID 并通过 `TaskTitle` 规范化标题，由 Rust 生成 UTC 更新时间，再通过即时事务持久化。重复设置同一规范标题保持 `updatedAt` 不变，用户输入与持久损坏继续使用独立错误分流。4 个新增测试与全量 75 个 Rust 测试、Rust/前端门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings。
- **模块 13：任务截止日期 Tauri command** 已完成实现与审查：注册 `set_task_due_date`，强制请求显式包含日期字符串或 `null`；日期先验证精确 ASCII `YYYY-MM-DD` 形状，再以 `NaiveDate` 校验本地日历有效性，由 Rust 生成 UTC 更新时间并通过即时事务设置或清除。首轮 review 发现缺失字段误清除与宽松日期解析，修复后新增对应回归测试。5 个新增测试与全量 80 个 Rust 测试、Rust/前端门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 复审结果为 `APPROVE`，无 findings。
- **模块 14：任务跨分类移动 Tauri command** 已完成实现与审查：注册 `move_task`，在获取数据库锁前校验任务与目标分类 UUID，由 Rust 生成 UTC 更新时间并调用已有事务性仓库移动。跨分类移动追加到目标末尾并压缩源位置，同分类移动保持 `updatedAt`；非法输入、缺失实体和持久损坏使用稳定且独立的错误分流。5 个新增测试与全量 85 个 Rust 测试、Rust/前端门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `1b41e84` 已推送到 `origin/main`。
- **模块 15：分类内任务重排 Tauri command** 已完成实现与审查：注册 `reorder_tasks`，在获取数据库锁前校验分类与完整任务 UUID 序列，由 Rust 生成 UTC 更新时间并调用现有事务性仓库重排。有效完整集合按请求持久化且同序提交保持时间戳；重复、缺失、额外或跨分类 ID 原子拒绝为 `invalid_input`，缺失分类与持久损坏保持独立错误分流。5 个新增测试与全量 90 个 Rust 测试、Rust/前端门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `b40b80b` 已推送到 `origin/main`。
- **模块 16：分类重命名 Tauri command** 已完成实现与审查：注册 `rename_category`，在获取数据库锁前校验分类 UUID 并通过 `CategoryName` 规范化名称，再调用现有事务性仓库重命名。用户分类与收件箱均可重命名，收件箱固定 ID 与系统类型保持不变；非法输入、Unicode caseless 重名、缺失分类和持久损坏使用稳定且独立的错误分流。5 个新增测试与全量 95 个 Rust 测试、Rust/前端门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `584a083` 已推送到 `origin/main`。
- **模块 17：分类重排 Tauri command** 已完成实现与审查：注册 `reorder_categories`，在获取数据库锁前校验完整分类 UUID 序列，再调用现有事务性仓库重排。有效完整集合按请求持久化，收件箱可参与任意位置但固定 ID 与系统类型保持不变；重复、缺失或额外 ID 原子拒绝为 `invalid_input`，持久损坏保持独立错误分流。4 个新增测试与全量 99 个 Rust 测试、Rust/前端门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `b197c38` 已推送到 `origin/main`。
- **模块 18：分类删除 Tauri command** 已完成实现与审查：注册 `delete_category`，在锁前校验分类 UUID，由 Rust 生成 UTC 时间并返回删除分类 ID 与迁移任务数；用户分类删除会按原顺序把任务追加到收件箱并压缩分类位置，收件箱删除返回稳定 `cannot_delete_inbox`。首轮 review 发现删除路径未完整验证任务存储，修复为在同一即时事务中先复用完整任务解码与全库位置不变量校验，损坏时分类和任务均原样保留。5 个新增 command 测试与全量 104 个 Rust 测试、Rust/前端门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 复审结果为 `APPROVE`，无剩余 findings；模块提交 `c230971` 已推送到 `origin/main`。
- **模块 19：任务删除 Tauri command** 已完成实现与审查：注册 `delete_task`，在获取数据库锁前校验任务 UUID，并返回包含 8 个原始字段的完整被删 `Task` 快照，为后续短暂撤销提供无损输入。删除事务压缩同分类后续位置且不影响其他分类；非法输入、缺失任务和持久损坏使用稳定且独立的错误分流。4 个新增测试与全量 108 个 Rust 测试、Rust/前端门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `1feaa28` 已推送到 `origin/main`。
- **模块 20：前端只读 IPC 客户端** 已完成实现与审查：新增可注入的 `SmartSpaceClient`，通过直接导入 Tauri `invoke` 提供 `list_categories` 与 `list_tasks` 强类型读取，DTO 与 Rust 序列化字段一致；8 个已知 command error code 保留结构化信息，未知拒绝稳定归一化为 `unknown`。3 个新增测试与全量 4 个前端测试、前端/Rust 门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `d65ce67` 已推送到 `origin/main`。
- **模块 21：只读任务工作台** 已完成实现与审查：通过可注入的 `SmartSpaceClient` 以 `Promise.all` 并行加载分类和任务，提供 loading/error/empty/success 状态、分类计数与筛选、任务完成状态/分类/截止日期展示，并保留独立的第三方应用承载边界；长列表使用延迟绘制，骨架动画支持 reduced motion。1120×720、800×520 和 640×700 视觉与交互验收无重叠、裁切或溢出。首轮 review 的辅助文本对比度、异步错误播报与真实 effect/交互测试覆盖 3 个 P2 均已修复；10 个前端测试、前端/Rust 全量门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 复审结果为 `APPROVE`，无 findings；模块提交 `2c3c53d` 已推送到 `origin/main`。
- **模块 22：前端创建任务 IPC 客户端** 已完成实现与审查：在可注入 `SmartSpaceClient` 中新增只读 `CreateTaskInput` 与 `createTask`，精确调用 `create_task` 并传递 `{ request: { title, categoryId } }`，标题原样交由 Rust 领域层规范化，返回完整 `TaskDto`；`invalid_input`、`category_not_found` 和未知拒绝复用统一错误边界。13 个前端测试、前端/Rust 全量门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `92425e4` 已推送到 `origin/main`。
- **模块 23：基础添加任务交互** 已完成实现与审查：工作台加入标题输入、当前/显式分类选择和创建提交，空白标题拒绝、原始标题透传、同步重复提交锁、失败保留草稿、成功清空并恢复焦点，同时按持久化顺序更新列表与计数；客户端身份 keyed 会话隔离 A→B pending create 与 A→B→A fresh loading。1120×720、800×520、640×700 的长文本、成功/失败和窄视口验收无溢出；18 个前端测试、108 个 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过。三轮 `gpt-5.6-sol medium` review 的强调色对比度、live region 与异步客户端隔离 findings 均已关闭，最终结果为 `APPROVE`；模块提交 `5b14e48` 已推送到 `origin/main`。
- **模块 24：前端任务状态 IPC 客户端** 已完成实现与审查：新增只读 `SetTaskStatusInput` 与 `SmartSpaceClient.setTaskStatus`，精确调用 `set_task_status` 并传递 `{ request: { taskId, status } }`，不改写输入且返回完整 `TaskDto`；`invalid_input`、`task_not_found` 和未知拒绝复用统一错误边界。3 个新增测试与全量 21 个前端测试、108 个 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `cbcd39d` 已推送到 `origin/main`。
- **模块 25：任务完成/恢复交互** 已完成实现与审查：任务行状态标记升级为可访问的完成/恢复按钮，通过 `SmartSpaceClient.setTaskStatus` 持久化并仅以返回 DTO 替换对应任务；per-row pending 锁允许不同任务独立更新，函数式状态合并支持响应乱序完成，客户端 keyed session 隔离旧请求。按钮具备动作名称、tooltip、稳定 24×24 命中区域、成功/错误 live feedback 与 reduced-motion 支持；1120×720、800×520、640×700 视觉验收无重叠或溢出。25 个前端测试、108 个 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 最终 review 结果为 `APPROVE`，无 findings；模块提交 `7e69719` 已推送到 `origin/main`。
- **模块 26：前端任务重命名 IPC 客户端** 已完成实现与审查：新增只读 `RenameTaskInput` 与 `SmartSpaceClient.renameTask`，精确调用 `rename_task` 并传递 `{ request: { taskId, title } }`；标题原样交由 Rust 领域层规范化，冻结输入保持不变并返回完整 `TaskDto`，现有测试替身显式拒绝意外调用。28 个前端测试、108 个 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `6faca3e` 已推送到 `origin/main`。
- **模块 27：前端任务截止日期 IPC 客户端** 已完成实现与审查：新增只读 `SetTaskDueDateInput` 与 `SmartSpaceClient.setTaskDueDate`，精确调用 `set_task_due_date` 并传递 `{ request: { taskId, dueDate } }`；日期字符串和显式 `null` 原样交给 Rust，缺失字段不会误清除日期，冻结输入保持不变并返回完整 `TaskDto`。32 个前端测试、108 个 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `d65f448` 已推送到 `origin/main`。
- **模块 28：前端任务跨分类移动 IPC 客户端** 已完成实现与审查：新增只读 `MoveTaskInput` 与 `SmartSpaceClient.moveTask`，精确调用 `move_task` 并传递 `{ request: { taskId, categoryId } }`；冻结输入保持不变并返回完整移动后 `TaskDto`，三种领域错误继续使用统一错误边界。36 个前端测试、108 个 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `fd64d87` 已推送到 `origin/main`。

## In Progress

- None.

## Next Up

1. 模块 29：按最小可验收范围确定并登记。

## Open Questions

- 对首个兼容性发布门槛，除受控测试程序外还要求哪些第三方应用成功嵌入。
- 任务短暂撤销期间若原分类已删除或原位置已不可恢复：应回收到收件箱/最近有效位置，还是让撤销失败并提示用户。

## Architecture Decisions

- 选择 Tauri 2 而不是 Electron：需要较低的常驻资源占用，同时保留 React 的界面开发效率。
- 选择 SQLite：数据为本机结构化关系数据，需要事务、迁移和可靠恢复。
- 将 Win32 窗口嵌入隔离到独立 Rust 模块：该能力风险高且平台专用，不得影响任务领域与持久层。
- 进程注册表仅存在于运行时：进程 ID 和窗口句柄不能跨会话可靠恢复。
- 嵌入任意传统桌面应用是实验性能力：Windows 不提供对所有第三方窗口统一且受支持的嵌入协议。
- 右侧使用标签页且同一时刻只显示一个嵌入窗口：控制布局复杂度和窗口层级风险。
- 首版无账号、无云同步、无系统提醒：保持个人本地工具的范围和隐私边界。
- `vercel-react-best-practices` 用于 React 性能和实现质量，不替代 SmartSpace 的视觉设计规范。
- Amicro 只作为按需微交互来源：优先用于状态反馈，不引入与工作台无关的展示型动画，并必须支持减少动态效果。
- 每个最小功能模块只有在验证通过、sub-agent review 无阻塞问题、独立 commit 且成功推送 GitHub 后才算交付完成。

## Session Notes

- 当前仓库已包含 Tauri 2、React 19、TypeScript、Vite、Tailwind CSS 4、Vitest、任务领域/SQLite 持久层、任务 Tauri commands 和基础任务工作台；托盘、快捷键、窗口模式、备份及第三方窗口嵌入仍待后续模块实现。
- 用户最初描述的“空白板块”已澄清为可直接操作的第三方应用窗口，而不是应用快捷启动网格。
- 用户要求允许选择任意传统桌面应用；规格必须持续强调兼容性限制，不承诺全部成功。
- 已确认的窗口嵌入行为：标签页切换只隐藏/显示窗口；关闭标签页默认关闭由 SmartSpace 启动的进程；嵌入失败时提供重试和外部打开。
- Amicro 仓库检查结果：默认分支 `main`，当前包版本 `1.0.1`，许可证为 MIT；可通过 npm、CLI 或 shadcn registry 获取组件。
- 模块 1 已以提交 `060479d` 推送到公开远程 `https://github.com/CxHsin/SmartSpace` 的 `main` 分支。
- 模块 2 已以提交 `c9e698f` 推送到 `origin/main`。
- 模块 3 已以提交 `c9a5113` 推送到 `origin/main`。
- 模块 4 已以提交 `f0dfe4f` 推送到 `origin/main`。
- 模块 5 已以提交 `c299347` 推送到 `origin/main`。
- 模块 6 已以提交 `dac82e3` 推送到 `origin/main`。
- 模块 7 已以提交 `13d70f6` 推送到 `origin/main`。
- 模块 8 已以提交 `6e12cc2` 推送到 `origin/main`。
- 模块 9 已以提交 `244d27f` 推送到 `origin/main`。
- 模块 10 已以提交 `ae62bba` 推送到 `origin/main`。
- 模块 11 已以提交 `a25f67a` 推送到 `origin/main`。
- 模块 12 已以提交 `1456c57` 推送到 `origin/main`。
- 模块 13 已以提交 `2563626` 推送到 `origin/main`。
- 模块 14 已以提交 `1b41e84` 推送到 `origin/main`。
- 模块 15 已以提交 `b40b80b` 推送到 `origin/main`。
- 模块 16 已以提交 `584a083` 推送到 `origin/main`。
- 模块 17 已以提交 `b197c38` 推送到 `origin/main`。
- 模块 18 已以提交 `c230971` 推送到 `origin/main`。
- 模块 19 已以提交 `1feaa28` 推送到 `origin/main`。
- 模块 20 已以提交 `d65ce67` 推送到 `origin/main`。
- 模块 21 已以提交 `2c3c53d` 推送到 `origin/main`。
- 模块 22 已以提交 `92425e4` 推送到 `origin/main`。
- 模块 23 已以提交 `5b14e48` 推送到 `origin/main`。
- 模块 24 已以提交 `cbcd39d` 推送到 `origin/main`。
- 模块 25 已以提交 `7e69719` 推送到 `origin/main`。
- 模块 26 已以提交 `6faca3e` 推送到 `origin/main`。
- 模块 27 已以提交 `d65f448` 推送到 `origin/main`。
- 模块 28 已以提交 `fd64d87` 推送到 `origin/main`。
- 初始 PATH 探测未发现 Rust；随后确认 `rustc`/`cargo` `1.97.1` 位于 `%USERPROFILE%\\.cargo\\bin`，后续 Rust 验证必须使用显式路径或先加入该目录。
- 用户选择首阶段仅交付开发机可运行版本，不制作安装包；`tauri build --no-bundle` 是当前发布构建门禁。
