import type { SmartSpaceApi } from './shared/ipc';

declare global {
  interface Window {
    readonly smartSpace?: SmartSpaceApi;
  }
}

export {};
