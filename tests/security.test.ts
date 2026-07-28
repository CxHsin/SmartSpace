import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSecureRendererPreferences, isAllowedRendererNavigation } from '../src/main/shell/security';

const projectRoot = resolve(import.meta.dirname, '..');

describe('Electron renderer boundary', () => {
  it('uses context isolation, sandboxing, and no Node integration', () => {
    expect(createSecureRendererPreferences('preload.cjs')).toEqual({
      preload: 'preload.cjs',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    });
  });

  it('allows only the configured renderer URL or file', () => {
    expect(
      isAllowedRendererNavigation(
        'http://127.0.0.1:5173/',
        'C:/SmartSpace/dist/renderer/index.html',
        'http://127.0.0.1:5173',
      ),
    ).toBe(true);
    expect(
      isAllowedRendererNavigation(
        'http://127.0.0.1:51730/',
        'C:/SmartSpace/dist/renderer/index.html',
        'http://127.0.0.1:5173',
      ),
    ).toBe(false);
    expect(
      isAllowedRendererNavigation(
        'https://example.invalid/',
        'C:/SmartSpace/dist/renderer/index.html',
        'http://127.0.0.1:5173',
      ),
    ).toBe(false);
    expect(
      isAllowedRendererNavigation(
        'file:///C:/SmartSpace/dist/renderer/index.html',
        'C:\\SmartSpace\\dist\\renderer\\index.html',
      ),
    ).toBe(true);
  });

  it('keeps Node, Electron, and SQLite imports out of renderer modules', () => {
    const rendererFiles = ['src/main.tsx', 'src/App.tsx', 'src/motion.tsx'];
    for (const relativePath of rendererFiles) {
      const source = readFileSync(resolve(projectRoot, relativePath), 'utf8');
      expect(source).not.toMatch(/from\s+['"](?:electron|node:|sqlite|better-sqlite3)/);
    }
  });

  it('exposes only the typed bridge from preload', () => {
    const preload = readFileSync(resolve(projectRoot, 'src/preload/preload.ts'), 'utf8');
    expect(preload).toContain("contextBridge.exposeInMainWorld('smartSpace', api)");
    expect(preload).not.toContain("exposeInMainWorld('electron'");
    expect(preload).not.toContain("exposeInMainWorld('require'");
  });
});
