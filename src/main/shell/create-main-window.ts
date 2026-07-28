import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { createSecureRendererPreferences, isAllowedRendererNavigation } from './security';

export interface MainWindowPaths {
  readonly preload: string;
  readonly renderer: string;
}

export function getMainWindowPaths(moduleDirectory: string): MainWindowPaths {
  return {
    preload: join(moduleDirectory, 'preload.cjs'),
    renderer: join(moduleDirectory, '..', 'renderer', 'index.html'),
  };
}

export function createMainWindow(): BrowserWindow {
  const paths = getMainWindowPaths(__dirname);
  const developmentUrl = process.env.SMARTSPACE_DEV_SERVER_URL || undefined;
  const smokeTest = process.env.SMARTSPACE_SMOKE_TEST === '1';
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    show: !smokeTest,
    webPreferences: createSecureRendererPreferences(paths.preload),
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedRendererNavigation(url, paths.renderer, developmentUrl)) {
      event.preventDefault();
    }
  });

  if (developmentUrl !== undefined) {
    void mainWindow.loadURL(developmentUrl);
  } else {
    void mainWindow.loadFile(paths.renderer);
  }

  return mainWindow;
}
