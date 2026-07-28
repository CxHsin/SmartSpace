import { app, type BrowserWindow } from 'electron';
import { emitShortcutStatus, emitShellReady, registerIpcHandlers } from './ipc/register-ipc';
import { createMainWindow } from './shell/create-main-window';
import { DEFAULT_QUICK_PANEL_SHORTCUT, QuickPanelController } from './shell/quick-panel-controller';
import { parseAppInfoResponse } from '../shared/ipc';

let quickPanelController: QuickPanelController | undefined;

function createAppInfo() {
  return {
    name: app.getName(),
    version: app.getVersion(),
  };
}

async function runStartupSmokeCheck(window: BrowserWindow): Promise<void> {
  try {
    const response = await window.webContents.executeJavaScript(
      `window.smartSpace?.app.getInfo({}) ?? null`,
      true,
    );
    const parsedResponse = parseAppInfoResponse(response);
    app.exit(parsedResponse.ok ? 0 : 1);
  } catch {
    app.exit(1);
  }
}

function boot(): void {
  const window = createMainWindow();
  const controller = new QuickPanelController(window);
  quickPanelController = controller;
  let rendererReady = false;

  registerIpcHandlers(
    createAppInfo,
    window.webContents,
    () => controller.hide(),
    (enabled) => controller.setHideOnBlur(enabled),
  );
  controller.onShortcutStatus((status) => {
    if (rendererReady && !window.isDestroyed() && !window.webContents.isDestroyed()) {
      emitShortcutStatus(window.webContents, status);
    }
  });
  const shortcutRegistered = controller.registerShortcut(DEFAULT_QUICK_PANEL_SHORTCUT);
  if (!shortcutRegistered && controller.getShortcutStatus()?.activeShortcut === null) {
    controller.showAndFocus();
  }

  window.webContents.once('did-finish-load', () => {
    rendererReady = true;
    if (process.env.SMARTSPACE_SMOKE_TEST === '1') {
      void runStartupSmokeCheck(window);
      return;
    }

    emitShellReady(window.webContents, app.getVersion());
    const shortcutStatus = controller.getShortcutStatus();
    if (shortcutStatus !== null) {
      emitShortcutStatus(window.webContents, shortcutStatus);
    }
  });
}

app.whenReady().then(boot).catch(() => app.exit(1));

app.on('before-quit', () => {
  quickPanelController?.beginQuit();
});

app.on('will-quit', () => {
  quickPanelController?.dispose();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
