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
