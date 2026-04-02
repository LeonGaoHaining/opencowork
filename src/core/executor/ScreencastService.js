const DEFAULT_CONFIG = {
    fps: 24, // 默认 fps
    quality: 20, // 降低质量提高压缩率
    maxWidth: 800, // 降低分辨率
    maxHeight: 0, // 0 表示使用 CSS 自动填充高度
};
export class ScreencastService {
    page = null;
    mainWindow = null;
    config;
    intervalId = null;
    isRunning = false;
    lastFrameTime = 0;
    frameCount = 0;
    pageContent = '';
    contentUpdateInterval = null;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    setPage(page) {
        this.page = page;
    }
    setMainWindow(window) {
        this.mainWindow = window;
    }
    start() {
        if (this.isRunning) {
            console.log('[Screencast] Already running');
            return;
        }
        if (!this.page || !this.mainWindow) {
            console.log('[Screencast] Cannot start: missing page or mainWindow');
            return;
        }
        const interval = 1000 / this.config.fps;
        this.isRunning = true;
        this.frameCount = 0;
        console.log(`[Screencast] Starting with ${this.config.fps}fps, quality ${this.config.quality}%`);
        this.intervalId = setInterval(async () => {
            await this.captureFrame();
        }, interval);
        this.updatePageContent();
        this.contentUpdateInterval = setInterval(() => {
            this.updatePageContent();
        }, 5000);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.contentUpdateInterval) {
            clearInterval(this.contentUpdateInterval);
            this.contentUpdateInterval = null;
        }
        this.isRunning = false;
        console.log('[Screencast] Stopped');
    }
    async updatePageContent() {
        if (!this.page)
            return;
        try {
            this.pageContent = await this.page.content();
        }
        catch (error) {
            console.warn('[Screencast] Failed to get page content:', error);
        }
    }
    getPageContent() {
        return this.pageContent;
    }
    async captureFrame() {
        if (!this.page || !this.mainWindow || this.mainWindow.isDestroyed()) {
            return;
        }
        try {
            const screenshot = await this.page.screenshot({
                type: 'jpeg',
                quality: this.config.quality,
                fullPage: false,
            });
            const base64 = Buffer.from(screenshot).toString('base64');
            this.frameCount++;
            this.lastFrameTime = Date.now();
            if (!this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('preview:screenshot', base64);
            }
            if (this.frameCount % 30 === 0) {
                console.log(`[Screencast] Sent ${this.frameCount} frames, last at ${Date.now()}`);
            }
        }
        catch (error) {
            console.warn('[Screencast] Capture frame failed:', error?.message || error);
        }
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }
    isActive() {
        return this.isRunning;
    }
    getStats() {
        return {
            fps: this.config.fps,
            frames: this.frameCount,
            lastFrame: this.lastFrameTime,
        };
    }
    setActiveMode(active) {
        if (active && this.config.fps < 24) {
            this.config.fps = 24;
            this.config.quality = 30;
            if (this.isRunning) {
                this.stop();
                this.start();
            }
        }
        else if (!active && this.config.fps > 5) {
            this.config.fps = 5;
            this.config.quality = 20;
            if (this.isRunning) {
                this.stop();
                this.start();
            }
        }
    }
    setTaskRunning(running) {
        if (running) {
            if (!this.isRunning) {
                this.start();
            }
            else if (this.config.fps < 10) {
                this.config.fps = 24;
                this.config.quality = 30;
                this.updateConfig({ fps: 24, quality: 30 });
            }
        }
        else {
            this.config.fps = 2;
            this.config.quality = 20;
            this.updateConfig({ fps: 2, quality: 20 });
        }
    }
}
export default ScreencastService;
