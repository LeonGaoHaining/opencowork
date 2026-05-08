import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { IMMessage, IMBot, DispatchTask, TaskStatus, IMAttachment } from './types';
import { CommandParser } from './CommandParser';
import { getProgressEmitter } from './ProgressEmitter';
import { getSharedMainAgent } from '../main/ipcHandlers';
import { executeVisualBrowserTask, resolveVisualAdapterMode } from '../agents/visualBrowserHelper';
import { mapAgentResultToTaskResult } from '../core/task/resultMapper';
import { getTaskTemplateRepository } from '../core/task/TaskTemplateRepository';
import { resolveTemplateInput } from '../core/task/templateUtils';
import { getTaskOrchestrator } from '../core/task/TaskOrchestrator';
import { TaskArtifact, TaskResult } from '../core/task/types';
import { buildTaskExecutionMetadata } from '../core/task/taskModelMetadata';
import { attachTaskRoutingToResult, resolveTaskExecutionRoute } from '../core/task/taskRouting';
import { getDefaultDesktopUserId } from './desktopBinding';
import { getBindingStore } from './store/bindingStore';
import { InProcessAgentRuntimeApi } from '../core/runtime/AgentRuntimeApi';
import {
  buildFeishuTaskPrompt,
  MAX_FEISHU_CONVERSATION_CONTEXT_CHARS,
  MAX_FEISHU_CONVERSATION_TURNS,
  truncateFeishuConversationText,
} from './feishuPrompt';
import type { FeishuConversationTurn } from './feishuPrompt';

const PRIORITY_MAP: Record<string, number> = {
  low: 10,
  normal: 5,
  high: 1,
};

const MAX_STATUS_MAP_SIZE = 1000;
const MAX_TASK_QUEUE_SIZE = 500;
const MAX_FEISHU_CONVERSATION_HISTORY_AGE_MS = 2 * 60 * 60 * 1000;

export class DispatchService extends EventEmitter {
  private bot: IMBot;
  private taskQueue: DispatchTask[] = [];
  private statusMap: Map<string, TaskStatus> = new Map();
  private statusInsertionOrder: string[] = [];
  private recentFileAttachmentsByConversation: Map<string, IMAttachment> = new Map();
  private recentFileAttachment: IMAttachment | null = null;
  private conversationTurnsByConversation: Map<string, FeishuConversationTurn[]> = new Map();
  private isProcessingQueue = false;
  private runtimeApi: InProcessAgentRuntimeApi;

  constructor(bot: IMBot) {
    super();
    this.bot = bot;
    this.runtimeApi = new InProcessAgentRuntimeApi({
      defaultClient: 'im',
      adapter: {
        startTask: async (params) => {
          const dispatchTask = params.metadata?.dispatchTask as DispatchTask | undefined;
          if (!dispatchTask) {
            return {
              accepted: false,
              error: 'Missing dispatch task for IM runtime execution',
            };
          }

          await this.forwardToDesktopDirect(dispatchTask);
          return {
            accepted: true,
            runId: dispatchTask.id,
          };
        },
        readRun: async ({ runId }) => getTaskOrchestrator().getRun(runId),
        listRuns: async ({ limit } = {}) => getTaskOrchestrator().listRuns(limit),
      },
    });
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('task:status', (taskId: string, status: Partial<TaskStatus>) => {
      console.log('[DispatchService] Task status changed:', taskId, status);
    });
  }

  async handleMessage(msg: IMMessage): Promise<void> {
    console.log('[DispatchService] Handling message from:', msg.userId);

    if (await this.tryHandleFileShareRequest(msg)) {
      return;
    }

    if (msg.attachments && msg.attachments.length > 0) {
      await this.handleAttachmentMessage(msg);
      return;
    }

    const parser = new CommandParser();
    const cmd = parser.parse(msg.content);

    const chatType = msg.chatType || 'p2p';
    const targetId = this.getReplyTargetId(msg);

    if (!cmd) {
      await this.bot.sendMessage(
        targetId,
        '无法识别命令，请输入"帮助"查看命令列表',
        chatType
      );
      return;
    }

    switch (cmd.command) {
      case 'task':
        await this.handleTask(msg, cmd.args.join(' '));
        break;
      case 'sendFile':
        await this.handleSendFile(msg, cmd.args.join(' '));
        break;
      case 'template':
        await this.handleTemplate(msg, cmd.args);
        break;
      case 'status':
        await this.handleStatus(msg, cmd.args[0]);
        break;
      case 'list':
        await this.handleList(msg);
        break;
      case 'bindDevice':
        await this.handleBindDevice(msg);
        break;
      case 'takeover':
        await this.handleTakeover(msg, cmd.args[0]);
        break;
      case 'return':
        await this.handleReturn(msg);
        break;
      case 'cancel':
        await this.handleCancel(msg, cmd.args[0]);
        break;
      case 'help':
        await this.handleHelp(msg);
        break;
      default:
        await this.handleHelp(msg);
    }
  }

  private async handleTask(msg: IMMessage, description: string): Promise<void> {
    if (!description) {
      const chatType = msg.chatType || 'p2p';
      await this.bot.sendMessage(
        this.getReplyTargetId(msg),
        '请输入任务描述\n例: @机器人 任务 帮我查下北京天气',
        chatType
      );
      return;
    }

    const attachments = await this.resolveTaskAttachments(msg, description);
    const task: DispatchTask = {
      id: this.generateTaskId(),
      description,
      source: 'feishu',
      priority: 'normal',
      userId: msg.userId,
      conversationId: msg.conversationId,
      chatType: msg.chatType,
      replyTargetId: this.getReplyTargetId(msg),
      attachments,
      createdAt: Date.now(),
    };

    this.rememberConversationTurn(task.conversationId, {
      role: 'user',
      content: task.description,
      taskId: task.id,
      createdAt: task.createdAt,
    });

    this.enqueueTask(task);
    this.statusMap.set(task.id, {
      id: task.id,
      status: 'pending',
      message: '任务已接收，等待执行',
      templateId: task.templateId,
      updatedAt: Date.now(),
    });

    const progressEmitter = getProgressEmitter();
    progressEmitter.setUserBinding(task.id, {
      userId: msg.userId,
      conversationId: msg.conversationId,
      chatType: msg.chatType,
      replyTargetId: task.replyTargetId,
    });

    await this.bot.sendMessage(
      this.getReplyTargetId(msg),
      `✅ 任务已接收\n\n任务ID: ${task.id}\n描述: ${description}`,
      msg.chatType || 'p2p'
    );

    await this.processQueue();
  }

  private async handleAttachmentMessage(msg: IMMessage): Promise<void> {
    const attachments = msg.attachments || [];
    this.rememberIncomingAttachments(msg.conversationId, attachments);
    const normalizedContent = msg.content.trim();
    const description = normalizedContent || this.buildDefaultAttachmentTaskDescription(attachments);
    await this.handleTask({ ...msg, content: description, type: 'text' }, description);
  }

  private async handleTemplate(msg: IMMessage, args: string[]): Promise<void> {
    const chatType = msg.chatType || 'p2p';
    const targetId = this.getReplyTargetId(msg);
    const action = args[0];

    if (!action || action === '列表') {
      const templates = await getTaskTemplateRepository().list();
      if (templates.length === 0) {
        await this.bot.sendMessage(targetId, '暂无模板，请先在桌面端保存模板', chatType);
        return;
      }

      const content = templates
        .slice(0, 20)
        .map((template) => `• ${template.name} (${template.id.slice(0, 12)})`)
        .join('\n');
      await this.bot.sendMessage(targetId, `📚 可用模板\n\n${content}`, chatType);
      return;
    }

    if (action !== '运行') {
      await this.bot.sendMessage(
        targetId,
        '模板命令格式:\n1. 模板 列表\n2. 模板 运行 [模板名/ID] [key=value ...]',
        chatType
      );
      return;
    }

    const templateKey = args[1];
    if (!templateKey) {
      await this.bot.sendMessage(targetId, '请提供模板名或模板ID', chatType);
      return;
    }

    const templates = await getTaskTemplateRepository().list();
    const template =
      templates.find((item) => item.id === templateKey) ||
      templates.find((item) => item.name === templateKey) ||
      templates.find((item) => item.name.includes(templateKey));

    if (!template) {
      await this.bot.sendMessage(targetId, `未找到模板: ${templateKey}`, chatType);
      return;
    }

    const templateInput: Record<string, unknown> = {};
    for (const arg of args.slice(2)) {
      const [key, ...rest] = arg.split('=');
      if (!key || rest.length === 0) {
        continue;
      }
      templateInput[key] = rest.join('=');
    }

    try {
      const resolved = resolveTemplateInput(template, templateInput);
      const task: DispatchTask = {
        id: this.generateTaskId(),
        description: resolved.prompt,
        templateId: template.id,
        templateInput,
        executionMode: template.executionProfile === 'mixed' ? 'hybrid' : 'dom',
        source: 'feishu',
        priority: 'normal',
        userId: msg.userId,
        conversationId: msg.conversationId,
        chatType: msg.chatType,
        replyTargetId: targetId,
        attachments: msg.attachments,
        createdAt: Date.now(),
      };

      this.rememberConversationTurn(task.conversationId, {
        role: 'user',
        content: task.description,
        taskId: task.id,
        createdAt: task.createdAt,
      });

      this.enqueueTask(task);
      this.statusMap.set(task.id, {
        id: task.id,
        status: 'pending',
        message: `模板任务已接收: ${template.name}`,
        resultSummary: resolved.prompt,
        updatedAt: Date.now(),
      });

      await this.bot.sendMessage(
        targetId,
        `✅ 模板任务已接收\n\n任务ID: ${task.id}\n模板: ${template.name}\n执行内容: ${resolved.prompt}`,
        chatType
      );

      await this.processQueue();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.bot.sendMessage(targetId, `模板参数缺失或无效: ${message}`, chatType);
    }
  }

  private enqueueTask(task: DispatchTask): void {
    if (this.taskQueue.length >= MAX_TASK_QUEUE_SIZE) {
      this.taskQueue.shift();
      console.log('[DispatchService] Task queue limit reached, removed oldest task');
    }
    const priority = PRIORITY_MAP[task.priority];
    const index = this.taskQueue.findIndex((t) => PRIORITY_MAP[t.priority] > priority);
    if (index === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(index, 0, task);
    }
    console.log('[DispatchService] Task enqueued:', task.id, 'Queue size:', this.taskQueue.length);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;
    try {
      while (this.taskQueue.length > 0) {
        const task = this.taskQueue.shift();
        if (!task) {
          continue;
        }

        await this.forwardToDesktop(task);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async forwardToDesktop(task: DispatchTask): Promise<void> {
    const prompt = this.buildTaskPrompt(task);
    const response = await this.runtimeApi.startTask({
      task: prompt,
      source: 'im',
      client: 'im',
      runId: task.id,
      templateId: task.templateId,
      params: task.templateInput,
      executionMode: task.executionMode,
      metadata: { dispatchTask: task },
    });

    if (!response.accepted) {
      this.rememberConversationTurn(task.conversationId, {
        role: 'assistant',
        content: response.error || 'IM runtime task was not accepted',
        taskId: task.id,
        createdAt: Date.now(),
      });
      this.updateTaskStatus(task.id, {
        status: 'failed',
        message: response.error || 'IM runtime task was not accepted',
        resultSummary: response.error || 'IM runtime task was not accepted',
        artifactsCount: 0,
        runId: task.id,
        templateId: task.templateId,
        conversationId: task.conversationId,
      });
      await this.sendTaskResponse(task, '❌ 任务执行失败', response.error || 'IM runtime task was not accepted');
    }
  }

  private async forwardToDesktopDirect(task: DispatchTask): Promise<void> {
    try {
      const agent = getSharedMainAgent();
      if (!agent) {
        console.warn('[DispatchService] Shared MainAgent not initialized');
        this.updateTaskStatus(task.id, {
          status: 'failed',
          message: 'Agent not initialized',
          resultSummary: 'Agent 未初始化',
          templateId: task.templateId,
        });
        await this.sendTaskResponse(task, '❌ 任务执行失败', 'Agent 未初始化');
        return;
      }

      console.log('[DispatchService] Forwarding task to sharedMainAgent:', task.description);
      const prompt = this.buildTaskPrompt(task);
      const taskOrchestrator = getTaskOrchestrator();
      const routing = resolveTaskExecutionRoute({
        task: prompt,
        source: 'im',
        executionMode: task.executionMode || undefined,
      });
      taskOrchestrator.startRun({
        runId: task.id,
        source: 'im',
        title: task.templateId ? `IM Template: ${task.templateId}` : task.description,
        prompt,
        params: task.templateInput,
        templateId: task.templateId,
        metadata: buildTaskExecutionMetadata({
          source: 'im',
          templateId: task.templateId,
          executionMode: routing.executionMode,
          visualProvider: routing.visualProvider,
          taskRouting: routing,
          extra: {
            userId: task.userId,
            conversationId: task.conversationId,
            chatType: task.chatType,
            replyTargetId: task.replyTargetId,
            attachments: task.attachments,
          },
        }),
      });
      this.updateTaskStatus(task.id, {
        status: 'executing',
        message:
          task.templateId
            ? `AI 正在执行模板任务: ${task.templateId}`
            : routing.executionMode === 'visual' || routing.executionMode === 'hybrid'
              ? 'AI 正在执行视觉任务'
              : 'AI 正在执行任务',
        runId: task.id,
        templateId: task.templateId,
        conversationId: task.conversationId,
      });
      const taskResult = await taskOrchestrator.executeRun(task.id, async () => {
        agent.setThreadId(task.id);
        const result =
          routing.executionMode === 'visual' || routing.executionMode === 'hybrid'
            ? await executeVisualBrowserTask({
                task: prompt,
                adapterMode: resolveVisualAdapterMode(routing.executionMode, routing.visualProvider),
                maxTurns: 8,
                visualProvider: routing.visualProvider,
              })
            : await agent.run(prompt);
        return attachTaskRoutingToResult(mapAgentResultToTaskResult(result), routing);
      });

      if (!taskResult.error) {
        this.rememberConversationTurn(task.conversationId, {
          role: 'assistant',
          content: taskResult.summary || '任务已完成',
          taskId: task.id,
          createdAt: taskResult.completedAt,
        });
        this.updateTaskStatus(task.id, {
          status: 'completed',
          message: task.templateId ? '模板任务执行完成' : '任务执行完成',
          result: taskResult,
          resultSummary: taskResult.summary,
          artifactsCount: taskResult.artifacts.length,
          runId: task.id,
          templateId: task.templateId,
          conversationId: task.conversationId,
        });
        this.rememberRecentTaskFiles(task, taskResult);
        await this.sendTaskResponse(
          task,
          '✅ 任务执行完成',
          taskResult.summary || '任务已完成'
        );
        await this.sendTaskArtifacts(task, taskResult);
      } else {
        this.rememberConversationTurn(task.conversationId, {
          role: 'assistant',
          content: taskResult.error.message,
          taskId: task.id,
          createdAt: taskResult.completedAt,
        });
        this.updateTaskStatus(task.id, {
          status: 'failed',
          message: taskResult.error.message,
          result: taskResult,
          resultSummary: taskResult.summary,
          artifactsCount: taskResult.artifacts.length,
          runId: task.id,
          templateId: task.templateId,
          conversationId: task.conversationId,
        });
        await this.sendTaskResponse(
          task,
          '❌ 任务执行失败',
          taskResult.error.message || '未知错误'
        );
      }
    } catch (error) {
      console.error('[DispatchService] Forward to desktop failed:', error);
      this.rememberConversationTurn(task.conversationId, {
        role: 'assistant',
        content: `任务执行失败: ${String(error)}`,
        taskId: task.id,
        createdAt: Date.now(),
      });
      this.updateTaskStatus(task.id, {
        status: 'failed',
        message: String(error),
        resultSummary: String(error),
        artifactsCount: 0,
        runId: task.id,
        templateId: task.templateId,
        conversationId: task.conversationId,
      });
      await this.sendTaskResponse(task, '❌ 任务执行失败', String(error));
    }
  }

  private async handleStatus(msg: IMMessage, taskId?: string): Promise<void> {
    const chatType = msg.chatType || 'p2p';
    const targetId = this.getReplyTargetId(msg);
    if (!taskId) {
      await this.bot.sendMessage(
        targetId,
        '请提供任务ID\n例: @机器人 状态 abc123',
        chatType
      );
      return;
    }

    const status = this.statusMap.get(taskId);
    if (!status) {
      await this.bot.sendMessage(targetId, `任务 ${taskId} 不存在`, chatType);
      return;
    }

    const statusText = {
      pending: '⏳ 待执行',
      executing: '🔄 执行中',
      completed: '✅ 已完成',
      failed: '❌ 失败',
    }[status.status];

    let response = `📋 任务状态\n\nID: ${taskId}\n状态: ${statusText}`;
    if (status.message) {
      response += `\n信息: ${status.message}`;
    }
    if (status.resultSummary) {
      response += `\n结果: ${status.resultSummary}`;
    }

    await this.bot.sendMessage(targetId, response, chatType);
  }

  private async handleList(msg: IMMessage): Promise<void> {
    const chatType = msg.chatType || 'p2p';
    const targetId = this.getReplyTargetId(msg);
    const tasks = Array.from(this.statusMap.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 10);

    if (tasks.length === 0) {
      await this.bot.sendMessage(targetId, '暂无任务记录', chatType);
      return;
    }

    const list = tasks
      .map((t) => {
        const icon = { pending: '⏳', executing: '🔄', completed: '✅', failed: '❌' }[t.status];
        const summary = t.resultSummary ? ` - ${t.resultSummary}` : '';
        return `${icon} ${t.id.slice(0, 12)}${summary}`;
      })
      .join('\n');

    await this.bot.sendMessage(targetId, `📋 最近任务\n\n${list}`, chatType);
  }

  private async handleBindDevice(msg: IMMessage): Promise<void> {
    const chatType = msg.chatType || 'p2p';
    const targetId = this.getReplyTargetId(msg);
    const desktopUserId = getDefaultDesktopUserId();

    try {
      const bindingStore = getBindingStore();
      bindingStore.set(msg.userId, {
        imUserId: msg.userId,
        desktopUserId,
        imPlatform: 'feishu',
        boundAt: Date.now(),
      });

      await this.bot.sendMessage(
        targetId,
        `已将当前飞书账号绑定到这台设备。\n\n设备用户ID: ${desktopUserId}`,
        chatType
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.bot.sendMessage(targetId, `绑定设备失败: ${message}`, chatType);
    }
  }

  private async handleTakeover(msg: IMMessage, taskId: string): Promise<void> {
    const chatType = msg.chatType || 'p2p';
    const targetId = this.getReplyTargetId(msg);
    if (!taskId) {
      await this.bot.sendMessage(
        targetId,
        '请提供任务ID\n例: @机器人 接管 abc123',
        chatType
      );
      return;
    }

    try {
      if (typeof window !== 'undefined' && window.electron) {
        const result = await window.electron.invoke('feishu:takeover', {
          taskId,
          userId: msg.userId,
        });

        if (result.success) {
          await this.bot.sendMessage(
            targetId,
            `🔐 已接管任务\n\n任务ID: ${taskId}`,
            chatType
          );
        } else {
          await this.bot.sendMessage(targetId, `❌ 接管失败: ${result.error}`, chatType);
        }
      } else {
        await this.bot.sendMessage(
          targetId,
          '❌ 接管失败: Desktop API not available',
          chatType
        );
      }
    } catch (error) {
      console.error('[DispatchService] Takeover failed:', error);
      await this.bot.sendMessage(targetId, `❌ 接管失败: ${String(error)}`, chatType);
    }
  }

  private async handleReturn(msg: IMMessage): Promise<void> {
    const chatType = msg.chatType || 'p2p';
    const targetId = this.getReplyTargetId(msg);
    try {
      if (typeof window !== 'undefined' && window.electron) {
        const result = await window.electron.invoke('feishu:return', { userId: msg.userId });

        if (result.success) {
          await this.bot.sendMessage(targetId, '🔄 已交还控制权给AI', chatType);
        } else {
          await this.bot.sendMessage(targetId, `❌ 交还失败: ${result.error}`, chatType);
        }
      } else {
        await this.bot.sendMessage(
          targetId,
          '❌ 交还失败: Desktop API not available',
          chatType
        );
      }
    } catch (error) {
      console.error('[DispatchService] Return failed:', error);
      await this.bot.sendMessage(targetId, `❌ 交还失败: ${String(error)}`, chatType);
    }
  }

  private async handleCancel(msg: IMMessage, taskId: string): Promise<void> {
    const chatType = msg.chatType || 'p2p';
    const targetId = this.getReplyTargetId(msg);
    if (!taskId) {
      await this.bot.sendMessage(
        targetId,
        '请提供任务ID\n例: @机器人 取消 abc123',
        chatType
      );
      return;
    }

    const status = this.statusMap.get(taskId);
    if (!status) {
      await this.bot.sendMessage(targetId, `任务 ${taskId} 不存在`, chatType);
      return;
    }

    if (status.status === 'completed') {
      await this.bot.sendMessage(targetId, `任务 ${taskId} 已完成，无法取消`, chatType);
      return;
    }

    try {
      if (typeof window !== 'undefined' && window.electron) {
        const result = await window.electron.invoke('feishu:cancel', { taskId });

        if (result.success) {
          this.updateTaskStatus(taskId, {
            status: 'failed',
            message: '用户取消',
            resultSummary: '用户取消任务',
            templateId: status.templateId,
          });
          await this.bot.sendMessage(
            targetId,
            `🗑️ 已取消任务\n\n任务ID: ${taskId}`,
            chatType
          );
        } else {
          await this.bot.sendMessage(targetId, `❌ 取消失败: ${result.error}`, chatType);
        }
      } else {
        await this.bot.sendMessage(
          targetId,
          '❌ 取消失败: Desktop API not available',
          chatType
        );
      }
    } catch (error) {
      console.error('[DispatchService] Cancel failed:', error);
      await this.bot.sendMessage(targetId, `❌ 取消失败: ${String(error)}`, chatType);
    }
  }

  private async handleHelp(msg: IMMessage): Promise<void> {
    const chatType = msg.chatType || 'p2p';
    const parser = new CommandParser();
    await this.bot.sendMessage(this.getReplyTargetId(msg), parser.getHelp(), chatType);
  }

  private getReplyTargetId(msg: IMMessage): string {
    return msg.chatType === 'group' && msg.messageId ? msg.messageId : msg.conversationId;
  }

  private buildDefaultAttachmentTaskDescription(attachments: IMAttachment[]): string {
    if (attachments.length === 1) {
      return `处理我刚发送的文件：${attachments[0].fileName || '未命名文件'}`;
    }
    return `处理我刚发送的 ${attachments.length} 个文件`;
  }

  private async resolveTaskAttachments(msg: IMMessage, description: string): Promise<IMAttachment[] | undefined> {
    if (msg.attachments && msg.attachments.length > 0) {
      return msg.attachments;
    }

    if (!this.hasRecentAttachmentReference(description)) {
      return undefined;
    }

    const recentAttachment = await this.getRecentFileAttachment(msg.conversationId);
    return recentAttachment ? [recentAttachment] : undefined;
  }

  private hasRecentAttachmentReference(content: string): boolean {
    const text = content.trim();
    if (!text) {
      return false;
    }

    return ['这个文件', '刚发送的文件', '刚才的文件', '刚发的文件', '这个附件', '刚发送的附件'].some((keyword) =>
      text.includes(keyword)
    );
  }

  private buildTaskPrompt(task: DispatchTask): string {
    const conversationTurns = this.getConversationTurns(task.conversationId, task.id);
    return buildFeishuTaskPrompt({
      description: task.description,
      attachments: task.attachments,
      conversationTurns,
    });
  }

  private getConversationTurns(conversationId: string, excludeTaskId?: string): FeishuConversationTurn[] {
    const turns = this.conversationTurnsByConversation.get(conversationId) || [];
    const now = Date.now();
    const filteredTurns = turns.filter((turn) => now - turn.createdAt <= MAX_FEISHU_CONVERSATION_HISTORY_AGE_MS);
    const scopedTurns = excludeTaskId ? filteredTurns.filter((turn) => turn.taskId !== excludeTaskId) : filteredTurns;
    return scopedTurns.slice(-MAX_FEISHU_CONVERSATION_TURNS);
  }

  private rememberConversationTurn(conversationId: string, turn: FeishuConversationTurn): void {
    const turns = this.conversationTurnsByConversation.get(conversationId) || [];
    const now = Date.now();
    const freshTurns = turns.filter((existing) => now - existing.createdAt <= MAX_FEISHU_CONVERSATION_HISTORY_AGE_MS);
    freshTurns.push({
      role: turn.role,
      content: truncateFeishuConversationText(turn.content, MAX_FEISHU_CONVERSATION_CONTEXT_CHARS),
      taskId: turn.taskId,
      createdAt: turn.createdAt,
    });

    while (freshTurns.length > MAX_FEISHU_CONVERSATION_TURNS) {
      freshTurns.shift();
    }

    this.conversationTurnsByConversation.set(conversationId, freshTurns);
  }

  private async sendTaskArtifacts(task: DispatchTask, taskResult: TaskResult): Promise<void> {
    if (!taskResult.artifacts || taskResult.artifacts.length === 0) {
      return;
    }

    const conversationId = task.replyTargetId || task.conversationId;
    const chatType = task.chatType || 'p2p';
    const conversationKey = task.conversationId;

    for (const artifact of taskResult.artifacts) {
      try {
        if (artifact.type === 'link' && artifact.uri) {
          await this.bot.sendMessage(
            conversationId,
            `🔗 ${artifact.name || '结果链接'}\n${artifact.uri}`,
            chatType
          );
          continue;
        }

        const attachment = await this.buildArtifactAttachment(artifact);
        if (attachment) {
          this.rememberRecentFile(conversationKey, attachment);
          await this.bot.sendAttachment(conversationId, attachment, chatType);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[DispatchService] Failed to send task artifact:', artifact, error);
        await this.bot.sendMessage(
          conversationId,
          `⚠️ 无法回传结果文件 ${artifact.name || artifact.uri || ''}\n${message}`.trim(),
          chatType
        );
      }
    }
  }

  private async sendTaskResponse(task: DispatchTask, title: string, content: string): Promise<void> {
    const conversationId = task.replyTargetId || task.conversationId;
    const chatType = task.chatType || 'p2p';

    await this.bot.sendMessage(conversationId, `${title}\n\n${content}`, chatType);
  }

  private async buildArtifactAttachment(artifact: TaskArtifact): Promise<IMAttachment | null> {
    if (!artifact.uri || !path.isAbsolute(artifact.uri)) {
      return null;
    }

    const stats = await fs.promises.stat(artifact.uri);
    if (!stats.isFile()) {
      return null;
    }

    return {
      type: this.isImageArtifact(artifact) ? 'image' : 'file',
      fileName: path.basename(artifact.uri),
      mimeType: artifact.mimeType,
      size: stats.size,
      localPath: artifact.uri,
    };
  }

  private isImageArtifact(artifact: TaskArtifact): boolean {
    if (artifact.type === 'image') {
      return true;
    }
    if (artifact.mimeType?.startsWith('image/')) {
      return true;
    }
    if (!artifact.uri) {
      return false;
    }
    const extension = path.extname(artifact.uri).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(extension);
  }

  private async handleSendFile(msg: IMMessage, filePathInput: string): Promise<void> {
    const chatType = msg.chatType || 'p2p';
    const targetId = this.getReplyTargetId(msg);
    const filePath = filePathInput.trim();

    if (!filePath) {
      const recentAttachment = await this.getRecentFileAttachment(msg.conversationId);
      if (!recentAttachment) {
        await this.bot.sendMessage(
          targetId,
          '没有找到最近生成的文件。请直接发送本地路径，例如：发送文件 /tmp/虚沅数公司介绍.pptx',
          chatType
        );
        return;
      }

      await this.bot.sendAttachment(targetId, recentAttachment, chatType);
      await this.bot.sendMessage(targetId, `📎 已发送最近生成的文件：${recentAttachment.fileName || '附件'}`, chatType);
      return;
    }

    const attachment = await this.buildAttachmentFromLocalPath(filePath);
    if (!attachment) {
      await this.bot.sendMessage(
        targetId,
        `未找到可发送的文件：${filePath}`,
        chatType
      );
      return;
    }

    await this.bot.sendAttachment(targetId, attachment, chatType);
    this.rememberRecentFile(msg.conversationId, attachment);
    await this.bot.sendMessage(targetId, `📎 已发送文件：${attachment.fileName || path.basename(filePath)}`, chatType);
  }

  private async tryHandleFileShareRequest(msg: IMMessage): Promise<boolean> {
    if (!this.isFileShareRequest(msg.content)) {
      return false;
    }

    const chatType = msg.chatType || 'p2p';
    const targetId = this.getReplyTargetId(msg);
    const explicitPath = this.extractLocalFilePath(msg.content);

    if (explicitPath) {
      const attachment = await this.buildAttachmentFromLocalPath(explicitPath);
      if (attachment) {
        await this.bot.sendAttachment(targetId, attachment, chatType);
        this.rememberRecentFile(msg.conversationId, attachment);
        await this.bot.sendMessage(targetId, `📎 已发送文件：${attachment.fileName || path.basename(explicitPath)}`, chatType);
        return true;
      }
    }

    const taskAttachment = await this.findLatestCompletedTaskAttachment(msg.conversationId);
    if (taskAttachment) {
      await this.bot.sendAttachment(targetId, taskAttachment, chatType);
      this.rememberRecentFile(msg.conversationId, taskAttachment);
      await this.bot.sendMessage(
        targetId,
        `📎 已发送最近生成的文件：${taskAttachment.fileName || '附件'}`,
        chatType
      );
      return true;
    }

    const recentAttachment = await this.getRecentFileAttachment(msg.conversationId);
    if (!recentAttachment) {
      return false;
    }

    await this.bot.sendAttachment(targetId, recentAttachment, chatType);
    await this.bot.sendMessage(targetId, `📎 已发送最近生成的文件：${recentAttachment.fileName || '附件'}`, chatType);
    return true;
  }

  private isFileShareRequest(content: string): boolean {
    const text = content.trim();
    if (!text) {
      return false;
    }

    const intentKeywords = ['发给我', '发送给我', '传给我', '分享给我', '转发给我', '发一下', '发来', '发过来', '给我发', '发我'];
    return intentKeywords.some((keyword) => text.includes(keyword));
  }

  private extractLocalFilePath(content: string): string | null {
    const match = content.match(/\/(?:[^\s`"']+\/)*[^\s`"']+\.(?:pptx?|pdf|docx?|xlsx?|csv|zip|png|jpe?g|gif|webp|txt)/i);
    return match ? match[0] : null;
  }

  private async buildAttachmentFromLocalPath(filePath: string): Promise<IMAttachment | null> {
    if (!path.isAbsolute(filePath)) {
      return null;
    }

    try {
      const stats = await fs.promises.stat(filePath);
      if (!stats.isFile() || stats.size === 0) {
        return null;
      }

      return {
        type: this.isImageFilePath(filePath) ? 'image' : 'file',
        fileName: path.basename(filePath),
        localPath: filePath,
        size: stats.size,
      };
    } catch {
      return null;
    }
  }

  private isImageFilePath(filePath: string): boolean {
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(path.extname(filePath).toLowerCase());
  }

  private async getRecentFileAttachment(conversationId: string): Promise<IMAttachment | null> {
    const attachment = this.recentFileAttachmentsByConversation.get(conversationId);
    if (attachment?.localPath) {
      return this.buildAttachmentFromLocalPath(attachment.localPath);
    }

    if (this.recentFileAttachment?.localPath) {
      return this.buildAttachmentFromLocalPath(this.recentFileAttachment.localPath);
    }

    return null;
  }

  private async findLatestCompletedTaskAttachment(conversationId: string): Promise<IMAttachment | null> {
    const statuses = Array.from(this.statusMap.values()).filter(
      (status) => status.status === 'completed' && status.conversationId === conversationId
    );

    const latestStatus = statuses.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!latestStatus?.result) {
      return null;
    }

    const artifacts = Array.isArray(latestStatus.result.artifacts) ? latestStatus.result.artifacts : [];
    for (const artifact of artifacts as TaskArtifact[]) {
      if (!artifact?.uri) {
        continue;
      }

      const attachment = await this.buildArtifactAttachment(artifact);
      if (attachment) {
        return attachment;
      }
    }

    for (const filePath of this.extractFilePathsFromText(String(latestStatus.resultSummary || latestStatus.result?.summary || ''))) {
      const attachment = await this.buildAttachmentFromLocalPath(filePath);
      if (attachment) {
        return attachment;
      }
    }

    return null;
  }

  private rememberRecentFile(conversationId: string, attachment: IMAttachment): void {
    if (!attachment.localPath) {
      return;
    }

    this.recentFileAttachment = {
      ...attachment,
      localPath: attachment.localPath,
    };
    this.recentFileAttachmentsByConversation.set(conversationId, {
      ...attachment,
      localPath: attachment.localPath,
    });
  }

  private rememberIncomingAttachments(conversationId: string, attachments: IMAttachment[]): void {
    for (const attachment of attachments) {
      if (attachment.localPath) {
        this.rememberRecentFile(conversationId, attachment);
      }
    }
  }

  private rememberRecentTaskFiles(task: DispatchTask, taskResult: TaskResult): void {
    const conversationId = task.conversationId;
    const fileArtifacts = (taskResult.artifacts || []).filter((artifact) => artifact.type === 'file' || artifact.type === 'image');

    for (const artifact of fileArtifacts) {
      const attachment = artifact.uri ? this.createAttachmentFromArtifactPath(artifact.uri, artifact) : null;
      if (attachment) {
        this.rememberRecentFile(conversationId, attachment);
      }
    }

    for (const filePath of this.extractFilePathsFromText(taskResult.summary)) {
      const attachment = this.createAttachmentFromArtifactPath(filePath);
      if (attachment) {
        this.rememberRecentFile(conversationId, attachment);
      }
    }
  }

  private createAttachmentFromArtifactPath(
    filePath: string,
    artifact?: Pick<TaskArtifact, 'mimeType' | 'type' | 'name'>
  ): IMAttachment | null {
    if (!path.isAbsolute(filePath)) {
      return null;
    }

    try {
      const stats = fs.statSync(filePath);
      if (!stats.isFile() || stats.size === 0) {
        return null;
      }

      return {
        type: artifact?.type === 'image' || this.isImageFilePath(filePath) ? 'image' : 'file',
        fileName: artifact?.name || path.basename(filePath),
        mimeType: artifact?.mimeType,
        size: stats.size,
        localPath: filePath,
      };
    } catch {
      return null;
    }
  }

  private extractFilePathsFromText(text: string): string[] {
    if (!text) {
      return [];
    }

    const matches = text.match(/\/(?:[^\s`"']+\/)*[^\s`"']+\.(?:pptx?|pdf|docx?|xlsx?|csv|zip|png|jpe?g|gif|webp|txt)/gi);
    if (!matches) {
      return [];
    }

    return Array.from(new Set(matches));
  }

  updateTaskStatus(taskId: string, status: Partial<TaskStatus>): void {
    if (this.statusMap.size >= MAX_STATUS_MAP_SIZE) {
      const oldestKey = this.statusInsertionOrder.shift();
      if (oldestKey) {
        this.statusMap.delete(oldestKey);
        console.log('[DispatchService] statusMap limit reached, removed oldest entry');
      }
    }
    if (!this.statusMap.has(taskId)) {
      this.statusInsertionOrder.push(taskId);
    }
    const existing = this.statusMap.get(taskId);
    if (existing) {
      const nextStatus = { ...existing, ...status, updatedAt: Date.now() };
      this.statusMap.set(taskId, nextStatus);
      this.emit('task:status', taskId, nextStatus);
    }
  }

  getTaskStatus(taskId: string): TaskStatus | undefined {
    return this.statusMap.get(taskId);
  }

  getAllTasks(): TaskStatus[] {
    return Array.from(this.statusMap.values());
  }

  private generateTaskId(): string {
    return `ft_${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

let dispatchServiceInstance: DispatchService | null = null;

export function createDispatchService(bot: IMBot): DispatchService {
  dispatchServiceInstance = new DispatchService(bot);
  return dispatchServiceInstance;
}

export function getDispatchService(): DispatchService | null {
  return dispatchServiceInstance;
}
