import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { IMMessage, IMBot, DispatchTask, TaskStatus, IMAttachment } from './types';
import { CommandParser } from './CommandParser';
import { getProgressEmitter } from './ProgressEmitter';
import { getSharedMainAgent } from '../main/ipcHandlers';
import { mapAgentResultToTaskResult } from '../core/task/resultMapper';
import { getTaskTemplateRepository } from '../core/task/TaskTemplateRepository';
import { resolveTemplateInput } from '../core/task/templateUtils';
import { getTaskOrchestrator } from '../core/task/TaskOrchestrator';
import { TaskArtifact, TaskResult } from '../core/task/types';

const PRIORITY_MAP: Record<string, number> = {
  low: 10,
  normal: 5,
  high: 1,
};

const MAX_STATUS_MAP_SIZE = 1000;
const MAX_TASK_QUEUE_SIZE = 500;

export class DispatchService extends EventEmitter {
  private bot: IMBot;
  private taskQueue: DispatchTask[] = [];
  private statusMap: Map<string, TaskStatus> = new Map();
  private statusInsertionOrder: string[] = [];

  constructor(bot: IMBot) {
    super();
    this.bot = bot;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('task:status', (taskId: string, status: Partial<TaskStatus>) => {
      console.log('[DispatchService] Task status changed:', taskId, status);
    });
  }

  async handleMessage(msg: IMMessage): Promise<void> {
    console.log('[DispatchService] Handling message from:', msg.userId);

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
      case 'template':
        await this.handleTemplate(msg, cmd.args);
        break;
      case 'status':
        await this.handleStatus(msg, cmd.args[0]);
        break;
      case 'list':
        await this.handleList(msg);
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

    const task: DispatchTask = {
      id: this.generateTaskId(),
      description,
      source: 'feishu',
      priority: 'normal',
      userId: msg.userId,
      conversationId: msg.conversationId,
      chatType: msg.chatType,
      replyTargetId: this.getReplyTargetId(msg),
      attachments: msg.attachments,
      createdAt: Date.now(),
    };

    this.enqueueTask(task);
    this.statusMap.set(task.id, {
      id: task.id,
      status: 'pending',
      message: '任务已接收，等待执行',
      updatedAt: Date.now(),
    });

    const progressEmitter = getProgressEmitter();
    progressEmitter.setUserBinding(task.id, msg.userId);

    await this.bot.sendMessage(
      this.getReplyTargetId(msg),
      `✅ 任务已接收\n\n任务ID: ${task.id}\n描述: ${description}`,
      msg.chatType || 'p2p'
    );

    await this.forwardToDesktop(task);
  }

  private async handleAttachmentMessage(msg: IMMessage): Promise<void> {
    const attachments = msg.attachments || [];
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
        source: 'feishu',
        priority: 'normal',
        userId: msg.userId,
        conversationId: msg.conversationId,
        chatType: msg.chatType,
        replyTargetId: targetId,
        attachments: msg.attachments,
        createdAt: Date.now(),
      };

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

      await this.forwardToDesktop(task);
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

  private async forwardToDesktop(task: DispatchTask): Promise<void> {
    try {
      const agent = getSharedMainAgent();
      if (!agent) {
        console.warn('[DispatchService] Shared MainAgent not initialized');
        this.updateTaskStatus(task.id, {
          status: 'failed',
          message: 'Agent not initialized',
          resultSummary: 'Agent 未初始化',
        });
        await this.bot.pushNotification(task.userId, {
          title: '❌ 任务执行失败',
          content: 'Agent 未初始化',
        });
        return;
      }

      console.log('[DispatchService] Forwarding task to sharedMainAgent:', task.description);
      const prompt = this.buildTaskPrompt(task.description, task.attachments);
      const taskOrchestrator = getTaskOrchestrator();
      taskOrchestrator.startRun({
        runId: task.id,
        source: 'im',
        title: task.templateId ? `IM Template: ${task.templateId}` : task.description,
        prompt,
        params: task.templateInput,
        templateId: task.templateId,
        metadata: {
          userId: task.userId,
          conversationId: task.conversationId,
          attachments: task.attachments,
        },
      });
      this.updateTaskStatus(task.id, {
        status: 'executing',
        message: task.templateId ? `AI 正在执行模板任务: ${task.templateId}` : 'AI 正在执行任务',
        runId: task.id,
      });
      const taskResult = await taskOrchestrator.executeRun(task.id, async () => {
        const result = await agent.run(prompt);
        return mapAgentResultToTaskResult(result);
      });

      if (!taskResult.error) {
        this.updateTaskStatus(task.id, {
          status: 'completed',
          message: task.templateId ? '模板任务执行完成' : '任务执行完成',
          result: taskResult,
          resultSummary: taskResult.summary,
          artifactsCount: taskResult.artifacts.length,
          runId: task.id,
        });
        await this.bot.pushNotification(task.userId, {
          title: '✅ 任务执行完成',
          content: taskResult.summary || '任务已完成',
        });
        await this.sendTaskArtifacts(task, taskResult);
      } else {
        this.updateTaskStatus(task.id, {
          status: 'failed',
          message: taskResult.error.message,
          result: taskResult,
          resultSummary: taskResult.summary,
          artifactsCount: taskResult.artifacts.length,
          runId: task.id,
        });
        await this.bot.pushNotification(task.userId, {
          title: '❌ 任务执行失败',
          content: taskResult.error.message || '未知错误',
        });
      }
    } catch (error) {
      console.error('[DispatchService] Forward to desktop failed:', error);
      this.updateTaskStatus(task.id, {
        status: 'failed',
        message: String(error),
        resultSummary: String(error),
        artifactsCount: 0,
        runId: task.id,
      });
      await this.bot.pushNotification(task.userId, {
        title: '❌ 任务执行失败',
        content: String(error),
      });
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

  private buildTaskPrompt(description: string, attachments?: IMAttachment[]): string {
    if (!attachments || attachments.length === 0) {
      return description;
    }

    const attachmentLines = attachments.map((attachment, index) => {
      const fields = [
        `类型: ${attachment.type}`,
        attachment.fileName ? `文件名: ${attachment.fileName}` : undefined,
        attachment.mimeType ? `MIME: ${attachment.mimeType}` : undefined,
        attachment.localPath ? `本地路径: ${attachment.localPath}` : undefined,
      ].filter(Boolean);
      return `${index + 1}. ${fields.join(' | ')}`;
    });

    return `${description}\n\n附加文件（可直接读取本地路径）:\n${attachmentLines.join('\n')}`;
  }

  private async sendTaskArtifacts(task: DispatchTask, taskResult: TaskResult): Promise<void> {
    if (!taskResult.artifacts || taskResult.artifacts.length === 0) {
      return;
    }

    const conversationId = task.replyTargetId || task.conversationId;
    const chatType = task.chatType || 'p2p';

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
