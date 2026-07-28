# SmartSpace Architecture Context

## Stack

| Layer               | Technology                                | Role                                                     |
| ------------------- | ----------------------------------------- | -------------------------------------------------------- |
| Desktop shell       | Tauri 2                                   | 窗口、托盘、全局快捷键、开机启动、原生对话框和前后端桥接 |
| UI                  | React + TypeScript                        | 任务界面、分类导航、应用标签页和设置界面                 |
| Styling             | Tailwind CSS 4                            | 设计令牌、布局、主题、响应式约束和状态样式               |
| Motion              | Motion + selected Amicro components       | 克制的状态过渡、加载反馈和组件微交互                     |
| Native core         | Rust                                      | 命令边界、业务编排、进程管理、备份和错误映射             |
| Database            | SQLite                                    | 任务、分类、应用配置、设置和数据库版本                   |
| Windows integration | Rust + Win32 APIs                         | 启动进程、发现主窗口、窗口嵌入、定位、缩放和生命周期控制 |
| Tests               | TypeScript/Rust tests + Windows test host | 纯逻辑、存储集成、桌面流程和窗口嵌入验证                 |

## Planned System Boundaries

- `src/`：React 前端，只负责显示和用户交互；不直接访问文件系统、数据库、进程或 Windows API。
- `src/features/tasks/`：任务、智能视图、分类和排序的前端功能单元。
- `src/features/apps/`：应用配置、标签页和嵌入状态的前端功能单元。
- `src/features/settings/`：快捷键、窗口、托盘、启动和主题设置。
- `src/components/ui/`：项目自有的基础 UI 组件和设计令牌消费者。
- `src/components/motion/`：从 Amicro 按需引入并适配后的微交互组件；不得散落复制到业务功能目录。
- `src-tauri/src/commands/`：前端可调用的类型化 Tauri Command；负责输入校验和错误映射。
- `src-tauri/src/storage/`：SQLite 仓库、迁移、事务、导入、导出和恢复点。
- `src-tauri/src/windows/`：主窗口模式、位置、DPI、多显示器校正、托盘和全局快捷键。
- `src-tauri/src/embedding/`：Windows 专用的进程注册表、窗口发现和嵌入实现。
- `src-tauri/src/domain/`：跨 UI 和基础设施复用的领域模型与规则。

这些路径是实现阶段的目标边界；当前仓库尚未创建应用代码。

## Component Contracts

### React UI

- React 组件实现和审查必须应用 `vercel-react-best-practices`，重点检查包体积、全局事件监听、派生状态、重渲染和长列表渲染。
- 直接从具体模块导入，避免无意引入完整组件库；较重且低频的设置或诊断界面按需加载。
- 窗口尺寸、嵌入区域坐标等高频瞬时值使用受控订阅或引用，避免驱动无关组件重渲染。
- 全局快捷键和原生窗口事件必须集中订阅并正确清理，不能由多个组件重复注册。

### Motion Components

- Amicro 作为 MIT 许可的参考与组件来源，优先按需引入单个组件并保留所需版权声明。
- 引入的组件必须适配 SmartSpace 设计令牌、键盘交互、焦点样式和 `prefers-reduced-motion`。
- 动画只允许使用 `transform` 和 `opacity` 等低成本属性，避免让动画持续触发布局计算。
- 任务列表、分类列表和嵌入窗口容器不得因进入/退出动画产生尺寸跳动或遮挡。
- 每个引入的 Amicro 组件都视为项目代码，必须经过类型检查、测试和 sub-agent review；不能盲目信任上游实现。

### Task Service

- 接收经过校验的任务和分类命令。
- 在事务中维护排序位置和分类迁移。
- 返回稳定的领域对象，不向 UI 暴露 SQLite 细节。
- 分类删除 command 在持有同一数据库锁期间返回删除后的完整分类与任务快照；前端以该快照替换工作台，不能根据删除前 DTO 推测迁移后的时间戳或位置。
- 任务与分类使用 UUID 作为稳定标识；内置“收件箱”使用固定 UUID，确保初始化、导入和迁移不会创建重复系统分类。
- 截止日期使用不含时区的本地日历日期；创建和更新时间使用 UTC 时间戳。
- 任务标题与分类名称在领域入口处去除首尾空白并拒绝空值；唯一性和引用完整性由后续服务/仓库事务保证。

### Application Configuration

- 应用配置使用 UUID 作为稳定标识；持久配置只描述用户选择的应用，不包含进程 ID、窗口句柄或运行状态。
- 应用配置领域入口保留可显示名称的规范形式，并拒绝空白名称、空白路径、包含 NUL 的路径、非绝对路径和大小写不敏感扩展名不是 `.exe` 的路径；路径存在性留给启动/嵌入边界重新验证。图标缓存键可选但非空时必须为非空白规范字符串，应用排序位置必须为非负整数。

### Embed Host

- 只提供 `launch`、`attach`、`show`、`hide`、`resize`、`retry` 和 `close` 等窄接口。
- 通过进程 ID 和窗口句柄维护运行时状态，不读写任务数据。
- React 提供嵌入区域的屏幕坐标和尺寸；Rust 负责 DPI 转换及 Win32 调用。
- 标签页切换只隐藏或显示窗口，不终止对应进程。

### Process Registry

- 维护应用标签页、进程 ID、主窗口句柄、启动路径和运行状态之间的映射。
- 注册表仅存在于当前会话；异常退出后不自动附加旧进程。
- 持久层只保存应用配置，不保存进程 ID 或窗口句柄。

## Storage Model

### SQLite

- `tasks`：UUID、标题、状态、本地截止日期、分类 UUID、排序位置、UTC 创建时间和 UTC 更新时间。
- `categories`：UUID、名称、排序位置和系统分类标记。
- `applications`：稳定 UUID、显示名称、可执行文件路径、可选图标缓存键和排序位置。
- `settings`：快捷键、窗口模式、窗口状态、关闭行为、开机启动和主题。
- `schema_meta`：数据库结构版本。

截止日期存储为本地日历日期，不含时间和时区。数据库变更必须通过可回滚迁移完成。Schema v2 新增 `applications` 表；已有 v1 任务与分类数据必须原样迁移。

- 应用使用进程内 `rusqlite` 与 bundled SQLite，不向 React 暴露 SQL，也不依赖系统 SQLite 安装。
- `schema_meta` 保存单例结构版本；打开数据库时只按顺序执行内嵌迁移，发现高于当前程序支持的版本时拒绝打开。
- 每个迁移与版本更新位于同一事务；失败必须完整回滚。
- SQLite 始终启用外键；分类仓库在写事务内执行 Unicode caseless 名称唯一校验，数据库 `NOCASE` 唯一约束作为 ASCII 竞争与绕过写入的后备保护；分类删除策略由服务事务明确执行，数据库外键默认拒绝悬空任务。
- 分类仓库把固定收件箱存在且唯一、分类位置恰为连续的 `0..n-1`、名称按 Unicode caseless 规则唯一视为持久层逻辑不变量；读取或写入前发现损坏时返回类型化错误，不在同一操作中静默修复。
- 任务仓库的公开复合读取使用单个 SQLite 延迟事务快照，确保分类与任务来自同一数据库版本；公开写入继续使用即时事务串行化位置变更。
- 任务 UTC 时间戳以固定 9 位纳秒 RFC3339 格式持久化，保证 `DateTime<Utc>` 无损往返；数据库中的任务标题与分类名称必须已经是领域规范形式，读取不得静默修剪后继续。
- 应用配置仓库按 `position ASC, id ASC` 读取完整配置；应用位置必须是连续的 `0..n-1`，显示名称、图标缓存键和可执行文件路径必须已经满足领域规范，发现损坏时返回 `CorruptApplicationStore`，不得静默排序修复或丢弃记录。

### User Data Directory

- 用户数据根目录必须由 Tauri `app.path().app_data_dir()` 解析，不手工拼接用户主目录或依赖环境变量。
- 主 SQLite 文件固定命名为 `smartspace.sqlite3`；应用启动的 `setup` 阶段递归创建数据目录、打开数据库并完成迁移，然后才允许业务流程继续。
- 进程内只初始化一个 `Database`，以 `std::sync::Mutex` 包装后注入 Tauri managed state；命令层后续只能通过该状态访问主数据库。
- SQLite 数据库文件。
- 从可执行文件提取的应用图标缓存。
- 导入前创建的恢复点。
- 诊断日志；不得记录任务标题或其他不必要的个人内容。

### Portable Backup

- 使用带 `schemaVersion` 的单个 JSON 文件。
- 包含任务、分类、应用配置和可迁移设置。
- 不包含进程状态、窗口句柄、诊断日志或第三方应用内部数据。

## Auth and Access Model

- SmartSpace 是无账号的单用户本地应用。
- 不启动网络服务，不提供远程访问接口。
- 添加应用只能通过原生文件选择器选择可执行文件；不接受任意命令或脚本文本。
- SmartSpace 不提升自身权限，也不尝试控制高权限窗口。

## Embedded Window Lifecycle

```text
NotStarted -> Launching -> FindingWindow -> Embedded
                                |              |
                                v              v
                           EmbedFailed     ProcessExited
```

- 主窗口发现默认超时 10 秒，超时后允许手动重试。
- 首版选择进程的首个可见主窗口，不提供多窗口选择器。
- 第三方应用弹出的独立对话框可以出现在 SmartSpace 容器之外。
- SmartSpace 隐藏时不暂停或终止已嵌入进程。
- 关闭标签页默认终止由 SmartSpace 启动的进程；存在其他独立窗口时先确认。

## Invariants

1. React 不得直接访问数据库、文件系统、进程或 Win32 API。
2. 窗口嵌入失败不得阻塞任务功能、损坏持久数据或导致主窗口失去响应。
3. 任务必须属于且只属于一个有效分类；“收件箱”始终存在且不可删除。
4. 数据导入必须原子执行；失败时恢复原状态，成功前必须创建恢复点。
5. 持久层不得保存会话相关的进程 ID 或窗口句柄。
6. 不得静默提升权限、执行用户未选择的命令或强制控制高权限进程。
7. 快速模式和常规模式分别持久化窗口状态；恢复后的窗口必须位于可见显示区域。
8. 所有跨 Tauri 边界的输入均需校验，并返回可展示、可诊断的类型化错误。
9. UI 在启用“减少动态效果”时必须保持全部功能和明确反馈，动画不得成为唯一状态表达。
10. Amicro 组件只能按需引入，必须保留 MIT 许可要求，并在进入业务代码前完成本地适配和审查。
11. 数据库迁移必须单调、原子且可重复打开；程序不得静默降级或打开高于自身支持版本的数据库。
12. 前端不得合并引用当前分类集合之外 `categoryId` 的迟到任务 DTO；分类删除后的权威快照必须优先于删除事务之前完成但延迟返回的任务响应。
