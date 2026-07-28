import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import {
  createMainWindow,
  createQuickPanelWindowOptions,
  getCenteredWindowBounds,
} from '../src/main/shell/create-main-window';
import {
  DEFAULT_QUICK_PANEL_SHORTCUT,
  QuickPanelController,
  type ShortcutRegistry,
} from '../src/main/shell/quick-panel-controller';

const electronMocks = vi.hoisted(() => ({
  BrowserWindow: vi.fn(),
  globalShortcut: {
    register: vi.fn(),
    unregister: vi.fn(),
  },
  screen: {
    getPrimaryDisplay: vi.fn(),
  },
}));

vi.mock('electron', () => electronMocks);

type WindowListener = (...args: unknown[]) => void;

interface FakePanelWindow {
  readonly window: BrowserWindow;
  readonly listeners: Map<string, WindowListener>;
  readonly show: ReturnType<typeof vi.fn>;
  readonly hide: ReturnType<typeof vi.fn>;
  readonly focus: ReturnType<typeof vi.fn>;
  setVisible(visible: boolean): void;
  setFocused(focused: boolean): void;
  setDestroyed(destroyed: boolean): void;
}

function createFakePanelWindow(): FakePanelWindow {
  let visible = false;
  let focused = false;
  let destroyed = false;
  const listeners = new Map<string, WindowListener>();
  const show = vi.fn(() => {
    visible = true;
  });
  const hide = vi.fn(() => {
    visible = false;
    focused = false;
  });
  const focus = vi.fn(() => {
    focused = true;
  });
  const fakeWindow = {
    isDestroyed: () => destroyed,
    isVisible: () => visible,
    isFocused: () => focused,
    show,
    hide,
    focus,
    on: vi.fn((event: string, listener: WindowListener) => {
      listeners.set(event, listener);
      return fakeWindow;
    }),
  };

  return {
    window: fakeWindow as unknown as BrowserWindow,
    listeners,
    show,
    hide,
    focus,
    setVisible: (nextVisible) => {
      visible = nextVisible;
    },
    setFocused: (nextFocused) => {
      focused = nextFocused;
    },
    setDestroyed: (nextDestroyed) => {
      destroyed = nextDestroyed;
    },
  };
}

function createShortcutRegistry(registerResult = true): ShortcutRegistry & {
  readonly callbacks: Map<string, () => void>;
} {
  const callbacks = new Map<string, () => void>();
  return {
    callbacks,
    register: vi.fn((shortcut: string, callback: () => void) => {
      if (registerResult) {
        callbacks.set(shortcut, callback);
      }
      return registerResult;
    }),
    unregister: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('quick-panel window creation', () => {
  it('centers the first launch inside the primary display work area', () => {
    expect(getCenteredWindowBounds({ x: -1920, y: 20, width: 1920, height: 1060 })).toEqual({
      x: -1550,
      y: 170,
      width: 1180,
      height: 760,
    });
  });

  it('creates a hidden frameless always-on-top window outside the taskbar', () => {
    const webContents = {
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      loadFile: vi.fn(),
      loadURL: vi.fn(),
    };
    const mainWindow = {
      webContents,
      setAlwaysOnTop: vi.fn(),
      loadFile: vi.fn(),
      loadURL: vi.fn(),
    };
    electronMocks.screen.getPrimaryDisplay.mockReturnValue({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    });
    electronMocks.BrowserWindow.mockImplementation(function BrowserWindowMock(..._args: unknown[]) {
      return mainWindow;
    });

    createMainWindow();

    expect(electronMocks.BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      x: 370,
      y: 160,
    }));
    expect(mainWindow.setAlwaysOnTop).toHaveBeenCalledWith(true, 'floating');
  });

  it('keeps the quick-panel options deterministic for future bound persistence', () => {
    expect(createQuickPanelWindowOptions('preload.cjs', {
      x: 10,
      y: 20,
      width: 900,
      height: 600,
    })).toEqual(expect.objectContaining({
      x: 10,
      y: 20,
      width: 900,
      height: 600,
      minWidth: 780,
      minHeight: 520,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
    }));
  });
});

describe('quick-panel lifecycle controller', () => {
  it('registers the default shortcut and shows plus focuses a hidden panel', () => {
    const panel = createFakePanelWindow();
    const registry = createShortcutRegistry();
    const controller = new QuickPanelController(panel.window, { shortcutRegistry: registry });

    expect(controller.registerShortcut(DEFAULT_QUICK_PANEL_SHORTCUT)).toBe(true);
    registry.callbacks.get(DEFAULT_QUICK_PANEL_SHORTCUT)?.();

    expect(panel.show).toHaveBeenCalledOnce();
    expect(panel.focus).toHaveBeenCalledOnce();
  });

  it('hides a focused visible panel and focuses an unfocused visible panel', () => {
    const panel = createFakePanelWindow();
    const controller = new QuickPanelController(panel.window, { shortcutRegistry: createShortcutRegistry() });

    panel.setVisible(true);
    panel.setFocused(true);
    controller.toggle();
    expect(panel.hide).toHaveBeenCalledOnce();

    panel.hide.mockClear();
    panel.focus.mockClear();
    panel.setVisible(true);
    panel.setFocused(false);
    controller.toggle();
    expect(panel.focus).toHaveBeenCalledOnce();
    expect(panel.hide).not.toHaveBeenCalled();
  });

  it('hides on blur only while the setting is enabled', () => {
    const panel = createFakePanelWindow();
    const controller = new QuickPanelController(panel.window, { shortcutRegistry: createShortcutRegistry() });
    const blur = panel.listeners.get('blur');

    expect(blur).toEqual(expect.any(Function));
    blur?.();
    expect(panel.hide).toHaveBeenCalledOnce();

    controller.setHideOnBlur(false);
    panel.hide.mockClear();
    blur?.();
    expect(panel.hide).not.toHaveBeenCalled();
  });

  it('keeps the previous valid shortcut when a replacement conflicts', () => {
    const panel = createFakePanelWindow();
    const callbacks = new Map<string, () => void>();
    let nextRegistrationResult = true;
    const registry: ShortcutRegistry = {
      register: vi.fn((shortcut: string, callback: () => void) => {
        if (nextRegistrationResult) {
          callbacks.set(shortcut, callback);
        }
        return nextRegistrationResult;
      }),
      unregister: vi.fn(),
    };
    const controller = new QuickPanelController(panel.window, { shortcutRegistry: registry });
    const statuses: unknown[] = [];
    controller.onShortcutStatus((status) => statuses.push(status));

    expect(controller.registerShortcut('Ctrl+Alt+A')).toBe(true);
    nextRegistrationResult = false;
    expect(controller.registerShortcut('Ctrl+Alt+B')).toBe(false);
    expect(registry.unregister).not.toHaveBeenCalled();
    expect(controller.getShortcutStatus()).toEqual({
      shortcut: 'Ctrl+Alt+B',
      state: 'conflict',
      activeShortcut: 'Ctrl+Alt+A',
      message: 'The shortcut Ctrl+Alt+B is unavailable. The previous shortcut remains active.',
    });
    expect(statuses).toHaveLength(2);

    callbacks.get('Ctrl+Alt+A')?.();
    expect(panel.show).toHaveBeenCalledOnce();
  });

  it('hides on ordinary close and minimize, but lets an explicit quit close the window', () => {
    const panel = createFakePanelWindow();
    const controller = new QuickPanelController(panel.window, { shortcutRegistry: createShortcutRegistry() });
    const closeEvent = { preventDefault: vi.fn() };
    const close = panel.listeners.get('close');
    const minimize = panel.listeners.get('minimize');

    close?.(closeEvent);
    minimize?.();
    expect(closeEvent.preventDefault).toHaveBeenCalledOnce();
    expect(panel.hide).toHaveBeenCalledTimes(2);

    controller.beginQuit();
    closeEvent.preventDefault.mockClear();
    panel.hide.mockClear();
    close?.(closeEvent);
    minimize?.();
    expect(closeEvent.preventDefault).not.toHaveBeenCalled();
    expect(panel.hide).not.toHaveBeenCalled();
  });

  it('does not act on a destroyed window', () => {
    const panel = createFakePanelWindow();
    const controller = new QuickPanelController(panel.window, { shortcutRegistry: createShortcutRegistry() });
    panel.setDestroyed(true);

    controller.showAndFocus();
    controller.hide();
    controller.toggle();

    expect(panel.show).not.toHaveBeenCalled();
    expect(panel.focus).not.toHaveBeenCalled();
    expect(panel.hide).not.toHaveBeenCalled();
  });
});
