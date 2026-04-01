/**
 * 页面观察者
 * 位置: src/browser/observer.ts
 *
 * 功能: 失败后捕获页面UIGraph
 * 原则: 只在失败后调用，减少开销
 */

import { Page } from 'playwright';
import { buildUIGraph } from './uiGraph';
import { UIGraph, UIElement, ObserverConfig, DEFAULT_OBSERVER_CONFIG } from '../types/uiElement';

export class Observer {
  private page: Page;
  private lastGraph: UIGraph | null = null;
  private config: ObserverConfig;
  private readonly CAPTURE_TIMEOUT = 5000;

  constructor(page: Page, config?: Partial<ObserverConfig>) {
    this.page = page;
    this.config = { ...DEFAULT_OBSERVER_CONFIG, ...config };
  }

  /**
   * 捕获当前页面UIGraph - 超时保护版
   */
  async capture(): Promise<UIGraph> {
    const url = this.page.url();
    const title = await this.page.title().catch(() => '');

    try {
      const graph = await Promise.race([
        buildUIGraph(this.page, this.config),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Observer capture timeout')), this.CAPTURE_TIMEOUT)
        ),
      ]);

      graph.url = url;
      graph.title = title;
      this.lastGraph = graph;

      console.log(`[Observer] Captured UIGraph: ${graph.elements.length} elements`);
      return graph;
    } catch (error) {
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
  async captureDiff(): Promise<{
    added: UIElement[];
    removed: UIElement[];
    changed: UIElement[];
  }> {
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
      return prev && JSON.stringify(prev) !== JSON.stringify(e);
    });

    console.log(`[Observer] Diff: +${added.length}, -${removed.length}, ~${changed.length}`);

    return { added, removed, changed };
  }

  /**
   * 获取上次捕获的UIGraph
   */
  getLastGraph(): UIGraph | null {
    return this.lastGraph;
  }

  /**
   * 获取Playwright Page对象
   */
  getPage(): Page {
    return this.page;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ObserverConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[Observer] Config updated:', this.config);
  }

  /**
   * 释放资源
   */
  destroy(): void {
    this.page = null as any;
    this.lastGraph = null;
    console.log('[Observer] Destroyed');
  }
}

export { Observer as PageObserver };
