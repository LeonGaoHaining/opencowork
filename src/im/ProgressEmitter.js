import { EventEmitter } from 'events';
export class ProgressEmitter extends EventEmitter {
    progressListeners = new Map();
    imBot = null;
    userBindingMap = new Map();
    setIMBot(bot) {
        this.imBot = bot;
    }
    setUserBinding(taskId, userId) {
        this.userBindingMap.set(taskId, userId);
    }
    subscribe(taskId, listener) {
        if (!this.progressListeners.has(taskId)) {
            this.progressListeners.set(taskId, new Set());
        }
        this.progressListeners.get(taskId).add(listener);
        return () => {
            this.progressListeners.get(taskId)?.delete(listener);
            if (this.progressListeners.get(taskId)?.size === 0) {
                this.progressListeners.delete(taskId);
                this.userBindingMap.delete(taskId);
            }
        };
    }
    emitProgress(event) {
        const listeners = this.progressListeners.get(event.taskId);
        if (listeners) {
            listeners.forEach((listener) => listener(event));
        }
        if (this.imBot && event.status !== 'pending') {
            this.pushToIM(event);
        }
    }
    async pushToIM(event) {
        if (!this.imBot)
            return;
        const statusText = {
            pending: '⏳ 待执行',
            executing: `🔄 执行中: ${event.message || ''}`,
            completed: '✅ 任务完成',
            failed: '❌ 任务失败',
        }[event.status];
        const notification = {
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
            }
            catch (error) {
                console.error('[ProgressEmitter] Push notification failed:', error);
            }
        }
    }
    clearTask(taskId) {
        this.progressListeners.delete(taskId);
        this.userBindingMap.delete(taskId);
    }
    clearAll() {
        this.progressListeners.clear();
        this.userBindingMap.clear();
    }
}
let progressEmitterInstance = null;
export function getProgressEmitter() {
    if (!progressEmitterInstance) {
        progressEmitterInstance = new ProgressEmitter();
    }
    return progressEmitterInstance;
}
