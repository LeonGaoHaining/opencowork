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
import * as fs from 'fs';
import * as path from 'path';
import { getCheckpointer, AgentCheckpointer } from '../checkpointers/agentCheckpointer';
import { getLogger, LoggerConfig } from './agentLogger';
import { getBrowserExecutor } from '../main/ipcHandlers';
import { getCLIExecutor } from '../main/ipcHandlers';
import { ActionType, generateId } from '../core/action/ActionSchema';
import { loadLLMConfig } from '../llm/config';
import { webfetchTool } from '../tools/webfetch/WebFetchTool';
import { websearchTool } from '../tools/websearch/WebSearchTool';
import { schedulerTool } from '../tools/scheduler/SchedulerTool';
import { getSkillToolFactory } from '../tools/skill/SkillToolFactory';
import { recordingTools } from '../tools/skill/RecordingTools';
import { listSkillsTool } from '../tools/skill/ListSkillsTool';
import { listMCPToolsTool, buildMCPCatalogText } from '../tools/mcp/ListMCPToolsTool';
import { getSkillLoader } from '../skills/skillLoader';
import { getHistoryService } from '../history/historyService';
import {
  getMemoryService,
  getMemoryWorkflow,
  MemoryWorkflowResult,
  MemoryCandidate,
} from '../memory';
import { PersistedTaskState } from '../core/runtime/taskState';
import { getTaskStateStore, TaskStateStore } from '../core/runtime/taskStateStore';
import { createSkillMatcher, SkillSource } from '../skills/skillMatcher';
import { getMCPClient } from '../mcp';
import { getSkillRecorder } from '../skills/skillRecorder';
import { getSkillRunner } from '../skills/skillRunner';
import { createTaskResultError, mapAgentResultToTaskResult } from '../core/task/resultMapper';
import { VisionExecutor } from '../core/executor/VisionExecutor';
import { VisualAutomationService } from '../visual/VisualAutomationService';
import { HybridToolRouter } from '../visual';
import { executeVisualBrowserTask } from './visualBrowserHelper';
import { getTaskOrchestrator } from '../core/task/TaskOrchestrator';
import { getFeishuService } from '../im/feishu/FeishuService';
import { IMAttachment } from '../im/types';
import { getBindingStore } from '../im/store/bindingStore';
import { getDefaultDesktopUserId } from '../im/desktopBinding';

interface CurrentFeishuTarget {
  conversationId: string;
  chatType?: string;
  targetType: 'im-conversation' | 'bound-user';
}

interface FeishuTargetResolution {
  target: CurrentFeishuTarget | null;
  error?: {
    code: string;
    message: string;
  };
}

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

const MODEL_SAFE_TEXT_LIMIT = 4000;
const MODEL_SAFE_JSON_LIMIT = 6000;

function truncateText(text: string, limit: number = MODEL_SAFE_TEXT_LIMIT): string {
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}... [truncated ${text.length - limit} chars]`;
}

function sanitizeValueForModel(value: unknown): unknown {
  if (typeof value === 'string') {
    return truncateText(value);
  }

  if (Array.isArray(value)) {
    const sanitized = value.slice(0, 20).map((item) => sanitizeValueForModel(item));
    if (value.length > 20) {
      sanitized.push(`... [truncated ${value.length - 20} items]`);
    }
    return sanitized;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (typeof record.screenshot === 'string') {
      return {
        ...Object.fromEntries(
          Object.entries(record)
            .filter(([key]) => key !== 'screenshot')
            .map(([key, child]) => [key, sanitizeValueForModel(child)])
        ),
        screenshotCaptured: true,
        screenshotBytes: record.screenshot.length,
      };
    }

    return Object.fromEntries(
      Object.entries(record).map(([key, child]) => [key, sanitizeValueForModel(child)])
    );
  }

  return value;
}

function sanitizeToolResultForModel(result: any): any {
  if (!result || typeof result !== 'object') {
    return result;
  }

  const sanitizedResult = {
    ...result,
    output: sanitizeValueForModel(result.output),
  };

  const serialized = JSON.stringify(sanitizedResult);
  if (serialized.length <= MODEL_SAFE_JSON_LIMIT) {
    return sanitizedResult;
  }

  return {
    ...sanitizedResult,
    output:
      typeof sanitizedResult.output === 'string'
        ? truncateText(sanitizedResult.output, MODEL_SAFE_TEXT_LIMIT)
        : truncateText(JSON.stringify(sanitizedResult.output), MODEL_SAFE_TEXT_LIMIT),
  };
}

function shellQuoteArg(arg: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(arg)) {
    return arg;
  }

  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

function buildCLICommand(command: string, args?: string[]): string {
  if (!args || args.length === 0) {
    return command;
  }

  return [command, ...args.map((arg) => shellQuoteArg(arg))].join(' ');
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

function resolveCurrentFeishuTarget(agent: MainAgent | null): FeishuTargetResolution {
  if (!agent) {
    return {
      target: null,
      error: {
        code: 'FEISHU_TARGET_UNAVAILABLE',
        message: 'Current agent instance is unavailable',
      },
    };
  }

  const run = getTaskOrchestrator().getRun(agent.getThreadId());
  const metadata = run?.metadata && typeof run.metadata === 'object' ? (run.metadata as Record<string, unknown>) : null;
  if (!metadata || metadata.source !== 'im') {
    const binding = getBindingStore().getByDesktopUserId(getDefaultDesktopUserId());
    if (!binding?.imUserId) {
      return {
        target: null,
        error: {
          code: 'FEISHU_BINDING_REQUIRED',
          message:
            'This task is not running from a Feishu chat, and no Feishu account is bound to this device yet. Open Feishu and send "绑定设备" to the bot once, then retry.',
        },
      };
    }

    return {
      target: {
        conversationId: binding.imUserId,
        chatType: 'p2p',
        targetType: 'bound-user',
      },
    };
  }

  const chatType = typeof metadata.chatType === 'string' ? metadata.chatType : undefined;
  const replyTargetId = typeof metadata.replyTargetId === 'string' ? metadata.replyTargetId : undefined;
  const conversationId = typeof metadata.conversationId === 'string' ? metadata.conversationId : undefined;
  const targetId = chatType === 'group' ? replyTargetId || conversationId : conversationId || replyTargetId;

  if (!targetId) {
    return {
      target: null,
      error: {
        code: 'FEISHU_TARGET_UNAVAILABLE',
        message: 'Current IM task is missing a usable Feishu conversation target',
      },
    };
  }

  return {
    target: {
      conversationId: targetId,
      chatType,
      targetType: 'im-conversation',
    },
  };
}

function buildFeishuAttachment(filePath: string): IMAttachment | null {
  if (!path.isAbsolute(filePath)) {
    return null;
  }

  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile() || stats.size === 0) {
      return null;
    }

    const extension = path.extname(filePath).toLowerCase();
    return {
      type: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(extension) ? 'image' : 'file',
      fileName: path.basename(filePath),
      localPath: filePath,
      size: stats.size,
    };
  } catch {
    return null;
  }
}

function shouldAttemptVisualFallback(params: {
  action: string;
  selector?: string;
  text?: string;
}): boolean {
  return ['click', 'input', 'wait'].includes(params.action);
}

function shouldUseVisualPrimary(params: {
  action: string;
  selector?: string;
  text?: string;
}): { useVisual: boolean; reason: string } {
  const router = new HybridToolRouter();
  const decision = router.decide({
    task: [params.action, params.selector, params.text].filter(Boolean).join(' '),
    action: params.action as 'click' | 'input' | 'wait' | 'extract' | 'goto' | 'screenshot',
    selector: params.selector,
    requiresStrictExtraction: params.action === 'extract',
  });
  return {
    useVisual: decision.mode === 'cua',
    reason: decision.reason,
  };
}

async function tryVisualBrowserFallback(
  params: {
    action: string;
    selector?: string;
    text?: string;
    timeout?: number;
    pressEnter?: boolean;
  },
  priorResult: { success?: boolean; error?: { recoverable?: boolean; message?: string } }
): Promise<any | null> {
  if (!shouldAttemptVisualFallback(params)) {
    return null;
  }

  if (priorResult.success || !priorResult.error?.recoverable) {
    return null;
  }

  const action = params.action as 'click' | 'input' | 'wait';
  const service = new VisualAutomationService(getBrowserExecutor());
  const result = await service.runBrowserActionFallback({
    action,
    selector: params.selector,
    text: params.text,
    timeout: params.timeout,
    pressEnter: params.pressEnter,
    fallbackReason: priorResult.error?.message || 'DOM execution failed with a recoverable error',
  });

  if (!result.success) {
    return null;
  }

  return {
    success: true,
    output: {
      fallbackMode: 'visual',
      finalMessage: result.finalMessage,
      turns: result.turns,
    },
    duration: 0,
  };
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
    pressEnter?: boolean;
  }) => {
    const logger = getLogger();
    const startTime = Date.now();
    const agent = getAgent();

    try {
      await agent?.waitIfPaused();
      agent?.ensureNotCancelled();
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
          const clickRoute = shouldUseVisualPrimary(params);
          if (clickRoute.useVisual) {
            result = await new VisualAutomationService(executor).runBrowserActionFallback({
              action: 'click',
              selector: params.selector,
              routeReason: clickRoute.reason,
            });
            break;
          }
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
          const inputRoute = shouldUseVisualPrimary(params);
          if (inputRoute.useVisual) {
            result = await new VisualAutomationService(executor).runBrowserActionFallback({
              action: 'input',
              selector: params.selector,
              text: params.text,
              pressEnter: params.pressEnter,
              routeReason: inputRoute.reason,
            });
            break;
          }
          result = await executor.execute({
            id: generateId(),
            type: ActionType.BROWSER_INPUT,
            description: 'Input text',
            params: {
              selector: params.selector,
              text: params.text || '',
              clear: true,
              pressEnter: params.pressEnter,
            },
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
          const waitRoute = shouldUseVisualPrimary(params);
          if (waitRoute.useVisual) {
            result = await new VisualAutomationService(executor).runBrowserActionFallback({
              action: 'wait',
              selector: params.selector,
              timeout: params.timeout,
              routeReason: waitRoute.reason,
            });
            break;
          }
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

      if (!result.success) {
        const fallbackResult = await tryVisualBrowserFallback(params, result);
        if (fallbackResult) {
          result = fallbackResult;
        }
      }

      const duration = Date.now() - startTime;
      const modelSafeResult = sanitizeToolResultForModel(result);
      agent?.sendNodeComplete('browser', params.action, modelSafeResult, duration, params);
      recordSkillStepIfActive(
        `browser:${params.action}`,
        params as Record<string, unknown>,
        modelSafeResult
      );
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

      return modelSafeResult;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('[BrowserTool] Error:', error);
      agent?.sendNodeComplete('browser', params.action, { error: error.message }, duration, params);
      recordSkillStepIfActive(`browser:${params.action}`, params as Record<string, unknown>, {
        success: false,
        error: error.message,
      });
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
      pressEnter: z.boolean().optional(),
    }),
  }
);

const visualBrowserTool = tool(
  async (params: {
    task: string;
    adapterMode?: 'chat-structured' | 'responses-computer';
    maxTurns?: number;
  }) => {
    const logger = getLogger();
    const startTime = Date.now();
    const agent = getAgent();

    agent?.sendNodeStart('visual_browser', 'run', {
      task: params.task,
      adapterMode: params.adapterMode,
      maxTurns: params.maxTurns,
    });
    logger.logToolCall('visual_browser', params, 'main-agent', params.task);

    try {
      await agent?.waitIfPaused();
      agent?.ensureNotCancelled();

      const result = await executeVisualBrowserTask(params);
      const duration = Date.now() - startTime;
      const modelSafeResult = sanitizeToolResultForModel(result);

      agent?.sendNodeComplete('visual_browser', 'run', modelSafeResult, duration, params);
      recordSkillStepIfActive('visual_browser:run', params as Record<string, unknown>, modelSafeResult);
      logger.logToolResult('visual_browser', result, duration, 'main-agent', params.task);

      return modelSafeResult;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('[VisualBrowserTool] Error:', error);
      agent?.sendNodeComplete(
        'visual_browser',
        'run',
        { success: false, error: error.message },
        duration,
        params
      );
      recordSkillStepIfActive('visual_browser:run', params as Record<string, unknown>, {
        success: false,
        error: error.message,
      });
      logger.logToolResult(
        'visual_browser',
        { error: error.message },
        duration,
        'main-agent',
        params.task,
        error.message
      );

      return { success: false, error: { code: 'VISUAL_BROWSER_ERROR', message: error.message } };
    }
  },
  {
    name: 'visual_browser',
    description:
      '视觉浏览器工具。适用于复杂前端、模糊按钮、弹窗、菜单、canvas、低代码后台等 DOM/selector 不稳定场景。传入完整任务意图而不是单个 selector。',
    schema: z.object({
      task: z.string().describe('Describe the browser task in natural language for visual execution'),
      adapterMode: z.enum(['chat-structured', 'responses-computer']).optional(),
      maxTurns: z.number().optional(),
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
      await agent?.waitIfPaused();
      agent?.ensureNotCancelled();
      const executor = getCLIExecutor();
      const command = buildCLICommand(params.command, params.args);
      const result = await executor.execute({
        id: generateId(),
        type: ActionType.CLI_EXECUTE,
        description: `Execute CLI: ${command}`,
        params: {
          command,
          workingDir: params.workingDir,
        },
      } as any);
      const duration = Date.now() - startTime;

      agent?.sendNodeComplete('cli', 'execute', result, duration, params);
      recordSkillStepIfActive('cli:execute', params as Record<string, unknown>, result);

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
      recordSkillStepIfActive('cli:execute', params as Record<string, unknown>, {
        success: false,
        error: error.message,
      });
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

const visionExecutor = new VisionExecutor();

// Vision Tool 定义
const visionTool = tool(
  async (params: { action: string; target?: string }) => {
    const logger = getLogger();
    const startTime = Date.now();
    logger.logToolCall('vision', params, 'main-agent', params.action);
    console.log('[VisionTool] Executing:', params);
    const result = await visionExecutor.execute({
      action: params.action as 'ocr' | 'analyze' | 'screenshot',
      target: params.target,
    });
    const duration = Date.now() - startTime;
    logger.logToolResult('vision', result, duration, 'main-agent', params.action);
    return result;
  },
  {
    name: 'vision',
    description: '视觉处理工具，用于 OCR 和图片分析',
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

const sendFeishuAttachmentTool = tool(
  async (params: { filePath: string; message?: string }) => {
    const logger = getLogger();
    const startTime = Date.now();
    const agent = getAgent();

    agent?.sendNodeStart('send_feishu_attachment', 'send', params);
    logger.logToolCall('send_feishu_attachment', params, 'main-agent', params.filePath);

    try {
      const resolution = resolveCurrentFeishuTarget(agent);
      const target = resolution.target;
      if (!target) {
        return {
          success: false,
          error: {
            code: resolution.error?.code || 'FEISHU_TARGET_UNAVAILABLE',
            message:
              resolution.error?.message ||
              'Current task is not an IM task with an available Feishu conversation target',
          },
        };
      }

      const bot = getFeishuService().getBot();
      if (!bot) {
        return {
          success: false,
          error: {
            code: 'FEISHU_BOT_UNAVAILABLE',
            message: 'Feishu bot is not initialized',
          },
        };
      }

      const attachment = buildFeishuAttachment(params.filePath);
      if (!attachment?.localPath) {
        return {
          success: false,
          error: {
            code: 'INVALID_ATTACHMENT_PATH',
            message: `File is not a readable local attachment: ${params.filePath}`,
          },
        };
      }

      if (target.targetType === 'bound-user') {
        if (params.message) {
          await bot.sendMessageToUser(target.conversationId, params.message);
        }
        await bot.sendAttachmentToUser(target.conversationId, attachment);
      } else {
        if (params.message) {
          await bot.sendMessage(target.conversationId, params.message, target.chatType);
        }
        await bot.sendAttachment(target.conversationId, attachment, target.chatType);
      }
      const result = {
        success: true,
        output: {
          fileName: attachment.fileName,
          filePath: attachment.localPath,
          conversationId: target.conversationId,
          chatType: target.chatType || 'p2p',
          targetType: target.targetType,
        },
      };
      const duration = Date.now() - startTime;
      agent?.sendNodeComplete('send_feishu_attachment', 'send', result, duration, params);
      logger.logToolResult('send_feishu_attachment', result, duration, 'main-agent', params.filePath);
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const result = {
        success: false,
        error: {
          code: 'FEISHU_ATTACHMENT_SEND_FAILED',
          message: error?.message || String(error),
        },
      };
      agent?.sendNodeComplete('send_feishu_attachment', 'send', result, duration, params);
      logger.logToolResult(
        'send_feishu_attachment',
        result,
        duration,
        'main-agent',
        params.filePath,
        result.error.message
      );
      return result;
    }
  },
  {
    name: 'send_feishu_attachment',
    description:
      'Send a local file attachment back to the current Feishu IM conversation. Only works for IM-originated tasks with an available Feishu chat target.',
    schema: z.object({
      filePath: z.string().describe('Absolute local file path to send, such as /tmp/report.pdf or /tmp/slides.pptx'),
      message: z.string().optional().describe('Optional text message to send before the attachment'),
    }),
  }
);

const baseTools = [
  browserTool,
  visualBrowserTool,
  cliTool,
  visionTool,
  plannerTool,
  sendFeishuAttachmentTool,
  webfetchTool,
  websearchTool,
  schedulerTool,
  listSkillsTool,
  listMCPToolsTool,
  ...recordingTools,
];

let skillTools: any[] = [];
let mcpTools: any[] = [];

function recordSkillStepIfActive(
  toolName: string,
  args: Record<string, unknown>,
  result?: unknown
): void {
  const recorder = getSkillRecorder();
  if (!recorder.isCurrentlyRecording()) {
    return;
  }

  recorder.recordStep(toolName, args, result);
}

async function buildSkillCatalogText(): Promise<string> {
  const skillMatcher = createSkillMatcher('');
  const skills = await skillMatcher.listSkills();
  if (skills.length === 0) {
    return '无可用 Skills。';
  }

  const catalogEntries = await Promise.all(
    skills.slice(0, 20).map(async (skill) => {
      const level0 = await skillMatcher.loadSkillLevel(
        (skill.source || 'agent-created') as SkillSource,
        skill.name,
        0
      );
      return level0?.content || `${skill.name}: ${skill.description}`;
    })
  );

  return catalogEntries
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join('\n');
}

function normalizeSkillName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\-]/g, '');
}

async function resolveSkillByName(skillName: string) {
  const loader = getSkillLoader();
  const exactSkill = await loader.getSkill(skillName);
  if (exactSkill) {
    return exactSkill;
  }

  const normalized = normalizeSkillName(skillName);
  const skills = await loader.loadAllSkills();
  return (
    skills.find((skill) => normalizeSkillName(skill.manifest.name) === normalized) ||
    skills.find((skill) => normalizeSkillName(skill.manifest.name).includes(normalized)) ||
    null
  );
}

function createMCPDynamicTools(): any[] {
  const mcpClient = getMCPClient();
  const tools = Array.from(mcpClient.getAllTools().entries()).map(([fullName, mcpTool]) => {
    const parts = fullName.split('_');
    const serverName = parts[1];
    const toolName = parts.slice(2).join('_');

    return tool(
      async (params: Record<string, unknown>) => {
        const toolArgs =
          params &&
          typeof params === 'object' &&
          'payload' in params &&
          params.payload &&
          typeof params.payload === 'object' &&
          !Array.isArray(params.payload)
            ? (params.payload as Record<string, unknown>)
            : params;
        const result = await mcpClient.callTool(serverName, toolName, toolArgs || {});
        return {
          success: true,
          output: typeof result === 'string' ? result : JSON.stringify(result),
        };
      },
      {
        name: fullName,
        description: mcpTool.description || `Call MCP tool ${toolName} on ${serverName}`,
        schema: z
          .object({
            payload: z
              .record(z.string(), z.unknown())
              .optional()
              .describe(
                'Legacy wrapper for MCP tool arguments; direct top-level arguments are preferred'
              ),
          })
          .passthrough()
          .describe(
            'Arguments for the MCP tool call. Pass tool parameters directly as top-level fields.'
          ),
      }
    );
  });

  mcpTools = tools;
  return tools;
}

const executeSkillTool = tool(
  async (params: { skillName: string; input: string }) => {
    const logger = getLogger();
    const startTime = Date.now();
    const agent = getAgent();

    agent?.sendNodeStart('skill', 'execute', {
      skillName: params.skillName,
      input: params.input,
    });
    logger.logToolCall('skill', params, 'main-agent', params.skillName);

    try {
      const skill = await resolveSkillByName(params.skillName);
      if (!skill) {
        return {
          success: false,
          output: '',
          error: `Skill not found: ${params.skillName}`,
        };
      }

      const runner = getSkillRunner();
      const result = await runner.executeSkill(skill, [params.input]);
      const duration = Date.now() - startTime;
      agent?.sendNodeComplete('skill', 'execute', result, duration, {
        skillName: skill.manifest.name,
        input: params.input,
      });
      recordSkillStepIfActive(
        'skill:execute',
        { skillName: skill.manifest.name, input: params.input },
        result
      );
      logger.logToolResult(
        'skill',
        result,
        duration,
        'main-agent',
        skill.manifest.name,
        result.error
      );

      if (!result.success) {
        return {
          success: false,
          output: '',
          error: result.error || `Failed to execute skill: ${skill.manifest.name}`,
        };
      }

      const skillFactory = getSkillToolFactory();
      const scriptInfo = skillFactory.getScriptInfo(skill);
      let output = result.output || 'Skill executed successfully';
      if (scriptInfo) {
        output += skillFactory.buildScriptInfoOutput(scriptInfo);
      }

      return {
        success: true,
        output,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      agent?.sendNodeComplete('skill', 'execute', { error: error.message }, duration, params);
      logger.logToolResult(
        'skill',
        { error: error.message },
        duration,
        'main-agent',
        params.skillName,
        error.message
      );
      return {
        success: false,
        output: '',
        error: error.message,
      };
    }
  },
  {
    name: 'execute_skill',
    description:
      'Execute a skill by skillName. First inspect the Skill Catalog or use list_skills, then call this tool with the chosen skillName and the user request as input. Prefer this when an existing skill can solve the task.',
    schema: z.object({
      skillName: z.string().describe('The skill name from Skill Catalog or list_skills'),
      input: z.string().describe('The user request or task details to pass into the skill'),
    }),
  }
);

export async function loadSkillTools(): Promise<any[]> {
  try {
    skillTools = [executeSkillTool];
    console.log('[MainAgent] Loaded full skill catalog mode with execute_skill tool');
    return skillTools;
  } catch (error) {
    console.error('[MainAgent] Failed to load skill tools:', error);
    return [];
  }
}

function getAvailableTools(): any[] {
  return [...baseTools, ...skillTools, ...mcpTools];
}

const BASE_STATE_MODIFIER = `你是一个浏览器自动化助手，擅长理解用户任务并分解执行。

可用工具：
1. browser - 用于浏览器操作（打开网页、点击、输入、提取内容）
    - 重要：当需要获取页面文本内容时，优先使用 extract 工具而非 screenshot
    - screenshot 仅在需要分析视觉元素（如图标、图片、布局问题）时才使用
   - 如果用户要的是页面文字、搜索结果、公司介绍、文章内容，禁止优先使用 screenshot；先使用 extract
    - 如果用户明确说“不要用 screenshot”，则禁止调用 screenshot
     - 注意：browser 工具仅适用于网页内容，不适合打开本地文件
2. visual_browser - 用于基于截图和视觉状态操作网页
   - 适用场景：复杂前端、模糊按钮、下拉菜单、弹窗、canvas、低代码后台
   - 传入完整任务意图，不要传单个 selector
   - 如果普通 browser 工具很可能因 selector 不稳定而失败，应优先使用 visual_browser
3. cli - 用于执行系统命令
   - 本地文件（.pptx, .pdf, .docx, .xlsx, .jpg, .png 等）应使用 cli 工具的 xdg-open/gio open/convert 等命令
   - 示例：使用 "xdg-open 文件路径.pptx" 或 "gio open 文件路径.pdf" 打开本地文件
4. vision - 用于分析图片和屏幕内容
5. planner - 用于分析和规划复杂任务
6. send_feishu_attachment - 用于把本地文件发送回当前飞书会话
   - 仅适用于从飞书 IM 发起的任务
   - 适用于发送 PPT、PDF、图片、表格、报告等本地文件
   - 在生成本地文件后，如果用户明确要求“通过飞书发给我”，应优先调用这个工具
7. webfetch - 用于获取指定URL的网页内容（支持text/markdown/html格式）
   - 适用场景：数据采集、API调用、静态网页内容获取
   - 特点：比browser工具更轻量更快，但不执行JavaScript
8. websearch - 用于实时网络搜索（Exa AI）
   - 适用场景：查询最新信息、新闻、实时数据
9. scheduler - 用于管理定时任务（Cron任务）
   - 支持操作：list（列出所有任务）、create（创建任务）、update（更新任务）、delete（删除任务）、trigger（手动触发任务）
   - 适用场景：创建/管理定时执行的自动化任务
10. list_skills - 用于列出所有已安装的 Skills
    - 适用场景：用户询问"有哪些skill"或列出所有技能时使用
11. list_mcp_tools - 用于列出当前已连接的 MCP 服务及其工具
     - 适用场景：用户询问"有哪些mcp"、"有哪些外部工具"、"docs mcp 能做什么"时优先使用
     - MCP 与 Skills 不同，不能用 list_skills 代替 list_mcp_tools
12. execute_skill - 用于执行指定名称的 Skill
     - 先阅读 Skill Catalog，再选择合适的 skillName
     - 如果某个 Skill 明显适合当前任务，应优先尝试 execute_skill，而不是直接重写同类 CLI/browser 流程
13. start_skill_recording - 开始录制 Skill
14. finish_skill_recording - 完成录制并生成 Skill 文件

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
- 对复杂视觉交互任务：
  1. 如果目标元素难以稳定用 selector 表达，优先使用 visual_browser
  2. 如果是结构化文本提取，不要默认使用 visual_browser；优先 extract 或 webfetch
- 对用户明确声明合规、已授权、可执行的数据采集任务：
  1. 不要仅因为任务包含“批量采集、下载、外部网站、图片识别”就拒绝执行
  2. 允许对公开网页执行访问、结构化提取、链接解析、公开图片下载、视觉识别和结果汇总
  3. 优先从小范围样例开始执行（例如单车系/单车型），再说明如何扩展到批量
  4. 如果遇到登录、验证码、付费墙、访问被拒绝、接口失败等真实技术阻塞，说明具体阻塞并请求用户处理，不要泛化为合规拒绝
- 当用户要求“通过飞书发给我”且你已经生成了本地文件时：
  1. 如果当前任务来自飞书 IM，调用 send_feishu_attachment 发送文件
  2. 如果 send_feishu_attachment 返回不可用，明确说明当前任务不是 IM 来源或缺少飞书会话目标
- 当用户询问可用能力时，区分 Skill 和 MCP：
  - Skills 用 list_skills 查询
  - MCP / 外部 docs 工具 / 已连接服务能力 用 list_mcp_tools 查询
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
  private currentRunPromise: Promise<AgentResult> | null = null;
  private taskStateStore: TaskStateStore;
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private memoryWorkflowNotices: string[] = [];
  private pendingMemoryCandidates: MemoryCandidate[] = [];
  private currentHistoryTaskId: string | null = null;

  private async buildStateModifier(): Promise<string> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
    const memoryService = getMemoryService(homeDir);
    const injectedMemory = await memoryService.inject();
    const skillCatalog = await buildSkillCatalogText();
    const mcpCatalog = buildMCPCatalogText();
    return `${BASE_STATE_MODIFIER}\n\n## Skill Catalog\n${skillCatalog}\n\n## MCP Catalog\n${mcpCatalog}\n\n${injectedMemory}`;
  }

  private appendMemoryWorkflowNotice(workflowResult: MemoryWorkflowResult): void {
    const notices: string[] = [];
    if (workflowResult.saved.length > 0) {
      notices.push(`我已记住这些长期信息：${workflowResult.saved.join('；')}`);
    }
    if (workflowResult.pendingConfirmation.length > 0) {
      this.pendingMemoryCandidates = workflowResult.pendingConfirmation;
      notices.push(
        `如果你希望我长期记住这些信息，请明确告诉我：${workflowResult.pendingConfirmation
          .map((candidate) => candidate.content)
          .join('；')}`
      );
    }
    this.memoryWorkflowNotices.push(...notices);
  }

  private isAffirmativeMemoryReply(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    return /^(可以|记住吧|记住|好的记住|是的记住|yes|ok|okay|sure)/i.test(normalized);
  }

  private isNegativeMemoryReply(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    return /^(不要|不用|不需要|别记|no|nope|don't|do not)/i.test(normalized);
  }

  private async tryResolvePendingMemoryConfirmation(task: string): Promise<AgentResult | null> {
    if (this.pendingMemoryCandidates.length === 0) {
      return null;
    }

    if (this.isAffirmativeMemoryReply(task)) {
      const result = await getMemoryWorkflow().confirmCandidates(this.pendingMemoryCandidates);
      const confirmed = result.saved.join('；');
      this.pendingMemoryCandidates = [];
      this.status = 'completed';
      const finalMessage = confirmed
        ? `好的，我已经记住这些长期信息：${confirmed}`
        : '好的，我尝试记住这些信息，但保存失败了。';
      this.sendTaskCompleted({
        result: {
          success: true,
          output: finalMessage,
          duration: 0,
          steps: [],
          finalMessage,
        },
      });
      return { success: true, output: finalMessage, duration: 0, steps: [], finalMessage };
    }

    if (this.isNegativeMemoryReply(task)) {
      const declined = this.pendingMemoryCandidates
        .map((candidate) => candidate.content)
        .join('；');
      this.pendingMemoryCandidates = [];
      this.status = 'completed';
      const finalMessage = declined
        ? `好的，我不会记住这些信息：${declined}`
        : '好的，我不会记录这些信息。';
      this.sendTaskCompleted({
        result: {
          success: true,
          output: finalMessage,
          duration: 0,
          steps: [],
          finalMessage,
        },
      });
      return { success: true, output: finalMessage, duration: 0, steps: [], finalMessage };
    }

    return null;
  }

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
    this.checkpointerEnabled = this.config.checkpointerEnabled ?? true;
    this.checkpointer = getCheckpointer({
      type: this.checkpointerEnabled ? 'sqlite' : 'memory',
    });
    this.logger = getLogger(config.logger);
    this.taskStateStore = getTaskStateStore();
  }

  async waitIfPaused(): Promise<void> {
    while (this.pauseRequested) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  ensureNotCancelled(): void {
    if (this.cancelRequested) {
      throw new Error('Task cancelled');
    }
  }

  async captureState(): Promise<PersistedTaskState> {
    const executor = getBrowserExecutor();
    const browserState = await executor.captureBrowserState();
    const baseState = {
      version: 1,
      runtimeType: 'main-agent' as const,
      handleId: this.threadId,
      threadId: this.threadId,
      taskDescription: this.currentTask,
      status: this.status as any,
      progress: { current: 0, total: 0 },
      plan: null,
      currentNodeId: null,
      completedNodeIds: [],
      executedActions: [],
      executionState: {
        planId: null,
        currentNodeId: null,
        paused: this.pauseRequested,
        cancelled: this.cancelRequested,
        completedNodeIds: [],
      },
      browserState,
      conversationHistory: this.conversationHistory.length
        ? this.conversationHistory
        : [{ role: 'user', content: this.currentTask }],
    };

    return {
      ...baseState,
      metadata: {
        savedAt: Date.now(),
        integrityHash: this.taskStateStore.createIntegrityHash(baseState as any),
        restoreHints: browserState?.url ? [`Resume agent at ${browserState.url}`] : [],
      },
    };
  }

  async saveState(): Promise<PersistedTaskState> {
    const state = await this.captureState();
    this.taskStateStore.save(state);
    return state;
  }

  async interrupt(reason?: string): Promise<PersistedTaskState> {
    this.pause();
    const state = await this.saveState();
    console.log('[MainAgent] Interrupted:', reason || 'manual');
    return state;
  }

  async restoreFromState(state: PersistedTaskState): Promise<AgentResult> {
    if (state.browserState) {
      await getBrowserExecutor().restoreBrowserState(state.browserState);
    }

    this.setThreadId(state.threadId || state.handleId);
    this.currentTask = state.taskDescription;
    this.conversationHistory = state.conversationHistory || [
      { role: 'user', content: state.taskDescription },
    ];
    this.pauseRequested = false;
    this.cancelRequested = false;
    this.status = 'running';
    currentAgentInstance = this;

    if (!this.agent) {
      await this.initialize();
    }

    try {
      const result = await this.agent.invoke(null as any, {
        configurable: { thread_id: this.threadId },
      });
      const duration = 0;
      const messages = Array.isArray(result.messages) ? result.messages : [];
      const scopedMessages = this.getCurrentRunMessages(messages, this.currentTask);
      const scopedResult = { ...result, messages: scopedMessages };
      const steps = this.extractSteps(scopedMessages);
      const finalMessage = this.extractFinalMessage(scopedMessages);
      this.status = 'completed';
      this.sendTaskCompleted({
        result: {
          success: true,
          output: scopedResult,
          duration,
          steps,
          finalMessage,
        },
      });
      return {
        success: true,
        output: scopedResult,
        messages: scopedMessages,
        duration,
        steps,
        finalMessage,
      };
    } catch (error: any) {
      console.warn('[MainAgent] Checkpoint restore failed, falling back to rerun:', error);
      this.setThreadId(`${state.threadId || state.handleId}-restored-${Date.now()}`);
      await this.initialize();
      return this.run(state.taskDescription);
    } finally {
      clearAgentInstance();
    }
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
    createMCPDynamicTools();
    if (this.agent) {
      this.agent = createReactAgent({
        llm: this.model,
        tools: getAvailableTools(),
        stateModifier: await this.buildStateModifier(),
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

  getCurrentTask(): string {
    return this.currentTask;
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
    this.conversationHistory.push({
      role: 'assistant',
      content: `调用工具 ${toolName}:${action}，参数: ${JSON.stringify(input || {})}`,
    });
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
    const safeOutput = sanitizeToolResultForModel(output);
    this.conversationHistory.push({
      role: 'assistant',
      content: `工具 ${toolName}:${action} 完成，结果: ${JSON.stringify(safeOutput || {})}`,
    });
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
    const finalMessage = result?.result?.finalMessage;
    const taskResult = mapAgentResultToTaskResult({
      success: true,
      output: result?.result?.output,
      finalMessage,
      steps: result?.result?.steps,
    });
    if (finalMessage) {
      this.conversationHistory.push({ role: 'assistant', content: finalMessage });
    }
    this.sendToRenderer('task:completed', {
      type: 'task_completed',
      handleId: this.threadId,
      runId: this.threadId,
      status: 'completed',
      result: taskResult,
      legacyResult: result?.result,
    });
  }

  private sendTaskError(error: string): void {
    const taskError = createTaskResultError(error);
    this.conversationHistory.push({ role: 'assistant', content: `任务错误: ${error}` });
    const payload = {
      type: 'task_error',
      handleId: this.threadId,
      runId: this.threadId,
      status: 'failed',
      error: taskError,
    };
    this.sendToRenderer('task:error', payload);
    this.sendToRenderer('task:failed', payload);
  }

  async initialize(): Promise<void> {
    await loadSkillTools();
    createMCPDynamicTools();
    this.agent = createReactAgent({
      llm: this.model,
      tools: getAvailableTools(),
      stateModifier: await this.buildStateModifier(),
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
    this.conversationHistory = [{ role: 'user', content: task }];
    this.memoryWorkflowNotices = [];
    this.currentHistoryTaskId = null;
    currentAgentInstance = this;

    this.logger.logAgentStart(this.threadId, task);
    console.log('[MainAgent] Running task:', task);

    const steps: AgentStep[] = [];

    const memoryConfirmationResult = await this.tryResolvePendingMemoryConfirmation(task);
    if (memoryConfirmationResult) {
      return memoryConfirmationResult;
    }

    if (this.cancelRequested) {
      this.status = 'cancelled';
      this.logger.logError('Task cancelled before start', { task }, this.threadId, task);
      return { success: false, error: 'Task cancelled' };
    }

    try {
      try {
        const historyService = getHistoryService();
        const historyRecord = await historyService.startTask(task, {
          threadId: this.threadId,
          runId: this.threadId,
          source: 'chat',
          model: this.config.modelName || loadLLMConfig().model || 'unknown',
        });
        this.currentHistoryTaskId = historyRecord.id;
      } catch (historyError) {
        console.warn('[MainAgent] Failed to start history:', historyError);
      }

      try {
        const memoryWorkflowResult = await getMemoryWorkflow().processChatMemory(task);
        this.appendMemoryWorkflowNotice(memoryWorkflowResult);
      } catch (error) {
        console.warn('[MainAgent] processChatMemory failed:', error);
      }

      await loadSkillTools();
      createMCPDynamicTools();
      this.agent = createReactAgent({
        llm: this.model,
        tools: getAvailableTools(),
        stateModifier: await this.buildStateModifier(),
        checkpointer: this.checkpointerEnabled ? this.checkpointer.getCheckpointer() : undefined,
      });

      const startTime = Date.now();
      const TASK_TIMEOUT_MS = 300000; // 5 minutes

      const invokePromise = this.agent.invoke(
        { messages: [{ role: 'user', content: task }] },
        { configurable: { thread_id: this.threadId } }
      );

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Task timeout after 5 minutes')), TASK_TIMEOUT_MS)
      );

      this.currentRunPromise = Promise.race([invokePromise, timeoutPromise]) as Promise<any>;
      const result = await this.currentRunPromise;
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
      const resultMessages = Array.isArray(result.messages) ? result.messages : [];
      const scopedMessages = this.getCurrentRunMessages(resultMessages, task);
      const scopedResult = { ...result, messages: scopedMessages };

      try {
        steps = this.extractSteps(scopedMessages);
        finalMessage = this.extractFinalMessage(scopedMessages);
      } catch (error: any) {
        console.error('[MainAgent] Failed to extract steps:', error);
      }

      try {
        const memoryWorkflowResult = await getMemoryWorkflow().processTaskMemory(
          task,
          finalMessage || ''
        );
        this.appendMemoryWorkflowNotice(memoryWorkflowResult);
      } catch (error) {
        console.warn('[MainAgent] processTaskMemory failed:', error);
      }

      if (this.memoryWorkflowNotices.length > 0) {
        finalMessage = [finalMessage, '', ...this.memoryWorkflowNotices].filter(Boolean).join('\n');
      }

      this.sendTaskCompleted({
        result: {
          success: true,
          output: scopedResult,
          duration,
          steps,
          finalMessage,
        },
      });

      try {
        const historyService = getHistoryService();
        if (this.currentHistoryTaskId) {
          const taskResult = mapAgentResultToTaskResult({
            success: true,
            output: scopedResult,
            finalMessage,
            steps,
          });
          await historyService.completeTask(this.currentHistoryTaskId, {
            success: true,
            output: scopedResult,
            summary: taskResult.summary,
            artifacts: taskResult.artifacts,
            rawOutput: taskResult.rawOutput,
            actionContract: taskResult.actionContract,
            structuredData: taskResult.structuredData,
            reusable: taskResult.reusable,
          });
          for (const step of steps) {
            await historyService.addStep(this.currentHistoryTaskId, {
              toolName: step.toolName,
              args: step.args || {},
              result: step.result,
              status: step.status,
              endTime: step.duration ? Date.now() : undefined,
              duration: step.duration,
            });
          }
        }
      } catch (historyError) {
        console.error('[MainAgent] Failed to save history:', historyError);
      }

      return {
        success: true,
        output: scopedResult,
        messages: scopedMessages,
        duration,
        steps,
        finalMessage,
      };
    } catch (error: any) {
      this.status = 'error';
      this.conversationHistory.push({
        role: 'assistant',
        content: `任务失败: ${error.message || 'Unknown error'}`,
      });
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
        if (this.currentHistoryTaskId) {
          const taskError = createTaskResultError(friendlyError);
          await historyService.completeTask(this.currentHistoryTaskId, {
            success: false,
            error: friendlyError,
            summary: friendlyError,
            taskError,
            reusable: false,
          });
        }
      } catch (historyError) {
        console.error('[MainAgent] Failed to save history:', historyError);
      }

      return {
        success: false,
        error: friendlyError,
      };
    } finally {
      this.currentRunPromise = null;
      this.currentHistoryTaskId = null;
      clearAgentInstance();
    }
  }

  private getCurrentRunMessages(messages: any[], task: string): any[] {
    if (!Array.isArray(messages) || messages.length === 0) {
      return [];
    }

    const normalizedTask = task.trim();
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const type = message.type || message.constructor?.name || 'unknown';
      const content = typeof message.content === 'string' ? message.content.trim() : '';
      if ((type === 'human' || type === 'HumanMessage') && content === normalizedTask) {
        return messages.slice(i);
      }
    }

    return messages;
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
