import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import {
  failure,
  IPC_CHANNELS,
  type AppInfoResponse,
  type IpcResponse,
  type ShortcutStatusEvent,
  type WindowSetHideOnBlurResponse,
} from '../../shared/ipc';
import { createAppInfoHandler, createSetHideOnBlurHandler, createWindowHideHandler } from './handlers';

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

export function createAuthorizedWindowHideHandler(
  hideWindow: () => void,
  authorizedContents: WebContents,
): (event: Pick<IpcMainInvokeEvent, 'sender'>, request: unknown) => Promise<IpcResponse<{ readonly hidden: true }>> {
  const handleWindowHide = createWindowHideHandler(hideWindow);

  return async (event, request) => {
    if (event.sender !== authorizedContents) {
      return failure({
        code: 'unauthorized-sender',
        message: 'The IPC sender is not the active SmartSpace renderer.',
        details: { field: 'sender' },
      });
    }

    return handleWindowHide(request);
  };
}

export function createAuthorizedSetHideOnBlurHandler(
  setHideOnBlur: (enabled: boolean) => void,
  authorizedContents: WebContents,
): (
  event: Pick<IpcMainInvokeEvent, 'sender'>,
  request: unknown,
) => Promise<IpcResponse<WindowSetHideOnBlurResponse>> {
  const handleSetHideOnBlur = createSetHideOnBlurHandler(setHideOnBlur);

  return async (event, request) => {
    if (event.sender !== authorizedContents) {
      return failure({
        code: 'unauthorized-sender',
        message: 'The IPC sender is not the active SmartSpace renderer.',
        details: { field: 'sender' },
      });
    }

    return handleSetHideOnBlur(request);
  };
}

export function registerIpcHandlers(
  provider: () => AppInfoResponse,
  authorizedContents: WebContents,
  hideWindow?: () => void,
  setHideOnBlur?: (enabled: boolean) => void,
): void {
  ipcMain.removeHandler(IPC_CHANNELS.appGetInfo);
  ipcMain.handle(IPC_CHANNELS.appGetInfo, createAuthorizedAppInfoHandler(provider, authorizedContents));

  if (hideWindow !== undefined) {
    ipcMain.removeHandler(IPC_CHANNELS.windowHide);
    ipcMain.handle(IPC_CHANNELS.windowHide, createAuthorizedWindowHideHandler(hideWindow, authorizedContents));
  }

  if (setHideOnBlur !== undefined) {
    ipcMain.removeHandler(IPC_CHANNELS.windowSetHideOnBlur);
    ipcMain.handle(
      IPC_CHANNELS.windowSetHideOnBlur,
      createAuthorizedSetHideOnBlurHandler(setHideOnBlur, authorizedContents),
    );
  }
}

export function emitShellReady(contents: WebContents, version: string): void {
  contents.send(IPC_CHANNELS.shellReady, { version });
}

export function emitShortcutStatus(contents: WebContents, status: ShortcutStatusEvent): void {
  contents.send(IPC_CHANNELS.shellShortcutStatus, status);
}
