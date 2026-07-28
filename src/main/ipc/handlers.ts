import {
  failure,
  parseAppInfoRequest,
  success,
  type AppInfoRequest,
  type AppInfoResponse,
  type IpcResponse,
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
