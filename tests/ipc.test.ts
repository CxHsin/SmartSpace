import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppInfoHandler } from '../src/main/ipc/handlers';
import { makeEmptyAppInfoRequest } from '../src/main/ipc/handlers';
import { registerIpcHandlers } from '../src/main/ipc/register-ipc';
import { parseAppInfoResponse, parseShellReadyEvent, type AppInfoRequest } from '../src/shared/ipc';
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
  });
});
