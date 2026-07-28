import { describe, expect, it } from 'vitest';
import type { AppInfoRequest, SmartSpaceApi } from '../src/shared/ipc';

function appInfoRequestTypeCoverage(api: SmartSpaceApi): void {
  api.app.getInfo({});

  // @ts-expect-error AppInfoRequest must reject unexpected request fields.
  api.app.getInfo({ unexpected: true });
}

void appInfoRequestTypeCoverage;

describe('IPC request types', () => {
  it('preserves the empty-object app info request wire shape', () => {
    const request = {} satisfies AppInfoRequest;
    expect(request).toEqual({});
  });
});
