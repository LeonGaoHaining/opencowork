import { TaskHistoryRecord, HistoryQueryOptions, TaskStep } from './taskHistory';
import { getHistoryStore, HistoryStore } from './historyStore';

export class HistoryService {
  private store: HistoryStore;

  constructor(store?: HistoryStore) {
    this.store = store || getHistoryStore();
  }

  async createTask(
    task: string,
    metadata?: TaskHistoryRecord['metadata']
  ): Promise<TaskHistoryRecord> {
    const now = Date.now();
    const record: TaskHistoryRecord = {
      id: this.generateId(),
      taskId: this.generateTaskId(),
      task,
      status: 'completed',
      startTime: now,
      endTime: now,
      duration: 0,
      steps: [],
      metadata,
    };
    await this.store.saveTask(record);
    return record;
  }

  async startTask(
    task: string,
    metadata?: TaskHistoryRecord['metadata']
  ): Promise<TaskHistoryRecord> {
    const now = Date.now();
    const record: TaskHistoryRecord = {
      id: this.generateId(),
      taskId: this.generateTaskId(),
      task,
      status: 'completed',
      startTime: now,
      endTime: now,
      duration: 0,
      steps: [],
      metadata,
    };
    await this.store.saveTask(record);
    return record;
  }

  async addStep(taskId: string, step: Omit<TaskStep, 'id' | 'startTime'>): Promise<void> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    const newStep: TaskStep = {
      ...step,
      id: this.generateId(),
      startTime: Date.now(),
    };
    task.steps.push(newStep);
    await this.store.saveTask(task);
  }

  async completeTask(
    taskId: string,
    result: { success: boolean; output?: any; error?: string }
  ): Promise<void> {
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
  }

  async cancelTask(taskId: string, reason?: string): Promise<void> {
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
  }

  async getTask(taskId: string): Promise<TaskHistoryRecord | null> {
    return this.store.getTask(taskId);
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
    const tasks = await this.store.listTasks({ limit: 1000 });
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const failed = tasks.filter((t) => t.status === 'failed').length;
    const cancelled = tasks.filter((t) => t.status === 'cancelled').length;
    const durations = tasks.filter((t) => t.duration > 0).map((t) => t.duration);
    const averageDuration =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    return {
      total: tasks.length,
      completed,
      failed,
      cancelled,
      averageDuration,
    };
  }

  private generateId(): string {
    return `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
