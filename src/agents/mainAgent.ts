/**
 * Main Agent - LangGraph ReAct 主 Agent
 * 负责任务理解、分发、结果汇总
 *
 * 注意：此文件为 v0.4 架构占位符
 * 实际集成需要与现有 TaskEngine、BrowserExecutor 等模块对接
 */

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export interface AgentConfig {
  modelName?: string;
  temperature?: number;
  threadId?: string;
}

export interface AgentResult {
  success: boolean;
  output?: any;
  error?: string;
  messages?: any[];
}

// Browser Tool 定义
const browserTool = tool(
  async (params: { action: string; url?: string; selector?: string; text?: string }) => {
    console.log('[BrowserTool] Executing:', params);
    return { success: true, action: params.action, result: 'Browser operation completed' };
  },
  {
    name: 'browser',
    description: `浏览器操作工具，支持以下操作：
- goto: 导航到指定 URL
- click: 点击页面元素
- input: 在输入框中输入文本
- wait: 等待元素出现
- extract: 提取页面内容
- screenshot: 截取当前页面截图`,
    schema: z.object({
      action: z.enum(['goto', 'click', 'input', 'wait', 'extract', 'screenshot']),
      url: z.string().optional(),
      selector: z.string().optional(),
      text: z.string().optional(),
    }),
  }
);

// CLI Tool 定义
const cliTool = tool(
  async (params: { command: string; args?: string[] }) => {
    console.log('[CLITool] Executing:', params);
    return { success: true, command: params.command, result: 'CLI operation completed' };
  },
  {
    name: 'cli',
    description: '系统命令执行工具，用于执行白名单内的系统命令',
    schema: z.object({
      command: z.string(),
      args: z.array(z.string()).optional(),
    }),
  }
);

// Vision Tool 定义
const visionTool = tool(
  async (params: { action: string; target?: string }) => {
    console.log('[VisionTool] Executing:', params);
    return { success: true, action: params.action, result: 'Vision operation completed' };
  },
  {
    name: 'vision',
    description: '视觉处理工具，用于分析图片和屏幕内容',
    schema: z.object({
      action: z.enum(['ocr', 'analyze', 'screenshot']),
      target: z.string().optional(),
    }),
  }
);

// Planner Tool 定义
const plannerTool = tool(
  async (params: { task: string; context?: string }) => {
    console.log('[PlannerTool] Executing:', params);
    return { success: true, task: params.task, result: 'Planning completed' };
  },
  {
    name: 'planner',
    description: '任务规划工具，用于分析和规划复杂任务',
    schema: z.object({
      task: z.string(),
      context: z.string().optional(),
    }),
  }
);

// 可用工具列表
const availableTools = [browserTool, cliTool, visionTool, plannerTool];

export class MainAgent {
  private agent: any;
  private config: AgentConfig;
  private threadId: string;
  private model: ChatOpenAI;

  constructor(config: AgentConfig = {}) {
    this.config = {
      modelName: config.modelName || 'gpt-4-turbo',
      temperature: config.temperature || 0,
    };
    this.threadId = config.threadId || `thread-${Date.now()}`;
    this.model = new ChatOpenAI({
      model: this.config.modelName,
      temperature: this.config.temperature,
    });
  }

  async initialize(): Promise<void> {
    this.agent = createReactAgent({
      llm: this.model,
      tools: availableTools,
      stateModifier: `你是一个浏览器自动化助手，擅长理解用户任务并分解执行。

可用工具：
1. browser - 用于浏览器操作（打开网页、点击、输入、提取内容）
2. cli - 用于执行系统命令
3. vision - 用于分析图片和屏幕内容
4. planner - 用于分析和规划复杂任务

根据用户任务，选择合适的工具来完成任务。
如果任务需要多个步骤，请按顺序执行。`,
    });

    console.log('[MainAgent] Initialized with thread:', this.threadId);
  }

  async run(task: string): Promise<AgentResult> {
    if (!this.agent) {
      await this.initialize();
    }

    console.log('[MainAgent] Running task:', task);

    try {
      const result = await this.agent.invoke(
        { messages: [{ role: 'user', content: task }] },
        { configurable: { thread_id: this.threadId } }
      );

      console.log('[MainAgent] Task completed');
      return {
        success: true,
        output: result,
        messages: result.messages,
      };
    } catch (error: any) {
      console.error('[MainAgent] Task failed:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  setThreadId(threadId: string): void {
    this.threadId = threadId;
  }

  getThreadId(): string {
    return this.threadId;
  }
}

export async function createMainAgent(config?: AgentConfig): Promise<MainAgent> {
  const agent = new MainAgent(config);
  await agent.initialize();
  return agent;
}

export default MainAgent;
