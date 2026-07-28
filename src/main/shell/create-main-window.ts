import { BrowserWindow, screen, type BrowserWindowConstructorOptions, type Rectangle } from 'electron';
import { join } from 'node:path';
import { createSecureRendererPreferences, isAllowedRendererNavigation } from './security';

export const DEFAULT_WINDOW_WIDTH = 1180;
export const DEFAULT_WINDOW_HEIGHT = 760;

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

export function getCenteredWindowBounds(
  workArea: Rectangle,
  width = DEFAULT_WINDOW_WIDTH,
  height = DEFAULT_WINDOW_HEIGHT,
): Pick<Rectangle, 'x' | 'y' | 'width' | 'height'> {
  return {
    x: workArea.x + Math.max(0, Math.floor((workArea.width - width) / 2)),
    y: workArea.y + Math.max(0, Math.floor((workArea.height - height) / 2)),
    width,
    height,
  };
}

export function createQuickPanelWindowOptions(
  preload: string,
  bounds: Pick<Rectangle, 'x' | 'y' | 'width' | 'height'>,
): BrowserWindowConstructorOptions {
  return {
    ...bounds,
    minWidth: 780,
    minHeight: 520,
    show: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    backgroundColor: '#151719',
    webPreferences: createSecureRendererPreferences(preload),
  };
}

export function createMainWindow(): BrowserWindow {
  const paths = getMainWindowPaths(__dirname);
  const developmentUrl = process.env.SMARTSPACE_DEV_SERVER_URL || undefined;
  const workArea = screen.getPrimaryDisplay().workArea;
  const bounds = getCenteredWindowBounds(workArea);
  const mainWindow = new BrowserWindow(createQuickPanelWindowOptions(paths.preload, bounds));
  mainWindow.setAlwaysOnTop(true, 'floating');

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
