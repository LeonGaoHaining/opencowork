import { EventEmitter } from 'events';
import { IMMessage, IMBot, DispatchTask, TaskStatus } from './types';
import { CommandParser } from './CommandParser';
import { getProgressEmitter } from './ProgressEmitter';
import { getSharedMainAgent } from '../main/ipcHandlers';

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

    const parser = new CommandParser();
    const cmd = parser.parse(msg.content);

    const chatType = (msg as any).chatType || 'p2p';

    if (!cmd) {
      await this.bot.sendMessage(
        msg.conversationId,
        '无法识别命令，请输入"帮助"查看命令列表',
        chatType
      );
      return;
    }

    switch (cmd.command) {
      case 'task':
        await this.handleTask(msg, cmd.args.join(' '));
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
      const chatType = (msg as any).chatType || 'p2p';
      await this.bot.sendMessage(
        msg.conversationId,
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
      createdAt: Date.now(),
    };

    this.enqueueTask(task);
    this.statusMap.set(task.id, {
      id: task.id,
      status: 'pending',
      updatedAt: Date.now(),
    });

    const progressEmitter = getProgressEmitter();
    progressEmitter.setUserBinding(task.id, msg.userId);

    await this.bot.sendMessage(
      msg.conversationId,
      `✅ 任务已接收\n\n任务ID: ${task.id}\n描述: ${description}`,
      (msg as any).chatType || 'p2p'
    );

    await this.forwardToDesktop(task);
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
        this.updateTaskStatus(task.id, { status: 'failed', message: 'Agent not initialized' });
        await this.bot.pushNotification(task.userId, {
          title: '❌ 任务执行失败',
          content: 'Agent 未初始化',
        });
        return;
      }

      console.log('[DispatchService] Forwarding task to sharedMainAgent:', task.description);
      const result = await agent.run(task.description);

      if (result.success) {
        this.updateTaskStatus(task.id, { status: 'executing' });
        await this.bot.pushNotification(task.userId, {
          title: '✅ 任务执行完成',
          content: result.finalMessage || result.output || '任务已完成',
        });
      } else {
        this.updateTaskStatus(task.id, { status: 'failed', message: result.error });
        await this.bot.pushNotification(task.userId, {
          title: '❌ 任务执行失败',
          content: result.error || '未知错误',
        });
      }
    } catch (error) {
      console.error('[DispatchService] Forward to desktop failed:', error);
      this.updateTaskStatus(task.id, { status: 'failed', message: String(error) });
      await this.bot.pushNotification(task.userId, {
        title: '❌ 任务执行失败',
        content: String(error),
      });
    }
  }

  private async handleStatus(msg: IMMessage, taskId?: string): Promise<void> {
    const chatType = (msg as any).chatType || 'p2p';
    if (!taskId) {
      await this.bot.sendMessage(
        msg.conversationId,
        '请提供任务ID\n例: @机器人 状态 abc123',
        chatType
      );
      return;
    }

    const status = this.statusMap.get(taskId);
    if (!status) {
      await this.bot.sendMessage(msg.conversationId, `任务 ${taskId} 不存在`, chatType);
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

    await this.bot.sendMessage(msg.conversationId, response, chatType);
  }

  private async handleList(msg: IMMessage): Promise<void> {
    const chatType = (msg as any).chatType || 'p2p';
    const tasks = Array.from(this.statusMap.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 10);

    if (tasks.length === 0) {
      await this.bot.sendMessage(msg.conversationId, '暂无任务记录', chatType);
      return;
    }

    const list = tasks
      .map((t) => {
        const icon = { pending: '⏳', executing: '🔄', completed: '✅', failed: '❌' }[t.status];
        return `${icon} ${t.id.slice(0, 12)}`;
      })
      .join('\n');

    await this.bot.sendMessage(msg.conversationId, `📋 最近任务\n\n${list}`, chatType);
  }

  private async handleTakeover(msg: IMMessage, taskId: string): Promise<void> {
    const chatType = (msg as any).chatType || 'p2p';
    if (!taskId) {
      await this.bot.sendMessage(
        msg.conversationId,
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
            msg.conversationId,
            `🔐 已接管任务\n\n任务ID: ${taskId}`,
            chatType
          );
        } else {
          await this.bot.sendMessage(msg.conversationId, `❌ 接管失败: ${result.error}`, chatType);
        }
      } else {
        await this.bot.sendMessage(
          msg.conversationId,
          '❌ 接管失败: Desktop API not available',
          chatType
        );
      }
    } catch (error) {
      console.error('[DispatchService] Takeover failed:', error);
      await this.bot.sendMessage(msg.conversationId, `❌ 接管失败: ${String(error)}`, chatType);
    }
  }

  private async handleReturn(msg: IMMessage): Promise<void> {
    const chatType = (msg as any).chatType || 'p2p';
    try {
      if (typeof window !== 'undefined' && window.electron) {
        const result = await window.electron.invoke('feishu:return', { userId: msg.userId });

        if (result.success) {
          await this.bot.sendMessage(msg.conversationId, '🔄 已交还控制权给AI', chatType);
        } else {
          await this.bot.sendMessage(msg.conversationId, `❌ 交还失败: ${result.error}`, chatType);
        }
      } else {
        await this.bot.sendMessage(
          msg.conversationId,
          '❌ 交还失败: Desktop API not available',
          chatType
        );
      }
    } catch (error) {
      console.error('[DispatchService] Return failed:', error);
      await this.bot.sendMessage(msg.conversationId, `❌ 交还失败: ${String(error)}`, chatType);
    }
  }

  private async handleCancel(msg: IMMessage, taskId: string): Promise<void> {
    const chatType = (msg as any).chatType || 'p2p';
    if (!taskId) {
      await this.bot.sendMessage(
        msg.conversationId,
        '请提供任务ID\n例: @机器人 取消 abc123',
        chatType
      );
      return;
    }

    const status = this.statusMap.get(taskId);
    if (!status) {
      await this.bot.sendMessage(msg.conversationId, `任务 ${taskId} 不存在`, chatType);
      return;
    }

    if (status.status === 'completed') {
      await this.bot.sendMessage(msg.conversationId, `任务 ${taskId} 已完成，无法取消`, chatType);
      return;
    }

    try {
      if (typeof window !== 'undefined' && window.electron) {
        const result = await window.electron.invoke('feishu:cancel', { taskId });

        if (result.success) {
          this.updateTaskStatus(taskId, { status: 'failed', message: '用户取消' });
          await this.bot.sendMessage(
            msg.conversationId,
            `🗑️ 已取消任务\n\n任务ID: ${taskId}`,
            chatType
          );
        } else {
          await this.bot.sendMessage(msg.conversationId, `❌ 取消失败: ${result.error}`, chatType);
        }
      } else {
        await this.bot.sendMessage(
          msg.conversationId,
          '❌ 取消失败: Desktop API not available',
          chatType
        );
      }
    } catch (error) {
      console.error('[DispatchService] Cancel failed:', error);
      await this.bot.sendMessage(msg.conversationId, `❌ 取消失败: ${String(error)}`, chatType);
    }
  }

  private async handleHelp(msg: IMMessage): Promise<void> {
    const chatType = (msg as any).chatType || 'p2p';
    const parser = new CommandParser();
    await this.bot.sendMessage(msg.conversationId, parser.getHelp(), chatType);
  }

  updateTaskStatus(taskId: string, status: Partial<TaskStatus>): void {
    if (status.status === 'completed' || status.status === 'failed') {
      this.statusMap.delete(taskId);
      this.statusInsertionOrder = this.statusInsertionOrder.filter((k) => k !== taskId);
      return;
    }

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
      this.statusMap.set(taskId, { ...existing, ...status, updatedAt: Date.now() });
      this.emit('task:status', taskId, status);
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
