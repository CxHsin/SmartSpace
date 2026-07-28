import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { failure, IPC_CHANNELS, type AppInfoResponse, type IpcResponse } from '../../shared/ipc';
import { createAppInfoHandler } from './handlers';

export function createAuthorizedAppInfoHandler(
  provider: () => AppInfoResponse,
  authorizedContents: WebContents,
): (event: Pick<IpcMainInvokeEvent, 'sender'>, request: unknown) => Promise<IpcResponse<AppInfoResponse>> {
  const handleAppInfo = createAppInfoHandler(provider);

  return async (event, request) => {
    if (event.sender !== authorizedContents) {
      return failure({
        code: 'unauthorized-sender',
        message: 'The IPC sender is not the active SmartSpace renderer.',
        details: { field: 'sender' },
      });
    }

    return handleAppInfo(request);
  };
}

export function registerIpcHandlers(provider: () => AppInfoResponse, authorizedContents: WebContents): void {
  ipcMain.removeHandler(IPC_CHANNELS.appGetInfo);
  ipcMain.handle(IPC_CHANNELS.appGetInfo, createAuthorizedAppInfoHandler(provider, authorizedContents));
}

export function emitShellReady(contents: WebContents, version: string): void {
  contents.send(IPC_CHANNELS.shellReady, { version });
}
