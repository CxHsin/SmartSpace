import { describe, expect, it, vi } from 'vitest';
import type { ShortcutStatusEvent, SmartSpaceApi } from '../src/shared/ipc';
import { IPC_CHANNELS } from '../src/shared/ipc';

const electronMocks = vi.hoisted(() => ({
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
  ipcRenderer: {
    on: vi.fn(),
    removeListener: vi.fn(),
    invoke: vi.fn(),
  },
}));

vi.mock('electron', () => electronMocks);

import '../src/preload/preload';

function getShortcutStatusHandler(): (_event: unknown, payload: unknown) => void {
  const registration = electronMocks.ipcRenderer.on.mock.calls.find(
    ([channel]) => channel === IPC_CHANNELS.shellShortcutStatus,
  );
  expect(registration).toEqual(expect.any(Array));
  expect(registration?.[1]).toEqual(expect.any(Function));
  return registration?.[1] as (_event: unknown, payload: unknown) => void;
}

function getApi(): SmartSpaceApi {
  const exposedApi = electronMocks.contextBridge.exposeInMainWorld.mock.calls[0]?.[1];
  expect(exposedApi).toBeDefined();
  return exposedApi as SmartSpaceApi;
}

describe('preload shortcut status delivery', () => {
  it('replays an initial conflict to a listener attached after the event', () => {
    const conflict: ShortcutStatusEvent = {
      shortcut: 'Ctrl+Shift+Space',
      state: 'conflict',
      activeShortcut: null,
      message: 'The shortcut Ctrl+Shift+Space is unavailable.',
    };
    const listener = vi.fn();

    getShortcutStatusHandler()(undefined, conflict);
    const unsubscribe = getApi().events.onShortcutStatus(listener);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(conflict);

    unsubscribe();
    getShortcutStatusHandler()(undefined, {
      ...conflict,
      state: 'registered',
      activeShortcut: conflict.shortcut,
      message: null,
    });
    expect(listener).toHaveBeenCalledOnce();
  });
});
