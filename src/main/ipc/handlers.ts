import {
  failure,
  parseAppInfoRequest,
  parseLayoutGetRequest,
  parseLayoutSetSplitRatioRequest,
  parseStartupGetLaunchAtStartupRequest,
  parseStartupSetLaunchAtStartupRequest,
  parseWindowRequestExitRequest,
  parseWindowHideRequest,
  parseWindowSetHideOnBlurRequest,
  success,
  type AppInfoRequest,
  type AppInfoResponse,
  type LayoutGetResponse,
  type LayoutSetSplitRatioResponse,
  type IpcResponse,
  type StartupGetLaunchAtStartupResponse,
  type StartupSetLaunchAtStartupResponse,
  type WindowRequestExitResponse,
  type WindowHideResponse,
  type WindowSetHideOnBlurResponse,
} from '../../shared/ipc';

export type AppInfoProvider = () => AppInfoResponse;

export function createAppInfoHandler(provider: AppInfoProvider) {
  return async (request: unknown): Promise<IpcResponse<AppInfoResponse>> => {
    const parsedRequest = parseAppInfoRequest(request);
    if (!parsedRequest.ok) {
      return failure(parsedRequest.error);
    }

    try {
      return success(provider());
    } catch {
      return failure({
        code: 'internal-error',
        message: 'The app information service failed.',
      });
    }
  };
}

export function makeEmptyAppInfoRequest(): AppInfoRequest {
  return {};
}

export function createWindowHideHandler(hideWindow: () => void) {
  return async (request: unknown): Promise<IpcResponse<WindowHideResponse>> => {
    const parsedRequest = parseWindowHideRequest(request);
    if (!parsedRequest.ok) {
      return failure(parsedRequest.error);
    }

    try {
      hideWindow();
      return success({ hidden: true });
    } catch {
      return failure({
        code: 'internal-error',
        message: 'The SmartSpace window could not be hidden.',
      });
    }
  };
}

export function createSetHideOnBlurHandler(setHideOnBlur: (enabled: boolean) => void) {
  return async (request: unknown): Promise<IpcResponse<WindowSetHideOnBlurResponse>> => {
    const parsedRequest = parseWindowSetHideOnBlurRequest(request);
    if (!parsedRequest.ok) {
      return failure(parsedRequest.error);
    }

    try {
      setHideOnBlur(parsedRequest.value.enabled);
      return success({ hideOnBlur: parsedRequest.value.enabled });
    } catch {
      return failure({
        code: 'internal-error',
        message: 'The hide-on-blur setting could not be applied.',
      });
    }
  };
}

export function createWindowRequestExitHandler(requestExit: () => void) {
  return async (request: unknown): Promise<IpcResponse<WindowRequestExitResponse>> => {
    const parsedRequest = parseWindowRequestExitRequest(request);
    if (!parsedRequest.ok) {
      return failure(parsedRequest.error);
    }

    try {
      requestExit();
      return success({ exiting: true });
    } catch {
      return failure({
        code: 'internal-error',
        message: 'The SmartSpace shutdown request could not be started.',
      });
    }
  };
}

export function createLayoutGetHandler(getSplitRatio: () => number) {
  return async (request: unknown): Promise<IpcResponse<LayoutGetResponse>> => {
    const parsedRequest = parseLayoutGetRequest(request);
    if (!parsedRequest.ok) {
      return failure(parsedRequest.error);
    }

    try {
      return success({ splitRatio: getSplitRatio() });
    } catch {
      return failure({ code: 'internal-error', message: 'The window layout could not be read.' });
    }
  };
}

export function createLayoutSetSplitRatioHandler(setSplitRatio: (ratio: number) => number) {
  return async (request: unknown): Promise<IpcResponse<LayoutSetSplitRatioResponse>> => {
    const parsedRequest = parseLayoutSetSplitRatioRequest(request);
    if (!parsedRequest.ok) {
      return failure(parsedRequest.error);
    }

    try {
      return success({ splitRatio: setSplitRatio(parsedRequest.value.ratio) });
    } catch {
      return failure({ code: 'internal-error', message: 'The window split ratio could not be saved.' });
    }
  };
}

export function createStartupGetHandler(getLaunchAtStartup: () => boolean) {
  return async (request: unknown): Promise<IpcResponse<StartupGetLaunchAtStartupResponse>> => {
    const parsedRequest = parseStartupGetLaunchAtStartupRequest(request);
    if (!parsedRequest.ok) {
      return failure(parsedRequest.error);
    }

    try {
      return success({ enabled: getLaunchAtStartup() });
    } catch {
      return failure({ code: 'internal-error', message: 'The startup setting could not be read.' });
    }
  };
}

export function createStartupSetHandler(setLaunchAtStartup: (enabled: boolean) => boolean) {
  return async (request: unknown): Promise<IpcResponse<StartupSetLaunchAtStartupResponse>> => {
    const parsedRequest = parseStartupSetLaunchAtStartupRequest(request);
    if (!parsedRequest.ok) {
      return failure(parsedRequest.error);
    }

    try {
      return success({ enabled: setLaunchAtStartup(parsedRequest.value.enabled) });
    } catch {
      return failure({ code: 'internal-error', message: 'The startup setting could not be changed.' });
    }
  };
}
