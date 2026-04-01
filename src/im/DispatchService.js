import { EventEmitter } from 'events';
import { CommandParser } from './CommandParser';
const PRIORITY_MAP = {
    low: 10,
    normal: 5,
    high: 1,
};
export class DispatchService extends EventEmitter {
    bot;
    taskQueue = [];
    statusMap = new Map();
    constructor(bot) {
        super();
        this.bot = bot;
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.on('task:status', (taskId, status) => {
            this.updateTaskStatus(taskId, status);
        });
    }
    async handleMessage(msg) {
        console.log('[DispatchService] Handling message from:', msg.userId);
        const parser = new CommandParser();
        const cmd = parser.parse(msg.content);
        if (!cmd) {
            await this.bot.sendMessage(msg.conversationId, '无法识别命令，请输入"帮助"查看命令列表');
            return;
        }
        switch (cmd.command) {
            case 'task':
                await this.handleTask(msg, cmd.args.join(' '));
                break;
            case 'status':
                await this.handleStatus(msg, cmd.args[0]);
                break;
            case 'list':
                await this.handleList(msg);
                break;
            case 'takeover':
                await this.handleTakeover(msg, cmd.args[0]);
                break;
            case 'return':
                await this.handleReturn(msg);
                break;
            case 'cancel':
                await this.handleCancel(msg, cmd.args[0]);
                break;
            case 'help':
                await this.handleHelp(msg);
                break;
            default:
                await this.handleHelp(msg);
        }
    }
    async handleTask(msg, description) {
        if (!description) {
            await this.bot.sendMessage(msg.conversationId, '请输入任务描述\n例: @机器人 任务 帮我查下北京天气');
            return;
        }
        const task = {
            id: this.generateTaskId(),
            description,
            source: 'feishu',
            priority: 'normal',
            userId: msg.userId,
            conversationId: msg.conversationId,
            createdAt: Date.now(),
        };
        this.enqueueTask(task);
        this.statusMap.set(task.id, {
            id: task.id,
            status: 'pending',
            updatedAt: Date.now(),
        });
        await this.bot.sendMessage(msg.conversationId, `✅ 任务已接收\n\n任务ID: ${task.id}\n描述: ${description}`);
        await this.forwardToDesktop(task);
    }
    enqueueTask(task) {
        const priority = PRIORITY_MAP[task.priority];
        const index = this.taskQueue.findIndex((t) => PRIORITY_MAP[t.priority] > priority);
        if (index === -1) {
            this.taskQueue.push(task);
        }
        else {
            this.taskQueue.splice(index, 0, task);
        }
        console.log('[DispatchService] Task enqueued:', task.id, 'Queue size:', this.taskQueue.length);
    }
    async forwardToDesktop(task) {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('feishu:execute', {
                taskId: task.id,
                description: task.description,
                userId: task.userId,
                priority: task.priority,
            });
            if (result.success) {
                this.updateTaskStatus(task.id, { status: 'executing' });
            }
            else {
                this.updateTaskStatus(task.id, { status: 'failed', message: result.error });
            }
        }
        catch (error) {
            console.error('[DispatchService] Forward to desktop failed:', error);
            this.updateTaskStatus(task.id, { status: 'failed', message: String(error) });
        }
    }
    async handleStatus(msg, taskId) {
        if (!taskId) {
            await this.bot.sendMessage(msg.conversationId, '请提供任务ID\n例: @机器人 状态 abc123');
            return;
        }
        const status = this.statusMap.get(taskId);
        if (!status) {
            await this.bot.sendMessage(msg.conversationId, `任务 ${taskId} 不存在`);
            return;
        }
        const statusText = {
            pending: '⏳ 待执行',
            executing: '🔄 执行中',
            completed: '✅ 已完成',
            failed: '❌ 失败',
        }[status.status];
        let response = `📋 任务状态\n\nID: ${taskId}\n状态: ${statusText}`;
        if (status.message) {
            response += `\n信息: ${status.message}`;
        }
        await this.bot.sendMessage(msg.conversationId, response);
    }
    async handleList(msg) {
        const tasks = Array.from(this.statusMap.values())
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 10);
        if (tasks.length === 0) {
            await this.bot.sendMessage(msg.conversationId, '暂无任务记录');
            return;
        }
        const list = tasks
            .map((t) => {
            const icon = { pending: '⏳', executing: '🔄', completed: '✅', failed: '❌' }[t.status];
            return `${icon} ${t.id.slice(0, 12)}`;
        })
            .join('\n');
        await this.bot.sendMessage(msg.conversationId, `📋 最近任务\n\n${list}`);
    }
    async handleTakeover(msg, taskId) {
        if (!taskId) {
            await this.bot.sendMessage(msg.conversationId, '请提供任务ID\n例: @机器人 接管 abc123');
            return;
        }
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('feishu:takeover', { taskId, userId: msg.userId });
            if (result.success) {
                await this.bot.sendMessage(msg.conversationId, `🔐 已接管任务\n\n任务ID: ${taskId}`);
            }
            else {
                await this.bot.sendMessage(msg.conversationId, `❌ 接管失败: ${result.error}`);
            }
        }
        catch (error) {
            console.error('[DispatchService] Takeover failed:', error);
            await this.bot.sendMessage(msg.conversationId, `❌ 接管失败: ${String(error)}`);
        }
    }
    async handleReturn(msg) {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('feishu:return', { userId: msg.userId });
            if (result.success) {
                await this.bot.sendMessage(msg.conversationId, '🔄 已交还控制权给AI');
            }
            else {
                await this.bot.sendMessage(msg.conversationId, `❌ 交还失败: ${result.error}`);
            }
        }
        catch (error) {
            console.error('[DispatchService] Return failed:', error);
            await this.bot.sendMessage(msg.conversationId, `❌ 交还失败: ${String(error)}`);
        }
    }
    async handleCancel(msg, taskId) {
        if (!taskId) {
            await this.bot.sendMessage(msg.conversationId, '请提供任务ID\n例: @机器人 取消 abc123');
            return;
        }
        const status = this.statusMap.get(taskId);
        if (!status) {
            await this.bot.sendMessage(msg.conversationId, `任务 ${taskId} 不存在`);
            return;
        }
        if (status.status === 'completed') {
            await this.bot.sendMessage(msg.conversationId, `任务 ${taskId} 已完成，无法取消`);
            return;
        }
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('feishu:cancel', { taskId });
            if (result.success) {
                this.updateTaskStatus(taskId, { status: 'failed', message: '用户取消' });
                await this.bot.sendMessage(msg.conversationId, `🗑️ 已取消任务\n\n任务ID: ${taskId}`);
            }
            else {
                await this.bot.sendMessage(msg.conversationId, `❌ 取消失败: ${result.error}`);
            }
        }
        catch (error) {
            console.error('[DispatchService] Cancel failed:', error);
            await this.bot.sendMessage(msg.conversationId, `❌ 取消失败: ${String(error)}`);
        }
    }
    async handleHelp(msg) {
        const parser = new CommandParser();
        await this.bot.sendMessage(msg.conversationId, parser.getHelp());
    }
    updateTaskStatus(taskId, status) {
        const existing = this.statusMap.get(taskId);
        if (existing) {
            this.statusMap.set(taskId, { ...existing, ...status, updatedAt: Date.now() });
            this.emit('task:status', taskId, status);
        }
    }
    getTaskStatus(taskId) {
        return this.statusMap.get(taskId);
    }
    getAllTasks() {
        return Array.from(this.statusMap.values());
    }
    generateTaskId() {
        return `ft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
}
let dispatchServiceInstance = null;
export function createDispatchService(bot) {
    dispatchServiceInstance = new DispatchService(bot);
    return dispatchServiceInstance;
}
export function getDispatchService() {
    return dispatchServiceInstance;
}
