export type AppHostState =
  | 'searching'
  | 'launching'
  | 'embedded'
  | 'external'
  | 'permission-required'
  | 'error';

export interface AppHostService {
  getState(appId: string): AppHostState;
}
