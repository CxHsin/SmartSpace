# SmartSpace Progress Tracker

每次有意义的实现变更后更新本文件。只有已经运行并验证的工作才能列入 `Completed`。

## Current Phase

- 模块 48 已完成，下一步进入应用配置仓库模块。

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
- **模块 29：前端分类内任务重排 IPC 客户端** 已完成实现与审查：新增只读 `ReorderTasksInput` 与 `SmartSpaceClient.reorderTasks`，精确调用 `reorder_tasks` 并传递完整 `{ request: { categoryId, orderedTaskIds } }`；冻结输入和只读 ID 序列保持不变，返回完整只读 `TaskDto` 数组。39 个前端测试、108 个 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `b750744` 已推送到 `origin/main`。
- **模块 30：前端任务删除 IPC 客户端** 已完成实现与审查：新增只读 `DeleteTaskInput` 与 `SmartSpaceClient.deleteTask`，精确调用 `delete_task` 并传递 `{ request: { taskId } }`；冻结输入保持不变，返回删除前包含全部 8 个字段的完整 `TaskDto` 快照，为后续撤销提供无损输入。42 个前端测试、108 个 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `165b904` 已推送到 `origin/main`。
- **模块 31：前端创建分类 IPC 客户端** 已完成实现与审查：新增只读 `CreateCategoryInput` 与 `SmartSpaceClient.createCategory`，精确调用 `create_category` 并传递 `{ request: { name } }`；分类名称原样交由 Rust 领域层规范化，冻结输入保持不变并返回完整四字段 `CategoryDto`。45 个前端测试、108 个 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `57a20f6` 已推送到 `origin/main`。
- **模块 32：前端分类重命名 IPC 客户端** 已完成实现与审查：新增只读 `RenameCategoryInput` 与 `SmartSpaceClient.renameCategory`，精确调用 `rename_category` 并传递 `{ request: { categoryId, name } }`；分类名称原样交由 Rust 领域层规范化，冻结输入保持不变并返回完整四字段 `CategoryDto`。49 个前端测试、108 个 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `a640370` 已推送到 `origin/main`。
- **模块 33：前端分类重排 IPC 客户端** 已完成实现与审查：新增只读 `ReorderCategoriesInput` 与 `SmartSpaceClient.reorderCategories`，精确调用 `reorder_categories` 并传递完整 `{ request: { orderedCategoryIds } }`；冻结输入和只读 ID 序列保持不变，收件箱 ID 原样参与排序，返回完整只读 `CategoryDto` 数组。51 个前端测试、108 个 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `e932974` 已推送到 `origin/main`。
- **模块 34：前端分类删除 IPC 客户端** 已完成实现与审查：新增只读 `DeleteCategoryInput`、`DeleteCategoryResultDto` 与 `SmartSpaceClient.deleteCategory`，精确调用 `delete_category` 并传递 `{ request: { categoryId } }`；冻结输入保持不变，返回删除分类 ID 与迁移任务数，收件箱保护错误保持结构化。55 个前端测试、108 个 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `8c3b508` 已推送到 `origin/main`。
- **模块 35：“已完成”智能视图** 已完成实现与审查：任务导航新增 Completed，计数与分类计数在同一次任务遍历中派生，列表直接从最新 DTO 过滤 `status === "completed"`；All、分类和 Completed 视图的标题、计数、筛选与专用空状态准确，恢复任务后会立即退出 Completed 并同步计数。新增 2 条交互测试；57 个前端测试、108 个 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；1120x720、800x520、640x700 的长标题、切换和恢复流程视觉验收无重叠、裁切或页面溢出。`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `7b39a59` 已推送到 `origin/main`。
- **模块 36：创建分类交互** 已完成实现与审查：分类导航新增紧凑内联创建入口，通过 `SmartSpaceClient.createCategory` 持久化并按返回位置同步更新导航与任务分类选择器；支持 Enter、Escape、Cancel、空白拒绝、同步重复提交锁、成功清空与焦点恢复、三类错误和草稿保留，并通过 keyed 会话隔离旧客户端请求。64 条前端测试、108 条 Rust 测试、前端/Rust 全量门禁和 Tauri release 构建通过；1120×720、800×520、640×700 的长草稿、重复错误及长名称成功状态视觉验收无重叠或整体溢出。`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `3b49fcd` 已推送到 `origin/main`。
- **模块 37：过期任务标识** 已完成实现与审查：使用本地日历日期和可清理的本地午夜 timer 派生过期状态，仅对开放且截止日期早于今天的任务强调日期并显示文本 `Overdue`，不改变筛选、排序或 DTO。首轮 review 指出的午夜刷新与 timer 生命周期测试缺口（P2）已用 fake timers 覆盖并经复审关闭。66 条前端测试、108 条 Rust 测试、前端/Rust 全量门禁与 Tauri release 构建通过；1120×720、800×520、640×700 视觉验收无重叠或整体溢出。`gpt-5.6-sol medium` 复审结果为 `APPROVE`，无 findings；模块提交 `e8d663c` 已推送到 `origin/main`。
- **模块 38：Today 智能视图** 已完成实现与审查：任务导航新增 Today，计数在现有单次任务遍历中派生，筛选以当前本地日历日精确匹配 `dueDate`，包含开放与已完成任务并保持存储顺序；标题、计数、当前页、专用空状态和本地午夜刷新一致。67 条前端测试、108 条 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；1120×720、800×520、640×700 视觉验收无重叠或整体溢出。`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 findings；模块提交 `d5258cd` 已推送到 `origin/main`。
- **模块 39：任务截止日期编辑交互** 已完成实现与审查：任务行加入原生日期编辑、设置、显式清除、取消、焦点恢复、类型化错误和共享行级并发锁，通过既有 `set_task_due_date` IPC 持久化并只合并 command 返回 DTO；Today 任务因改期退出列表时焦点转移到持久视图标题。首轮 review 的临界宽度裁切和 Today 焦点丢失两个 P2 已修复，复审结果为 `APPROVE`。75 条前端测试、108 条 Rust 测试、前端/Rust 全量门禁和 Tauri release 构建通过；640、800、996、1040、1100、1116、1120px 视觉/边界实测无横向溢出、裁切或重叠，浏览器控制台无错误；模块提交 `f2aa6c2` 已推送到 `origin/main`。
- **模块 40：任务跨分类移动交互** 已完成实现与审查：任务行加入当前分类选择、移动、取消、焦点恢复、结构化错误和共享行级并发锁，通过既有 `move_task` IPC 持久化；App 按 command 返回 position 压缩源分类、插入并连续化目标分类，并用会话级 Promise 队列串行提交和应用不同任务的移动，保证 All 视图顺序与 SQLite 一致。成功后分类计数与视图立即同步，移出当前分类时焦点落到持久标题，keyed client session 隔离旧结果。两轮 review 发现的连续移动旧 position 与不同任务并发逆序两个 P1 均已修复，`gpt-5.6-sol medium` 最终复审结果为 `APPROVE`，无 findings。85 条前端测试、108 条 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；1120×720、800×520、640×700 的长任务、超长无断点分类名、编辑与成功状态视觉验收无溢出、裁切或重叠，浏览器控制台无错误；模块提交 `f85562d` 已推送到 `origin/main`。
- **模块 41：原生 Windows 可执行文件选择 command** 已完成实现与审查：引入与 Tauri 2.11.5 共用运行时的官方 `tauri-plugin-dialog` 2.7.2，初始化 plugin 并注册窄 `pick_application_executable` command；异步 command 只打开原生单文件 `.exe` 选择器，取消返回 `null`，返回前复验绝对路径、无损 Unicode、大小写不敏感扩展名、存在性和普通文件类型，失败统一为结构化 `invalid_input`，不访问数据库或进程 API。4 条聚焦测试覆盖全部纯边界分支；85 条前端测试、112 条 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过。`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 P1/P2；真实系统对话框交互留待 React 添加应用入口端到端验收，未来启动边界必须再次验证文件并把 TOCTOU 失败映射为可恢复状态；模块提交 `b65dafb` 已推送到 `origin/main`。
- **模块 42：前端可执行文件选择 IPC 客户端** 已完成实现与审查：可注入 `SmartSpaceClient` 新增必需的 `pickApplicationExecutable(): Promise<string | null>`，默认客户端精确调用 `pick_application_executable` 且不传 args，选中路径与取消 `null` 原样返回，`invalid_input` 和未知拒绝复用统一 `SmartSpaceCommandError` 边界；App 与 workspace loader 的全部手写客户端替身显式拒绝意外 picker 调用。新增 4 条客户端测试；89 条前端测试、112 条 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过。`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 P1/P2；与现有 IPC 方法一致，运行时响应形状由类型化 Tauri 边界保证，当前不重复解码；模块提交 `11a03f3` 已推送到 `origin/main`。
- **模块 43：任务标题重命名交互** 已完成实现与审查：任务行新增可访问的标题 trigger 与内联编辑器，通过既有 `rename_task` IPC 持久化原始草稿并只合并 command 返回 DTO；支持打开时聚焦/全选、空白及规范化未变化禁用、Enter、Escape、Cancel、保存后焦点恢复、结构化错误保留草稿，以及标题/状态/日期/分类共享同步行锁。App 使用函数式状态替换并依靠 keyed client session 隔离旧请求。50 条 App 聚焦测试、95 条前端全量测试、112 条 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；1120x720、800x520、640x700 的长标题、无断点分类名、成功与取消流程视觉验收无重叠、裁切或横向溢出，控制台无错误。`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 P1/P2；模块提交 `defbeaa` 已推送到 `origin/main`。
- **模块 44：分类重命名交互** 已完成实现与审查：分类导航新增独立重命名 trigger 与内联编辑器，通过既有 `rename_category` IPC 持久化原始草稿并只合并 command 返回 DTO；支持打开时聚焦/全选、空白及规范化未变化禁用、Enter、Escape、Cancel、同步重复提交锁、保存后焦点恢复和四类错误保留草稿。名称更新会同步当前分类标题、导航、任务分类展示和新任务分类选择器，keyed client session 隔离旧请求。57 条 App 聚焦测试、102 条前端全量测试、112 条 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；1120x720、800x520、640x700 的超长无断点分类名、成功与取消流程视觉验收无重叠、裁切或横向溢出，控制台无错误。`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 P1/P2；模块提交 `a3e4a48` 已推送到 `origin/main`。
- **模块 45：分类手动排序交互** 已完成实现与审查：分类导航新增 Sort/Done 显式排序模式和首尾边界禁用的上移/下移控制，每次通过既有 `reorder_categories` IPC 提交包含收件箱的完整 ID 序列，不做乐观更新；以 command 返回的完整 `CategoryDto[]` 同步导航、当前分类和任务分类选择器，并按返回 position 重建 All 视图任务存储顺序。分类创建、重命名和排序共享同步写锁；成功后提供 live feedback 并把焦点保留在同方向或边界反方向控制上，错误保留原顺序，keyed client session 隔离旧请求。62 条 App 聚焦测试、107 条前端全量测试、112 条 Rust 测试、前端/Rust 全量门禁及 Tauri release 构建通过；1120x720、800x520、640x700 视觉验收无重叠、裁切或页面溢出，浏览器日志无 warning/error。`gpt-5.6-sol medium` 独立 review 结果为 `APPROVE`，无 P1/P2；模块提交 `5d362ed` 已推送到 `origin/main`。
- **模块 46：分类删除交互** 已完成实现与审查：用户分类提供内联确认、任务迁移说明、Escape/Cancel、类型化错误、重复提交保护及确定性焦点恢复，收件箱不可删除；删除与分类创建、重命名、排序共享 UI 写锁。Rust 删除事务在同一数据库锁内迁移任务、压缩分类并返回权威分类/任务快照，快照读取失败会回滚；前端直接应用快照，并以会话级删除屏障协调任务创建、状态、重命名、日期和移动写入，拒绝引用缺失分类的迟到 DTO。成功反馈、确认关闭和邻居焦点均按 command 返回 ID 派生，删除当前分类时切换收件箱并聚焦标题，keyed client session 隔离旧结果。三轮 `gpt-5.6-sol medium` review 发现的任务写交错 P1、迁移时间戳 P2、返回 ID 状态 P2 和请求行焦点竞争 P2 均已修复，最终结果为 `APPROVE`，无 P1/P2。72 条 App 聚焦测试、117 条前端全量测试、112 条 Rust 测试、前端/Rust 全量门禁和 Tauri release 构建通过；1120x720、800x520、640x700 视觉验收覆盖长分类名、确认、滚动、反馈与焦点，无重叠、裁切或页面溢出，浏览器日志无 warning/error；模块提交 `76a1181` 已推送到 `origin/main`。
- **模块 47：应用配置表迁移** 已完成实现与审查：schema v2 新增 `applications` 表，包含稳定 ID、显示名称、Windows 可执行文件路径、可选图标缓存键和排序位置索引；名称、路径和非空图标键拒绝空白，位置通过 `typeof(position) = 'integer'` 同时拒绝文本、小数与负数。全新数据库直接建立 v2，v1 文件数据库升级前后的分类与任务完整有序行快照逐列一致，既有失败迁移回滚与目录连续性测试推进到未来版本 3。首轮 `gpt-5.6-sol medium` review 发现的无损迁移断言不足 P2 和 SQLite 整数亲和性 P2 均已修复，复审结果为 `APPROVE`，无 P1/P2。117 条前端测试、114 条 Rust 测试、Prettier、ESLint、TypeScript、Vite build、Rust fmt、Clippy、cargo check、git diff check 与 Tauri release build 全部通过；本模块无 UI 变更，不需要视觉验收；模块提交 `4b2691a` 已推送到 `origin/main`。
- **模块 48：应用配置领域模型** 已完成实现与审查：新增 `ApplicationId` 及 `ApplicationConfig`、`ApplicationDisplayName`、`ApplicationExecutablePath`、`ApplicationIconCacheKey`、`ApplicationPosition`。值对象通过自校验反序列化拒绝空白名称、空白/NUL/相对/非 `.exe` 路径、空白图标键和负数位置；路径保留用户选择的原始 Unicode 文本且不访问文件系统，使暂时不可用的持久配置仍可加载并由启动边界恢复处理。合法配置以 camelCase JSON 无损往返。首轮 `gpt-5.6-sol medium` review 发现的 Current Phase 文档 P2 已修正，复审结果为 `APPROVE`，无 P1/P2。19 条领域聚焦测试、117 条前端测试、120 条 Rust 测试、前端/Rust 全量门禁与 Tauri release 构建通过；本模块无 UI 变更，不需要视觉验收；模块提交 `0408c9e` 已推送到 `origin/main`。

## In Progress

- 无。

## Next Up

1. 登记并实现应用配置仓库模块。

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
- 模块 29 已以提交 `b750744` 推送到 `origin/main`。
- 模块 30 已以提交 `165b904` 推送到 `origin/main`。
- 模块 31 已以提交 `57a20f6` 推送到 `origin/main`。
- 模块 32 已以提交 `a640370` 推送到 `origin/main`。
- 模块 33 已以提交 `e932974` 推送到 `origin/main`。
- 模块 34 已以提交 `8c3b508` 推送到 `origin/main`。
- 模块 35 已以提交 `7b39a59` 推送到 `origin/main`。
- 模块 39 已以提交 `f2aa6c2` 推送到 `origin/main`。
- 初始 PATH 探测未发现 Rust；随后确认 `rustc`/`cargo` `1.97.1` 位于 `%USERPROFILE%\\.cargo\\bin`，后续 Rust 验证必须使用显式路径或先加入该目录。
- 用户选择首阶段仅交付开发机可运行版本，不制作安装包；`tauri build --no-bundle` 是当前发布构建门禁。
