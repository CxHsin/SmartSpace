import { globalShortcut as electronGlobalShortcut, type BrowserWindow } from 'electron';
import type { ShortcutStatusEvent } from '../../shared/ipc';

export const DEFAULT_QUICK_PANEL_SHORTCUT = 'Ctrl+Shift+Space';

export interface ShortcutRegistry {
  register(accelerator: string, callback: () => void): boolean;
  unregister(accelerator: string): void;
}

export interface WindowLifecycleEvent {
  preventDefault(): void;
}

export interface QuickPanelControllerOptions {
  readonly hideOnBlur?: boolean;
  readonly shortcutRegistry?: ShortcutRegistry;
}

export class QuickPanelController {
  private readonly window: BrowserWindow;
  private readonly shortcutRegistry: ShortcutRegistry;
  private readonly shortcutStatusListeners = new Set<(status: ShortcutStatusEvent) => void>();
  private activeShortcut: string | null = null;
  private shortcutStatus: ShortcutStatusEvent | null = null;
  private hideOnBlur: boolean;
  private quitting = false;

  public constructor(window: BrowserWindow, options: QuickPanelControllerOptions = {}) {
    this.window = window;
    this.hideOnBlur = options.hideOnBlur ?? true;
    this.shortcutRegistry = options.shortcutRegistry ?? electronGlobalShortcut;

    this.window.on('blur', () => this.handleBlur());
    this.window.on('close', (event) => this.handleClose(event));
    this.window.on('minimize', () => this.handleMinimize());
  }

  public registerShortcut(shortcut: string): boolean {
    if (this.activeShortcut === shortcut) {
      this.publishShortcutStatus({
        shortcut,
        state: 'registered',
        activeShortcut: this.activeShortcut,
        message: null,
      });
      return true;
    }

    let registered = false;
    try {
      registered = this.shortcutRegistry.register(shortcut, () => this.toggle());
    } catch {
      registered = false;
    }

    if (!registered) {
      this.publishShortcutStatus({
        shortcut,
        state: 'conflict',
        activeShortcut: this.activeShortcut,
        message: `The shortcut ${shortcut} is unavailable. The previous shortcut remains active.`,
      });
      return false;
    }

    if (this.activeShortcut !== null) {
      this.shortcutRegistry.unregister(this.activeShortcut);
    }
    this.activeShortcut = shortcut;
    this.publishShortcutStatus({
      shortcut,
      state: 'registered',
      activeShortcut: this.activeShortcut,
      message: null,
    });
    return true;
  }

  public getShortcutStatus(): ShortcutStatusEvent | null {
    return this.shortcutStatus;
  }

  public onShortcutStatus(listener: (status: ShortcutStatusEvent) => void): () => void {
    this.shortcutStatusListeners.add(listener);
    return () => this.shortcutStatusListeners.delete(listener);
  }

  public setHideOnBlur(enabled: boolean): void {
    this.hideOnBlur = enabled;
  }

  public getHideOnBlur(): boolean {
    return this.hideOnBlur;
  }

  public beginQuit(): void {
    this.quitting = true;
  }

  public toggle(): void {
    if (this.window.isDestroyed()) {
      return;
    }

    if (!this.window.isVisible()) {
      this.showAndFocus();
      return;
    }

    if (!this.window.isFocused()) {
      this.window.focus();
      return;
    }

    this.window.hide();
  }

  public showAndFocus(): void {
    if (this.window.isDestroyed()) {
      return;
    }

    if (!this.window.isVisible()) {
      this.window.show();
    }
    this.window.focus();
  }

  public hide(): void {
    if (!this.window.isDestroyed()) {
      this.window.hide();
    }
  }

  public dispose(): void {
    if (this.activeShortcut !== null) {
      this.shortcutRegistry.unregister(this.activeShortcut);
      this.activeShortcut = null;
    }
    this.shortcutStatusListeners.clear();
  }

  private handleBlur(): void {
    if (this.quitting || !this.hideOnBlur) {
      return;
    }

    this.hide();
  }

  private handleClose(event: WindowLifecycleEvent): void {
    if (this.quitting) {
      return;
    }

    event.preventDefault();
    this.hide();
  }

  private handleMinimize(): void {
    if (this.quitting) {
      return;
    }

    this.hide();
  }

  private publishShortcutStatus(status: ShortcutStatusEvent): void {
    this.shortcutStatus = status;
    for (const listener of this.shortcutStatusListeners) {
      listener(status);
    }
  }
}
