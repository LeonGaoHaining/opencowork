/**
 * Main Agent - LangGraph ReAct 主 Agent
 * 负责任务理解、分发、结果汇总
 * v0.4 主架构
 */

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { BrowserWindow } from 'electron';
import { getCheckpointer, AgentCheckpointer } from '../checkpointers/agentCheckpointer';
import { getLogger, LoggerConfig } from './agentLogger';
import { getBrowserExecutor } from '../main/ipcHandlers';
import { getCLIExecutor } from '../main/ipcHandlers';
import { ActionType, generateId } from '../core/action/ActionSchema';
import { loadLLMConfig } from '../llm/config';
import { webfetchTool } from '../tools/webfetch/WebFetchTool';
import { websearchTool } from '../tools/websearch/WebSearchTool';
import { schedulerTool } from '../tools/scheduler/SchedulerTool';
import { getSkillToolFactory, SkillToolFactory } from '../tools/skill/SkillToolFactory';
import { recordingTools } from '../tools/skill/RecordingTools';
import { listSkillsTool } from '../tools/skill/ListSkillsTool';
import { getSkillLoader } from '../skills/skillLoader';
import { getHistoryService } from '../history/historyService';

function cleanHtmlText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface AgentConfig {
  modelName?: string;
  temperature?: number;
  threadId?: string;
  checkpointerEnabled?: boolean;
  logger?: LoggerConfig;
}

export interface AgentStep {
  id: string;
  toolName: string;
  args: any;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: any;
  duration?: number;
}

export interface AgentResult {
  success: boolean;
  output?: any;
  error?: string;
  messages?: any[];
  duration?: number;
  steps?: AgentStep[];
  finalMessage?: string;
}

export type AgentStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';

let currentAgentInstance: MainAgent | null = null;

function getAgent(): MainAgent | null {
  return currentAgentInstance;
}

export function clearAgentInstance(): void {
  currentAgentInstance = null;
  console.log('[MainAgent] Instance cleared');
}

// Browser Tool 定义
const browserTool = tool(
  async (params: {
    action: string;
    url?: string;
    selector?: string;
    text?: string;
    timeout?: number;
    index?: number;
  }) => {
    const logger = getLogger();
    const startTime = Date.now();
    const agent = getAgent();

    try {
      const executor = getBrowserExecutor();
      let result: any;

      switch (params.action) {
        case 'goto':
          if (!params.url)
            return { success: false, error: { code: 'MISSING_PARAM', message: 'URL is required' } };
          agent?.sendNodeStart('browser', 'goto', { url: params.url });
          logger.logToolCall(
            'browser',
            { action: 'goto', url: params.url },
            'main-agent',
            params.url
          );
          result = await executor.execute({
            id: `browser-goto-${Date.now()}`,
            type: ActionType.BROWSER_NAVIGATE,
            description: 'Navigate to URL',
            params: { url: params.url, waitUntil: 'domcontentloaded' },
          });
          break;
        case 'click':
          if (!params.selector)
            return {
              success: false,
              error: { code: 'MISSING_PARAM', message: 'Selector is required' },
            };
          agent?.sendNodeStart('browser', 'click', { selector: params.selector });
          logger.logToolCall(
            'browser',
            { action: 'click', selector: params.selector },
            'main-agent',
            params.selector
          );
          result = await executor.execute({
            id: `browser-click-${Date.now()}`,
            type: ActionType.BROWSER_CLICK,
            description: 'Click element',
            params: { selector: params.selector, index: params.index },
          });
          break;
        case 'input':
          if (!params.selector)
            return {
              success: false,
              error: { code: 'MISSING_PARAM', message: 'Selector is required' },
            };
          agent?.sendNodeStart('browser', 'input', {
            selector: params.selector,
            text: params.text,
          });
          logger.logToolCall(
            'browser',
            { action: 'input', selector: params.selector, text: params.text },
            'main-agent',
            params.selector
          );
          result = await executor.execute({
            id: generateId(),
            type: ActionType.BROWSER_INPUT,
            description: 'Input text',
            params: { selector: params.selector, text: params.text || '', clear: true },
          });
          break;
        case 'wait':
          if (!params.selector)
            return {
              success: false,
              error: { code: 'MISSING_PARAM', message: 'Selector is required' },
            };
          agent?.sendNodeStart('browser', 'wait', { selector: params.selector });
          logger.logToolCall(
            'browser',
            { action: 'wait', selector: params.selector },
            'main-agent',
            params.selector
          );
          result = await executor.execute({
            id: generateId(),
            type: ActionType.BROWSER_WAIT,
            description: 'Wait for element',
            params: { selector: params.selector, timeout: params.timeout || 10000 },
          });
          break;
        case 'extract':
          if (!params.selector)
            return {
              success: false,
              error: { code: 'MISSING_PARAM', message: 'Selector is required' },
            };
          agent?.sendNodeStart('browser', 'extract', { selector: params.selector });
          logger.logToolCall(
            'browser',
            { action: 'extract', selector: params.selector },
            'main-agent',
            params.selector
          );
          result = await executor.execute({
            id: generateId(),
            type: ActionType.BROWSER_EXTRACT,
            description: 'Extract content',
            params: { selector: params.selector, type: 'text', multiple: true },
          });
          if (result.success && result.output) {
            if (Array.isArray(result.output)) {
              result.output = result.output.map((item: any) => {
                if (typeof item === 'string') return cleanHtmlText(item);
                return item;
              });
              result.output = result.output.join('\n').substring(0, 2000);
            } else if (typeof result.output === 'string') {
              result.output = cleanHtmlText(result.output).substring(0, 2000);
            }
          }
          break;
        case 'screenshot':
          agent?.sendNodeStart('browser', 'screenshot', {});
          logger.logToolCall('browser', { action: 'screenshot' }, 'main-agent', 'screenshot');
          result = await executor.execute({
            id: generateId(),
            type: ActionType.BROWSER_SCREENSHOT,
            description: 'Take screenshot',
            params: {},
          });
          break;
        default:
          return {
            success: false,
            error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${params.action}` },
          };
      }

      const duration = Date.now() - startTime;
      agent?.sendNodeComplete('browser', params.action, result, duration, params);
      if (result.success) {
        logger.logToolResult('browser', result, duration, 'main-agent', params.action);
      } else {
        logger.logToolResult(
          'browser',
          result,
          duration,
          'main-agent',
          params.action,
          result.error?.message
        );
      }

      // v2.0: Sync webview with Agent browser
      try {
        const currentUrl = executor.getCurrentPageUrl();
        const { getMainWindowRef } = await import('../main/ipcHandlers.js');
        const mainWindow = getMainWindowRef();
        if (mainWindow && !mainWindow.isDestroyed() && currentUrl) {
          mainWindow.webContents.send('browser:webviewNavigate', { url: currentUrl });
        }
      } catch (syncError) {
        console.warn('[BrowserTool] Failed to sync webview:', syncError);
      }

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('[BrowserTool] Error:', error);
      agent?.sendNodeComplete('browser', params.action, { error: error.message }, duration, params);
      logger.logToolResult(
        'browser',
        { error: error.message },
        duration,
        'main-agent',
        params.action,
        error.message
      );
      return { success: false, error: { code: 'BROWSER_ERROR', message: error.message } };
    }
  },
  {
    name: 'browser',
    description: '浏览器操作工具，支持 goto/click/input/wait/extract/screenshot',
    schema: z.object({
      action: z.enum(['goto', 'click', 'input', 'wait', 'extract', 'screenshot']),
      url: z.string().optional(),
      selector: z.string().optional(),
      text: z.string().optional(),
      timeout: z.number().optional(),
      index: z.number().optional(),
    }),
  }
);

// CLI Tool 定义
const cliTool = tool(
  async (params: { command: string; args?: string[]; workingDir?: string }) => {
    const logger = getLogger();
    const startTime = Date.now();
    const agent = getAgent();

    agent?.sendNodeStart('cli', 'execute', {
      command: params.command,
      args: params.args,
      workingDir: params.workingDir,
    });

    logger.logToolCall(
      'cli',
      { command: params.command, args: params.args },
      'main-agent',
      params.command
    );

    try {
      const executor = getCLIExecutor();
      const result = await executor.execute({
        id: generateId(),
        type: ActionType.CLI_EXECUTE,
        description: `Execute CLI: ${params.command}`,
        params: {
          command: params.command,
          workingDir: params.workingDir,
        },
      } as any);
      const duration = Date.now() - startTime;

      agent?.sendNodeComplete('cli', 'execute', result, duration, params);

      if (result.success) {
        logger.logToolResult('cli', result, duration, 'main-agent', params.command);
      } else {
        logger.logToolResult(
          'cli',
          result,
          duration,
          'main-agent',
          params.command,
          result.error?.message
        );
      }
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('[CLITool] Error:', error);
      agent?.sendNodeComplete('cli', 'execute', { error: error.message }, duration, params);
      logger.logToolResult(
        'cli',
        { error: error.message },
        duration,
        'main-agent',
        params.command,
        error.message
      );
      return { success: false, error: { code: 'CLI_ERROR', message: error.message } };
    }
  },
  {
    name: 'cli',
    description: '系统命令执行工具',
    schema: z.object({
      command: z.string(),
      args: z.array(z.string()).optional(),
      workingDir: z.string().optional(),
    }),
  }
);

// Vision Tool 定义 (TODO: 等待 VisionExecutor 实现)
const visionTool = tool(
  async (params: { action: string; target?: string }) => {
    const logger = getLogger();
    const startTime = Date.now();
    logger.logToolCall('vision', params, 'main-agent', params.action);
    console.log('[VisionTool] Executing:', params);
    const result = {
      success: true,
      action: params.action,
      result: 'Vision operation completed (placeholder)',
    };
    const duration = Date.now() - startTime;
    logger.logToolResult('vision', result, duration, 'main-agent', params.action);
    return result;
  },
  {
    name: 'vision',
    description: '视觉处理工具 (TODO: 等待 VisionExecutor 实现)',
    schema: z.object({
      action: z.enum(['ocr', 'analyze', 'screenshot']),
      target: z.string().optional(),
    }),
  }
);

// Planner Tool 定义 (TODO: 使用现有 TaskPlanner)
const plannerTool = tool(
  async (params: { task: string; context?: string }) => {
    const logger = getLogger();
    const startTime = Date.now();
    logger.logToolCall('planner', params, 'main-agent', params.task);
    console.log('[PlannerTool] Executing:', params);
    const result = { success: true, task: params.task, result: 'Planning completed (placeholder)' };
    const duration = Date.now() - startTime;
    logger.logToolResult('planner', result, duration, 'main-agent', params.task);
    return result;
  },
  {
    name: 'planner',
    description: '任务规划工具 (TODO: 集成现有 TaskPlanner)',
    schema: z.object({
      task: z.string(),
      context: z.string().optional(),
    }),
  }
);

const baseTools = [
  browserTool,
  cliTool,
  visionTool,
  plannerTool,
  webfetchTool,
  websearchTool,
  schedulerTool,
  listSkillsTool,
  ...recordingTools,
];

let skillTools: any[] = [];

export async function loadSkillTools(): Promise<any[]> {
  try {
    const skillLoader = getSkillLoader();
    const skills = await skillLoader.loadAllSkills();
    const skillFactory = getSkillToolFactory();
    skillTools = skillFactory.createToolsFromSkills(skills);
    console.log(`[MainAgent] Loaded ${skillTools.length} skill tools`);
    return skillTools;
  } catch (error) {
    console.error('[MainAgent] Failed to load skill tools:', error);
    return [];
  }
}

function getAvailableTools(): any[] {
  return [...baseTools, ...skillTools];
}

const STATE_MODIFIER = `你是一个浏览器自动化助手，擅长理解用户任务并分解执行。

可用工具：
1. browser - 用于浏览器操作（打开网页、点击、输入、提取内容）
   - 重要：当需要获取页面文本内容时，优先使用 extract 工具而非 screenshot
   - screenshot 仅在需要分析视觉元素（如图标、图片、布局问题）时才使用
   - 注意：browser 工具仅适用于网页内容，不适合打开本地文件
2. cli - 用于执行系统命令
   - 本地文件（.pptx, .pdf, .docx, .xlsx, .jpg, .png 等）应使用 cli 工具的 xdg-open/gio open/convert 等命令
   - 示例：使用 "xdg-open 文件路径.pptx" 或 "gio open 文件路径.pdf" 打开本地文件
3. vision - 用于分析图片和屏幕内容
4. planner - 用于分析和规划复杂任务
5. webfetch - 用于获取指定URL的网页内容（支持text/markdown/html格式）
   - 适用场景：数据采集、API调用、静态网页内容获取
   - 特点：比browser工具更轻量更快，但不执行JavaScript
6. websearch - 用于实时网络搜索（Exa AI）
   - 适用场景：查询最新信息、新闻、实时数据
7. scheduler - 用于管理定时任务（Cron任务）
   - 支持操作：list（列出所有任务）、create（创建任务）、update（更新任务）、delete（删除任务）、trigger（手动触发任务）
   - 适用场景：创建/管理定时执行的自动化任务
8. list_skills - 用于列出所有已安装的 Skills
   - 适用场景：用户询问"有哪些skill"或"列出所有技能"时使用
9. start_skill_recording - 开始录制 Skill
10. finish_skill_recording - 完成录制并生成 Skill 文件

执行流程：
1. 理解用户任务
2. 选择合适的工具执行
3. 工具执行完成后，分析提取的内容，找到用户问题的答案

重要规则（强制要求）：
- 你必须为每次用户请求生成一个文字回复
- 搜索任务流程：
  1. 使用 extract 工具或 webfetch 工具提取页面内容
  2. 分析提取的内容，找到用户问题的答案
  3. 用简洁的语言回答用户的问题
- 你的最终回复格式：
  首先直接回答用户的问题（1-2句话）
  然后提供支持这个结论的证据
- 禁止返回空内容
- 禁止只执行工具就结束对话`;

export class MainAgent {
  private agent: any;
  private config: AgentConfig;
  private threadId: string;
  private model: ChatOpenAI;
  private checkpointer: AgentCheckpointer;
  private checkpointerEnabled: boolean;
  private logger: ReturnType<typeof getLogger>;

  private mainWindow: BrowserWindow | null = null;
  private previewWindow: BrowserWindow | null = null;
  private status: AgentStatus = 'idle';
  private cancelRequested: boolean = false;
  private pauseRequested: boolean = false;
  private currentTask: string = '';

  constructor(config: AgentConfig = {}) {
    this.config = {
      modelName: config.modelName,
      temperature: config.temperature ?? 0,
      checkpointerEnabled: config.checkpointerEnabled !== false,
    };
    this.threadId = config.threadId || `thread-${Date.now()}`;
    const llmConfig = loadLLMConfig();
    this.model = new ChatOpenAI({
      model: this.config.modelName || llmConfig.model || 'gpt-4-turbo',
      temperature: this.config.temperature ?? 0,
      apiKey: llmConfig.apiKey,
      configuration: {
        baseURL: llmConfig.baseUrl,
      },
      timeout: llmConfig.timeout || 60000,
      maxRetries: llmConfig.maxRetries || 3,
    });
    this.checkpointer = getCheckpointer({ type: 'memory' });
    this.checkpointerEnabled = this.config.checkpointerEnabled ?? true;
    this.logger = getLogger(config.logger);
  }

  setMainWindow(window: BrowserWindow | null): void {
    console.log('[MainAgent] setMainWindow called:', {
      windowExists: !!window,
      windowDestroyed: window?.isDestroyed(),
    });
    this.mainWindow = window;
  }

  setPreviewWindow(window: BrowserWindow | null): void {
    this.previewWindow = window;
  }

  async reloadSkills(): Promise<void> {
    console.log('[MainAgent] Reloading skill tools...');
    await loadSkillTools();
    if (this.agent) {
      this.agent = createReactAgent({
        llm: this.model,
        tools: getAvailableTools(),
        stateModifier: STATE_MODIFIER,
        checkpointer: this.checkpointerEnabled ? this.checkpointer.getCheckpointer() : undefined,
      });
      console.log('[MainAgent] Skill tools reloaded, agent updated');
    }
  }

  getThreadId(): string {
    return this.threadId;
  }

  setThreadId(threadId: string): void {
    this.threadId = threadId;
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  isRunning(): boolean {
    return this.status === 'running';
  }

  requestCancel(): void {
    this.cancelRequested = true;
    this.status = 'cancelled';
    this.logger.logEvent({
      threadId: this.threadId,
      eventType: 'error',
      level: 'warn',
      task: this.currentTask,
      error: 'Cancel requested',
    });
  }

  pause(): void {
    this.pauseRequested = true;
    this.status = 'paused';
  }

  resume(): void {
    this.pauseRequested = false;
    this.status = 'running';
  }

  private sendToRenderer(channel: string, data: any): void {
    console.log('[MainAgent] sendToRenderer:', {
      channel,
      mainWindowExists: !!this.mainWindow,
      mainWindowDestroyed: this.mainWindow?.isDestroyed(),
      dataKeys: Object.keys(data || {}),
    });

    try {
      if (!this.mainWindow) {
        console.error('[MainAgent] mainWindow is null!');
        return;
      }
      if (this.mainWindow.isDestroyed()) {
        console.error('[MainAgent] mainWindow is destroyed!');
        return;
      }
      this.mainWindow.webContents.send(channel, data);
      console.log(`[MainAgent] ✅ Sent to mainWindow: ${channel}`);
    } catch (error) {
      console.error('[MainAgent] Failed to send to renderer:', error);
    }
  }

  private generateNodeId(toolName: string, action: string, input: any): string {
    const inputStr = JSON.stringify(input || {});
    const hash = this.simpleHash(inputStr);
    return `${toolName}-${action}-${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }

  sendNodeStart(toolName: string, action: string, input: any): void {
    const nodeId = this.generateNodeId(toolName, action, input);
    this.sendToRenderer('task:nodeStart', {
      type: 'node_start',
      node: {
        id: nodeId,
        action: {
          type: action,
          description: `${toolName} ${action}`,
          params: input,
        },
      },
      handleId: this.threadId,
    });
  }

  sendNodeComplete(
    toolName: string,
    action: string,
    output: any,
    duration: number,
    input?: any
  ): void {
    const nodeId = this.generateNodeId(toolName, action, input || {});
    this.sendToRenderer('task:nodeComplete', {
      type: 'node_complete',
      node: {
        id: nodeId,
        action: {
          type: action,
        },
        result: output,
        duration,
      },
      handleId: this.threadId,
    });
  }

  private sendTaskCompleted(result: any): void {
    this.sendToRenderer('task:completed', {
      type: 'task_completed',
      handleId: this.threadId,
      result,
    });
  }

  private sendTaskError(error: string): void {
    this.sendToRenderer('task:error', {
      type: 'task_error',
      handleId: this.threadId,
      error,
    });
  }

  async initialize(): Promise<void> {
    await loadSkillTools();
    this.agent = createReactAgent({
      llm: this.model,
      tools: getAvailableTools(),
      stateModifier: STATE_MODIFIER,
      checkpointer: this.checkpointerEnabled ? this.checkpointer.getCheckpointer() : undefined,
    });

    this.logger.logAgentStart(this.threadId, 'initialize');
    console.log('[MainAgent] Initialized, thread:', this.threadId);
  }

  async run(task: string): Promise<AgentResult> {
    if (!this.agent) {
      await this.initialize();
    }

    this.status = 'running';
    this.currentTask = task;
    this.cancelRequested = false;
    currentAgentInstance = this;

    this.logger.logAgentStart(this.threadId, task);
    console.log('[MainAgent] Running task:', task);

    const steps: AgentStep[] = [];

    if (this.cancelRequested) {
      this.status = 'cancelled';
      this.logger.logError('Task cancelled before start', { task }, this.threadId, task);
      return { success: false, error: 'Task cancelled' };
    }

    try {
      const startTime = Date.now();
      const TASK_TIMEOUT_MS = 300000; // 5 minutes

      const invokePromise = this.agent.invoke(
        { messages: [{ role: 'user', content: task }] },
        { configurable: { thread_id: this.threadId } }
      );

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Task timeout after 5 minutes')), TASK_TIMEOUT_MS)
      );

      const result = await Promise.race([invokePromise, timeoutPromise]);
      const duration = Date.now() - startTime;

      if (this.cancelRequested) {
        this.status = 'cancelled';
        this.logger.logError(
          'Task cancelled during execution',
          { task, duration },
          this.threadId,
          task
        );
        return { success: false, error: 'Task cancelled' };
      }

      this.status = 'completed';
      this.logger.logAgentEnd(this.threadId, result, task);
      console.log('[MainAgent] Task completed');

      let steps: AgentStep[] = [];
      let finalMessage = '';

      try {
        steps = this.extractSteps(result.messages);
        finalMessage = this.extractFinalMessage(result.messages);
      } catch (error: any) {
        console.error('[MainAgent] Failed to extract steps:', error);
      }

      this.sendTaskCompleted({
        result: {
          success: true,
          output: result,
          duration,
          steps,
          finalMessage,
        },
      });

      try {
        const historyService = getHistoryService();
        await historyService.completeTask(this.threadId, {
          success: true,
          output: result,
        });
      } catch (historyError) {
        console.error('[MainAgent] Failed to save history:', historyError);
      }

      return {
        success: true,
        output: result,
        messages: result.messages,
        duration,
        steps,
        finalMessage,
      };
    } catch (error: any) {
      this.status = 'error';
      this.logger.logError(error.message, { task, threadId: this.threadId }, this.threadId, task);
      console.error('[MainAgent] Task failed:', error);

      // Format friendly error message based on error type
      let friendlyError = error.message || 'Unknown error';
      if (
        error.message?.includes('Recursion limit') ||
        error.message?.includes('recursionLimit') ||
        error.lc_error_code === 'GRAPH_RECURSION_LIMIT'
      ) {
        friendlyError =
          '抱歉，经过多次尝试后仍然无法完成任务。AI 已尽力调整策略，建议稍后重试或简化任务。';
      }

      this.sendTaskError(friendlyError);

      try {
        const historyService = getHistoryService();
        await historyService.completeTask(this.threadId, {
          success: false,
          error: friendlyError,
        });
      } catch (historyError) {
        console.error('[MainAgent] Failed to save history:', historyError);
      }

      return {
        success: false,
        error: friendlyError,
      };
    } finally {
      clearAgentInstance();
    }
  }

  private extractSteps(messages: any[]): AgentStep[] {
    const steps: AgentStep[] = [];
    const toolCallMap = new Map<string, AgentStep>();

    console.log('[MainAgent] extractSteps called with', messages.length, 'messages');

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const msgType = msg.type || msg.constructor?.name || 'unknown';
      const hasToolCalls = !!(msg.tool_calls && Array.isArray(msg.tool_calls));
      console.log(`[MainAgent] Message ${i}: type=${msgType}, hasToolCalls=${hasToolCalls}`);

      if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
        console.log(`[MainAgent] Found ${msg.tool_calls.length} tool_calls in message ${i}`);
        for (const tc of msg.tool_calls) {
          let parsedArgs = tc.args || {};
          if (typeof tc.args === 'string') {
            try {
              parsedArgs = JSON.parse(tc.args || '{}');
            } catch (e) {
              console.warn('[MainAgent] Failed to parse tool args:', e);
              parsedArgs = {};
            }
          }
          const step: AgentStep = {
            id: tc.id || `tc-${steps.length}`,
            toolName: tc.name || 'unknown',
            args: parsedArgs,
            status: 'completed',
          };
          steps.push(step);
          if (tc.id) {
            toolCallMap.set(tc.id, step);
          }
          console.log(`[MainAgent] Extracted step:`, JSON.stringify(step));
        }
      }

      const isToolMessage = msgType === 'tool' || msg.lc_direct_tool_output;
      if (isToolMessage && msg.tool_call_id) {
        const step = toolCallMap.get(msg.tool_call_id);
        if (step) {
          try {
            step.result = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
          } catch {
            step.result = msg.content;
          }
          step.status = msg.status === 'error' ? 'error' : 'completed';
          console.log(`[MainAgent] Linked result to step ${step.id}:`, step.status);
        } else {
          console.log(`[MainAgent] ToolMessage with id ${msg.tool_call_id} not found in map`);
        }
      }
    }

    console.log('[MainAgent] extractSteps returning', steps.length, 'steps');
    return steps;
  }

  private extractFinalMessage(messages: any[]): string {
    const aiMessages = messages.filter((m) => {
      const type = m.type || m.constructor?.name || 'unknown';
      return type === 'ai' || type === 'AIMessage' || type === 'AIMessageChunk';
    });

    for (let i = aiMessages.length - 1; i >= 0; i--) {
      const msg = aiMessages[i];
      const content = msg.content;
      const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;

      if (hasToolCalls) continue;

      if (!content) continue;

      let contentStr = '';
      if (typeof content === 'string') {
        contentStr = content.trim();
      } else if (Array.isArray(content)) {
        contentStr = content
          .map((b: any) => b.text || b.content || '')
          .join('')
          .trim();
      } else if (typeof content === 'object') {
        contentStr = content.text || content.content || '';
      }

      if (contentStr) {
        console.log(`[MainAgent] Final AI message at index ${i}:`, contentStr.substring(0, 200));
        return contentStr;
      }
    }

    return '';
  }

  isCheckpointerEnabled(): boolean {
    return this.checkpointerEnabled;
  }
}

export async function createMainAgent(config?: AgentConfig): Promise<MainAgent> {
  const agent = new MainAgent(config);
  await agent.initialize();
  return agent;
}

export default MainAgent;
