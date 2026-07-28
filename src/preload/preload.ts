import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  parseAppInfoResponse,
  parseShortcutStatusEvent,
  parseShellReadyEvent,
  parseWindowHideResponse,
  parseWindowSetHideOnBlurResponse,
  type AppInfoRequest,
  type AppInfoResponse,
  type IpcResponse,
  type ShortcutStatusEvent,
  type ShellReadyEvent,
  type SmartSpaceApi,
  type WindowHideRequest,
  type WindowHideResponse,
  type WindowSetHideOnBlurRequest,
  type WindowSetHideOnBlurResponse,
} from '../shared/ipc';

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
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        const parsedEvent = parseShortcutStatusEvent(payload);
        if (parsedEvent.ok) {
          listener(parsedEvent.value);
        }
      };

      ipcRenderer.on(IPC_CHANNELS.shellShortcutStatus, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.shellShortcutStatus, handler);
    },
  },
};

contextBridge.exposeInMainWorld('smartSpace', api);
