import { BrowserWindow, BrowserView } from 'electron';
import * as path from 'path';

export type PreviewMode = 'sidebar' | 'collapsible' | 'detached';

interface PreviewConfig {
  sidebar: {
    width: number;
  };
  collapsible: {
    collapsedHeight: number;
    expandedHeightRatio: number;
  };
  detached: {
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    title: string;
  };
}

const DEFAULT_PREVIEW_CONFIG: PreviewConfig = {
  sidebar: {
    width: 500,
  },
  collapsible: {
    collapsedHeight: 40,
    expandedHeightRatio: 0.6,
  },
  detached: {
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    title: 'OpenCowork - Browser Preview',
  },
};

interface PreviewState {
  mode: PreviewMode;
  isExpanded: boolean;
  currentUrl?: string;
}

export class PreviewManager {
  private mainWindow: BrowserWindow | null = null;
  private previewWindow: BrowserWindow | null = null;
  private previewView: BrowserView | null = null;
  private mode: PreviewMode = 'detached';
  private isExpanded: boolean = false;
  private currentUrl?: string;
  private config: PreviewConfig;

  constructor(config: Partial<PreviewConfig> = {}) {
    this.config = { ...DEFAULT_PREVIEW_CONFIG, ...config };
  }

  async initialize(mainWindow: BrowserWindow): Promise<void> {
    this.mainWindow = mainWindow;
    console.log('[PreviewManager] Initialized with mode:', this.mode);
  }

  async setMode(mode: PreviewMode): Promise<void> {
    this.mode = mode;
    console.log(`[PreviewManager] Mode changed to: ${mode}`);

    switch (mode) {
      case 'sidebar':
        await this.enableSidebarMode();
        break;
      case 'collapsible':
        await this.enableCollapsibleMode();
        break;
      case 'detached':
        await this.enableDetachedMode();
        break;
    }
  }

  private async enableSidebarMode(): Promise<void> {
    if (!this.mainWindow) {
      console.error('[PreviewManager] Main window not set');
      return;
    }

    this.closeDetachedWindow();

    if (!this.previewView) {
      this.previewView = new BrowserView({
        webPreferences: {
          partition: 'persist:automation',
          preload: path.join(__dirname, '../../preload/index.js'),
        },
      });
    }

    try {
      this.mainWindow.addBrowserView(this.previewView);
    } catch (e) {
      console.log('[PreviewManager] BrowserView might already be added');
    }

    const bounds = this.mainWindow.getBounds();
    this.previewView.setBounds({
      x: bounds.width - this.config.sidebar.width,
      y: 0,
      width: this.config.sidebar.width,
      height: bounds.height,
    });

    this.previewView.setAutoResize({ width: true, height: true });

    this.loadPreviewContent();

    console.log('[PreviewManager] Sidebar mode enabled');
  }

  private async enableCollapsibleMode(): Promise<void> {
    if (!this.mainWindow) {
      console.error('[PreviewManager] Main window not set');
      return;
    }

    this.closeDetachedWindow();

    if (!this.previewView) {
      this.previewView = new BrowserView({
        webPreferences: {
          partition: 'persist:automation',
          preload: path.join(__dirname, '../../preload/index.js'),
        },
      });
    }

    try {
      this.mainWindow.addBrowserView(this.previewView);
    } catch (e) {
      console.log('[PreviewManager] BrowserView might already be added');
    }

    this.updateCollapsibleBounds();

    this.loadPreviewContent();

    console.log('[PreviewManager] Collapsible mode enabled');
  }

  private updateCollapsibleBounds(): void {
    if (!this.mainWindow || !this.previewView) return;

    const bounds = this.mainWindow.getBounds();

    if (this.isExpanded) {
      const expandedHeight = Math.floor(
        bounds.height * this.config.collapsible.expandedHeightRatio
      );
      this.previewView.setBounds({
        x: 0,
        y: 0,
        width: bounds.width,
        height: expandedHeight,
      });
    } else {
      this.previewView.setBounds({
        x: 0,
        y: 0,
        width: bounds.width,
        height: this.config.collapsible.collapsedHeight,
      });
    }

    this.previewView.setAutoResize({ width: true, height: false });
  }

  private async enableDetachedMode(): Promise<void> {
    if (this.previewView && this.mainWindow) {
      try {
        this.mainWindow.removeBrowserView(this.previewView);
      } catch (e) {
        console.log('[PreviewManager] Could not remove BrowserView');
      }
    }

    this.previewWindow = new BrowserWindow({
      width: this.config.detached.width,
      height: this.config.detached.height,
      minWidth: this.config.detached.minWidth,
      minHeight: this.config.detached.minHeight,
      title: this.config.detached.title,
      backgroundColor: '#0F0F14',
      webPreferences: {
        partition: 'persist:automation',
        preload: path.join(__dirname, '../../preload/index.js'),
      },
    });

    this.previewView = new BrowserView({
      webPreferences: {
        partition: 'persist:automation',
        preload: path.join(__dirname, '../../preload/index.js'),
      },
    });

    this.previewWindow.addBrowserView(this.previewView);
    this.previewView.setBounds({
      x: 0,
      y: 0,
      width: this.config.detached.width,
      height: this.config.detached.height,
    });

    this.loadPreviewContent();

    this.previewWindow.on('closed', () => {
      this.previewWindow = null;
      console.log('[PreviewManager] Detached window closed');
    });

    console.log('[PreviewManager] Detached mode enabled');
  }

  private loadPreviewContent(): void {
    const previewUrl =
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000/preview.html'
        : path.join(__dirname, '../../renderer/preview.html');

    if (this.previewView) {
      if (process.env.NODE_ENV === 'development') {
        this.previewView.webContents.loadURL('http://localhost:3000/preview.html');
      } else {
        this.previewView.webContents.loadFile(path.join(__dirname, '../../renderer/preview.html'));
      }
    }
  }

  private closeDetachedWindow(): void {
    if (this.previewWindow) {
      this.previewWindow.close();
      this.previewWindow = null;
    }
  }

  setExpanded(expanded: boolean): void {
    if (this.mode === 'collapsible') {
      this.isExpanded = expanded;
      this.updateCollapsibleBounds();
    }
  }

  toggleExpanded(): void {
    if (this.mode === 'collapsible') {
      this.isExpanded = !this.isExpanded;
      this.updateCollapsibleBounds();
    }
  }

  getMode(): PreviewMode {
    return this.mode;
  }

  isPreviewExpanded(): boolean {
    return this.isExpanded;
  }

  setCurrentUrl(url: string): void {
    this.currentUrl = url;
  }

  getCurrentUrl(): string | undefined {
    return this.currentUrl;
  }

  getState(): PreviewState {
    return {
      mode: this.mode,
      isExpanded: this.isExpanded,
      currentUrl: this.currentUrl,
    };
  }

  getPreviewView(): BrowserView | null {
    return this.previewView;
  }

  getPreviewWindow(): BrowserWindow | null {
    return this.previewWindow;
  }

  async navigateTo(url: string): Promise<void> {
    this.currentUrl = url;
    if (this.previewView) {
      try {
        if (this.previewView.webContents.isDestroyed()) {
          console.warn('[PreviewManager] Preview view already destroyed');
          return;
        }
        await this.previewView.webContents.loadURL(url);
      } catch (e) {
        console.error('[PreviewManager] Failed to navigate:', e);
      }
    }
  }

  cleanup(): void {
    this.closeDetachedWindow();
    if (this.previewView && this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.removeBrowserView(this.previewView);
        console.log('[PreviewManager] Removed BrowserView');
      } catch (e) {
        console.warn('[PreviewManager] Could not remove BrowserView during cleanup:', e);
      }
    }
    this.previewView = null;
    this.previewWindow = null;
    this.mainWindow = null;
    console.log('[PreviewManager] Cleaned up');
  }
}

export default PreviewManager;
