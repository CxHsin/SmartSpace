import { BrowserWindow, screen, type BrowserWindowConstructorOptions, type Rectangle } from 'electron';
import { join } from 'node:path';
import { createSecureRendererPreferences, isAllowedRendererNavigation } from './security';

export const DEFAULT_WINDOW_WIDTH = 1180;
export const DEFAULT_WINDOW_HEIGHT = 760;
export const MIN_WINDOW_WIDTH = 780;
export const MIN_WINDOW_HEIGHT = 520;

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
  // Relax the normal size below the configured minimum when the work area itself is smaller.
  const boundedWidth = Math.min(Math.max(1, width), Math.max(1, workArea.width));
  const boundedHeight = Math.min(Math.max(1, height), Math.max(1, workArea.height));

  return {
    x: workArea.x + Math.floor((workArea.width - boundedWidth) / 2),
    y: workArea.y + Math.floor((workArea.height - boundedHeight) / 2),
    width: boundedWidth,
    height: boundedHeight,
  };
}

export function createQuickPanelWindowOptions(
  preload: string,
  bounds: Pick<Rectangle, 'x' | 'y' | 'width' | 'height'>,
): BrowserWindowConstructorOptions {
  return {
    ...bounds,
    show: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minWidth: Math.min(MIN_WINDOW_WIDTH, bounds.width),
    minHeight: Math.min(MIN_WINDOW_HEIGHT, bounds.height),
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
