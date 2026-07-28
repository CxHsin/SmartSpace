import { app, type BrowserWindow } from 'electron';
import { emitShellReady, registerIpcHandlers } from './ipc/register-ipc';
import { createMainWindow } from './shell/create-main-window';
import { parseAppInfoResponse } from '../shared/ipc';

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
  registerIpcHandlers(createAppInfo, window.webContents);
  window.webContents.once('did-finish-load', () => {
    if (process.env.SMARTSPACE_SMOKE_TEST === '1') {
      void runStartupSmokeCheck(window);
      return;
    }

    emitShellReady(window.webContents, app.getVersion());
  });
}

app.whenReady().then(boot).catch(() => app.exit(1));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
