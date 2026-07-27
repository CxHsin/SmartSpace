# SmartSpace

SmartSpace is a local-first Windows desktop workspace for tasks and embedded traditional desktop applications.

## Prerequisites

- Node.js 24 or later
- npm 11 or later
- Rust stable and the Windows build tools for Tauri commands

## Commands

```powershell
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run format
npm run format:rust
npm run test:rust
npm run lint:rust
npm run tauri:check
```

The first module only establishes the application shell and architecture boundaries. Task management, local storage, tray controls, global shortcuts, and desktop-window embedding are implemented in later modules.
