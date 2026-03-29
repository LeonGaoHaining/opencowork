/**
 * AgentIpcBridge - Agent IPC 桥接层
 * 负责将 SubAgent 的调用转发到主进程执行器
 *
 * 使用方式：
 * - 在 Renderer 进程中创建桥接实例
 * - 将桥接实例注入到 SubAgent
 * - SubAgent 通过桥接调用主进程 BrowserExecutor/CLIExecutor
 */

export interface BrowserActionParams {
  action: string;
  url?: string;
  selector?: string;
  text?: string;
  timeout?: number;
  index?: number;
  textMatch?: string;
  script?: string;
  multiple?: boolean;
}

export interface CLIActionParams {
  command: string;
  args?: string[];
  timeout?: number;
}

export interface VisionActionParams {
  action: string;
  target?: string;
  prompt?: string;
}

export interface AgentIpcBridgeOptions {
  timeout?: number;
}

export class AgentIpcBridge {
  private timeout: number;
  private ipcRenderer: any;

  constructor(options: AgentIpcBridgeOptions = {}) {
    this.timeout = options.timeout || 30000;

    if (typeof window !== 'undefined' && (window as any).electron) {
      this.ipcRenderer = (window as any).electron;
    }
  }

  async executeBrowser(params: BrowserActionParams): Promise<any> {
    console.log('[AgentIpcBridge] executeBrowser:', params);

    if (!this.ipcRenderer) {
      console.warn('[AgentIpcBridge] IPC not available, returning mock response');
      return this.getMockBrowserResponse(params.action);
    }

    try {
      const result = await this.ipcRenderer.invoke('agent:browser', params);
      console.log('[AgentIpcBridge] Browser result:', result);
      return result;
    } catch (error: any) {
      console.error('[AgentIpcBridge] Browser error:', error);
      throw error;
    }
  }

  async executeCLI(params: CLIActionParams): Promise<any> {
    console.log('[AgentIpcBridge] executeCLI:', params);

    if (!this.ipcRenderer) {
      console.warn('[AgentIpcBridge] IPC not available, returning mock response');
      return {
        success: true,
        output: `[Mock] CLI command: ${params.command} ${params.args?.join(' ') || ''}`,
      };
    }

    try {
      const result = await this.ipcRenderer.invoke('agent:cli', params);
      console.log('[AgentIpcBridge] CLI result:', result);
      return result;
    } catch (error: any) {
      console.error('[AgentIpcBridge] CLI error:', error);
      throw error;
    }
  }

  async executeVision(params: VisionActionParams): Promise<any> {
    console.log('[AgentIpcBridge] executeVision:', params);

    if (!this.ipcRenderer) {
      console.warn('[AgentIpcBridge] IPC not available, returning mock response');
      return {
        success: true,
        output: `[Mock] Vision action: ${params.action}`,
      };
    }

    try {
      const result = await this.ipcRenderer.invoke('agent:vision', params);
      console.log('[AgentIpcBridge] Vision result:', result);
      return result;
    } catch (error: any) {
      console.error('[AgentIpcBridge] Vision error:', error);
      throw error;
    }
  }

  private getMockBrowserResponse(action: string): any {
    const mockResponses: Record<string, any> = {
      navigate: { success: true, url: 'https://www.example.com' },
      click: { success: true, message: 'Click executed' },
      input: { success: true, message: 'Input executed' },
      wait: { success: true, message: 'Wait completed' },
      extract: { success: true, output: ['Mock extract result 1', 'Mock extract result 2'] },
      screenshot: { success: true, data: 'base64_mock_screenshot' },
      evaluate: { success: true, result: 'Mock eval result' },
      getPageInfo: { success: true, url: 'https://www.example.com', title: 'Example Domain' },
    };

    return mockResponses[action] || { success: true, message: `Mock ${action}` };
  }

  isAvailable(): boolean {
    return !!this.ipcRenderer;
  }
}

let bridgeInstance: AgentIpcBridge | null = null;

export function getAgentIpcBridge(options?: AgentIpcBridgeOptions): AgentIpcBridge {
  if (!bridgeInstance) {
    bridgeInstance = new AgentIpcBridge(options);
  }
  return bridgeInstance;
}

export function createAgentIpcBridge(options?: AgentIpcBridgeOptions): AgentIpcBridge {
  return new AgentIpcBridge(options);
}

export default AgentIpcBridge;
