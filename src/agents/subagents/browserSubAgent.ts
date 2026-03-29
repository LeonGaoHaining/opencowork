/**
 * BrowserSubAgent - 浏览器子 Agent
 * 负责浏览器操作的精细控制
 *
 * 基于现有 BrowserExecutor 实现
 * 通过 IPC 与主进程通信
 */

import { z } from 'zod';
import {
  BaseSubAgent,
  SubAgentConfig,
  SubAgentResult,
  createErrorResponse,
  createSuccessResponse,
} from './baseSubAgent';

export const BrowserActions = z.enum([
  'goto',
  'click',
  'input',
  'wait',
  'extract',
  'screenshot',
  'evaluate',
  'getPageInfo',
]);

export type BrowserActionType = z.infer<typeof BrowserActions>;

export interface BrowserParams {
  action: BrowserActionType;
  url?: string;
  selector?: string;
  text?: string;
  timeout?: number;
  index?: number;
  textMatch?: string;
  script?: string;
}

const BrowserParamsSchema = z.object({
  action: BrowserActions,
  url: z.string().optional(),
  selector: z.string().optional(),
  text: z.string().optional(),
  timeout: z.number().optional(),
  index: z.number().optional(),
  textMatch: z.string().optional(),
  script: z.string().optional(),
});

export class BrowserSubAgent extends BaseSubAgent {
  private ipcBridge: any;

  constructor(ipcBridge?: any) {
    const config: SubAgentConfig = {
      name: 'browser',
      description: `浏览器操作子 Agent，用于执行网页自动化任务。
      
支持的操作：
- goto: 导航到指定 URL
- click: 点击页面元素
- input: 在输入框中输入文本
- wait: 等待元素出现
- extract: 提取页面内容
- screenshot: 截取当前页面截图
- evaluate: 执行 JavaScript 代码
- getPageInfo: 获取页面信息`,
    };
    super(config);
    this.ipcBridge = ipcBridge;
  }

  setIpcBridge(bridge: any): void {
    this.ipcBridge = bridge;
  }

  protected getSchema(): z.ZodType<any> {
    return BrowserParamsSchema;
  }

  async execute(params: BrowserParams): Promise<SubAgentResult> {
    const { action } = params;

    console.log(`[BrowserSubAgent] Executing action: ${action}`, params);

    try {
      switch (action) {
        case 'goto':
          return await this.handleGoto(params);
        case 'click':
          return await this.handleClick(params);
        case 'input':
          return await this.handleInput(params);
        case 'wait':
          return await this.handleWait(params);
        case 'extract':
          return await this.handleExtract(params);
        case 'screenshot':
          return await this.handleScreenshot(params);
        case 'evaluate':
          return await this.handleEvaluate(params);
        case 'getPageInfo':
          return await this.handleGetPageInfo(params);
        default:
          return createErrorResponse(`Unknown action: ${action}`);
      }
    } catch (error: any) {
      console.error('[BrowserSubAgent] Error:', error);
      return createErrorResponse(error.message || 'Browser operation failed');
    }
  }

  private async handleGoto(params: BrowserParams): Promise<SubAgentResult> {
    if (!params.url) {
      return createErrorResponse('URL is required for goto action');
    }

    if (this.ipcBridge) {
      const result = await this.ipcBridge.executeBrowser({
        action: 'navigate',
        url: params.url,
        timeout: params.timeout || 30000,
      });
      return createSuccessResponse(result);
    }

    return createSuccessResponse({
      action: 'goto',
      url: params.url,
      message: 'Browser navigation (IPC not connected)',
    });
  }

  private async handleClick(params: BrowserParams): Promise<SubAgentResult> {
    if (!params.selector) {
      return createErrorResponse('Selector is required for click action');
    }

    if (this.ipcBridge) {
      const result = await this.ipcBridge.executeBrowser({
        action: 'click',
        selector: params.selector,
        index: params.index,
        textMatch: params.textMatch,
      });
      return createSuccessResponse(result);
    }

    return createSuccessResponse({
      action: 'click',
      selector: params.selector,
      message: 'Click executed (IPC not connected)',
    });
  }

  private async handleInput(params: BrowserParams): Promise<SubAgentResult> {
    if (!params.selector || params.text === undefined) {
      return createErrorResponse('Selector and text are required for input action');
    }

    if (this.ipcBridge) {
      const result = await this.ipcBridge.executeBrowser({
        action: 'input',
        selector: params.selector,
        text: params.text,
      });
      return createSuccessResponse(result);
    }

    return createSuccessResponse({
      action: 'input',
      selector: params.selector,
      text: params.text,
      message: 'Input executed (IPC not connected)',
    });
  }

  private async handleWait(params: BrowserParams): Promise<SubAgentResult> {
    if (!params.selector) {
      return createErrorResponse('Selector is required for wait action');
    }

    if (this.ipcBridge) {
      const result = await this.ipcBridge.executeBrowser({
        action: 'wait',
        selector: params.selector,
        timeout: params.timeout || 10000,
      });
      return createSuccessResponse(result);
    }

    return createSuccessResponse({
      action: 'wait',
      selector: params.selector,
      message: 'Wait executed (IPC not connected)',
    });
  }

  private async handleExtract(params: BrowserParams): Promise<SubAgentResult> {
    if (!params.selector) {
      return createErrorResponse('Selector is required for extract action');
    }

    if (this.ipcBridge) {
      const result = await this.ipcBridge.executeBrowser({
        action: 'extract',
        selector: params.selector,
        multiple: true,
      });
      return createSuccessResponse(result);
    }

    return createSuccessResponse({
      action: 'extract',
      selector: params.selector,
      message: 'Extract executed (IPC not connected)',
    });
  }

  private async handleScreenshot(params: BrowserParams): Promise<SubAgentResult> {
    if (this.ipcBridge) {
      const result = await this.ipcBridge.executeBrowser({
        action: 'screenshot',
      });
      return createSuccessResponse(result);
    }

    return createSuccessResponse({
      action: 'screenshot',
      message: 'Screenshot captured (IPC not connected)',
    });
  }

  private async handleEvaluate(params: BrowserParams): Promise<SubAgentResult> {
    if (!params.script) {
      return createErrorResponse('Script is required for evaluate action');
    }

    if (this.ipcBridge) {
      const result = await this.ipcBridge.executeBrowser({
        action: 'evaluate',
        script: params.script,
      });
      return createSuccessResponse(result);
    }

    return createSuccessResponse({
      action: 'evaluate',
      script: params.script,
      message: 'Evaluate executed (IPC not connected)',
    });
  }

  private async handleGetPageInfo(params: BrowserParams): Promise<SubAgentResult> {
    if (this.ipcBridge) {
      const result = await this.ipcBridge.executeBrowser({
        action: 'getPageInfo',
      });
      return createSuccessResponse(result);
    }

    return createSuccessResponse({
      action: 'getPageInfo',
      url: 'about:blank',
      title: 'Page Info (IPC not connected)',
    });
  }
}

export function createBrowserSubAgent(ipcBridge?: any): BrowserSubAgent {
  return new BrowserSubAgent(ipcBridge);
}

export default BrowserSubAgent;
