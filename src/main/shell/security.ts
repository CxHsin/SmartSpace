export interface SecureRendererPreferences {
  readonly preload: string;
  readonly contextIsolation: true;
  readonly nodeIntegration: false;
  readonly sandbox: true;
  readonly webSecurity: true;
}

export function createSecureRendererPreferences(preload: string): SecureRendererPreferences {
  return {
    preload,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
  };
}

export function isAllowedRendererNavigation(
  url: string,
  rendererPath: string,
  developmentUrl?: string,
): boolean {
  if (developmentUrl !== undefined) {
    try {
      return new URL(url).origin === new URL(developmentUrl).origin;
    } catch {
      return false;
    }
  }

  const normalizedPath = rendererPath.replaceAll('\\', '/');
  const rendererFileUrl = normalizedPath.startsWith('/')
    ? `file://${normalizedPath}`
    : `file:///${normalizedPath}`;
  return url === rendererFileUrl;
}
