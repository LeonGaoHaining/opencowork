import { getHistoryStore } from './historyStore';
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => deepClone(item));
    }
    const cloned = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}
class Mutex {
    queue = [];
    locked = false;
    async lock(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    resolve(await fn());
                }
                catch (e) {
                    reject(e);
                }
            });
            this.process();
        });
    }
    async process() {
        if (this.locked || this.queue.length === 0) {
            return;
        }
        this.locked = true;
        const fn = this.queue.shift();
        try {
            await fn();
        }
        finally {
            this.locked = false;
            this.process();
        }
    }
}
export class HistoryService {
    store;
    taskMutexes = new Map();
    globalMutex = new Mutex();
    constructor(store) {
        this.store = store || getHistoryStore();
    }
    getTaskMutex(taskId) {
        if (!this.taskMutexes.has(taskId)) {
            this.taskMutexes.set(taskId, new Mutex());
        }
        return this.taskMutexes.get(taskId);
    }
    async createTask(task, metadata) {
        return this.globalMutex.lock(async () => {
            const now = Date.now();
            const record = {
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
    async startTask(task, metadata) {
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
            const record = {
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
    async startTaskById(taskId) {
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
    async addStep(taskId, step) {
        const mutex = this.getTaskMutex(taskId);
        return mutex.lock(async () => {
            const task = await this.store.getTask(taskId);
            if (!task) {
                throw new Error(`Task not found: ${taskId}`);
            }
            const newStep = {
                ...deepClone(step),
                id: this.generateId(),
                startTime: Date.now(),
            };
            task.steps.push(newStep);
            await this.store.saveTask(task);
        });
    }
    async completeTask(taskId, result) {
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
        });
    }
    async cancelTask(taskId, reason) {
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
        });
    }
    async getTask(taskId) {
        const task = await this.store.getTask(taskId);
        return task ? deepClone(task) : null;
    }
    async listTasks(options = {}) {
        return this.store.listTasks(options);
    }
    async deleteTask(taskId) {
        return this.store.deleteTask(taskId);
    }
    async replayTask(taskId) {
        return this.store.replayTask(taskId);
    }
    async searchByKeyword(keyword) {
        return this.store.listTasks({ keyword });
    }
    async searchByDateRange(start, end) {
        return this.store.searchByDate(start, end);
    }
    async getTaskStats() {
        const [tasks, total] = await Promise.all([
            this.store.listTasks({ limit: 1000 }),
            this.store.getTotalCount(),
        ]);
        const completed = tasks.filter((t) => t.status === 'completed').length;
        const failed = tasks.filter((t) => t.status === 'failed').length;
        const cancelled = tasks.filter((t) => t.status === 'cancelled').length;
        const durations = tasks.filter((t) => t.duration > 0).map((t) => t.duration);
        const averageDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        return {
            total,
            completed,
            failed,
            cancelled,
            averageDuration,
        };
    }
    generateId() {
        return `hist_${Date.now()}_${crypto.randomUUID()}_${Math.random().toString(36).substring(2, 8)}`;
    }
    generateTaskId() {
        return `task_${Date.now()}_${crypto.randomUUID()}_${Math.random().toString(36).substring(2, 8)}`;
    }
}
let historyServiceInstance = null;
export function getHistoryService() {
    if (!historyServiceInstance) {
        historyServiceInstance = new HistoryService();
    }
    return historyServiceInstance;
}
export function createHistoryService(store) {
    historyServiceInstance = new HistoryService(store);
    return historyServiceInstance;
}
