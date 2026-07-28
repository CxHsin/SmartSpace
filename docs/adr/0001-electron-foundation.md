# ADR 0001: Electron Foundation Choices

- Status: Accepted for WP-01
- Date: 2026-07-28
- Scope: Electron foundation only

## Context

SmartSpace is a Windows desktop quick panel. Its renderer is an existing React/Vite application, while shell lifecycle, local persistence, and Windows window hosting must remain outside the renderer. WP-01 needs a runnable development and production build path without prematurely implementing task persistence or native hosting.

## Decisions

### Electron

Use Electron `43.2.0` with a CommonJS-built main process and preload script. The renderer is emitted as a separate Vite bundle. Browser windows use context isolation, sandboxing, disabled Node integration, enabled web security, and a narrow context-bridge API.

### SQLite driver

Use `better-sqlite3` for the future main-process repository layer. Its synchronous transaction model is a good fit for small local task operations, and keeping the driver behind repository interfaces avoids exposing database handles to IPC or the renderer. The dependency is intentionally deferred to WP-04, where migration, native rebuild, and isolated database testing are implemented together.

### Native bridge

Use `koffi` as the initial native bridge candidate for the WP-08 Win32 implementation. It provides maintained FFI access to the narrow Win32 calls needed for HWND discovery, parenting, styles, focus, and bounds without creating a custom C++ addon in WP-01. Exact Electron ABI loading, elevated-target behavior, and fallback behavior remain explicit WP-08 verification items. The dependency is deferred until that work begins.

### Packaging

Use `electron-builder` `26.15.3` for the project packaging entry point. WP-01 provides reproducible `package` and `package:dir` scripts and a Windows directory target. The installer target, signing, native-module rebuild, startup registration, install/upgrade/uninstall checks, and clean-machine smoke test belong to WP-10 and are not claimed here.

## Consequences

- `dist/renderer` and `dist/electron` can be built independently, and the Electron shell can load the renderer without a Vite server.
- Main/preload code is typechecked separately from the renderer and the renderer has no direct Node, Electron, or SQLite import path.
- Future native dependencies must be rebuilt and verified against Electron `43.2.0` before packaging.
- The current app-host and repository modules are contracts only; later packages own their implementations and tests.
