export const IPC_CHANNELS = {
  appGetInfo: 'app:get-info',
  shellReady: 'shell:ready',
  shellShortcutStatus: 'shell:shortcut-status',
  windowHide: 'window:hide',
  windowSetHideOnBlur: 'window:set-hide-on-blur',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export type EmptyIpcRequest = Readonly<Record<string, never>>;
export type AppInfoRequest = EmptyIpcRequest;
export type WindowHideRequest = EmptyIpcRequest;

export interface WindowSetHideOnBlurRequest {
  readonly enabled: boolean;
}

export interface AppInfoResponse {
  readonly name: string;
  readonly version: string;
}

export interface ShellReadyEvent {
  readonly version: string;
}

export interface ShortcutStatusEvent {
  readonly shortcut: string;
  readonly state: 'registered' | 'conflict';
  readonly activeShortcut: string | null;
  readonly message: string | null;
}

export interface WindowHideResponse {
  readonly hidden: true;
}

export interface WindowSetHideOnBlurResponse {
  readonly hideOnBlur: boolean;
}

export type IpcErrorCode = 'invalid-input' | 'unauthorized-sender' | 'internal-error' | 'transport-error';

export interface IpcError {
  readonly code: IpcErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, string>>;
}

export type IpcResponse<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: IpcError };

export interface IpcRequestMap {
  readonly [IPC_CHANNELS.appGetInfo]: AppInfoRequest;
  readonly [IPC_CHANNELS.windowHide]: WindowHideRequest;
  readonly [IPC_CHANNELS.windowSetHideOnBlur]: WindowSetHideOnBlurRequest;
}

export interface IpcResponseMap {
  readonly [IPC_CHANNELS.appGetInfo]: AppInfoResponse;
  readonly [IPC_CHANNELS.windowHide]: WindowHideResponse;
  readonly [IPC_CHANNELS.windowSetHideOnBlur]: WindowSetHideOnBlurResponse;
}

export interface IpcEventMap {
  readonly [IPC_CHANNELS.shellReady]: ShellReadyEvent;
  readonly [IPC_CHANNELS.shellShortcutStatus]: ShortcutStatusEvent;
}

export type IpcRequest<C extends keyof IpcRequestMap = keyof IpcRequestMap> = {
  readonly channel: C;
  readonly payload: IpcRequestMap[C];
};

export type IpcResponseEnvelope<C extends keyof IpcResponseMap = keyof IpcResponseMap> = {
  readonly channel: C;
  readonly response: IpcResponse<IpcResponseMap[C]>;
};

export type IpcEvent<C extends keyof IpcEventMap = keyof IpcEventMap> = {
  readonly channel: C;
  readonly payload: IpcEventMap[C];
};

export interface SmartSpaceApi {
  readonly app: {
    readonly getInfo: (request: AppInfoRequest) => Promise<IpcResponse<AppInfoResponse>>;
  };
  readonly window: {
    readonly hide: (request: WindowHideRequest) => Promise<IpcResponse<WindowHideResponse>>;
    readonly setHideOnBlur: (
      request: WindowSetHideOnBlurRequest,
    ) => Promise<IpcResponse<WindowSetHideOnBlurResponse>>;
  };
  readonly events: {
    readonly onShellReady: (listener: (event: ShellReadyEvent) => void) => () => void;
    readonly onShortcutStatus: (listener: (event: ShortcutStatusEvent) => void) => () => void;
  };
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: IpcError };

export function success<T>(value: T): IpcResponse<T> {
  return { ok: true, value };
}

export function failure<T = never>(error: IpcError): IpcResponse<T> {
  return { ok: false, error };
}

export function invalidInput(message: string, field = 'request'): IpcError {
  return {
    code: 'invalid-input',
    message,
    details: { field },
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseAppInfoRequest(value: unknown): ValidationResult<AppInfoRequest> {
  if (!isRecord(value) || Object.keys(value).length !== 0) {
    return {
      ok: false,
      error: invalidInput('The app info request must be an empty object.'),
    };
  }

  return { ok: true, value: {} };
}

export function isAppInfoResponse(value: unknown): value is AppInfoResponse {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    typeof value.version === 'string' &&
    value.version.length > 0
  );
}

export function isIpcError(value: unknown): value is IpcError {
  return (
    isRecord(value) &&
    (value.code === 'invalid-input' ||
      value.code === 'unauthorized-sender' ||
      value.code === 'internal-error' ||
      value.code === 'transport-error') &&
    typeof value.message === 'string' &&
    (value.details === undefined ||
      (isRecord(value.details) &&
        Object.values(value.details).every((detail) => typeof detail === 'string')))
  );
}

export function parseAppInfoResponse(value: unknown): IpcResponse<AppInfoResponse> {
  if (!isRecord(value)) {
    return failure({
      code: 'transport-error',
      message: 'The app info response was not an object.',
    });
  }

  if (value.ok === true && isAppInfoResponse(value.value)) {
    return success(value.value);
  }

  if (value.ok === false && isIpcError(value.error)) {
    return failure(value.error);
  }

  return failure({
    code: 'transport-error',
    message: 'The app info response did not match the IPC contract.',
  });
}

export function parseShellReadyEvent(value: unknown): ValidationResult<ShellReadyEvent> {
  if (!isRecord(value) || typeof value.version !== 'string' || value.version.length === 0) {
    return {
      ok: false,
      error: {
        code: 'transport-error',
        message: 'The shell-ready event did not match the IPC contract.',
      },
    };
  }

  return { ok: true, value: { version: value.version } };
}

export function parseShortcutStatusEvent(value: unknown): ValidationResult<ShortcutStatusEvent> {
  if (
    !isRecord(value) ||
    typeof value.shortcut !== 'string' ||
    value.shortcut.length === 0 ||
    (value.state !== 'registered' && value.state !== 'conflict') ||
    (value.activeShortcut !== null && typeof value.activeShortcut !== 'string') ||
    (value.message !== null && typeof value.message !== 'string')
  ) {
    return {
      ok: false,
      error: {
        code: 'transport-error',
        message: 'The shortcut status event did not match the IPC contract.',
      },
    };
  }

  return {
    ok: true,
    value: {
      shortcut: value.shortcut,
      state: value.state,
      activeShortcut: value.activeShortcut,
      message: value.message,
    },
  };
}

export function parseWindowHideRequest(value: unknown): ValidationResult<WindowHideRequest> {
  if (!isRecord(value) || Object.keys(value).length !== 0) {
    return {
      ok: false,
      error: invalidInput('The window hide request must be an empty object.'),
    };
  }

  return { ok: true, value: {} };
}

export function parseWindowHideResponse(value: unknown): IpcResponse<WindowHideResponse> {
  if (!isRecord(value)) {
    return failure({
      code: 'transport-error',
      message: 'The window hide response was not an object.',
    });
  }

  if (value.ok === true && isRecord(value.value) && value.value.hidden === true) {
    return success({ hidden: true });
  }

  if (value.ok === false && isIpcError(value.error)) {
    return failure(value.error);
  }

  return failure({
    code: 'transport-error',
    message: 'The window hide response did not match the IPC contract.',
  });
}

export function parseWindowSetHideOnBlurRequest(
  value: unknown,
): ValidationResult<WindowSetHideOnBlurRequest> {
  if (!isRecord(value) || Object.keys(value).length !== 1 || typeof value.enabled !== 'boolean') {
    return {
      ok: false,
      error: invalidInput('The hide-on-blur request must contain one boolean enabled field.'),
    };
  }

  return { ok: true, value: { enabled: value.enabled } };
}

export function parseWindowSetHideOnBlurResponse(
  value: unknown,
): IpcResponse<WindowSetHideOnBlurResponse> {
  if (!isRecord(value)) {
    return failure({
      code: 'transport-error',
      message: 'The hide-on-blur response was not an object.',
    });
  }

  if (value.ok === true && isRecord(value.value) && typeof value.value.hideOnBlur === 'boolean') {
    return success({ hideOnBlur: value.value.hideOnBlur });
  }

  if (value.ok === false && isIpcError(value.error)) {
    return failure(value.error);
  }

  return failure({
    code: 'transport-error',
    message: 'The hide-on-blur response did not match the IPC contract.',
  });
}
