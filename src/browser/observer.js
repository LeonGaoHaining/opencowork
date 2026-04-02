/**
 * 页面观察者
 * 位置: src/browser/observer.ts
 *
 * 功能: 失败后捕获页面UIGraph
 * 原则: 只在失败后调用，减少开销
 */
import { buildUIGraph } from './uiGraph';
import { DEFAULT_OBSERVER_CONFIG } from '../types/uiElement';
export class Observer {
    page;
    lastGraph = null;
    config;
    CAPTURE_TIMEOUT = 5000;
    constructor(page, config) {
        this.page = page;
        this.config = { ...DEFAULT_OBSERVER_CONFIG, ...config };
    }
    /**
     * 捕获当前页面UIGraph - 超时保护版
     */
    async capture() {
        const url = this.page.url();
        const title = await this.page.title().catch(() => '');
        try {
            const graph = await Promise.race([
                buildUIGraph(this.page, this.config),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Observer capture timeout')), this.CAPTURE_TIMEOUT)),
            ]);
            graph.url = url;
            graph.title = title;
            this.lastGraph = graph;
            console.log(`[Observer] Captured UIGraph: ${graph.elements.length} elements`);
            return graph;
        }
        catch (error) {
            console.error('[Observer] Capture failed:', error);
            return {
                url,
                title,
                timestamp: Date.now(),
                elements: [],
                navigation: [],
                inputs: [],
                actions: [],
                content: [],
            };
        }
    }
    /**
     * 捕获与上次的差异
     */
    async captureDiff() {
        const current = await this.capture();
        const previous = this.lastGraph;
        if (!previous) {
            return { added: current.elements, removed: [], changed: [] };
        }
        const currentIds = new Set(current.elements.map((e) => e.id));
        const previousIds = new Set(previous.elements.map((e) => e.id));
        const added = current.elements.filter((e) => !previousIds.has(e.id));
        const removed = previous.elements.filter((e) => !currentIds.has(e.id));
        const changed = current.elements.filter((e) => {
            const prev = previous.elements.find((p) => p.id === e.id);
            if (!prev)
                return false;
            // 比较关键字段
            const prevStr = `${prev.role || ''}${prev.label || ''}${prev.selector || ''}`;
            const currStr = `${e.role || ''}${e.label || ''}${e.selector || ''}`;
            return prevStr !== currStr;
        });
        console.log(`[Observer] Diff: +${added.length}, -${removed.length}, ~${changed.length}`);
        return { added, removed, changed };
    }
    /**
     * 获取上次捕获的UIGraph
     */
    getLastGraph() {
        return this.lastGraph;
    }
    /**
     * 获取Playwright Page对象
     */
    getPage() {
        return this.page;
    }
    /**
     * 更新配置
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        console.log('[Observer] Config updated:', this.config);
    }
    /**
     * 释放资源
     */
    destroy() {
        this.page = null;
        this.lastGraph = null;
        console.log('[Observer] Destroyed');
    }
}
export { Observer as PageObserver };
