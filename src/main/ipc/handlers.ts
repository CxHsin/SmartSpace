import {
  failure,
  parseAppInfoRequest,
  parseWindowHideRequest,
  parseWindowSetHideOnBlurRequest,
  success,
  type AppInfoRequest,
  type AppInfoResponse,
  type IpcResponse,
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
