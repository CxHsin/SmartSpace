# SmartSpace Progress Tracker

每次有意义的实现变更后更新本文件。只有已经运行并验证的工作才能列入 `Completed`。

## Current Phase

- 实现中：模块 1（基础工程）已完成，准备进入模块 2（任务领域模型）。

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

## In Progress

- None.

## Next Up

1. 模块 2：建立任务领域类型、分类不变量与纯逻辑测试。
2. 模块 3：建立 SQLite 迁移与任务持久化仓库。

## Open Questions

- 对首个兼容性发布门槛，除受控测试程序外还要求哪些第三方应用成功嵌入。

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

- 当前仓库已包含 Tauri 2、React 19、TypeScript、Vite、Tailwind CSS 4 与 Vitest 的基础工程；前端仅有静态应用壳，任务、SQLite、托盘、快捷键、窗口模式与嵌入均尚未实现。
- 用户最初描述的“空白板块”已澄清为可直接操作的第三方应用窗口，而不是应用快捷启动网格。
- 用户要求允许选择任意传统桌面应用；规格必须持续强调兼容性限制，不承诺全部成功。
- 已确认的窗口嵌入行为：标签页切换只隐藏/显示窗口；关闭标签页默认关闭由 SmartSpace 启动的进程；嵌入失败时提供重试和外部打开。
- Amicro 仓库检查结果：默认分支 `main`，当前包版本 `1.0.1`，许可证为 MIT；可通过 npm、CLI 或 shadcn registry 获取组件。
- 模块 1 使用本地 Git `main` 和公开远程 `https://github.com/CxHsin/SmartSpace`；独立 review 已批准，交付提交将推送到 `origin/main`。
- 初始 PATH 探测未发现 Rust；随后确认 `rustc`/`cargo` `1.97.1` 位于 `%USERPROFILE%\\.cargo\\bin`，后续 Rust 验证必须使用显式路径或先加入该目录。
- 用户选择首阶段仅交付开发机可运行版本，不制作安装包；`tauri build --no-bundle` 是当前发布构建门禁。
