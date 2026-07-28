import { describe, expect, it } from 'vitest';
import { createAppInfoHandler } from '../src/main/ipc/handlers';
import { makeEmptyAppInfoRequest } from '../src/main/ipc/handlers';
import { parseAppInfoResponse, parseShellReadyEvent, type AppInfoRequest } from '../src/shared/ipc';

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
