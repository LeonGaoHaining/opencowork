import {
  AnyAction,
  ActionResult,
  BrowserNavigateAction,
  BrowserClickAction,
  BrowserInputAction,
  BrowserWaitAction,
  BrowserExtractAction,
  BrowserScreenshotAction,
} from '../action/ActionSchema';
import { getLLMClient } from '../../llm/OpenAIResponses';
import { LLMMessage } from '../../llm/LLMClient';
import { ScreencastService } from './ScreencastService';

let mainWindowRef: Electron.BrowserWindow | null = null;

export function setBrowserExecutorMainWindow(window: Electron.BrowserWindow | null): void {
  mainWindowRef = window;
}

const SELECTOR_RETRY_STRATEGY = {
  maxAttempts: 3,
  strategies: ['exact', 'partial', 'text', 'xpath'] as const,
};

export interface RobustSelector {
  primary: string;
  fallbacks?: string[];
  textMatch?: string;
  xpath?: string;
}

export class BrowserExecutor {
  private browser: any = null;
  private context: any = null;
  private page: any = null;
  private llmClient = getLLMClient();
  private screencast: ScreencastService;

  constructor() {
    this.screencast = new ScreencastService({
      fps: 8,
      quality: 50,
      maxWidth: 800,
      maxHeight: 450,
    });
  }

  async launchBrowser(): Promise<void> {
    await this.ensureBrowser();
  }

  async closeBrowser(): Promise<void> {
    await this.cleanup();
  }

  async execute(action: AnyAction): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      await this.ensureBrowser();

      switch (action.type) {
        case 'browser:navigate':
          return await this.navigate(action as BrowserNavigateAction, startTime);
        case 'browser:click':
          return await this.click(action as BrowserClickAction, startTime);
        case 'browser:input':
          return await this.input(action as BrowserInputAction, startTime);
        case 'browser:wait':
          return await this.wait(action as BrowserWaitAction, startTime);
        case 'browser:extract':
          return await this.extract(action as BrowserExtractAction, startTime);
        case 'browser:screenshot':
          return await this.screenshot(action as BrowserScreenshotAction, startTime);
        default:
          return {
            success: false,
            error: {
              code: 'UNKNOWN_ACTION',
              message: `Unknown browser action: ${action.type}`,
              recoverable: false,
            },
            duration: Date.now() - startTime,
          };
      }
    } catch (error: any) {
      console.error(`[BrowserExecutor] Action failed:`, error);
      return {
        success: false,
        error: {
          code: 'BROWSER_ERROR',
          message: error.message || 'Unknown browser error',
          recoverable: true,
        },
        duration: Date.now() - startTime,
      };
    }
  }

  private async ensureBrowser(): Promise<void> {
    if (this.page) return;

    try {
      // 使用 playwright-extra（不使用 stealth 插件，手动实现反检测）
      const { chromium } = require('playwright-extra');

      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      try {
        this.context = await this.browser.newContext({
          viewport: { width: 1280, height: 720 },
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });

        try {
          this.page = await this.context.newPage();

          // 手动反检测脚本
          await this.page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
              get: () => undefined,
            });

            if (window.navigator.permissions) {
              // @ts-ignore
              window.navigator.permissions.query = (parameters: any) => {
                if (parameters.name === 'notifications') {
                  return Promise.resolve({ state: 'default' } as any);
                }
                return Promise.resolve({ state: 'prompt' } as any);
              };
            }

            Object.defineProperty(navigator, 'plugins', {
              get: () => [1, 2, 3, 4, 5],
            });

            Object.defineProperty(navigator, 'languages', {
              get: () => ['zh-CN', 'zh', 'en'],
            });
          });

          // 设置实时截图服务
          this.screencast.setPage(this.page);
          this.screencast.setMainWindow(mainWindowRef);
          this.screencast.start();

          console.log('[BrowserExecutor] Browser launched with manual stealth');
        } catch (e) {
          await this.browser.close();
          this.browser = null;
          throw e;
        }
      } catch (e) {
        await this.browser.close();
        this.browser = null;
        throw e;
      }
    } catch (error) {
      console.error('[BrowserExecutor] Failed to launch browser:', error);
      this.browser = null;
      throw error;
    }
  }

  startScreencast(): void {
    this.screencast.start();
  }

  stopScreencast(): void {
    this.screencast.stop();
  }

  private async navigate(action: BrowserNavigateAction, startTime: number): Promise<ActionResult> {
    const { url, waitUntil = 'domcontentloaded' } = action.params;

    console.log(`[BrowserExecutor] Navigating to: ${url}`);

    try {
      await this.page.goto(url, { waitUntil, timeout: 30000 });
    } catch (navError: any) {
      console.warn(
        '[BrowserExecutor] Navigation failed, trying with networkidle:',
        navError.message
      );
      try {
        await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      } catch (retryError: any) {
        console.error('[BrowserExecutor] Navigation retry failed:', retryError.message);
        return {
          success: false,
          error: {
            code: 'NAVIGATION_ERROR',
            message: `Failed to navigate to ${url}: ${retryError.message}`,
            recoverable: true,
          },
          duration: Date.now() - startTime,
        };
      }
    }

    const currentUrl = this.page.url();
    console.log(`[BrowserExecutor] Navigated to: ${currentUrl}`);

    return {
      success: true,
      output: { url: currentUrl, title: await this.page.title() },
      duration: Date.now() - startTime,
    };
  }

  private async click(action: BrowserClickAction, startTime: number): Promise<ActionResult> {
    const { selector, index = 0, textMatch, fallbackSelectors } = action.params;

    console.log(`[BrowserExecutor] Clicking: ${selector}[${index}]`);

    // 预处理选择器：拆分逗号分隔的选择器，处理 contains 语法
    let processedSelector = selector;
    let processedFallbacks = fallbackSelectors || [];

    // 如果选择器包含逗号，拆分成主选择器和备用选择器
    if (selector.includes(',')) {
      const parts = selector.split(',').map((s) => s.trim());
      processedSelector = parts[0];
      processedFallbacks = [...parts.slice(1), ...processedFallbacks];
    }

    // 处理 contains 语法，提取为 textMatch
    if (processedSelector.includes('contains(')) {
      const containsMatch = processedSelector.match(/contains\(['"](.+)['"]\)/);
      if (containsMatch) {
        const textContent = containsMatch[1];
        console.log(`[BrowserExecutor] Extracted textMatch from contains: ${textContent}`);
        // 使用 getByText 策略
        try {
          const textElement = await this.page.getByText(textContent, { exact: false }).first();
          if (await textElement.isVisible()) {
            await textElement.click({ force: true });
            return {
              success: true,
              output: { strategy: 'contains', selector: processedSelector },
              duration: Date.now() - startTime,
            };
          }
        } catch (e) {
          console.log(`[BrowserExecutor] contains strategy failed, trying other methods`);
        }
      }
    }

    // 尝试选择器策略
    // 注意：不再在 click 失败时使用 Enter fallback
    // 因为 input 成功后已经发送过 Enter，click 失败时再按 Enter 会导致双重 Enter
    const result = await this.executeWithSelectorStrategy(
      processedSelector,
      index,
      textMatch,
      processedFallbacks,
      async (sel, idx) => {
        const elements = await this.page.locator(sel).all();
        if (elements.length === 0) {
          throw new Error(`Element not found: ${sel}`);
        }
        const targetElement = elements[idx] || elements[0];
        try {
          await targetElement.scrollIntoViewIfNeeded({ timeout: 7000 });
        } catch (e) {
          console.warn(
            '[BrowserExecutor] scrollIntoViewIfNeeded failed for click, proceeding anyway'
          );
        }
        await targetElement.click({ force: true });
      },
      startTime
    );

    return result;
  }

  private async input(action: BrowserInputAction, startTime: number): Promise<ActionResult> {
    const {
      selector,
      text,
      clear = true,
      delay = 0,
      textMatch,
      fallbackSelectors,
      pressEnter = false,
    } = action.params;

    console.log(`[BrowserExecutor] Input to: ${selector}, pressEnter: ${pressEnter}`);

    // 预处理选择器：拆分逗号分隔的选择器
    let processedSelector = selector;
    let processedFallbacks = fallbackSelectors || [];

    if (selector.includes(',')) {
      const parts = selector.split(',').map((s) => s.trim());
      processedSelector = parts[0];
      processedFallbacks = [...parts.slice(1), ...processedFallbacks];
    }

    const result = await this.executeWithSelectorStrategy(
      processedSelector,
      0,
      textMatch,
      processedFallbacks,
      async (sel) => {
        const element = this.page.locator(sel);
        try {
          await element.scrollIntoViewIfNeeded({ timeout: 7000 });
        } catch (e) {
          console.warn(
            '[BrowserExecutor] scrollIntoViewIfNeeded failed for input, proceeding anyway'
          );
        }
        if (clear) {
          await element.clear({ force: true });
        }
        await element.type(text, { delay: 50, force: true });
      },
      startTime
    );

    // input 成功后，根据 pressEnter 参数决定是否按 Enter
    if (result.success && pressEnter) {
      console.log(
        `[BrowserExecutor] Input succeeded, waiting 100ms then pressing Enter on element`
      );
      try {
        await this.page.waitForTimeout(100);
        const inputElement = this.page.locator(processedSelector).first();
        await inputElement.press('Enter');
      } catch (e) {
        console.log(`[BrowserExecutor] Press Enter failed (optional):`, e);
      }
    }

    return result;
  }

  private async executeWithSelectorStrategy(
    selector: string,
    index: number,
    textMatch: string | undefined,
    fallbackSelectors: string[] | undefined,
    operation: (sel: string, idx: number) => Promise<void>,
    startTime: number = Date.now()
  ): Promise<ActionResult> {
    const maxRetries = SELECTOR_RETRY_STRATEGY.maxAttempts;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const currentSelector = selector;

        if (attempt > 0) {
          console.log(
            `[BrowserExecutor] Retry attempt ${attempt}/${maxRetries} with selector: ${currentSelector}`
          );
        }

        await operation(currentSelector, index);

        return {
          success: true,
          output: { selector: currentSelector },
          duration: Date.now() - startTime,
        };
      } catch (error: any) {
        const errorMessage = error.message || '';

        if (attempt === maxRetries) {
          console.error(`[BrowserExecutor] All selector strategies exhausted`);
          return {
            success: false,
            error: {
              code: 'SELECTOR_NOT_FOUND',
              message: `Could not find element. Last error: ${errorMessage}`,
              recoverable: true,
            },
            duration: Date.now() - startTime,
          };
        }

        if (fallbackSelectors && attempt < fallbackSelectors.length) {
          selector = fallbackSelectors[attempt];
          console.log(`[BrowserExecutor] Trying fallback selector: ${selector}`);
          continue;
        }

        if (textMatch && attempt === fallbackSelectors?.length) {
          console.log(`[BrowserExecutor] Trying textMatch strategy: ${textMatch}`);
          try {
            const elements = await this.page.getByText(textMatch, { exact: false }).all();
            if (elements.length > 0) {
              await elements[0].click();
              return {
                success: true,
                output: { strategy: 'textMatch', textMatch },
                duration: Date.now() - startTime,
              };
            }
          } catch (textError: unknown) {
            console.warn(
              '[BrowserExecutor] textMatch failed:',
              textError instanceof Error ? textError.message : String(textError)
            );
          }
        }

        if (attempt < maxRetries - 1) {
          try {
            const newSelector = await this.regenerateSelector(selector);
            if (newSelector) {
              selector = newSelector;
              console.log(`[BrowserExecutor] Regenerated selector: ${selector}`);
              continue;
            }
          } catch (llmError) {
            console.warn('[BrowserExecutor] LLM selector regeneration failed:', llmError);
          }
        }

        return {
          success: false,
          error: {
            code: 'SELECTOR_ERROR',
            message: `Click failed: ${errorMessage}`,
            recoverable: true,
          },
          duration: Date.now() - startTime,
        };
      }
    }

    return {
      success: false,
      error: {
        code: 'SELECTOR_EXHAUSTED',
        message: 'All selector strategies failed',
        recoverable: true,
      },
      duration: Date.now() - startTime,
    };
  }

  private async regenerateSelector(oldSelector: string): Promise<string | null> {
    const TIMEOUT_MS = 30000;

    try {
      const html = await this.page.content();
      const htmlSnippet = html.substring(0, 8000);

      const systemPrompt = `你是一个CSS选择器生成专家。根据页面HTML片段，生成更可靠的选择器。`;

      const userPrompt = `页面HTML片段：
${htmlSnippet}

之前失败的选择器：${oldSelector}

请生成一个更可靠的CSS选择器。只输出选择器字符串，不要其他内容。`;

      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Selector regeneration timeout')), TIMEOUT_MS)
      );

      const response = await Promise.race([this.llmClient.chat(messages), timeoutPromise]);

      const newSelector = response.content.trim();

      if (
        newSelector &&
        (newSelector.startsWith('.') ||
          newSelector.startsWith('#') ||
          newSelector.startsWith('[') ||
          newSelector.startsWith('div') ||
          newSelector.startsWith('button'))
      ) {
        console.log('[BrowserExecutor] LLM generated new selector:', newSelector);
        return newSelector;
      }

      return null;
    } catch (error) {
      console.error('[BrowserExecutor] Selector regeneration error:', error);
      return null;
    }
  }

  private async wait(action: BrowserWaitAction, startTime: number): Promise<ActionResult> {
    const { selector, timeout = 10000, state = 'visible' } = action.params;

    console.log(`[BrowserExecutor] Waiting for: ${selector} (${state})`);

    try {
      if (selector) {
        await this.page.waitForSelector(selector, { state, timeout });
      } else {
        await this.page.waitForTimeout(timeout);
      }

      return {
        success: true,
        output: { waited: selector || timeout },
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'WAIT_TIMEOUT',
          message: `Wait timeout for: ${selector}`,
          recoverable: true,
        },
        duration: Date.now() - startTime,
      };
    }
  }

  private async extract(action: BrowserExtractAction, startTime: number): Promise<ActionResult> {
    const { selector, type = 'text', multiple = true } = action.params;

    console.log(`[BrowserExecutor] Extracting from: ${selector}, multiple: ${multiple}`);

    try {
      const element = this.page.locator(selector);
      let output: any;

      // 检查匹配的元素数量
      const elements = await element.all();
      const elementCount = elements.length;

      console.log(`[BrowserExecutor] Found ${elementCount} elements matching selector`);

      // 自动处理多元素场景
      if (elementCount > 1 && !multiple) {
        // 多个元素但要求单元素 → 自动取第一个
        console.log(
          `[BrowserExecutor] Multiple elements found (${elementCount}), but multiple=false. Using first element.`
        );
        const firstElement = elements[0];

        switch (type) {
          case 'text':
            output = await firstElement.textContent();
            break;
          case 'html':
            output = await firstElement.innerHTML();
            break;
          default:
            output = await firstElement.textContent();
        }
      } else if (elementCount > 1 && multiple) {
        // 多个元素且要求多元素 → 批量提取
        switch (type) {
          case 'text':
            output = await element.allTextContents();
            break;
          case 'html':
            output = await element.allInnerHTMLs();
            break;
          default:
            output = await element.allTextContents();
        }
      } else {
        // 单个元素
        switch (type) {
          case 'text':
            output = await element.textContent();
            break;
          case 'html':
            output = await element.innerHTML();
            break;
          case 'json':
            output = await element.evaluate((el: any) => {
              try {
                return JSON.parse(el.textContent || '');
              } catch {
                return el.textContent;
              }
            });
            break;
          case 'table':
            output = await element.evaluate((table: any) => {
              const rows = table.querySelectorAll('tr');
              return Array.from(rows).map((row: any) => {
                const cells = row.querySelectorAll('th, td');
                return Array.from(cells).map((c: any) => c.textContent);
              });
            });
            break;
          default:
            output = await element.textContent();
        }
      }

      return {
        success: true,
        output,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'EXTRACT_ERROR',
          message: `Extract failed: ${error.message}`,
          recoverable: true,
        },
        duration: Date.now() - startTime,
      };
    }
  }

  private async screenshot(
    action: BrowserScreenshotAction,
    startTime: number
  ): Promise<ActionResult> {
    const { fullPage = false, selector } = action.params;

    console.log(`[BrowserExecutor] Taking screenshot (fullPage: ${fullPage})`);

    try {
      let screenshot: Buffer;

      if (selector) {
        const element = this.page.locator(selector);
        screenshot = (await element.screenshot({})) as Buffer;
      } else {
        screenshot = (await this.page.screenshot({ fullPage })) as Buffer;
      }

      const base64 = screenshot.toString('base64');

      return {
        success: true,
        output: { screenshot: base64 },
        screenshots: [base64],
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'SCREENSHOT_ERROR',
          message: `Screenshot failed: ${error.message}`,
          recoverable: false,
        },
        duration: Date.now() - startTime,
      };
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.screencast) {
        this.screencast.stop();
      }
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      console.log('[BrowserExecutor] Browser cleanup complete');
    } catch (error) {
      console.error('[BrowserExecutor] Cleanup error:', error);
    }
  }

  getPage() {
    return this.page || null;
  }

  async getScreenshot(): Promise<string | null> {
    if (!this.page) return null;
    try {
      const screenshot = await this.page.screenshot();
      return (screenshot as Buffer).toString('base64');
    } catch (error) {
      console.error('[BrowserExecutor] Failed to get screenshot:', error);
      return null;
    }
  }

  async getPageContent(): Promise<string | null> {
    if (!this.page) return null;
    try {
      return await this.page.content();
    } catch (error) {
      console.error('[BrowserExecutor] Failed to get page content:', error);
      return null;
    }
  }

  async getPageUrl(): Promise<string | null> {
    if (!this.page) return null;
    try {
      return this.page.url();
    } catch (error) {
      console.error('[BrowserExecutor] Failed to get page URL:', error);
      return null;
    }
  }

  async getPageStructure(): Promise<any> {
    if (!this.page) return null;
    try {
      const structure = await this.page.evaluate(() => {
        const getUniqueSelector = (el: Element): string => {
          if (el.id) return `#${el.id}`;

          let selector = el.tagName.toLowerCase();
          if (el.className && typeof el.className === 'string') {
            const classes = el.className
              .trim()
              .split(/\s+/)
              .filter((c) => c);
            if (classes.length > 0) {
              selector += '.' + classes.slice(0, 2).join('.');
            }
          }

          const parent = el.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter((e) => e.tagName === el.tagName);
            if (siblings.length > 1) {
              const index = siblings.indexOf(el) + 1;
              selector += `:nth-child(${index})`;
            }
            const parentSelector = getUniqueSelector(parent);
            if (parentSelector) {
              return `${parentSelector} > ${selector}`;
            }
          }
          return selector;
        };

        const links: any[] = [];
        const containers: Set<string> = new Set();

        const allLinks = document.querySelectorAll('a');
        const maxLinks = 30;
        let count = 0;

        for (const link of allLinks) {
          if (count >= maxLinks) break;

          const href = link.getAttribute('href') || '';
          const text = link.textContent?.trim() || '';

          if (!href || href === '#' || href.startsWith('javascript:')) continue;
          if (!text) continue;

          const selector = getUniqueSelector(link);
          const parentEl = link.parentElement;
          let parentContext = '';
          if (parentEl) {
            if (parentEl.id) parentContext = `#${parentEl.id}`;
            else if (parentEl.className && typeof parentEl.className === 'string') {
              parentContext = '.' + parentEl.className.trim().split(/\s+/)[0];
            }
          }

          const siblings = parentEl ? Array.from(parentEl.querySelectorAll(':scope > a')) : [];
          const index = siblings.indexOf(link);

          const box = link.getBoundingClientRect();
          links.push({
            href: href.substring(0, 200),
            text: text.substring(0, 100),
            selector,
            parentContext,
            index,
            boundingBox: { x: box.x, y: box.y, width: box.width, height: box.height },
          });

          if (parentContext) containers.add(parentContext);
          count++;
        }

        // 对 links 进行排序，主要内容区的链接优先
        const sortedLinks = [...links].sort((a, b) => {
          const mainKeywords = ['feed', 'article', 'note', 'content', 'result', 'list', 'card'];
          const excludeKeywords = [
            'sidebar',
            'side-bar',
            'channel',
            'nav',
            'header',
            'footer',
            'user',
            'profile',
            'guide',
            'tab',
          ];

          const aParent = (a.parentContext || '').toLowerCase();
          const bParent = (b.parentContext || '').toLowerCase();
          const aSelector = (a.selector || '').toLowerCase();
          const bSelector = (b.selector || '').toLowerCase();

          // 第一步：排除侧边栏/导航元素（同时检查 parentContext 和 selector）
          const aIsExcluded = excludeKeywords.some(
            (k) => aParent.includes(k) || aSelector.includes(k)
          );
          const bIsExcluded = excludeKeywords.some(
            (k) => bParent.includes(k) || bSelector.includes(k)
          );

          if (aIsExcluded && !bIsExcluded) return 1; // 侧边栏排后面
          if (!aIsExcluded && bIsExcluded) return -1; // 主要内容排前面

          // 第二步：在主要内容中找包含关键词的
          const aIsMain = mainKeywords.some((k) => aParent.includes(k) || aSelector.includes(k));
          const bIsMain = mainKeywords.some((k) => bParent.includes(k) || bSelector.includes(k));

          if (aIsMain && !bIsMain) return -1;
          if (!aIsMain && bIsMain) return 1;

          // 第三步：按原始索引排序
          return a.index - b.index;
        });

        const mainContainers = Array.from(document.querySelectorAll('div[class]'))
          .filter((el) => {
            const className = (el.className as string).toLowerCase();
            const id = (el.id || '').toLowerCase();

            // 排除侧边栏、导航栏等非主要内容区
            if (
              className.includes('sidebar') ||
              className.includes('side-bar') ||
              className.includes('channel') ||
              className.includes('nav') ||
              className.includes('header') ||
              className.includes('footer') ||
              id.includes('sidebar') ||
              id.includes('channel') ||
              id.includes('nav')
            ) {
              return false;
            }

            // 匹配主要内容区
            return (
              className.includes('feed') ||
              className.includes('article') ||
              className.includes('list') ||
              className.includes('content') ||
              className.includes('card') ||
              className.includes('result') ||
              className.includes('note')
            );
          })
          .sort((a, b) => b.children.length - a.children.length)
          .slice(0, 10)
          .map((el) => ({
            selector: getUniqueSelector(el),
            childCount: el.children.length,
          }));

        return {
          title: document.title || '',
          links: sortedLinks,
          containers: Array.from(containers).slice(0, 20),
          mainContentArea: mainContainers[0]?.selector || null,
          mainContainers,
        };
      });

      return structure;
    } catch (error) {
      console.error('[BrowserExecutor] Failed to get page structure:', error);
      return null;
    }
  }

  setActiveMode(active: boolean): void {
    if (this.screencast) {
      this.screencast.setActiveMode(active);
    }
  }

  setTaskRunning(running: boolean): void {
    if (this.screencast) {
      this.screencast.setTaskRunning(running);
    }
  }

  async checkLoginPopup(): Promise<{ hasPopup: boolean; popupType?: string }> {
    if (!this.page) return { hasPopup: false };

    try {
      const result = await this.page.evaluate(() => {
        const popupSelectors = [
          '[class*="login-popup"]',
          '[class*="login-modal"]',
          '[class*="login-dialog"]',
          '[class*="login-mask"]',
          '[class*="qrcode-login"]',
          '[class*="wechat-login"]',
          '[class*="login-tip"]',
          '[class*="login-required"]',
          '.mask',
          '[class*="overlay"]',
          '[class*="popup"]',
        ];

        for (const selector of popupSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            const style = window.getComputedStyle(el);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              return { hasPopup: true, popupType: selector };
            }
          }
        }

        return { hasPopup: false };
      });

      return result;
    } catch (error) {
      console.error('[BrowserExecutor] Failed to check login popup:', error);
      return { hasPopup: false };
    }
  }
}

export default BrowserExecutor;
