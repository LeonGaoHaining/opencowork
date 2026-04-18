import {
  TaskHistoryRecord,
  HistoryQueryOptions,
  HistorySearchOptions,
  HistorySearchResult,
} from './taskHistory';
import { MemoryStore } from './memoryStore';
import { SQLiteStore } from './sqliteStore';

const MAX_PENDING_WRITES = 500;

export class HistoryStore {
  private memoryStore: MemoryStore;
  private sqliteStore: SQLiteStore;
  private syncToSqliteTimer: NodeJS.Timeout | null = null;
  private pendingSqliteWrites: TaskHistoryRecord[] = [];
  private flushInProgress = false;
  private maxRetries = 3;
  private retryCounts: Map<string, number> = new Map();

  constructor(sqlitePath: string = './history.db') {
    this.memoryStore = new MemoryStore(['current']);
    this.sqliteStore = new SQLiteStore(sqlitePath);
  }

  async saveTask(record: TaskHistoryRecord): Promise<void> {
    await this.memoryStore.put(['current'], `task_${record.id}`, record);
    await this.scheduleSqliteSync(record);
  }

  private async scheduleSqliteSync(record: TaskHistoryRecord): Promise<void> {
    this.pendingSqliteWrites.push(record);

    if (this.pendingSqliteWrites.length >= MAX_PENDING_WRITES) {
      await this.flushToSqlite();
      return;
    }

    if (this.syncToSqliteTimer) {
      clearTimeout(this.syncToSqliteTimer);
      this.syncToSqliteTimer = null;
    }
    this.syncToSqliteTimer = setTimeout(() => {
      this.flushToSqlite();
    }, 1000);
  }

  private async flushToSqlite(): Promise<void> {
    if (this.flushInProgress) {
      return;
    }
    this.flushInProgress = true;

    try {
      const records = [...this.pendingSqliteWrites];
      const failedRecords: TaskHistoryRecord[] = [];

      for (const record of records) {
        const retryCount = this.retryCounts.get(record.id) || 0;
        try {
          await this.sqliteStore.put(['history'], `task_${record.id}`, record);
          this.retryCounts.delete(record.id);
        } catch (error) {
          console.error('[HistoryStore] Failed to sync to SQLite:', error);
          if (retryCount < this.maxRetries) {
            this.retryCounts.set(record.id, retryCount + 1);
            failedRecords.push(record);
          } else {
            console.error(
              `[HistoryStore] Max retries exceeded for task ${record.id}, dropping record`
            );
            this.retryCounts.delete(record.id);
          }
        }
      }

      this.pendingSqliteWrites = failedRecords;
    } finally {
      this.flushInProgress = false;
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

  async search(query: string, options?: HistorySearchOptions): Promise<HistorySearchResult[]> {
    return this.sqliteStore.search(query, options);
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
      this.syncToSqliteTimer = null;
    }
    await this.flushToSqlite();
    await this.sqliteStore.close();
  }

  async clear(): Promise<void> {
    this.pendingSqliteWrites = [];
    this.retryCounts.clear();
    await this.memoryStore.clear();
    await this.sqliteStore.clear();
  }

  async flushPendingWrites(): Promise<void> {
    if (this.pendingSqliteWrites.length > 0) {
      console.log(
        '[HistoryStore] Flushing pending writes on shutdown:',
        this.pendingSqliteWrites.length
      );
      await this.flushToSqlite();
    }
  }

  async getTotalCount(): Promise<number> {
    return await this.sqliteStore.size();
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
