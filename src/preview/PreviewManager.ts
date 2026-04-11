import { BrowserWindow, BrowserView } from 'electron';
import * as path from 'path';

export type PreviewMode = 'sidebar' | 'collapsible' | 'detached';

export type SyncStatus = 'idle' | 'agent_working' | 'user_working';

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
  cdpPort: number;
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
  cdpPort: 9222,
};

interface PreviewState {
  mode: PreviewMode;
  isExpanded: boolean;
  currentUrl?: string;
  syncStatus: SyncStatus;
}

const TOOLBAR_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    #browser-toolbar {
      display: flex;
      align-items: center;
      height: 40px;
      background: #1A1A24;
      border-bottom: 1px solid #333;
      padding: 0 8px;
      -webkit-app-region: drag;
    }
    #browser-toolbar button {
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      color: #fff;
      cursor: pointer;
      border-radius: 4px;
      font-size: 16px;
      -webkit-app-region: no-drag;
    }
    #browser-toolbar button:hover {
      background: #333;
    }
    #browser-toolbar button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .toolbar-center {
      flex: 1;
      margin: 0 8px;
      -webkit-app-region: no-drag;
    }
    #url-input {
      width: 100%;
      height: 28px;
      background: #0F0F14;
      border: 1px solid #333;
      border-radius: 4px;
      color: #fff;
      padding: 0 12px;
      font-size: 13px;
      outline: none;
    }
    #url-input:focus {
      border-color: #6366F1;
    }
    .toolbar-right {
      display: flex;
      align-items: center;
      margin-left: 8px;
    }
    #sync-status {
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      white-space: nowrap;
    }
    .status-idle { color: #10B981; }
    .status-agent { color: #22D3EE; }
    .status-user { color: #F59E0B; }
  </style>
</head>
<body>
  <div id="browser-toolbar">
    <button id="btn-back" title="后退">←</button>
    <button id="btn-forward" title="前进">→</button>
    <button id="btn-reload" title="刷新">↻</button>
    <button id="btn-stop" title="停止">×</button>
    <div class="toolbar-center">
      <input type="text" id="url-input" placeholder="输入网址后回车跳转" />
    </div>
    <div class="toolbar-right">
      <span id="sync-status" class="status-idle">● 就绪</span>
    </div>
  </div>
  <script>
    const backBtn = document.getElementById('btn-back');
    const forwardBtn = document.getElementById('btn-forward');
    const reloadBtn = document.getElementById('btn-reload');
    const stopBtn = document.getElementById('btn-stop');
    const urlInput = document.getElementById('url-input');
    const syncStatus = document.getElementById('sync-status');

    function sendToMain(channel, ...args) {
      if (window.electron && window.electron.send) {
        window.electron.send(channel, ...args);
      }
    }

    backBtn.addEventListener('click', () => sendToMain('toolbar:goBack'));
    forwardBtn.addEventListener('click', () => sendToMain('toolbar:goForward'));
    reloadBtn.addEventListener('click', () => sendToMain('toolbar:reload'));
    stopBtn.addEventListener('click', () => sendToMain('toolbar:stop'));

    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        let url = urlInput.value.trim();
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        if (url) {
          sendToMain('toolbar:navigate', url);
        }
      }
    });

    window.updateUrl = function(url) {
      urlInput.value = url;
    };

    window.updateSyncStatus = function(status) {
      const statusMap = {
        'idle': { text: '● 就绪', class: 'status-idle' },
        'agent_working': { text: '● Agent 工作中', class: 'status-agent' },
        'user_working': { text: '● 等待同步', class: 'status-user' }
      };
      if (statusMap[status]) {
        syncStatus.textContent = statusMap[status].text;
        syncStatus.className = statusMap[status].class;
      }
    };

    window.updateNavButtons = function(canGoBack, canGoForward) {
      backBtn.disabled = !canGoBack;
      forwardBtn.disabled = !canGoForward;
    };
  </script>
</body>
</html>
`;

export class PreviewManager {
  private mainWindow: BrowserWindow | null = null;
  private browserWindow: BrowserWindow | null = null;
  private previewView: BrowserView | null = null;
  private mode: PreviewMode = 'sidebar';
  private isExpanded: boolean = false;
  private currentUrl?: string;
  private syncStatus: SyncStatus = 'idle';
  private config: PreviewConfig;
  private isDestroyed: boolean = false;

  constructor(config: Partial<PreviewConfig> = {}) {
    this.config = { ...DEFAULT_PREVIEW_CONFIG, ...config };
  }

  async initialize(mainWindow: BrowserWindow): Promise<void> {
    this.mainWindow = mainWindow;
    console.log('[PreviewManager] Initialized with mode:', this.mode);

    this.setupToolbarIPC();
  }

  private setupToolbarIPC(): void {
    if (!this.browserWindow) return;

    const webContents = this.browserWindow.webContents;

    webContents.on('ipc-message', (_event, channel, ...args) => {
      if (typeof channel === 'string' && channel.startsWith('toolbar:')) {
        const action = channel.replace('toolbar:', '');
        this.handleToolbarAction(action, args[0]);
      }
    });

    webContents.on('did-navigate', (_event, url) => {
      this.currentUrl = url;
      this.browserWindow?.webContents
        .executeJavaScript(
          `
        window.updateUrl && window.updateUrl('${url.replace(/'/g, "\\'")}');
      `
        )
        .catch(() => {});
    });

    webContents.on('did-navigate-in-page', (_event, url) => {
      this.currentUrl = url;
    });

    webContents.on('input-event', (_event, input) => {
      if (input.type === 'mouseDown' || input.type === 'keyDown') {
        this.setSyncStatus('user_working');
      }
    });
  }

  private async handleToolbarAction(action: string, data?: any): Promise<void> {
    switch (action) {
      case 'navigate':
        if (data) {
          await this.navigateTo(data);
        }
        break;
      case 'goBack':
        await this.goBack();
        break;
      case 'goForward':
        await this.goForward();
        break;
      case 'reload':
        await this.reload();
        break;
      case 'stop':
        await this.stop();
        break;
    }
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

  private async createBrowserWindow(): Promise<BrowserWindow> {
    const bounds = this.mainWindow?.getBounds();
    const width =
      this.mode === 'sidebar'
        ? this.config.sidebar.width
        : this.mode === 'detached'
          ? this.config.detached.width
          : bounds?.width || 800;
    const height =
      this.mode === 'collapsible'
        ? this.config.collapsible.collapsedHeight
        : this.mode === 'detached'
          ? this.config.detached.height
          : bounds?.height || 720;

    const browserWindow = new BrowserWindow({
      width,
      height,
      show: false,
      frame: true,
      title: this.config.detached.title,
      backgroundColor: '#0F0F14',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:automation',
        preload: path.join(__dirname, '../../preload/index.js'),
        webviewTag: true,
      },
    });

    browserWindow.once('ready-to-show', () => {
      browserWindow.show();
    });

    return browserWindow;
  }

  private async loadToolbarContent(window: BrowserWindow): Promise<void> {
    const toolbarUrl =
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000/toolbar.html'
        : `file://${path.join(__dirname, '../../renderer/toolbar.html')}`;

    await window.loadURL(toolbarUrl);
  }

  private async enableSidebarMode(): Promise<void> {
    if (!this.mainWindow) {
      console.error('[PreviewManager] Main window not set');
      return;
    }

    this.closeDetachedWindow();

    if (!this.browserWindow) {
      this.browserWindow = await this.createBrowserWindow();
      this.setupToolbarIPC();
      await this.loadToolbarContent(this.browserWindow);
    }

    const mainBounds = this.mainWindow.getBounds();
    this.browserWindow.setBounds({
      x: mainBounds.width - this.config.sidebar.width,
      y: 0,
      width: this.config.sidebar.width,
      height: mainBounds.height,
    });

    if (!this.browserWindow.isVisible()) {
      this.browserWindow.show();
    }

    this.browserWindow.on('closed', () => {
      this.browserWindow = null;
      console.log('[PreviewManager] Sidebar window closed');
    });

    console.log('[PreviewManager] Sidebar mode enabled');
  }

  private async enableCollapsibleMode(): Promise<void> {
    if (!this.mainWindow) {
      console.error('[PreviewManager] Main window not set');
      return;
    }

    this.closeDetachedWindow();

    if (!this.browserWindow) {
      this.browserWindow = await this.createBrowserWindow();
      this.setupToolbarIPC();
      await this.loadToolbarContent(this.browserWindow);
    }

    this.updateCollapsibleBounds();

    this.browserWindow.on('closed', () => {
      this.browserWindow = null;
      console.log('[PreviewManager] Collapsible window closed');
    });

    console.log('[PreviewManager] Collapsible mode enabled');
  }

  private updateCollapsibleBounds(): void {
    if (!this.mainWindow || !this.browserWindow) return;

    const bounds = this.mainWindow.getBounds();

    if (this.isExpanded) {
      const expandedHeight = Math.floor(
        bounds.height * this.config.collapsible.expandedHeightRatio
      );
      this.browserWindow.setBounds({
        x: 0,
        y: 0,
        width: bounds.width,
        height: expandedHeight,
      });
    } else {
      this.browserWindow.setBounds({
        x: 0,
        y: 0,
        width: bounds.width,
        height: this.config.collapsible.collapsedHeight,
      });
    }
  }

  private async enableDetachedMode(): Promise<void> {
    if (this.browserWindow && this.mainWindow && this.previewView) {
      try {
        this.mainWindow.removeBrowserView(this.previewView);
      } catch (e) {
        console.log('[PreviewManager] Could not remove BrowserView');
      }
    }

    if (!this.browserWindow) {
      this.browserWindow = new BrowserWindow({
        width: this.config.detached.width,
        height: this.config.detached.height,
        minWidth: this.config.detached.minWidth,
        minHeight: this.config.detached.minHeight,
        title: this.config.detached.title,
        backgroundColor: '#0F0F14',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: 'persist:automation',
          preload: path.join(__dirname, '../../preload/index.js'),
          webviewTag: true,
        },
      });

      this.setupToolbarIPC();
      await this.loadToolbarContent(this.browserWindow);

      this.browserWindow.on('closed', () => {
        this.browserWindow = null;
        console.log('[PreviewManager] Detached window closed');
        this.setMode('sidebar');
      });
    }

    if (!this.browserWindow.isVisible()) {
      this.browserWindow.show();
    }

    console.log('[PreviewManager] Detached mode enabled');
  }

  private closeDetachedWindow(): void {
    if (this.browserWindow && !this.browserWindow.isDestroyed()) {
      this.browserWindow.close();
      this.browserWindow = null;
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

  setSyncStatus(status: SyncStatus): void {
    this.syncStatus = status;
    this.browserWindow?.webContents
      .executeJavaScript(
        `
      window.updateSyncStatus && window.updateSyncStatus('${status}');
    `
      )
      .catch(() => {});
  }

  getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  getState(): PreviewState {
    return {
      mode: this.mode,
      isExpanded: this.isExpanded,
      currentUrl: this.currentUrl,
      syncStatus: this.syncStatus,
    };
  }

  getBrowserWindow(): BrowserWindow | null {
    return this.browserWindow;
  }

  async navigateTo(url: string): Promise<void> {
    this.currentUrl = url;
    if (this.browserWindow && !this.browserWindow.isDestroyed()) {
      try {
        await this.browserWindow.webContents.loadURL(url);
        this.browserWindow.webContents
          .executeJavaScript(
            `
          window.updateUrl && window.updateUrl('${url.replace(/'/g, "\\'")}');
        `
          )
          .catch(() => {});
      } catch (e) {
        console.error('[PreviewManager] Failed to navigate:', e);
      }
    }
  }

  async goBack(): Promise<void> {
    if (this.browserWindow && !this.browserWindow.isDestroyed()) {
      const canGoBack = this.browserWindow.webContents.canGoBack();
      if (canGoBack) {
        this.browserWindow.webContents.goBack();
      }
    }
  }

  async goForward(): Promise<void> {
    if (this.browserWindow && !this.browserWindow.isDestroyed()) {
      const canGoForward = this.browserWindow.webContents.canGoForward();
      if (canGoForward) {
        this.browserWindow.webContents.goForward();
      }
    }
  }

  async reload(): Promise<void> {
    if (this.browserWindow && !this.browserWindow.isDestroyed()) {
      this.browserWindow.webContents.reload();
    }
  }

  async stop(): Promise<void> {
    if (this.browserWindow && !this.browserWindow.isDestroyed()) {
      this.browserWindow.webContents.stop();
    }
  }

  cleanup(): void {
    this.isDestroyed = true;
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
    this.mainWindow = null;
    console.log('[PreviewManager] Cleaned up');
  }
}

export default PreviewManager;
