import { EventEmitter } from 'events';
import { IMBot, ProgressEvent, IMNotification } from './types';

type ProgressListener = (data: ProgressEvent) => void;

export class ProgressEmitter extends EventEmitter {
  private progressListeners: Map<string, Set<ProgressListener>> = new Map();
  private imBot: IMBot | null = null;
  private userBindingMap: Map<string, string> = new Map();

  setIMBot(bot: IMBot): void {
    this.imBot = bot;
  }

  setUserBinding(taskId: string, userId: string): void {
    this.userBindingMap.set(taskId, userId);
  }

  subscribe(taskId: string, listener: ProgressListener): () => void {
    if (!this.progressListeners.has(taskId)) {
      this.progressListeners.set(taskId, new Set());
    }
    this.progressListeners.get(taskId)!.add(listener);

    return () => {
      this.progressListeners.get(taskId)?.delete(listener);
      if (this.progressListeners.get(taskId)?.size === 0) {
        this.progressListeners.delete(taskId);
        this.userBindingMap.delete(taskId);
      }
    };
  }

  emitProgress(event: ProgressEvent): void {
    const listeners = this.progressListeners.get(event.taskId);
    if (listeners) {
      listeners.forEach((listener) => listener(event));
    }

    if (this.imBot && event.status !== 'pending') {
      this.pushToIM(event);
    }
  }

  private async pushToIM(event: ProgressEvent): Promise<void> {
    if (!this.imBot) return;

    const statusText =
      {
        pending: '⏳ 待执行',
        executing: `🔄 执行中: ${event.message || ''}`,
        completed: '✅ 任务完成',
        failed: '❌ 任务失败',
      }[event.status] || `未知状态: ${event.status}`;

    const notification: IMNotification = {
      title: event.taskId,
      content: statusText,
      extra: {
        taskId: event.taskId,
        step: event.step,
        total: event.total,
      },
    };

    const userId = this.userBindingMap.get(event.taskId);
    if (userId) {
      try {
        await this.imBot.pushNotification(userId, notification);
        console.log('[ProgressEmitter] Notification pushed for task:', event.taskId);
      } catch (error) {
        console.error('[ProgressEmitter] Push notification failed:', error);
      }
    }
  }

  clearTask(taskId: string): void {
    this.progressListeners.delete(taskId);
    this.userBindingMap.delete(taskId);
  }

  clearAll(): void {
    this.progressListeners.clear();
    this.userBindingMap.clear();
  }
}

let progressEmitterInstance: ProgressEmitter | null = null;

export function getProgressEmitter(): ProgressEmitter {
  if (!progressEmitterInstance) {
    progressEmitterInstance = new ProgressEmitter();
  }
  return progressEmitterInstance;
}
