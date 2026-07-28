import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  parseAppInfoResponse,
  parseLayoutGetResponse,
  parseLayoutSetSplitRatioResponse,
  parseLaunchAtStartupChangedEvent,
  parseShortcutStatusEvent,
  parseShellReadyEvent,
  parseSettingsRequestedEvent,
  parseStartupGetLaunchAtStartupResponse,
  parseStartupSetLaunchAtStartupResponse,
  parseWindowRequestExitResponse,
  parseWindowHideResponse,
  parseWindowSetHideOnBlurResponse,
  type AppInfoRequest,
  type AppInfoResponse,
  type LayoutGetRequest,
  type LayoutGetResponse,
  type LayoutSetSplitRatioRequest,
  type LayoutSetSplitRatioResponse,
  type LaunchAtStartupChangedEvent,
  type IpcResponse,
  type ShortcutStatusEvent,
  type ShellReadyEvent,
  type SettingsRequestedEvent,
  type SmartSpaceApi,
  type StartupGetLaunchAtStartupRequest,
  type StartupGetLaunchAtStartupResponse,
  type StartupSetLaunchAtStartupRequest,
  type StartupSetLaunchAtStartupResponse,
  type WindowRequestExitRequest,
  type WindowRequestExitResponse,
  type WindowHideRequest,
  type WindowHideResponse,
  type WindowSetHideOnBlurRequest,
  type WindowSetHideOnBlurResponse,
} from '../shared/ipc';

const shortcutStatusListeners = new Set<(event: ShortcutStatusEvent) => void>();
let latestShortcutStatus: ShortcutStatusEvent | null = null;
const settingsRequestedListeners = new Set<(event: SettingsRequestedEvent) => void>();
let latestSettingsRequested: SettingsRequestedEvent | null = null;
const launchAtStartupListeners = new Set<(event: LaunchAtStartupChangedEvent) => void>();
let latestLaunchAtStartupChanged: LaunchAtStartupChangedEvent | null = null;

const shortcutStatusHandler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
  const parsedEvent = parseShortcutStatusEvent(payload);
  if (!parsedEvent.ok) {
    return;
  }

  latestShortcutStatus = parsedEvent.value;
  for (const listener of shortcutStatusListeners) {
    listener(parsedEvent.value);
  }
};

// Register before exposing the API so events sent during initial page load can be replayed.
ipcRenderer.on(IPC_CHANNELS.shellShortcutStatus, shortcutStatusHandler);
ipcRenderer.on(IPC_CHANNELS.shellSettingsRequested, (_event, payload) => {
  const parsedEvent = parseSettingsRequestedEvent(payload);
  if (!parsedEvent.ok) {
    return;
  }

  latestSettingsRequested = parsedEvent.value;
  for (const listener of settingsRequestedListeners) {
    listener(parsedEvent.value);
  }
});
ipcRenderer.on(IPC_CHANNELS.shellLaunchAtStartupChanged, (_event, payload) => {
  const parsedEvent = parseLaunchAtStartupChangedEvent(payload);
  if (!parsedEvent.ok) {
    return;
  }

  latestLaunchAtStartupChanged = parsedEvent.value;
  for (const listener of launchAtStartupListeners) {
    listener(parsedEvent.value);
  }
});

const api: SmartSpaceApi = {
  app: {
    getInfo: async (request: AppInfoRequest): Promise<IpcResponse<AppInfoResponse>> => {
      try {
        const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.appGetInfo, request);
        return parseAppInfoResponse(response);
      } catch {
        return {
          ok: false,
          error: {
            code: 'transport-error',
            message: 'The app information request could not be delivered.',
          },
        };
      }
    },
  },
  window: {
    hide: async (request: WindowHideRequest): Promise<IpcResponse<WindowHideResponse>> => {
      try {
        const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.windowHide, request);
        return parseWindowHideResponse(response);
      } catch {
        return {
          ok: false,
          error: {
            code: 'transport-error',
            message: 'The SmartSpace window request could not be delivered.',
          },
        };
      }
    },
    setHideOnBlur: async (
      request: WindowSetHideOnBlurRequest,
    ): Promise<IpcResponse<WindowSetHideOnBlurResponse>> => {
      try {
        const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.windowSetHideOnBlur, request);
        return parseWindowSetHideOnBlurResponse(response);
      } catch {
        return {
          ok: false,
          error: {
            code: 'transport-error',
            message: 'The hide-on-blur setting request could not be delivered.',
          },
        };
      }
    },
    requestExit: async (request: WindowRequestExitRequest): Promise<IpcResponse<WindowRequestExitResponse>> => {
      try {
        const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.windowRequestExit, request);
        return parseWindowRequestExitResponse(response);
      } catch {
        return {
          ok: false,
          error: {
            code: 'transport-error',
            message: 'The SmartSpace shutdown request could not be delivered.',
          },
        };
      }
    },
  },
  layout: {
    get: async (request: LayoutGetRequest): Promise<IpcResponse<LayoutGetResponse>> => {
      try {
        const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.layoutGet, request);
        return parseLayoutGetResponse(response);
      } catch {
        return {
          ok: false,
          error: {
            code: 'transport-error',
            message: 'The window layout request could not be delivered.',
          },
        };
      }
    },
    setSplitRatio: async (
      request: LayoutSetSplitRatioRequest,
    ): Promise<IpcResponse<LayoutSetSplitRatioResponse>> => {
      try {
        const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.layoutSetSplitRatio, request);
        return parseLayoutSetSplitRatioResponse(response);
      } catch {
        return {
          ok: false,
          error: {
            code: 'transport-error',
            message: 'The window split ratio request could not be delivered.',
          },
        };
      }
    },
  },
  startup: {
    getLaunchAtStartup: async (
      request: StartupGetLaunchAtStartupRequest,
    ): Promise<IpcResponse<StartupGetLaunchAtStartupResponse>> => {
      try {
        const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.startupGetLaunchAtStartup, request);
        return parseStartupGetLaunchAtStartupResponse(response);
      } catch {
        return {
          ok: false,
          error: {
            code: 'transport-error',
            message: 'The startup setting request could not be delivered.',
          },
        };
      }
    },
    setLaunchAtStartup: async (
      request: StartupSetLaunchAtStartupRequest,
    ): Promise<IpcResponse<StartupSetLaunchAtStartupResponse>> => {
      try {
        const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.startupSetLaunchAtStartup, request);
        return parseStartupSetLaunchAtStartupResponse(response);
      } catch {
        return {
          ok: false,
          error: {
            code: 'transport-error',
            message: 'The startup setting request could not be delivered.',
          },
        };
      }
    },
  },
  events: {
    onShellReady: (listener: (event: ShellReadyEvent) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        const parsedEvent = parseShellReadyEvent(payload);
        if (parsedEvent.ok) {
          listener(parsedEvent.value);
        }
      };

      ipcRenderer.on(IPC_CHANNELS.shellReady, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.shellReady, handler);
    },
    onShortcutStatus: (listener: (event: ShortcutStatusEvent) => void): (() => void) => {
      shortcutStatusListeners.add(listener);
      if (latestShortcutStatus !== null) {
        listener(latestShortcutStatus);
      }
      return () => shortcutStatusListeners.delete(listener);
    },
    onSettingsRequested: (listener: (event: SettingsRequestedEvent) => void): (() => void) => {
      settingsRequestedListeners.add(listener);
      if (latestSettingsRequested !== null) {
        listener(latestSettingsRequested);
      }
      return () => settingsRequestedListeners.delete(listener);
    },
    onLaunchAtStartupChanged: (listener: (event: LaunchAtStartupChangedEvent) => void): (() => void) => {
      launchAtStartupListeners.add(listener);
      if (latestLaunchAtStartupChanged !== null) {
        listener(latestLaunchAtStartupChanged);
      }
      return () => launchAtStartupListeners.delete(listener);
    },
  },
};

contextBridge.exposeInMainWorld('smartSpace', api);
