import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppInfoHandler, createSetHideOnBlurHandler, createWindowHideHandler } from '../src/main/ipc/handlers';
import { makeEmptyAppInfoRequest } from '../src/main/ipc/handlers';
import { registerIpcHandlers } from '../src/main/ipc/register-ipc';
import {
  IPC_CHANNELS,
  parseAppInfoResponse,
  parseShortcutStatusEvent,
  parseShellReadyEvent,
  parseWindowHideResponse,
  parseWindowSetHideOnBlurResponse,
  type AppInfoRequest,
} from '../src/shared/ipc';
import type { WebContents } from 'electron';

const electronMocks = vi.hoisted(() => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

vi.mock('electron', () => electronMocks);

type RegisteredAppInfoHandler = (event: { sender: WebContents }, request: unknown) => Promise<unknown>;

function getRegisteredAppInfoHandler(): RegisteredAppInfoHandler {
  const handler = electronMocks.ipcMain.handle.mock.calls[0]?.[1];
  expect(handler).toEqual(expect.any(Function));
  return handler as RegisteredAppInfoHandler;
}

function getRegisteredHandler(channel: string): RegisteredAppInfoHandler {
  const handler = electronMocks.ipcMain.handle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1];
  expect(handler).toEqual(expect.any(Function));
  return handler as RegisteredAppInfoHandler;
}

beforeEach(() => {
  electronMocks.ipcMain.handle.mockClear();
  electronMocks.ipcMain.removeHandler.mockClear();
});

describe('foundation IPC contract', () => {
  it('validates a request and returns the typed app information response', async () => {
    const handler = createAppInfoHandler(() => ({ name: 'SmartSpace', version: '0.1.0' }));

    const response = await handler(makeEmptyAppInfoRequest() satisfies AppInfoRequest);

    expect(response).toEqual({
      ok: true,
      value: { name: 'SmartSpace', version: '0.1.0' },
    });
  });

  it('returns a structured invalid-input error for an unexpected payload', async () => {
    const handler = createAppInfoHandler(() => ({ name: 'SmartSpace', version: '0.1.0' }));

    const response = await handler({ unexpected: true });

    expect(response).toEqual({
      ok: false,
      error: {
        code: 'invalid-input',
        message: 'The app info request must be an empty object.',
        details: { field: 'request' },
      },
    });
  });

  it('validates the window hide request and returns a structured result', async () => {
    const hideWindow = vi.fn();
    const handler = createWindowHideHandler(hideWindow);

    await expect(handler({ unexpected: true })).resolves.toEqual({
      ok: false,
      error: {
        code: 'invalid-input',
        message: 'The window hide request must be an empty object.',
        details: { field: 'request' },
      },
    });
    expect(hideWindow).not.toHaveBeenCalled();

    await expect(handler({})).resolves.toEqual({ ok: true, value: { hidden: true } });
    expect(hideWindow).toHaveBeenCalledOnce();
  });

  it('returns an internal error when hiding the window fails', async () => {
    const handler = createWindowHideHandler(() => {
      throw new Error('window failure');
    });

    await expect(handler({})).resolves.toEqual({
      ok: false,
      error: {
        code: 'internal-error',
        message: 'The SmartSpace window could not be hidden.',
      },
    });
  });

  it('validates and applies the hide-on-blur setting', async () => {
    const setHideOnBlur = vi.fn();
    const handler = createSetHideOnBlurHandler(setHideOnBlur);

    await expect(handler({ enabled: 'yes' })).resolves.toEqual({
      ok: false,
      error: {
        code: 'invalid-input',
        message: 'The hide-on-blur request must contain one boolean enabled field.',
        details: { field: 'request' },
      },
    });
    expect(setHideOnBlur).not.toHaveBeenCalled();

    await expect(handler({ enabled: false })).resolves.toEqual({
      ok: true,
      value: { hideOnBlur: false },
    });
    expect(setHideOnBlur).toHaveBeenCalledWith(false);
  });

  it('rejects an invoke from a renderer other than the active SmartSpace window', async () => {
    const activeContents = {} as WebContents;
    const unauthorizedContents = {} as WebContents;
    const provider = vi.fn(() => ({ name: 'SmartSpace', version: '0.1.0' }));

    registerIpcHandlers(provider, activeContents);
    const handler = getRegisteredAppInfoHandler();

    await expect(handler({ sender: unauthorizedContents }, {})).resolves.toEqual({
      ok: false,
      error: {
        code: 'unauthorized-sender',
        message: 'The IPC sender is not the active SmartSpace renderer.',
        details: { field: 'sender' },
      },
    });
    expect(provider).not.toHaveBeenCalled();

    await expect(handler({ sender: activeContents }, {})).resolves.toEqual({
      ok: true,
      value: { name: 'SmartSpace', version: '0.1.0' },
    });
    expect(provider).toHaveBeenCalledOnce();
  });

  it('authorizes window hide IPC and rejects an unauthorized sender', async () => {
    const activeContents = {} as WebContents;
    const unauthorizedContents = {} as WebContents;
    const hideWindow = vi.fn();

    registerIpcHandlers(() => ({ name: 'SmartSpace', version: '0.1.0' }), activeContents, hideWindow);
    const handler = getRegisteredHandler(IPC_CHANNELS.windowHide);

    await expect(handler({ sender: unauthorizedContents }, {})).resolves.toEqual({
      ok: false,
      error: {
        code: 'unauthorized-sender',
        message: 'The IPC sender is not the active SmartSpace renderer.',
        details: { field: 'sender' },
      },
    });
    expect(hideWindow).not.toHaveBeenCalled();

    await expect(handler({ sender: activeContents }, {})).resolves.toEqual({
      ok: true,
      value: { hidden: true },
    });
    expect(hideWindow).toHaveBeenCalledOnce();
  });

  it('authorizes hide-on-blur IPC and applies it only for the active renderer', async () => {
    const activeContents = {} as WebContents;
    const unauthorizedContents = {} as WebContents;
    const setHideOnBlur = vi.fn();

    registerIpcHandlers(() => ({ name: 'SmartSpace', version: '0.1.0' }), activeContents, undefined, setHideOnBlur);
    const handler = getRegisteredHandler(IPC_CHANNELS.windowSetHideOnBlur);

    await expect(handler({ sender: unauthorizedContents }, { enabled: false })).resolves.toEqual({
      ok: false,
      error: {
        code: 'unauthorized-sender',
        message: 'The IPC sender is not the active SmartSpace renderer.',
        details: { field: 'sender' },
      },
    });
    expect(setHideOnBlur).not.toHaveBeenCalled();

    await expect(handler({ sender: activeContents }, { enabled: false })).resolves.toEqual({
      ok: true,
      value: { hideOnBlur: false },
    });
    expect(setHideOnBlur).toHaveBeenCalledWith(false);
  });

  it('rejects malformed responses and events at the bridge boundary', () => {
    expect(parseAppInfoResponse({ ok: true, value: { name: 'SmartSpace' } })).toEqual({
      ok: false,
      error: {
        code: 'transport-error',
        message: 'The app info response did not match the IPC contract.',
      },
    });
    expect(parseShellReadyEvent({ version: 42 })).toEqual({
      ok: false,
      error: {
        code: 'transport-error',
        message: 'The shell-ready event did not match the IPC contract.',
      },
    });
    expect(parseShortcutStatusEvent({ shortcut: 'Ctrl+Shift+Space', state: 'conflict' })).toEqual({
      ok: false,
      error: {
        code: 'transport-error',
        message: 'The shortcut status event did not match the IPC contract.',
      },
    });
    expect(parseWindowHideResponse({ ok: true, value: { hidden: 'yes' } })).toEqual({
      ok: false,
      error: {
        code: 'transport-error',
        message: 'The window hide response did not match the IPC contract.',
      },
    });
    expect(parseWindowSetHideOnBlurResponse({ ok: true, value: { hideOnBlur: 'yes' } })).toEqual({
      ok: false,
      error: {
        code: 'transport-error',
        message: 'The hide-on-blur response did not match the IPC contract.',
      },
    });
  });
});
