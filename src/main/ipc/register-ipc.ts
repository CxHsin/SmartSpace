import { ipcMain, type WebContents } from 'electron';
import { IPC_CHANNELS, type AppInfoResponse } from '../../shared/ipc';
import { createAppInfoHandler } from './handlers';

export function registerIpcHandlers(provider: () => AppInfoResponse): void {
  ipcMain.removeHandler(IPC_CHANNELS.appGetInfo);
  const handleAppInfo = createAppInfoHandler(provider);
  ipcMain.handle(IPC_CHANNELS.appGetInfo, (_event, request: unknown) => handleAppInfo(request));
}

export function emitShellReady(contents: WebContents, version: string): void {
  contents.send(IPC_CHANNELS.shellReady, { version });
}
