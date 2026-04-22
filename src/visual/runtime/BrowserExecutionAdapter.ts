import { BrowserExecutor } from '../../core/executor/BrowserExecutor';
import {
  ActionExecutionResult,
  UIAction,
  VisualObservation,
  VisualPageContext,
  VisualTurnError,
} from '../types/visualProtocol';
import { normalizeAction, normalizeDragPath } from './ActionNormalizer';

export interface BrowserExecutionAdapter {
  captureObservation(): Promise<VisualObservation>;

  executeActions(actions: UIAction[]): Promise<ActionExecutionResult>;

  getPageContext(): Promise<VisualPageContext>;
}

export class PlaywrightBrowserExecutionAdapter implements BrowserExecutionAdapter {
  constructor(private readonly browserExecutor: BrowserExecutor) {}

  async captureObservation(): Promise<VisualObservation> {
    const [screenshotBase64, url, domSummary, pageStructure] = await Promise.all([
      this.browserExecutor.getScreenshot(),
      this.browserExecutor.getPageUrl(),
      this.browserExecutor.getPageContent(),
      this.browserExecutor.getPageStructure(),
    ]);

    const title = await this.getPageTitle();

    return {
      screenshotBase64: screenshotBase64 || undefined,
      screenshotMimeType: screenshotBase64 ? 'image/png' : undefined,
      page: {
        url: url || undefined,
        title: title || undefined,
        domSummary: domSummary ? domSummary.slice(0, 4000) : undefined,
        pageStructure,
      },
      textualHints: title || url || undefined,
    };
  }

  async executeActions(actions: UIAction[]): Promise<ActionExecutionResult> {
    const page = this.browserExecutor.getPage();
    if (!page) {
      return {
        success: false,
        executed: [],
        error: this.createError('PAGE_NOT_READY', 'Browser page is not ready', true),
      };
    }

    const executed: UIAction[] = [];

    try {
      for (const rawAction of actions) {
        const action = normalizeAction(rawAction);
        switch (action.type) {
          case 'click':
            await page.mouse.click(action.x, action.y, { button: action.button || 'left' });
            break;
          case 'double_click':
            await page.mouse.dblclick(action.x, action.y, { button: action.button || 'left' });
            break;
          case 'move':
            await page.mouse.move(action.x, action.y);
            break;
          case 'drag': {
            const path = normalizeDragPath(action.path);
            if (path.length < 2) {
              throw new Error('drag action requires at least two path points');
            }
            const [[startX, startY], ...rest] = path;
            await page.mouse.move(startX, startY);
            await page.mouse.down();
            for (const [x, y] of rest) {
              await page.mouse.move(x, y);
            }
            await page.mouse.up();
            break;
          }
          case 'scroll':
            await page.mouse.move(action.x || 0, action.y || 0);
            await page.mouse.wheel(action.scrollX || 0, action.scrollY || 0);
            break;
          case 'keypress':
            for (const key of action.keys || []) {
              await page.keyboard.press(key);
            }
            break;
          case 'type':
            await page.keyboard.type(action.text || '');
            break;
          case 'wait':
            await page.waitForTimeout(action.durationMs || 2000);
            break;
          case 'screenshot':
            await this.browserExecutor.getScreenshot();
            break;
          default:
            throw new Error(`Unsupported action type: ${(action as UIAction).type}`);
        }
        executed.push(action);
      }

      return {
        success: true,
        executed,
      };
    } catch (error: any) {
      return {
        success: false,
        executed,
        error: this.createError('ACTION_EXECUTION_FAILED', error?.message || String(error), true),
      };
    }
  }

  async getPageContext(): Promise<VisualPageContext> {
    const observation = await this.captureObservation();
    return observation.page || {};
  }

  private async getPageTitle(): Promise<string | null> {
    const page = this.browserExecutor.getPage();
    if (!page) {
      return null;
    }

    try {
      return await page.title();
    } catch (error) {
      console.error('[PlaywrightBrowserExecutionAdapter] Failed to get page title:', error);
      return null;
    }
  }

  private createError(code: string, message: string, recoverable: boolean): VisualTurnError {
    return { code, message, recoverable };
  }
}
