import { describe, expect, it } from 'vitest';
import type {
  AppInfoRequest,
  SmartSpaceApi,
  WindowHideRequest,
  WindowSetHideOnBlurRequest,
} from '../src/shared/ipc';

function appInfoRequestTypeCoverage(api: SmartSpaceApi): void {
  api.app.getInfo({});

  // @ts-expect-error AppInfoRequest must reject unexpected request fields.
  api.app.getInfo({ unexpected: true });

  api.window.hide({});

  // @ts-expect-error WindowHideRequest must reject unexpected request fields.
  api.window.hide({ unexpected: true });

  api.window.setHideOnBlur({ enabled: true });

  // @ts-expect-error WindowSetHideOnBlurRequest must reject unexpected request fields.
  api.window.setHideOnBlur({ enabled: true, unexpected: true });
}

void appInfoRequestTypeCoverage;

describe('IPC request types', () => {
  it('preserves the empty-object app info request wire shape', () => {
    const request = {} satisfies AppInfoRequest;
    expect(request).toEqual({});
  });

  it('preserves the empty-object window hide request wire shape', () => {
    const request = {} satisfies WindowHideRequest;
    expect(request).toEqual({});
  });

  it('keeps hide-on-blur requests typed as a boolean setting', () => {
    const request = { enabled: false } satisfies WindowSetHideOnBlurRequest;
    expect(request).toEqual({ enabled: false });
  });
});
