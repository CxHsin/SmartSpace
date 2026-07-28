# SmartSpace Implementation Tasks

## 1. Purpose

This document is the stable execution plan for turning the current React prototype into the SmartSpace Windows MVP described in `PRD.md`.

Each implementation round assigns exactly one work package to an implementation Agent. The Agent may fix directly related defects found while completing that package, but must not begin a later package or perform unrelated refactors.

Detailed implementation history does not belong here. Record actual changes in `IMPLEMENTATION_HANDOFF.md` and review findings in `REVIEW_LOG.md`.

## 2. Definition of Done

A work package is complete only when all of the following are true:

- Every acceptance criterion in the package is satisfied or explicitly recorded as incomplete.
- Relevant automated tests are added or updated.
- `npm run typecheck` and the relevant test/build commands pass.
- No placeholder behavior is presented as a production implementation.
- Security and process-lifecycle constraints from `PRD.md` are preserved.
- `IMPLEMENTATION_HANDOFF.md` is completed with the exact diff scope and verification results.
- The implementation is committed as one reviewable commit or a small, clearly identified commit range.

An implementation Agent must not mark a package complete when a required test was skipped, a target application was unavailable, or only mocked behavior was verified. Those cases must be recorded as incomplete or blocked.

## 2.1 Agent Assignment

- Implementation Agent: use the `luna` Codex profile, configured for `gpt-5.6-luna` with `xhigh` reasoning effort.
- Review Agent: use `gpt-5.6-sol` with `medium` reasoning effort. No separate Review profile is required.
- Keep implementation and review as separate Agent runs. The Review Agent receives the assigned work package, `IMPLEMENTATION_HANDOFF.md`, the relevant commit range, and necessary code context, but not the implementation Agent's reasoning transcript.
- If the configured implementation model is unavailable, stop and report the model/profile error instead of silently substituting another model.

## 3. Global Constraints

- Platform: Windows desktop application built with Electron, React, TypeScript, and Vite.
- Persistence: SQLite is the source of truth and is owned by the Electron main process.
- Renderer security: context isolation enabled, no direct Node.js or SQLite access, and narrow validated IPC contracts.
- UI: Fluent UI React components and Fluent icons only; preserve light/dark themes and reduced-motion behavior.
- Native hosting: embedding is best-effort. Unsupported or higher-integrity applications must produce an explicit fallback state rather than a blank surface.
- Managed processes: adopted and launched processes follow the same documented close and shutdown policy.
- Scope: MVP excludes accounts, cloud sync, reminders, recurring tasks, priorities, notes, subtasks, and arbitrary executable compatibility claims.
- Compatibility targets: Token Monitor, CCSwitch, and Clash Verge are validated individually.
- Destructive behavior: category deletion migrates tasks; tag deletion removes associations; application termination requires the configured confirmation behavior.
- Change tracking: the repository must have a Git baseline before WP-01 begins. Every implementation round must identify a reviewable commit or commit range.

## 4. Work Package Summary

| ID | Work package | Depends on | Primary result |
| --- | --- | --- | --- |
| WP-01 | Electron foundation | Prototype | Secure runnable Electron application |
| WP-02 | Quick-panel window lifecycle | WP-01 | Shortcut-controlled desktop panel |
| WP-03 | Panel layout, tray, and exit | WP-02 | Complete shell lifecycle and persisted layout |
| WP-04 | SQLite and task repository | WP-01 | Migrated local database and task CRUD |
| WP-05 | Categories, tags, and settings data | WP-04 | Complete relational data layer |
| WP-06 | Production task renderer | WP-03, WP-05 | IPC-backed task experience |
| WP-07 | Settings and app registration | WP-03, WP-05 | Persistent settings and executable registration |
| WP-08 | Native window-host core | WP-01, WP-07 | Process discovery, launch, and HWND embedding |
| WP-09 | Hosted-app lifecycle and fallback | WP-08 | Robust switching, fallback, focus, and shutdown |
| WP-10 | Compatibility, packaging, and release hardening | WP-06, WP-09 | Installable and validated Windows MVP |

WP-08 contains the highest technical risk. Its initial HWND proof of concept should be scheduled immediately after WP-01, even if the remaining packages continue in the order shown above.

## 5. Work Packages

### WP-01: Electron Foundation

**Goal:** Convert the prototype repository into a secure Electron development and build environment without changing the validated visual direction.

**Required work:**

- Add Electron main and preload entry points and connect them to the existing Vite renderer.
- Establish development, typecheck, test, build, and packaged-build commands.
- Enable context isolation and disable direct renderer Node.js access.
- Define typed IPC request, response, event, and error conventions with runtime payload validation.
- Establish module boundaries for shell services, repositories, app-host services, and renderer APIs.
- Add baseline unit/integration test infrastructure and a minimal Electron startup smoke check.
- Record final choices for Electron version, SQLite driver, native bridge, and packaging tool in an ADR or equivalent architecture note.

**Acceptance criteria:**

- Development mode starts one Electron shell displaying the existing renderer.
- A production renderer build loads without relying on the Vite development server.
- The renderer cannot import Node.js, Electron main-process APIs, or SQLite directly.
- A typed preload API can complete one validated request and return a structured error for invalid input.
- Typecheck, tests, and build pass from documented commands.

### WP-02: Quick-Panel Window Lifecycle

**Goal:** Implement the SmartSpace window behavior defined by the PRD.

**Required work:**

- Create the frameless or compact-title quick-panel window, always on top and excluded from the taskbar.
- Center first launch in the current primary work area.
- Register the default `Ctrl+Shift+Space` shortcut and support show, hide, and focus behavior.
- Surface shortcut conflicts without silently losing the previous valid registration.
- Hide the panel on blur when enabled and preserve it when the option is disabled.
- Ensure ordinary window close/minimize actions hide to tray rather than terminating the shell.

**Acceptance criteria:**

- The shortcut reliably toggles the panel and focuses it when already visible.
- First launch is centered and the panel does not appear in the taskbar.
- Blur behavior follows its setting.
- Shortcut conflicts are visible and leave a usable shortcut registered.
- Closing the visible panel does not end the Electron process.

### WP-03: Panel Layout, Tray, and Exit

**Goal:** Complete shell controls, layout persistence, and the single authoritative exit path.

**Required work:**

- Persist window position, size, display identity, and left/right split ratio.
- Clamp or recenter saved bounds when the saved display is unavailable or bounds are off-screen.
- Implement a visible draggable split affordance.
- Implement task-pane collapse/restore using the same SmartSpace title-bar control.
- Preserve category, tags, composer text, and task state while collapsed.
- Add tray actions for Show SmartSpace, Settings, launch-at-startup toggle, and Exit.
- Add title actions for Settings, hide-to-tray, and exit initiation.
- Route actual shell termination through one coordinated shutdown flow.

**Acceptance criteria:**

- Window bounds and split ratio survive restart and remain visible after monitor changes.
- Collapse/restore does not reset renderer state.
- Tray and title actions invoke the expected behavior.
- Only the explicit Exit flow terminates the shell process.

### WP-04: SQLite and Task Repository

**Goal:** Establish durable local persistence and complete task lifecycle operations.

**Required work:**

- Create database initialization, versioned migrations, transactions, and repository conventions.
- Implement the Category, Tag, Task, TaskTag, and HostedApp schema from the PRD.
- Seed initial categories without duplicating them on later launches.
- Implement task creation, list/query, completion, restoration, and permanent deletion.
- Enforce valid task titles, category references, status values, and timestamps.
- Expose task operations through validated main-process IPC.
- Add migration and repository tests using isolated temporary databases.

**Acceptance criteria:**

- Task data survives application and process restart.
- Completion and restoration maintain consistent timestamps and status.
- Invalid category references and malformed IPC payloads fail predictably.
- Migrations can initialize a new database and reopen an existing database safely.

### WP-05: Categories, Tags, and Settings Data

**Goal:** Complete the remaining persistence rules and user preferences.

**Required work:**

- Implement category create, rename, ordering, color, and confirmed deletion.
- Require category deletion to select or derive a valid remaining destination category and migrate tasks transactionally.
- Implement category-owned tag creation, rename, listing, and confirmed deletion.
- Remove deleted tag associations transactionally without deleting tasks.
- Implement combined category/tag task queries.
- Persist HostedApp records and shell settings, including shortcut, startup, blur behavior, and close-confirmation preference.
- Define duplicate-name, missing-record, and last-category behavior explicitly and test it.

**Acceptance criteria:**

- Category deletion cannot silently lose tasks.
- Tag deletion removes only the intended associations.
- Combined filters return the expected active or completed set.
- Hosted applications and settings survive restart.
- Repository operations are covered for success, validation failure, and transactional rollback.

### WP-06: Production Task Renderer

**Goal:** Replace prototype-only React state with the real preload API while preserving the approved interaction model.

**Required work:**

- Add application bootstrap and IPC-backed state/query handling.
- Implement visible loading, empty, error, retry, and mutation-pending states.
- Connect task create, complete, restore, and delete flows to persistence.
- Add inline task category and tag editing without a large modal.
- Connect category/tag management and deletion confirmations to persistence.
- Implement combined filters, completed view, and one-action filter clearing.
- Preserve keyboard navigation, visible focus, reduced motion, and both themes.
- Add component or integration tests for the primary task flows.

**Acceptance criteria:**

- Reloading or restarting shows persisted data rather than prototype fixtures.
- All task and filter acceptance criteria from the PRD work through IPC.
- Failed requests produce recoverable UI states and do not leave false optimistic state.
- Core flows are keyboard accessible and tested in light and dark themes.

### WP-07: Settings and App Registration

**Goal:** Deliver functional settings and registered application management.

**Required work:**

- Implement shortcut recording, validation, conflict feedback, and persistence.
- Implement launch-at-startup and hide-on-blur settings.
- Add an executable through a native file picker.
- Read and allow editing of display name; extract Windows icon/metadata when available.
- Persist executable path, icon cache path, process match hint, window-class hint, and close confirmation.
- Support editing and removing a registered application without terminating unrelated processes.
- Validate missing, moved, unreadable, and duplicate executable paths.

**Acceptance criteria:**

- Settings take effect and survive restart.
- A valid executable becomes an icon tab with a tooltip and process state.
- Invalid or missing executable paths show actionable errors.
- Renderer code never receives unrestricted filesystem access.

### WP-08: Native Window-Host Core

**Goal:** Prove and implement the minimum native bridge required to find, launch, and embed a compatible Windows application.

**Required work:**

- First produce a bounded HWND proof of concept using one simple compatible application.
- Implement process discovery using the stored matching hints.
- Enumerate and select appropriate top-level windows while avoiding invisible, owned, tool, and transient windows.
- Prefer adopting an existing matching process; otherwise launch the configured executable.
- Wait for a usable window with explicit timeout and cancellation behavior.
- Track PID, HWND, ownership source, original parent/style, and host state independently.
- Implement native operations for attach, detach, style changes, focus, visibility, and bounds.
- Restore original parent and styles before detaching or terminating where possible.
- Rebuild and load the native dependency for the selected Electron version.

**Acceptance criteria:**

- The proof-of-concept result and limitations are documented before full implementation proceeds.
- A compatible existing window can be adopted and an absent application can be launched.
- A compatible window is visibly embedded and can be detached without corrupting its normal window state.
- Search, launch, embed, and timeout failures are distinguishable.
- Native bridge failures cannot crash the renderer or silently present a blank host.

### WP-09: Hosted-App Lifecycle and Fallback

**Goal:** Turn basic embedding into a reliable multi-tab managed-application lifecycle.

**Required work:**

- Implement host states: `searching`, `launching`, `embedded`, `external`, `permission-required`, and `error`.
- Keep inactive processes alive while hiding their hosted windows.
- Synchronize bounds, visibility, focus, tab selection, panel movement, resizing, and task-pane collapse.
- Handle per-monitor DPI changes and document any unavoidable limitations.
- Detect higher-integrity targets and offer an elevated SmartSpace restart path.
- Fall back to an explicit independent desktop window when embedding is unsupported.
- Implement normal-close request, timeout, force-termination offer, and per-app confirmation.
- Coordinate application close, tab close, and full SmartSpace shutdown for adopted and launched processes.
- Add state-machine and lifecycle tests around cancellation, timeout, failure, and shutdown ordering.

**Acceptance criteria:**

- Switching tabs does not stop inactive processes.
- Unsupported applications show `独立窗口` and remain usable.
- Higher-integrity applications show `permission-required` instead of failing silently.
- Close behavior follows preferences and never force-terminates without an explicit permitted path.
- Managed windows do not remain incorrectly parented after normal shutdown where restoration is possible.

### WP-10: Compatibility, Packaging, and Release Hardening

**Goal:** Validate the stated MVP targets and produce an installable Windows release candidate.

**Required work:**

- Validate Token Monitor discovery, adoption/launch, embedding/fallback, tab switching, and close behavior.
- Validate CCSwitch using the same compatibility matrix.
- Validate Clash Verge, including its tray-first behavior, proxy-state implications, close confirmation, and force termination.
- Record application/version-specific process and window matching hints without claiming arbitrary executable compatibility.
- Configure Windows packaging, application metadata, icons, native-module rebuild, install, upgrade, and uninstall.
- Verify startup registration for packaged installations.
- Handle crash recovery and stale managed-window/process state where technically possible.
- Complete keyboard, focus, reduced-motion, light/dark theme, and DPI checks.
- Add automated coverage for critical repositories, IPC validation, shell lifecycle, and host state transitions.
- Run a packaged Windows smoke test and publish the compatibility matrix and known limitations.

**Acceptance criteria:**

- All MVP acceptance criteria in `PRD.md` have recorded evidence or a clearly approved exception.
- The installer works on a clean supported Windows environment.
- Native dependencies load in the packaged application.
- SQLite data survives restart and an application upgrade test.
- The three validation targets have individual, versioned compatibility results.
- Typecheck, automated tests, production build, and packaged smoke test pass.

## 6. Execution Protocol

Before implementation, the Agent must:

1. Confirm that the workspace is a Git repository with a known baseline; stop if a reliable diff boundary cannot be established.
2. Read `PRD.md`, this document, the latest `REVIEW_LOG.md` entry, and relevant source files.
3. Confirm the assigned work package and its dependency state.
4. Record the package ID and starting commit in `IMPLEMENTATION_HANDOFF.md`.
5. Stop and report ambiguity when a choice would change product behavior, data-loss policy, process-termination policy, or architectural boundaries.

After implementation, the Agent must:

1. Run all verification required by the package.
2. Review its own diff for accidental scope expansion and sensitive-data leakage.
3. Complete every applicable field in `IMPLEMENTATION_HANDOFF.md`.
4. Provide the exact commit or commit range for the Review Agent.
5. Leave package status as incomplete when any acceptance criterion remains unverified.

## 7. Review Protocol

The Review Agent should review the identified commit range rather than reanalyzing the entire repository. It may inspect dependencies outside the diff when required to prove a defect.

Review priority is:

1. Data loss, unintended process termination, security-boundary violations, and unrecoverable window state.
2. Functional regressions and unmet acceptance criteria.
3. Race conditions, lifecycle errors, invalid state transitions, and missing error handling.
4. Missing or ineffective tests.
5. Maintainability issues that create a concrete future defect risk.

Review findings and disposition belong in `REVIEW_LOG.md`; they must not rewrite the implementation Agent's factual handoff record.
