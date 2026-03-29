import { TaskHistoryRecord, HistoryQueryOptions } from './taskHistory';
import { MemoryStore } from './memoryStore';
import { SQLiteStore } from './sqliteStore';

export class HistoryStore {
  private memoryStore: MemoryStore;
  private sqliteStore: SQLiteStore;
  private syncToSqliteTimer: NodeJS.Timeout | null = null;
  private pendingSqliteWrites: TaskHistoryRecord[] = [];

  constructor(sqlitePath: string = './history.db') {
    this.memoryStore = new MemoryStore(['current']);
    this.sqliteStore = new SQLiteStore(sqlitePath);
  }

  async saveTask(record: TaskHistoryRecord): Promise<void> {
    await this.memoryStore.put(['current'], `task_${record.id}`, record);
    this.scheduleSqliteSync(record);
  }

  private scheduleSqliteSync(record: TaskHistoryRecord): void {
    this.pendingSqliteWrites.push(record);
    if (this.syncToSqliteTimer) {
      clearTimeout(this.syncToSqliteTimer);
    }
    this.syncToSqliteTimer = setTimeout(() => {
      this.flushToSqlite();
    }, 1000);
  }

  private async flushToSqlite(): Promise<void> {
    const records = [...this.pendingSqliteWrites];
    this.pendingSqliteWrites = [];
    for (const record of records) {
      try {
        await this.sqliteStore.put(['history'], `task_${record.id}`, record);
      } catch (error) {
        console.error('[HistoryStore] Failed to sync to SQLite:', error);
        this.pendingSqliteWrites.push(record);
      }
    }
  }

  async getTask(taskId: string): Promise<TaskHistoryRecord | null> {
    const memoryResult = await this.memoryStore.get(['current'], `task_${taskId}`);
    if (memoryResult) {
      return memoryResult;
    }
    return await this.sqliteStore.get(['history'], `task_${taskId}`);
  }

  async listTasks(options: HistoryQueryOptions = {}): Promise<TaskHistoryRecord[]> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const filterFn = (record: TaskHistoryRecord): boolean => {
      if (options.status && record.status !== options.status) return false;
      if (options.startDate && record.startTime < options.startDate) return false;
      if (options.endDate && record.endTime > options.endDate) return false;
      if (options.keyword && !record.task.toLowerCase().includes(options.keyword.toLowerCase()))
        return false;
      return true;
    };

    return await this.sqliteStore.query(['history'], {
      filter: filterFn,
      limit,
      offset,
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.memoryStore.delete(['current'], `task_${taskId}`);
    await this.sqliteStore.delete(['history'], `task_${taskId}`);
  }

  async searchByDate(start: number, end: number): Promise<TaskHistoryRecord[]> {
    return this.listTasks({ startDate: start, endDate: end });
  }

  async replayTask(taskId: string): Promise<{ taskId: string; status: 'started' }> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    return { taskId, status: 'started' };
  }

  async close(): Promise<void> {
    if (this.syncToSqliteTimer) {
      clearTimeout(this.syncToSqliteTimer);
      await this.flushToSqlite();
    }
    await this.sqliteStore.close();
  }

  async clear(): Promise<void> {
    await this.memoryStore.clear();
    await this.sqliteStore.clear();
  }
}

let historyStoreInstance: HistoryStore | null = null;

export function getHistoryStore(sqlitePath?: string): HistoryStore {
  if (!historyStoreInstance) {
    historyStoreInstance = new HistoryStore(sqlitePath);
  }
  return historyStoreInstance;
}

export function createHistoryStore(sqlitePath?: string): HistoryStore {
  historyStoreInstance = new HistoryStore(sqlitePath);
  return historyStoreInstance;
}
