// src/scheduler/taskQueue.ts
import { EventEmitter } from 'events';
const DEFAULT_CONFIG = {
    maxConcurrent: 3,
    maxQueueSize: 100,
};
export const TASK_QUEUE_EVENTS = {
    TASK_ENQUEUED: 'task:enqueued',
    TASK_COMPLETED: 'task:completed',
    TASK_FAILED: 'task:failed',
    QUEUE_EMPTY: 'queue:empty',
    QUEUE_PROCESSED: 'queue:processed',
};
export class TaskQueue extends EventEmitter {
    config;
    queue = [];
    runningCount = 0;
    isProcessing = false;
    executor;
    consecutiveEmptyChecks = 0;
    maxConsecutiveEmptyChecks = 100;
    emptyCheckDelay = 100;
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    setExecutor(executor) {
        this.executor = executor;
    }
    start() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        this.processQueue();
    }
    stop() {
        this.isProcessing = false;
    }
    async enqueue(task) {
        if (this.queue.length >= this.config.maxQueueSize) {
            console.warn('[TaskQueue] Queue full, rejecting task:', task.id);
            throw new Error('Task queue is full');
        }
        const insertIndex = this.queue.findIndex((t) => t.priority > task.priority);
        if (insertIndex === -1) {
            this.queue.push(task);
        }
        else {
            this.queue.splice(insertIndex, 0, task);
        }
        console.log('[TaskQueue] Enqueued task:', task.scheduledTaskId, 'Priority:', task.priority);
        this.emit(TASK_QUEUE_EVENTS.TASK_ENQUEUED, task);
        // Trigger processing if there are available slots
        if (this.runningCount < this.config.maxConcurrent && this.queue.length > 0) {
            this.processQueue();
        }
    }
    dequeue() {
        if (this.queue.length === 0)
            return undefined;
        return this.queue.shift();
    }
    size() {
        return this.queue.length;
    }
    getRunningCount() {
        return this.runningCount;
    }
    async processQueue() {
        if (!this.isProcessing)
            return;
        while (this.isProcessing &&
            this.runningCount < this.config.maxConcurrent &&
            this.queue.length > 0 &&
            this.executor) {
            const task = this.peekNextExecutable();
            if (!task) {
                // No executable tasks (waiting for executeAt time)
                break;
            }
            this.runningCount++;
            const dequeuedTask = this.dequeue();
            if (dequeuedTask) {
                this.executeTask(dequeuedTask).finally(() => {
                    this.runningCount--;
                    // After task completes, try to process more
                    if (this.queue.length > 0 && this.runningCount < this.config.maxConcurrent) {
                        this.processQueue();
                    }
                    else if (this.queue.length === 0) {
                        this.emit(TASK_QUEUE_EVENTS.QUEUE_EMPTY);
                    }
                });
            }
        }
        // Only schedule next check if queue has pending tasks but no available slots
        if (this.isProcessing &&
            this.queue.length > 0 &&
            this.runningCount >= this.config.maxConcurrent) {
            setTimeout(() => this.processQueue(), this.emptyCheckDelay);
        }
        // Track consecutive empty queue checks to reduce CPU usage
        if (this.queue.length === 0) {
            this.consecutiveEmptyChecks++;
            if (this.consecutiveEmptyChecks > this.maxConsecutiveEmptyChecks) {
                console.log('[TaskQueue] Queue empty for extended period, reducing check frequency');
                this.emptyCheckDelay = 5000;
                this.consecutiveEmptyChecks = 0;
            }
        }
        else {
            this.consecutiveEmptyChecks = 0;
            this.emptyCheckDelay = 100;
        }
    }
    peekNextExecutable() {
        const now = Date.now();
        return this.queue.find((task) => task.executeAt <= now);
    }
    async executeTask(task) {
        console.log('[TaskQueue] Executing task:', task.scheduledTaskId, 'Retry:', task.retryCount);
        let result;
        try {
            if (this.executor) {
                result = await this.executor(task);
            }
            else {
                throw new Error('No executor configured');
            }
            if (result.status === 'success') {
                this.emit('task:completed', task, result);
            }
            else {
                this.emit('task:failed', task, new Error(result.error || 'Task failed'));
            }
        }
        catch (error) {
            this.emit('task:failed', task, error instanceof Error ? error : new Error(String(error)));
        }
    }
}
