import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import {
  failure,
  IPC_CHANNELS,
  type AppInfoResponse,
  type IpcResponse,
  type ShortcutStatusEvent,
  type WindowSetHideOnBlurResponse,
} from '../../shared/ipc';
import {
  createAppInfoHandler,
  createLayoutGetHandler,
  createLayoutSetSplitRatioHandler,
  createSetHideOnBlurHandler,
  createStartupGetHandler,
  createStartupSetHandler,
  createWindowHideHandler,
  createWindowRequestExitHandler,
} from './handlers';

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

type AuthorizedHandler<TResponse> = (
  event: Pick<IpcMainInvokeEvent, 'sender'>,
  request: unknown,
) => Promise<IpcResponse<TResponse>>;

function authorize<TResponse>(
  handler: (request: unknown) => Promise<IpcResponse<TResponse>>,
  authorizedContents: WebContents,
): AuthorizedHandler<TResponse> {
  return async (event, request) => {
    if (event.sender !== authorizedContents) {
      return failure({
        code: 'unauthorized-sender',
        message: 'The IPC sender is not the active SmartSpace renderer.',
        details: { field: 'sender' },
      });
    }

    return handler(request);
  };
}

export interface ShellIpcHandlers {
  readonly hideWindow?: () => void;
  readonly setHideOnBlur?: (enabled: boolean) => void;
  readonly requestExit?: () => void;
  readonly getSplitRatio?: () => number;
  readonly setSplitRatio?: (ratio: number) => number;
  readonly getLaunchAtStartup?: () => boolean;
  readonly setLaunchAtStartup?: (enabled: boolean) => boolean;
}

export function registerIpcHandlers(
  provider: () => AppInfoResponse,
  authorizedContents: WebContents,
  handlers: ShellIpcHandlers = {},
): void {
  ipcMain.removeHandler(IPC_CHANNELS.appGetInfo);
  ipcMain.handle(IPC_CHANNELS.appGetInfo, createAuthorizedAppInfoHandler(provider, authorizedContents));

  if (handlers.hideWindow !== undefined) {
    ipcMain.removeHandler(IPC_CHANNELS.windowHide);
    ipcMain.handle(
      IPC_CHANNELS.windowHide,
      createAuthorizedWindowHideHandler(handlers.hideWindow, authorizedContents),
    );
  }

  if (handlers.setHideOnBlur !== undefined) {
    ipcMain.removeHandler(IPC_CHANNELS.windowSetHideOnBlur);
    ipcMain.handle(
      IPC_CHANNELS.windowSetHideOnBlur,
      createAuthorizedSetHideOnBlurHandler(handlers.setHideOnBlur, authorizedContents),
    );
  }

  const optionalHandlers: Array<[string, AuthorizedHandler<unknown> | undefined]> = [
    [
      IPC_CHANNELS.windowRequestExit,
      handlers.requestExit === undefined
        ? undefined
        : authorize(createWindowRequestExitHandler(handlers.requestExit), authorizedContents) as AuthorizedHandler<unknown>,
    ],
    [
      IPC_CHANNELS.layoutGet,
      handlers.getSplitRatio === undefined
        ? undefined
        : authorize(createLayoutGetHandler(handlers.getSplitRatio), authorizedContents) as AuthorizedHandler<unknown>,
    ],
    [
      IPC_CHANNELS.layoutSetSplitRatio,
      handlers.setSplitRatio === undefined
        ? undefined
        : authorize(createLayoutSetSplitRatioHandler(handlers.setSplitRatio), authorizedContents) as AuthorizedHandler<unknown>,
    ],
    [
      IPC_CHANNELS.startupGetLaunchAtStartup,
      handlers.getLaunchAtStartup === undefined
        ? undefined
        : authorize(createStartupGetHandler(handlers.getLaunchAtStartup), authorizedContents) as AuthorizedHandler<unknown>,
    ],
    [
      IPC_CHANNELS.startupSetLaunchAtStartup,
      handlers.setLaunchAtStartup === undefined
        ? undefined
        : authorize(createStartupSetHandler(handlers.setLaunchAtStartup), authorizedContents) as AuthorizedHandler<unknown>,
    ],
  ];

  for (const [channel, handler] of optionalHandlers) {
    if (handler === undefined) {
      continue;
    }

    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, handler);
  }
}

export function emitShellReady(contents: WebContents, version: string): void {
  contents.send(IPC_CHANNELS.shellReady, { version });
}

export function emitShortcutStatus(contents: WebContents, status: ShortcutStatusEvent): void {
  contents.send(IPC_CHANNELS.shellShortcutStatus, status);
}

export function emitSettingsRequested(contents: WebContents): void {
  contents.send(IPC_CHANNELS.shellSettingsRequested, { requested: true });
}

export function emitLaunchAtStartupChanged(contents: WebContents, enabled: boolean): void {
  contents.send(IPC_CHANNELS.shellLaunchAtStartupChanged, { enabled });
}
