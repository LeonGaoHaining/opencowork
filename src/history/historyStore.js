import { MemoryStore } from './memoryStore';
import { SQLiteStore } from './sqliteStore';
const MAX_PENDING_WRITES = 500;
export class HistoryStore {
    memoryStore;
    sqliteStore;
    syncToSqliteTimer = null;
    pendingSqliteWrites = [];
    flushInProgress = false;
    maxRetries = 3;
    retryCounts = new Map();
    constructor(sqlitePath = './history.db') {
        this.memoryStore = new MemoryStore(['current']);
        this.sqliteStore = new SQLiteStore(sqlitePath);
    }
    async saveTask(record) {
        await this.memoryStore.put(['current'], `task_${record.id}`, record);
        await this.scheduleSqliteSync(record);
    }
    async scheduleSqliteSync(record) {
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
    async flushToSqlite() {
        if (this.flushInProgress) {
            return;
        }
        this.flushInProgress = true;
        try {
            const records = [...this.pendingSqliteWrites];
            const failedRecords = [];
            for (const record of records) {
                const retryCount = this.retryCounts.get(record.id) || 0;
                try {
                    await this.sqliteStore.put(['history'], `task_${record.id}`, record);
                    this.retryCounts.delete(record.id);
                }
                catch (error) {
                    console.error('[HistoryStore] Failed to sync to SQLite:', error);
                    if (retryCount < this.maxRetries) {
                        this.retryCounts.set(record.id, retryCount + 1);
                        failedRecords.push(record);
                    }
                    else {
                        console.error(`[HistoryStore] Max retries exceeded for task ${record.id}, dropping record`);
                        this.retryCounts.delete(record.id);
                    }
                }
            }
            this.pendingSqliteWrites = failedRecords;
        }
        finally {
            this.flushInProgress = false;
        }
    }
    async getTask(taskId) {
        const memoryResult = await this.memoryStore.get(['current'], `task_${taskId}`);
        if (memoryResult) {
            return memoryResult;
        }
        return await this.sqliteStore.get(['history'], `task_${taskId}`);
    }
    async listTasks(options = {}) {
        const limit = options.limit || 50;
        const offset = options.offset || 0;
        const filterFn = (record) => {
            if (options.status && record.status !== options.status)
                return false;
            if (options.startDate && record.startTime < options.startDate)
                return false;
            if (options.endDate && record.endTime > options.endDate)
                return false;
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
    async deleteTask(taskId) {
        await this.memoryStore.delete(['current'], `task_${taskId}`);
        await this.sqliteStore.delete(['history'], `task_${taskId}`);
    }
    async searchByDate(start, end) {
        return this.listTasks({ startDate: start, endDate: end });
    }
    async replayTask(taskId) {
        const task = await this.getTask(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        return { taskId, status: 'started' };
    }
    async close() {
        if (this.syncToSqliteTimer) {
            clearTimeout(this.syncToSqliteTimer);
            this.syncToSqliteTimer = null;
        }
        await this.flushToSqlite();
        await this.sqliteStore.close();
    }
    async clear() {
        this.pendingSqliteWrites = [];
        this.retryCounts.clear();
        await this.memoryStore.clear();
        await this.sqliteStore.clear();
    }
    async flushPendingWrites() {
        if (this.pendingSqliteWrites.length > 0) {
            console.log('[HistoryStore] Flushing pending writes on shutdown:', this.pendingSqliteWrites.length);
            await this.flushToSqlite();
        }
    }
    async getTotalCount() {
        return await this.sqliteStore.size();
    }
}
let historyStoreInstance = null;
export function getHistoryStore(sqlitePath) {
    if (!historyStoreInstance) {
        historyStoreInstance = new HistoryStore(sqlitePath);
    }
    return historyStoreInstance;
}
export function createHistoryStore(sqlitePath) {
    historyStoreInstance = new HistoryStore(sqlitePath);
    return historyStoreInstance;
}
