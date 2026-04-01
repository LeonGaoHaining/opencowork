import { TaskHistoryRecord, HistoryQueryOptions, TaskStep } from './taskHistory';
import { getHistoryStore, HistoryStore } from './historyStore';

function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

type MutexFn<T> = () => Promise<T>;

class Mutex {
  private queue: MutexFn<any>[] = [];
  private locked = false;

  async lock<T>(fn: MutexFn<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        }
      });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.locked || this.queue.length === 0) {
      return;
    }
    this.locked = true;
    const fn = this.queue.shift()!;
    try {
      await fn();
    } finally {
      this.locked = false;
      this.process();
    }
  }
}

export class HistoryService {
  private store: HistoryStore;
  private taskMutexes: Map<string, Mutex> = new Map();
  private globalMutex = new Mutex();

  constructor(store?: HistoryStore) {
    this.store = store || getHistoryStore();
  }

  private getTaskMutex(taskId: string): Mutex {
    if (!this.taskMutexes.has(taskId)) {
      this.taskMutexes.set(taskId, new Mutex());
    }
    return this.taskMutexes.get(taskId)!;
  }

  private releaseTaskMutex(taskId: string): void {
    this.taskMutexes.delete(taskId);
  }

  async createTask(
    task: string,
    metadata?: TaskHistoryRecord['metadata']
  ): Promise<TaskHistoryRecord> {
    return this.globalMutex.lock(async () => {
      const now = Date.now();
      const record: TaskHistoryRecord = {
        id: this.generateId(),
        taskId: this.generateTaskId(),
        task,
        status: 'pending',
        startTime: now,
        endTime: now,
        duration: 0,
        steps: [],
        metadata,
      };
      await this.store.saveTask(record);
      return deepClone(record);
    });
  }

  async startTask(
    task: string,
    metadata?: TaskHistoryRecord['metadata']
  ): Promise<TaskHistoryRecord> {
    return this.globalMutex.lock(async () => {
      const existingTasks = await this.store.listTasks({
        status: 'pending',
        keyword: task,
        limit: 1,
      });
      if (existingTasks.length > 0) {
        const pendingTask = existingTasks[0];
        pendingTask.status = 'running';
        pendingTask.startTime = Date.now();
        await this.store.saveTask(pendingTask);
        return deepClone(pendingTask);
      }

      const now = Date.now();
      const record: TaskHistoryRecord = {
        id: this.generateId(),
        taskId: this.generateTaskId(),
        task,
        status: 'running',
        startTime: now,
        endTime: now,
        duration: 0,
        steps: [],
        metadata,
      };
      await this.store.saveTask(record);
      return deepClone(record);
    });
  }

  async startTaskById(taskId: string): Promise<TaskHistoryRecord> {
    const mutex = this.getTaskMutex(taskId);
    return mutex.lock(async () => {
      const task = await this.store.getTask(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      task.status = 'running';
      task.startTime = Date.now();
      await this.store.saveTask(task);
      return deepClone(task);
    });
  }

  async addStep(taskId: string, step: Omit<TaskStep, 'id' | 'startTime'>): Promise<void> {
    const mutex = this.getTaskMutex(taskId);
    return mutex.lock(async () => {
      const task = await this.store.getTask(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      const newStep: TaskStep = {
        ...deepClone(step),
        id: this.generateId(),
        startTime: Date.now(),
      };
      task.steps.push(newStep);
      await this.store.saveTask(task);
    });
  }

  async completeTask(
    taskId: string,
    result: { success: boolean; output?: unknown; error?: string }
  ): Promise<void> {
    const mutex = this.getTaskMutex(taskId);
    return mutex.lock(async () => {
      const task = await this.store.getTask(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      const now = Date.now();
      task.status = result.success ? 'completed' : 'failed';
      task.endTime = now;
      task.duration = now - task.startTime;
      task.result = result;
      await this.store.saveTask(task);
      this.releaseTaskMutex(taskId);
    });
  }

  async cancelTask(taskId: string, reason?: string): Promise<void> {
    const mutex = this.getTaskMutex(taskId);
    return mutex.lock(async () => {
      const task = await this.store.getTask(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      const now = Date.now();
      task.status = 'cancelled';
      task.endTime = now;
      task.duration = now - task.startTime;
      task.result = { success: false, error: reason || 'Cancelled by user' };
      await this.store.saveTask(task);
      this.releaseTaskMutex(taskId);
    });
  }

  async getTask(taskId: string): Promise<TaskHistoryRecord | null> {
    const task = await this.store.getTask(taskId);
    return task ? deepClone(task) : null;
  }

  async listTasks(options: HistoryQueryOptions = {}): Promise<TaskHistoryRecord[]> {
    return this.store.listTasks(options);
  }

  async deleteTask(taskId: string): Promise<void> {
    return this.store.deleteTask(taskId);
  }

  async replayTask(taskId: string): Promise<{ taskId: string; status: 'started' }> {
    return this.store.replayTask(taskId);
  }

  async searchByKeyword(keyword: string): Promise<TaskHistoryRecord[]> {
    return this.store.listTasks({ keyword });
  }

  async searchByDateRange(start: number, end: number): Promise<TaskHistoryRecord[]> {
    return this.store.searchByDate(start, end);
  }

  async getTaskStats(): Promise<{
    total: number;
    completed: number;
    failed: number;
    cancelled: number;
    averageDuration: number;
  }> {
    const [tasks, total] = await Promise.all([
      this.store.listTasks({ limit: 1000 }),
      this.store.getTotalCount(),
    ]);
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const failed = tasks.filter((t) => t.status === 'failed').length;
    const cancelled = tasks.filter((t) => t.status === 'cancelled').length;
    const durations = tasks.filter((t) => t.duration > 0).map((t) => t.duration);
    const averageDuration =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    return {
      total,
      completed,
      failed,
      cancelled,
      averageDuration,
    };
  }

  private generateId(): string {
    return `hist_${Date.now()}_${crypto.randomUUID()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${crypto.randomUUID()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}

let historyServiceInstance: HistoryService | null = null;

export function getHistoryService(): HistoryService {
  if (!historyServiceInstance) {
    historyServiceInstance = new HistoryService();
  }
  return historyServiceInstance;
}

export function createHistoryService(store?: HistoryStore): HistoryService {
  historyServiceInstance = new HistoryService(store);
  return historyServiceInstance;
}
