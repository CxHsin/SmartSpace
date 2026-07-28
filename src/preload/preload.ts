import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  parseAppInfoResponse,
  parseShellReadyEvent,
  type AppInfoRequest,
  type IpcResponse,
  type ShellReadyEvent,
  type SmartSpaceApi,
} from '../shared/ipc';

const api: SmartSpaceApi = {
  app: {
    getInfo: async (request: AppInfoRequest): Promise<IpcResponse<{ name: string; version: string }>> => {
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
  },
};

contextBridge.exposeInMainWorld('smartSpace', api);
