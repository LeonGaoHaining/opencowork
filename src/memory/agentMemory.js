/**
 * AgentMemory - 简单内存存储封装
 * 用于跨会话记忆存储
 */
const MAX_ENTRIES = 1000;
export class AgentMemory {
    entries = new Map();
    entryOrder = [];
    namespace;
    constructor(namespace = 'default') {
        this.namespace = namespace;
    }
    async put(entry) {
        if (this.entries.size >= MAX_ENTRIES && !this.hasEntry(entry.id, entry.type)) {
            const oldestKey = this.entryOrder.shift();
            if (oldestKey) {
                this.entries.delete(oldestKey);
                console.log('[AgentMemory] Max entries reached, evicted oldest');
            }
        }
        const key = `${this.namespace}_${entry.type}_${entry.id}`;
        this.entries.set(key, entry);
        if (!this.entryOrder.includes(key)) {
            this.entryOrder.push(key);
        }
        console.log(`[AgentMemory] Stored: ${key}`);
    }
    hasEntry(id, type) {
        const key = `${this.namespace}_${type}_${id}`;
        return this.entries.has(key);
    }
    async get(id, type) {
        if (type) {
            const key = `${this.namespace}_${type}_${id}`;
            return this.entries.get(key) || null;
        }
        for (const [key, entry] of this.entries) {
            if (entry.id === id) {
                return entry;
            }
        }
        return null;
    }
    async getByType(type) {
        const results = [];
        const prefix = `${this.namespace}_${type}_`;
        for (const [key, entry] of this.entries) {
            if (key.startsWith(prefix)) {
                results.push(entry);
            }
        }
        return results;
    }
    async delete(id, type) {
        if (type) {
            const key = `${this.namespace}_${type}_${id}`;
            this.entries.delete(key);
            this.entryOrder = this.entryOrder.filter((k) => k !== key);
            console.log(`[AgentMemory] Deleted: ${key}`);
        }
        else {
            for (const [key, entry] of this.entries) {
                if (entry.id === id) {
                    this.entries.delete(key);
                    this.entryOrder = this.entryOrder.filter((k) => k !== key);
                    console.log(`[AgentMemory] Deleted: ${key}`);
                    return;
                }
            }
        }
    }
    async list() {
        return Array.from(this.entries.values());
    }
    async recordTask(task, result) {
        const entry = {
            id: `task_${Date.now()}`,
            type: 'task',
            content: task,
            metadata: { result },
            timestamp: Date.now(),
            tags: ['task'],
        };
        await this.put(entry);
    }
    async recordAction(action, params, result) {
        const entry = {
            id: `action_${Date.now()}`,
            type: 'action',
            content: action,
            metadata: { params, result },
            timestamp: Date.now(),
            tags: ['action'],
        };
        await this.put(entry);
    }
    async recordError(error, context) {
        const entry = {
            id: `error_${Date.now()}`,
            type: 'error',
            content: error,
            metadata: { context },
            timestamp: Date.now(),
            tags: ['error'],
        };
        await this.put(entry);
    }
    async getRecentTasks(limit = 5) {
        const all = await this.list();
        return all
            .filter((e) => e.type === 'task')
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }
    async getRecentErrors(limit = 5) {
        const all = await this.list();
        return all
            .filter((e) => e.type === 'error')
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }
    async clear() {
        this.entries.clear();
        console.log('[AgentMemory] Cleared all entries');
    }
    size() {
        return this.entries.size;
    }
}
let memoryInstance = null;
export function getMemory() {
    if (!memoryInstance) {
        memoryInstance = new AgentMemory();
    }
    return memoryInstance;
}
export function createMemory(namespace) {
    return new AgentMemory(namespace);
}
export function resetMemory() {
    if (memoryInstance) {
        memoryInstance.clear();
        memoryInstance = null;
    }
}
export default AgentMemory;
