import { BrowserWindow, BrowserView } from 'electron';
import * as path from 'path';
const DEFAULT_PREVIEW_CONFIG = {
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
export class PreviewManager {
    mainWindow = null;
    previewWindow = null;
    previewView = null;
    mode = 'detached';
    isExpanded = false;
    currentUrl;
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_PREVIEW_CONFIG, ...config };
    }
    async initialize(mainWindow) {
        this.mainWindow = mainWindow;
        console.log('[PreviewManager] Initialized with mode:', this.mode);
    }
    async setMode(mode) {
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
    async enableSidebarMode() {
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
        }
        catch (e) {
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
    async enableCollapsibleMode() {
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
        }
        catch (e) {
            console.log('[PreviewManager] BrowserView might already be added');
        }
        this.updateCollapsibleBounds();
        this.loadPreviewContent();
        console.log('[PreviewManager] Collapsible mode enabled');
    }
    updateCollapsibleBounds() {
        if (!this.mainWindow || !this.previewView)
            return;
        const bounds = this.mainWindow.getBounds();
        if (this.isExpanded) {
            const expandedHeight = Math.floor(bounds.height * this.config.collapsible.expandedHeightRatio);
            this.previewView.setBounds({
                x: 0,
                y: 0,
                width: bounds.width,
                height: expandedHeight,
            });
        }
        else {
            this.previewView.setBounds({
                x: 0,
                y: 0,
                width: bounds.width,
                height: this.config.collapsible.collapsedHeight,
            });
        }
        this.previewView.setAutoResize({ width: true, height: false });
    }
    async enableDetachedMode() {
        if (this.previewView && this.mainWindow) {
            try {
                this.mainWindow.removeBrowserView(this.previewView);
            }
            catch (e) {
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
    loadPreviewContent() {
        const previewUrl = process.env.NODE_ENV === 'development'
            ? 'http://localhost:3000/preview.html'
            : path.join(__dirname, '../../renderer/preview.html');
        if (this.previewView) {
            if (process.env.NODE_ENV === 'development') {
                this.previewView.webContents.loadURL('http://localhost:3000/preview.html');
            }
            else {
                this.previewView.webContents.loadFile(path.join(__dirname, '../../renderer/preview.html'));
            }
        }
    }
    closeDetachedWindow() {
        if (this.previewWindow) {
            this.previewWindow.close();
            this.previewWindow = null;
        }
    }
    setExpanded(expanded) {
        if (this.mode === 'collapsible') {
            this.isExpanded = expanded;
            this.updateCollapsibleBounds();
        }
    }
    toggleExpanded() {
        if (this.mode === 'collapsible') {
            this.isExpanded = !this.isExpanded;
            this.updateCollapsibleBounds();
        }
    }
    getMode() {
        return this.mode;
    }
    isPreviewExpanded() {
        return this.isExpanded;
    }
    setCurrentUrl(url) {
        this.currentUrl = url;
    }
    getCurrentUrl() {
        return this.currentUrl;
    }
    getState() {
        return {
            mode: this.mode,
            isExpanded: this.isExpanded,
            currentUrl: this.currentUrl,
        };
    }
    getPreviewView() {
        return this.previewView;
    }
    getPreviewWindow() {
        return this.previewWindow;
    }
    async navigateTo(url) {
        this.currentUrl = url;
        if (this.previewView) {
            try {
                if (this.previewView.webContents.isDestroyed()) {
                    console.warn('[PreviewManager] Preview view already destroyed');
                    return;
                }
                await this.previewView.webContents.loadURL(url);
            }
            catch (e) {
                console.error('[PreviewManager] Failed to navigate:', e);
            }
        }
    }
    cleanup() {
        this.closeDetachedWindow();
        if (this.previewView && this.mainWindow && !this.mainWindow.isDestroyed()) {
            try {
                this.mainWindow.removeBrowserView(this.previewView);
                console.log('[PreviewManager] Removed BrowserView');
            }
            catch (e) {
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
