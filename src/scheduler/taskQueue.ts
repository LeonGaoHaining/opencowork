// src/scheduler/taskQueue.ts

import { EventEmitter } from 'events';
import { QueuedTask, TaskExecutionResult } from './types';

export interface TaskQueueConfig {
  maxConcurrent: number;
  maxQueueSize: number;
}

const DEFAULT_CONFIG: TaskQueueConfig = {
  maxConcurrent: 3,
  maxQueueSize: 100,
};

export const TASK_QUEUE_EVENTS = {
  TASK_ENQUEUED: 'task:enqueued',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  QUEUE_EMPTY: 'queue:empty',
  QUEUE_PROCESSED: 'queue:processed',
} as const;

export class TaskQueue extends EventEmitter {
  private config: TaskQueueConfig;
  private queue: QueuedTask[] = [];
  private runningCount = 0;
  private isProcessing = false;
  private executor?: (task: QueuedTask) => Promise<TaskExecutionResult>;
  private consecutiveEmptyChecks = 0;
  private maxConsecutiveEmptyChecks = 100;
  private emptyCheckDelay = 100;

  constructor(config: Partial<TaskQueueConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setExecutor(executor: (task: QueuedTask) => Promise<TaskExecutionResult>): void {
    this.executor = executor;
  }

  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.processQueue();
  }

  stop(): void {
    this.isProcessing = false;
  }

  async enqueue(task: QueuedTask): Promise<void> {
    if (this.queue.length >= this.config.maxQueueSize) {
      console.warn('[TaskQueue] Queue full, rejecting task:', task.id);
      throw new Error('Task queue is full');
    }

    const insertIndex = this.queue.findIndex((t) => t.priority > task.priority);
    if (insertIndex === -1) {
      this.queue.push(task);
    } else {
      this.queue.splice(insertIndex, 0, task);
    }

    console.log('[TaskQueue] Enqueued task:', task.scheduledTaskId, 'Priority:', task.priority);
    this.emit(TASK_QUEUE_EVENTS.TASK_ENQUEUED, task);

    // Trigger processing if there are available slots
    if (this.runningCount < this.config.maxConcurrent && this.queue.length > 0) {
      this.processQueue();
    }
  }

  dequeue(): QueuedTask | undefined {
    if (this.queue.length === 0) return undefined;
    return this.queue.shift();
  }

  size(): number {
    return this.queue.length;
  }

  getRunningCount(): number {
    return this.runningCount;
  }

  private async processQueue(): Promise<void> {
    if (!this.isProcessing) return;

    while (
      this.isProcessing &&
      this.runningCount < this.config.maxConcurrent &&
      this.queue.length > 0 &&
      this.executor
    ) {
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
          } else if (this.queue.length === 0) {
            this.emit(TASK_QUEUE_EVENTS.QUEUE_EMPTY);
          }
        });
      }
    }

    // Only schedule next check if queue has pending tasks but no available slots
    if (
      this.isProcessing &&
      this.queue.length > 0 &&
      this.runningCount >= this.config.maxConcurrent
    ) {
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
    } else {
      this.consecutiveEmptyChecks = 0;
      this.emptyCheckDelay = 100;
    }
  }

  private peekNextExecutable(): QueuedTask | undefined {
    const now = Date.now();
    return this.queue.find((task) => task.executeAt <= now);
  }

  private async executeTask(task: QueuedTask): Promise<void> {
    console.log('[TaskQueue] Executing task:', task.scheduledTaskId, 'Retry:', task.retryCount);

    let result: TaskExecutionResult;
    try {
      if (this.executor) {
        result = await this.executor(task);
      } else {
        throw new Error('No executor configured');
      }

      if (result.status === 'success') {
        this.emit('task:completed', task, result);
      } else {
        this.emit('task:failed', task, new Error(result.error || 'Task failed'));
      }
    } catch (error) {
      this.emit('task:failed', task, error instanceof Error ? error : new Error(String(error)));
    }
  }
}
