# SmartSpace To-Do Workbench

## 1. Product Summary

SmartSpace is a Windows desktop quick panel for personal tasks and frequently used utilities. A global shortcut reveals a compact, always-on-top workspace. The left side holds a local task list. The right side hosts selected Windows applications in icon-only horizontal tabs.

The product is designed for fast context switching, not as a general project-management suite.

## 2. Goals

- Capture a task in one line and one Enter press.
- Filter tasks by one category and multiple tags without leaving the quick panel.
- Keep frequently used Windows tools available in the same surface.
- Make the panel predictable: one shortcut to show or hide it, one tray menu to control it.
- Keep personal data local and independent of an account or network service.

## 3. Non-goals for MVP

- Cloud sync, accounts, collaboration, or a web backend.
- Due dates, reminders, recurring tasks, priorities, notes, subtasks, or attachments.
- Guaranteed support for arbitrary Windows applications.
- Sandboxing or rewriting the embedded applications.
- Replacing the system tray behavior of Clash Verge, CCSwitch, or Token Monitor.

## 4. Target User and Primary Flow

The target user works on Windows and repeatedly switches between a small set of utilities while maintaining a short personal task list.

1. SmartSpace starts with Windows when the user enables the option.
2. The user presses a configurable global shortcut. Default: `Ctrl+Shift+Space`.
3. The panel appears at the last known position and size. The first launch is centered.
4. The user types a task title, presses Enter, and sees it in the selected category.
5. The user filters by category or tag, completes tasks, or restores them from Completed.
6. The user selects a right-side application tab. The existing process is adopted when possible; otherwise the configured executable is launched.
7. The user switches tabs without stopping background processes.
8. Closing an application tab exits that application, including an adopted process. Destructive close confirmation is enabled for Clash Verge by default.
9. Clicking outside hides the panel. The tray menu can show the panel, open Settings, or exit SmartSpace completely.

## 5. Functional Requirements

### 5.1 Quick panel

- Global shortcut toggles visibility and focuses the panel when already visible.
- Window is always on top, hidden on blur, and excluded from the taskbar.
- The first launch is centered on the current primary work area.
- Last position, size, and left-right split ratio are persisted locally.
- If the saved monitor is unavailable, fall back to the current primary work area.
- The panel exposes a visible resize affordance for the left task area and right app area.
- The complete task pane can be collapsed by selecting the SmartSpace project icon in the title bar. The same icon restores it, keeping one consistent control in both states.
- Collapsing the task pane preserves its selected category, tag filter, composer text, and task list state.
- A compact title area exposes Settings, minimize-to-tray, and exit actions.

### 5.2 Tasks

- Create a task with a title from the inline composer.
- Every task has exactly one category.
- Every task can have zero or more tags.
- Toggle incomplete and completed states.
- Completed tasks move out of the active list into a Completed view.
- Restore a completed task or permanently delete it.
- Edit category and tags from the task row without opening a large form.
- Show empty, loading, and error states for the task list.

### 5.3 Categories and tags

- The task pane begins with a category bar. MVP ships with editable categories: Tools, Personal, Learning.
- Users can add a category with the category bar `+` control. Right-clicking a category exposes rename and delete actions.
- Deleting a category requires confirmation. Its tasks move to another remaining category so task data is not silently lost.
- Each category owns its own tag set, displayed directly below the category bar.
- Users can add a tag with the tag-row `+` control. Right-clicking a tag exposes rename and delete actions.
- Deleting a tag requires confirmation and removes the tag from associated tasks in that category.
- The inline task composer appears below the tag row.
- Category filter and tag filter can be used together. The current filter state is visible and can be cleared in one action.

### 5.4 Windows app host

- Add an executable from Settings with a file picker.
- Read display name and icon when Windows metadata is available.
- Store executable path, process matching hints, display name, icon cache path, and close-confirmation preference.
- Seed the first validation set around Token Monitor, CCSwitch, and Clash Verge.
- Prefer attaching to an existing matching process and top-level window.
- If no attachable window exists, launch the configured executable.
- Keep non-active processes alive while hiding their hosted windows.
- Close a tab by requesting normal process exit first, then offer force termination if needed.
- Handle higher-integrity processes by explaining the issue and asking to restart SmartSpace elevated.
- If embedding fails, fall back to a separate desktop window and show an explicit `独立窗口` state.
- Do not claim arbitrary `.exe` compatibility until the target application passes a manual compatibility check.

### 5.5 Settings and tray

- Record and validate a configurable global shortcut.
- Enable or disable launch at Windows startup.
- Manage registered apps and per-app close confirmation.
- Configure whether the panel hides on blur.
- Tray menu: Show SmartSpace, Settings, Launch at startup toggle, Exit.
- Exiting SmartSpace closes all managed app processes according to the user's confirmation choice.

## 6. Data Model

SQLite is the source of truth. The renderer never writes SQLite directly; the Electron main process owns persistence and exposes a narrow IPC API.

```text
Category
  id: string
  name: string
  color: string
  sortOrder: number

Tag
  id: string
  name: string

Task
  id: string
  title: string
  categoryId: string
  status: active | completed
  createdAt: string
  completedAt: string | null

TaskTag
  taskId: string
  tagId: string

HostedApp
  id: string
  displayName: string
  exePath: string
  iconPath: string | null
  processMatch: string | null
  closeConfirm: boolean
  lastKnownWindowClass: string | null
```

## 7. Technical Architecture

- Shell: Electron main process for window lifecycle, global shortcut, tray, startup registration, process control, and IPC.
- UI: React + TypeScript renderer bundled with Vite.
- UI system: Fluent UI React components and Fluent icons. One design system only.
- Motion: `motion/react`, using small spring transitions for state change and feedback. Amicro MIT-licensed patterns may be adapted with attribution in `THIRD_PARTY_NOTICES.md`.
- Persistence: SQLite behind an Electron main-process repository layer.
- Native bridge: a small Win32 addon or a maintained FFI layer for `HWND` discovery, `SetParent`, style changes, focus, resize, and process/window lifecycle.
- Security: context isolation enabled, sandbox enabled where compatible, no direct Node access from the renderer, validated IPC payloads.

### 7.1 Process and window lifecycle

The host tracks process ID, top-level window handle, ownership state, and embedding state separately. An adopted app is still marked as managed because the product requirement is to exit it when its tab closes. The host must restore the original parent and window style before process termination where possible.

### 7.2 Compatibility fallback

Embedding is best-effort. The host must detect these states distinctly:

- `searching`: looking for an existing process/window
- `launching`: starting the configured executable
- `embedded`: hosted inside the app panel
- `external`: running as a normal desktop window
- `permission-required`: target integrity level is higher
- `error`: no usable window or process response

## 8. UX and Visual Direction

- Compact Fluent-inspired work surface, not a marketing page.
- Neutral charcoal and cool gray surfaces with one restrained cyan accent for focus and active states.
- Clear 8px spacing rhythm and consistent 8px corner radius for surfaces. Icon buttons use a smaller 6px radius.
- App tabs are icon-only, with tooltip, selected background, process state, and context menu.
- Task rows are scan-friendly, with checkbox, title, category indicator, and compact tag chips.
- Motion communicates feedback: task completion, tab selection, panel entry, and loading only.
- Respect `prefers-reduced-motion`; all transitions become instant or are removed.
- Light and dark themes share the same hierarchy and are tested independently.

## 9. MVP Acceptance Criteria

- A user can add, complete, restore, and delete tasks without a modal.
- Category and tag filtering produce the expected active list.
- A registered app appears as an icon tab and can be selected without stopping other tabs.
- The shell can attach to a compatible existing app window or launch it when missing.
- An unsupported app visibly falls back to an external window instead of appearing blank.
- `Ctrl+Shift+Space` can be changed in Settings and conflict errors are surfaced.
- Closing SmartSpace from the tray is the only path that ends the shell process.
- SQLite data survives app restart.
- Keyboard navigation and visible focus states work for the core task and tab flows.
- Build, typecheck, and packaged Windows smoke test pass.

## 10. Delivery Phases

### Phase 1: UI prototype

- Build the quick-panel renderer with realistic sample tasks and app states.
- Validate layout, filtering, tab switching, settings, empty states, and motion.
- No native process control yet.

### Phase 2: Electron shell

- Add tray, global shortcut, startup registration, always-on-top, blur-to-hide, and persisted window bounds.
- Add secure IPC contracts with mocked app-host responses.

### Phase 3: Local persistence

- Add SQLite migrations and repositories for tasks, categories, tags, and hosted apps.
- Replace prototype state with IPC-backed state.

### Phase 4: Native window host

- Implement process discovery, top-level window matching, embedding, resize/focus sync, and fallback.
- Validate Token Monitor, CCSwitch, and Clash Verge separately.

### Phase 5: Packaging and hardening

- Package for Windows, test startup behavior, elevation flow, crash recovery, and app shutdown confirmation.
- Document known compatibility limitations.

## 11. Known Risks

- Windows `HWND` embedding can fail for elevated, GPU-rendered, multi-window, or tray-first applications.
- Clash Verge may keep proxy state in a tray process when its main window closes; force termination must be explicit.
- Different DPI scaling across monitors can desynchronize hosted window bounds.
- Native modules must be rebuilt for the exact Electron version used in packaging.
- An embedded application may capture keyboard shortcuts intended for SmartSpace.
