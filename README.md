# SmartSpace

SmartSpace is a Windows quick-panel concept that combines a compact local task list with a host surface for frequently used desktop applications.

## Current deliverables

- Product requirements: [docs/PRD.md](docs/PRD.md)
- Interactive React UI prototype
- Task creation, completion, filtering, app tabs, settings, themes, and close confirmation flows
- Amicro-inspired motion patterns with reduced-motion support

The current app-host surface is a UI prototype. It does not yet launch or embed real Windows processes. Native `HWND` integration is planned for the Electron implementation phase described in the PRD.

## Run locally

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run build
```

## Electron foundation

SmartSpace now has a secure Electron shell around the existing Vite renderer. The renderer receives only the typed `window.smartSpace` preload API; the main process owns shell and IPC work, while repository and app-host contracts remain isolated for later work packages.

### Commands

```powershell
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run start
npm run smoke:electron
npm run package:dir
npm run package
```

`npm run dev` builds the Electron entry points, starts Vite on `127.0.0.1:5173`, and launches one Electron shell. `npm run build` emits the production renderer and Electron bundles. `smoke:electron` builds first, then starts the production shell with a hidden smoke window and verifies that the preload bridge completes the app-info request. Packaging commands are foundation-level entry points; packaged Windows compatibility and installer validation are WP-10 work.

The architecture choices are recorded in [ADR 0001](docs/adr/0001-electron-foundation.md).
