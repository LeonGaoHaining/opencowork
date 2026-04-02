// src/scheduler/taskStore.ts
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
export class TaskStore {
    dbPath;
    tasks = new Map();
    initialized = false;
    constructor(dbPath = './data/scheduled_tasks.json') {
        this.dbPath = dbPath;
    }
    async initialize() {
        if (this.initialized)
            return;
        await this.load();
        this.initialized = true;
    }
    async load() {
        try {
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true });
            }
            if (fs.existsSync(this.dbPath)) {
                const data = await fs.promises.readFile(this.dbPath, 'utf-8');
                const tasks = JSON.parse(data);
                for (const task of tasks) {
                    this.tasks.set(task.id, task);
                }
                console.log('[TaskStore] Loaded', this.tasks.size, 'scheduled tasks');
            }
        }
        catch (error) {
            console.error('[TaskStore] Failed to load:', error);
        }
    }
    async save() {
        try {
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true });
            }
            const data = JSON.stringify(Array.from(this.tasks.values()), null, 2);
            await fs.promises.writeFile(this.dbPath, data, 'utf-8');
        }
        catch (error) {
            console.error('[TaskStore] Failed to save:', error);
        }
    }
    async create(input) {
        const now = Date.now();
        const newTask = {
            ...input,
            id: `st_${now}_${crypto.randomUUID()}`,
            createdAt: now,
            updatedAt: now,
            runCount: 0,
        };
        this.tasks.set(newTask.id, newTask);
        await this.save();
        return newTask;
    }
    async get(id) {
        return this.tasks.get(id) || null;
    }
    async getAll() {
        return Array.from(this.tasks.values());
    }
    async getAllEnabled() {
        return Array.from(this.tasks.values()).filter((t) => t.enabled);
    }
    async update(id, updates) {
        const task = this.tasks.get(id);
        if (!task)
            return null;
        const updatedTask = {
            ...task,
            ...updates,
            id: task.id,
            createdAt: task.createdAt,
            updatedAt: Date.now(),
        };
        this.tasks.set(id, updatedTask);
        await this.save();
        return updatedTask;
    }
    async delete(id) {
        const deleted = this.tasks.delete(id);
        if (deleted) {
            await this.save();
        }
        return deleted;
    }
    async updateExecutionStatus(id, status, error) {
        const task = this.tasks.get(id);
        if (!task)
            return null;
        const updates = {
            lastRun: Date.now(),
            lastStatus: status,
            lastError: error,
            runCount: task.runCount + 1,
        };
        return await this.update(id, updates);
    }
}
