export const IPC_CHANNELS = {
  appGetInfo: 'app:get-info',
  shellReady: 'shell:ready',
  shellShortcutStatus: 'shell:shortcut-status',
  shellSettingsRequested: 'shell:settings-requested',
  shellLaunchAtStartupChanged: 'shell:launch-at-startup-changed',
  windowHide: 'window:hide',
  windowSetHideOnBlur: 'window:set-hide-on-blur',
  windowRequestExit: 'window:request-exit',
  layoutGet: 'layout:get',
  layoutSetSplitRatio: 'layout:set-split-ratio',
  startupGetLaunchAtStartup: 'startup:get-launch-at-startup',
  startupSetLaunchAtStartup: 'startup:set-launch-at-startup',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export type EmptyIpcRequest = Readonly<Record<string, never>>;
export type AppInfoRequest = EmptyIpcRequest;
export type WindowHideRequest = EmptyIpcRequest;

export interface WindowSetHideOnBlurRequest {
  readonly enabled: boolean;
}

export type WindowRequestExitRequest = EmptyIpcRequest;
export type LayoutGetRequest = EmptyIpcRequest;
export type StartupGetLaunchAtStartupRequest = EmptyIpcRequest;

export interface LayoutSetSplitRatioRequest {
  readonly ratio: number;
}

export interface StartupSetLaunchAtStartupRequest {
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

export interface WindowRequestExitResponse {
  readonly exiting: true;
}

export interface LayoutGetResponse {
  readonly splitRatio: number;
}

export interface LayoutSetSplitRatioResponse {
  readonly splitRatio: number;
}

export interface StartupGetLaunchAtStartupResponse {
  readonly enabled: boolean;
}

export interface StartupSetLaunchAtStartupResponse {
  readonly enabled: boolean;
}

export interface SettingsRequestedEvent {
  readonly requested: true;
}

export interface LaunchAtStartupChangedEvent {
  readonly enabled: boolean;
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
  readonly [IPC_CHANNELS.windowRequestExit]: WindowRequestExitRequest;
  readonly [IPC_CHANNELS.layoutGet]: LayoutGetRequest;
  readonly [IPC_CHANNELS.layoutSetSplitRatio]: LayoutSetSplitRatioRequest;
  readonly [IPC_CHANNELS.startupGetLaunchAtStartup]: StartupGetLaunchAtStartupRequest;
  readonly [IPC_CHANNELS.startupSetLaunchAtStartup]: StartupSetLaunchAtStartupRequest;
}

export interface IpcResponseMap {
  readonly [IPC_CHANNELS.appGetInfo]: AppInfoResponse;
  readonly [IPC_CHANNELS.windowHide]: WindowHideResponse;
  readonly [IPC_CHANNELS.windowSetHideOnBlur]: WindowSetHideOnBlurResponse;
  readonly [IPC_CHANNELS.windowRequestExit]: WindowRequestExitResponse;
  readonly [IPC_CHANNELS.layoutGet]: LayoutGetResponse;
  readonly [IPC_CHANNELS.layoutSetSplitRatio]: LayoutSetSplitRatioResponse;
  readonly [IPC_CHANNELS.startupGetLaunchAtStartup]: StartupGetLaunchAtStartupResponse;
  readonly [IPC_CHANNELS.startupSetLaunchAtStartup]: StartupSetLaunchAtStartupResponse;
}

export interface IpcEventMap {
  readonly [IPC_CHANNELS.shellReady]: ShellReadyEvent;
  readonly [IPC_CHANNELS.shellShortcutStatus]: ShortcutStatusEvent;
  readonly [IPC_CHANNELS.shellSettingsRequested]: SettingsRequestedEvent;
  readonly [IPC_CHANNELS.shellLaunchAtStartupChanged]: LaunchAtStartupChangedEvent;
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
    readonly requestExit: (
      request: WindowRequestExitRequest,
    ) => Promise<IpcResponse<WindowRequestExitResponse>>;
  };
  readonly layout: {
    readonly get: (request: LayoutGetRequest) => Promise<IpcResponse<LayoutGetResponse>>;
    readonly setSplitRatio: (
      request: LayoutSetSplitRatioRequest,
    ) => Promise<IpcResponse<LayoutSetSplitRatioResponse>>;
  };
  readonly startup: {
    readonly getLaunchAtStartup: (
      request: StartupGetLaunchAtStartupRequest,
    ) => Promise<IpcResponse<StartupGetLaunchAtStartupResponse>>;
    readonly setLaunchAtStartup: (
      request: StartupSetLaunchAtStartupRequest,
    ) => Promise<IpcResponse<StartupSetLaunchAtStartupResponse>>;
  };
  readonly events: {
    readonly onShellReady: (listener: (event: ShellReadyEvent) => void) => () => void;
    readonly onShortcutStatus: (listener: (event: ShortcutStatusEvent) => void) => () => void;
    readonly onSettingsRequested: (listener: (event: SettingsRequestedEvent) => void) => () => void;
    readonly onLaunchAtStartupChanged: (
      listener: (event: LaunchAtStartupChangedEvent) => void,
    ) => () => void;
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

function parseEmptyRequest(value: unknown, message: string): ValidationResult<EmptyIpcRequest> {
  if (!isRecord(value) || Object.keys(value).length !== 0) {
    return { ok: false, error: invalidInput(message) };
  }

  return { ok: true, value: {} };
}

function parseBooleanResponse(value: unknown, message: string): IpcResponse<{ readonly enabled: boolean }> {
  if (!isRecord(value)) {
    return failure({ code: 'transport-error', message: `${message} response was not an object.` });
  }

  if (value.ok === true && isRecord(value.value) && typeof value.value.enabled === 'boolean') {
    return success({ enabled: value.value.enabled });
  }

  if (value.ok === false && isIpcError(value.error)) {
    return failure(value.error);
  }

  return failure({ code: 'transport-error', message: `${message} response did not match the IPC contract.` });
}

export function parseWindowRequestExitRequest(value: unknown): ValidationResult<WindowRequestExitRequest> {
  return parseEmptyRequest(value, 'The window exit request must be an empty object.');
}

export function parseWindowRequestExitResponse(value: unknown): IpcResponse<WindowRequestExitResponse> {
  if (!isRecord(value)) {
    return failure({ code: 'transport-error', message: 'The window exit response was not an object.' });
  }

  if (value.ok === true && isRecord(value.value) && value.value.exiting === true) {
    return success({ exiting: true });
  }

  if (value.ok === false && isIpcError(value.error)) {
    return failure(value.error);
  }

  return failure({ code: 'transport-error', message: 'The window exit response did not match the IPC contract.' });
}

export function parseLayoutGetRequest(value: unknown): ValidationResult<LayoutGetRequest> {
  return parseEmptyRequest(value, 'The layout get request must be an empty object.');
}

export function parseLayoutGetResponse(value: unknown): IpcResponse<LayoutGetResponse> {
  if (!isRecord(value)) {
    return failure({ code: 'transport-error', message: 'The layout response was not an object.' });
  }

  if (
    value.ok === true
    && isRecord(value.value)
    && typeof value.value.splitRatio === 'number'
    && Number.isFinite(value.value.splitRatio)
    && value.value.splitRatio > 0
    && value.value.splitRatio < 1
  ) {
    return success({ splitRatio: value.value.splitRatio });
  }

  if (value.ok === false && isIpcError(value.error)) {
    return failure(value.error);
  }

  return failure({ code: 'transport-error', message: 'The layout response did not match the IPC contract.' });
}

export function parseLayoutSetSplitRatioRequest(
  value: unknown,
): ValidationResult<LayoutSetSplitRatioRequest> {
  if (
    !isRecord(value)
    || Object.keys(value).length !== 1
    || typeof value.ratio !== 'number'
    || !Number.isFinite(value.ratio)
  ) {
    return { ok: false, error: invalidInput('The split ratio request must contain one finite numeric ratio field.') };
  }

  return { ok: true, value: { ratio: value.ratio } };
}

export function parseLayoutSetSplitRatioResponse(
  value: unknown,
): IpcResponse<LayoutSetSplitRatioResponse> {
  return parseLayoutGetResponse(value);
}

export function parseStartupGetLaunchAtStartupRequest(
  value: unknown,
): ValidationResult<StartupGetLaunchAtStartupRequest> {
  return parseEmptyRequest(value, 'The startup get request must be an empty object.');
}

export function parseStartupGetLaunchAtStartupResponse(
  value: unknown,
): IpcResponse<StartupGetLaunchAtStartupResponse> {
  return parseBooleanResponse(value, 'The startup get');
}

export function parseStartupSetLaunchAtStartupRequest(
  value: unknown,
): ValidationResult<StartupSetLaunchAtStartupRequest> {
  if (!isRecord(value) || Object.keys(value).length !== 1 || typeof value.enabled !== 'boolean') {
    return { ok: false, error: invalidInput('The startup set request must contain one boolean enabled field.') };
  }

  return { ok: true, value: { enabled: value.enabled } };
}

export function parseStartupSetLaunchAtStartupResponse(
  value: unknown,
): IpcResponse<StartupSetLaunchAtStartupResponse> {
  return parseBooleanResponse(value, 'The startup set');
}

export function parseSettingsRequestedEvent(value: unknown): ValidationResult<SettingsRequestedEvent> {
  if (!isRecord(value) || value.requested !== true) {
    return {
      ok: false,
      error: { code: 'transport-error', message: 'The settings request event did not match the IPC contract.' },
    };
  }

  return { ok: true, value: { requested: true } };
}

export function parseLaunchAtStartupChangedEvent(value: unknown): ValidationResult<LaunchAtStartupChangedEvent> {
  if (!isRecord(value) || typeof value.enabled !== 'boolean') {
    return {
      ok: false,
      error: {
        code: 'transport-error',
        message: 'The launch-at-startup event did not match the IPC contract.',
      },
    };
  }

  return { ok: true, value: { enabled: value.enabled } };
}
