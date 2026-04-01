/**
 * Main Agent - LangGraph ReAct 主 Agent
 * 负责任务理解、分发、结果汇总
 * v0.4 主架构
 */
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getCheckpointer } from '../checkpointers/agentCheckpointer';
import { getLogger } from './agentLogger';
import { getBrowserExecutor } from '../main/ipcHandlers';
import { getCLIExecutor } from '../main/ipcHandlers';
import { ActionType } from '../core/action/ActionSchema';
import { loadLLMConfig } from '../llm/config';
function cleanHtmlText(text) {
    return text
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}
let currentAgentInstance = null;
function getAgent() {
    return currentAgentInstance;
}
// Browser Tool 定义
const browserTool = tool(async (params) => {
    const logger = getLogger();
    const startTime = Date.now();
    const agent = getAgent();
    try {
        const executor = getBrowserExecutor();
        let result;
        switch (params.action) {
            case 'goto':
                if (!params.url)
                    return { success: false, error: { code: 'MISSING_PARAM', message: 'URL is required' } };
                agent?.sendNodeStart('browser', 'goto', { url: params.url });
                logger.logToolCall('browser', { action: 'goto', url: params.url }, 'main-agent', params.url);
                result = await executor.execute({
                    id: `browser-goto-${Date.now()}`,
                    type: ActionType.BROWSER_NAVIGATE,
                    description: 'Navigate to URL',
                    params: { url: params.url, waitUntil: 'domcontentloaded' },
                });
                break;
            case 'click':
                if (!params.selector)
                    return {
                        success: false,
                        error: { code: 'MISSING_PARAM', message: 'Selector is required' },
                    };
                agent?.sendNodeStart('browser', 'click', { selector: params.selector });
                logger.logToolCall('browser', { action: 'click', selector: params.selector }, 'main-agent', params.selector);
                result = await executor.execute({
                    id: `browser-click-${Date.now()}`,
                    type: ActionType.BROWSER_CLICK,
                    description: 'Click element',
                    params: { selector: params.selector, index: params.index },
                });
                break;
            case 'input':
                if (!params.selector)
                    return {
                        success: false,
                        error: { code: 'MISSING_PARAM', message: 'Selector is required' },
                    };
                agent?.sendNodeStart('browser', 'input', {
                    selector: params.selector,
                    text: params.text,
                });
                logger.logToolCall('browser', { action: 'input', selector: params.selector, text: params.text }, 'main-agent', params.selector);
                result = await executor.execute({
                    id: `browser-input-${Date.now()}`,
                    type: ActionType.BROWSER_INPUT,
                    description: 'Input text',
                    params: { selector: params.selector, text: params.text || '', clear: true },
                });
                break;
            case 'wait':
                if (!params.selector)
                    return {
                        success: false,
                        error: { code: 'MISSING_PARAM', message: 'Selector is required' },
                    };
                agent?.sendNodeStart('browser', 'wait', { selector: params.selector });
                logger.logToolCall('browser', { action: 'wait', selector: params.selector }, 'main-agent', params.selector);
                result = await executor.execute({
                    id: `browser-wait-${Date.now()}`,
                    type: ActionType.BROWSER_WAIT,
                    description: 'Wait for element',
                    params: { selector: params.selector, timeout: params.timeout || 10000 },
                });
                break;
            case 'extract':
                if (!params.selector)
                    return {
                        success: false,
                        error: { code: 'MISSING_PARAM', message: 'Selector is required' },
                    };
                agent?.sendNodeStart('browser', 'extract', { selector: params.selector });
                logger.logToolCall('browser', { action: 'extract', selector: params.selector }, 'main-agent', params.selector);
                result = await executor.execute({
                    id: `browser-extract-${Date.now()}`,
                    type: ActionType.BROWSER_EXTRACT,
                    description: 'Extract content',
                    params: { selector: params.selector, type: 'text', multiple: true },
                });
                if (result.success && result.output) {
                    if (Array.isArray(result.output)) {
                        result.output = result.output.map((item) => {
                            if (typeof item === 'string')
                                return cleanHtmlText(item);
                            return item;
                        });
                        result.output = result.output.join('\n').substring(0, 2000);
                    }
                    else if (typeof result.output === 'string') {
                        result.output = cleanHtmlText(result.output).substring(0, 2000);
                    }
                }
                break;
            case 'screenshot':
                agent?.sendNodeStart('browser', 'screenshot', {});
                logger.logToolCall('browser', { action: 'screenshot' }, 'main-agent', 'screenshot');
                result = await executor.execute({
                    id: `browser-screenshot-${Date.now()}`,
                    type: ActionType.BROWSER_SCREENSHOT,
                    description: 'Take screenshot',
                    params: {},
                });
                break;
            default:
                return {
                    success: false,
                    error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${params.action}` },
                };
        }
        const duration = Date.now() - startTime;
        agent?.sendNodeComplete('browser', params.action, result, duration, params);
        if (result.success) {
            logger.logToolResult('browser', result, duration, 'main-agent', params.action);
        }
        else {
            logger.logToolResult('browser', result, duration, 'main-agent', params.action, result.error?.message);
        }
        return result;
    }
    catch (error) {
        const duration = Date.now() - startTime;
        console.error('[BrowserTool] Error:', error);
        agent?.sendNodeComplete('browser', params.action, { error: error.message }, duration, params);
        logger.logToolResult('browser', { error: error.message }, duration, 'main-agent', params.action, error.message);
        return { success: false, error: { code: 'BROWSER_ERROR', message: error.message } };
    }
}, {
    name: 'browser',
    description: '浏览器操作工具，支持 goto/click/input/wait/extract/screenshot',
    schema: z.object({
        action: z.enum(['goto', 'click', 'input', 'wait', 'extract', 'screenshot']),
        url: z.string().optional(),
        selector: z.string().optional(),
        text: z.string().optional(),
        timeout: z.number().optional(),
        index: z.number().optional(),
    }),
});
// CLI Tool 定义
const cliTool = tool(async (params) => {
    const logger = getLogger();
    const startTime = Date.now();
    const agent = getAgent();
    agent?.sendNodeStart('cli', 'execute', {
        command: params.command,
        args: params.args,
        workingDir: params.workingDir,
    });
    logger.logToolCall('cli', { command: params.command, args: params.args }, 'main-agent', params.command);
    try {
        const executor = getCLIExecutor();
        const result = await executor.execute({
            id: `cli-${Date.now()}`,
            type: ActionType.CLI_EXECUTE,
            description: `Execute CLI: ${params.command}`,
            params: {
                command: params.command,
                workingDir: params.workingDir,
            },
        });
        const duration = Date.now() - startTime;
        agent?.sendNodeComplete('cli', 'execute', result, duration, params);
        if (result.success) {
            logger.logToolResult('cli', result, duration, 'main-agent', params.command);
        }
        else {
            logger.logToolResult('cli', result, duration, 'main-agent', params.command, result.error?.message);
        }
        return result;
    }
    catch (error) {
        const duration = Date.now() - startTime;
        console.error('[CLITool] Error:', error);
        agent?.sendNodeComplete('cli', 'execute', { error: error.message }, duration, params);
        logger.logToolResult('cli', { error: error.message }, duration, 'main-agent', params.command, error.message);
        return { success: false, error: { code: 'CLI_ERROR', message: error.message } };
    }
}, {
    name: 'cli',
    description: '系统命令执行工具',
    schema: z.object({
        command: z.string(),
        args: z.array(z.string()).optional(),
        workingDir: z.string().optional(),
    }),
});
// Vision Tool 定义 (TODO: 等待 VisionExecutor 实现)
const visionTool = tool(async (params) => {
    const logger = getLogger();
    const startTime = Date.now();
    logger.logToolCall('vision', params, 'main-agent', params.action);
    console.log('[VisionTool] Executing:', params);
    const result = {
        success: true,
        action: params.action,
        result: 'Vision operation completed (placeholder)',
    };
    const duration = Date.now() - startTime;
    logger.logToolResult('vision', result, duration, 'main-agent', params.action);
    return result;
}, {
    name: 'vision',
    description: '视觉处理工具 (TODO: 等待 VisionExecutor 实现)',
    schema: z.object({
        action: z.enum(['ocr', 'analyze', 'screenshot']),
        target: z.string().optional(),
    }),
});
// Planner Tool 定义 (TODO: 使用现有 TaskPlanner)
const plannerTool = tool(async (params) => {
    const logger = getLogger();
    const startTime = Date.now();
    logger.logToolCall('planner', params, 'main-agent', params.task);
    console.log('[PlannerTool] Executing:', params);
    const result = { success: true, task: params.task, result: 'Planning completed (placeholder)' };
    const duration = Date.now() - startTime;
    logger.logToolResult('planner', result, duration, 'main-agent', params.task);
    return result;
}, {
    name: 'planner',
    description: '任务规划工具 (TODO: 集成现有 TaskPlanner)',
    schema: z.object({
        task: z.string(),
        context: z.string().optional(),
    }),
});
const availableTools = [browserTool, cliTool, visionTool, plannerTool];
const STATE_MODIFIER = `你是一个浏览器自动化助手，擅长理解用户任务并分解执行。

可用工具：
1. browser - 用于浏览器操作（打开网页、点击、输入、提取内容）
   - 重要：当需要获取页面文本内容时，优先使用 extract 工具而非 screenshot
   - screenshot 仅在需要分析视觉元素（如图标、图片、布局问题）时才使用
2. cli - 用于执行系统命令
3. vision - 用于分析图片和屏幕内容
4. planner - 用于分析和规划复杂任务

执行流程：
1. 理解用户任务
2. 选择合适的工具执行
3. 工具执行完成后，分析提取的内容，找到用户问题的答案

重要规则（强制要求）：
- 你必须为每次用户请求生成一个文字回复
- 搜索任务流程：
  1. 使用 extract 工具提取页面内容
  2. 分析提取的内容，找到用户问题的答案
  3. 用简洁的语言回答用户的问题
- 你的最终回复格式：
  首先直接回答用户的问题（1-2句话）
  然后提供支持这个结论的证据
- 禁止返回空内容
- 禁止只执行工具就结束对话`;
export class MainAgent {
    agent;
    config;
    threadId;
    model;
    checkpointer;
    checkpointerEnabled;
    logger;
    mainWindow = null;
    previewWindow = null;
    status = 'idle';
    cancelRequested = false;
    pauseRequested = false;
    currentTask = '';
    constructor(config = {}) {
        this.config = {
            modelName: config.modelName,
            temperature: config.temperature ?? 0,
            checkpointerEnabled: config.checkpointerEnabled !== false,
        };
        this.threadId = config.threadId || `thread-${Date.now()}`;
        const llmConfig = loadLLMConfig();
        this.model = new ChatOpenAI({
            model: this.config.modelName || llmConfig.model || 'gpt-4-turbo',
            temperature: this.config.temperature ?? 0,
            apiKey: llmConfig.apiKey,
            configuration: {
                baseURL: llmConfig.baseUrl,
            },
            timeout: llmConfig.timeout || 60000,
            maxRetries: llmConfig.maxRetries || 3,
        });
        this.checkpointer = getCheckpointer({ type: 'memory' });
        this.checkpointerEnabled = this.config.checkpointerEnabled ?? true;
        this.logger = getLogger(config.logger);
    }
    setMainWindow(window) {
        console.log('[MainAgent] setMainWindow called:', {
            windowExists: !!window,
            windowDestroyed: window?.isDestroyed(),
        });
        this.mainWindow = window;
    }
    setPreviewWindow(window) {
        this.previewWindow = window;
    }
    getThreadId() {
        return this.threadId;
    }
    setThreadId(threadId) {
        this.threadId = threadId;
    }
    getStatus() {
        return this.status;
    }
    isRunning() {
        return this.status === 'running';
    }
    requestCancel() {
        this.cancelRequested = true;
        this.status = 'cancelled';
        this.logger.logEvent({
            threadId: this.threadId,
            eventType: 'error',
            level: 'warn',
            task: this.currentTask,
            error: 'Cancel requested',
        });
    }
    pause() {
        this.pauseRequested = true;
        this.status = 'paused';
    }
    resume() {
        this.pauseRequested = false;
        this.status = 'running';
    }
    sendToRenderer(channel, data) {
        console.log('[MainAgent] sendToRenderer:', {
            channel,
            mainWindowExists: !!this.mainWindow,
            mainWindowDestroyed: this.mainWindow?.isDestroyed(),
            dataKeys: Object.keys(data || {}),
        });
        try {
            if (!this.mainWindow) {
                console.error('[MainAgent] mainWindow is null!');
                return;
            }
            if (this.mainWindow.isDestroyed()) {
                console.error('[MainAgent] mainWindow is destroyed!');
                return;
            }
            this.mainWindow.webContents.send(channel, data);
            console.log(`[MainAgent] ✅ Sent to mainWindow: ${channel}`);
        }
        catch (error) {
            console.error('[MainAgent] Failed to send to renderer:', error);
        }
    }
    generateNodeId(toolName, action, input) {
        const inputStr = JSON.stringify(input || {});
        const hash = this.simpleHash(inputStr);
        return `${toolName}-${action}-${hash}`;
    }
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36).substring(0, 8);
    }
    sendNodeStart(toolName, action, input) {
        const nodeId = this.generateNodeId(toolName, action, input);
        this.sendToRenderer('task:nodeStart', {
            type: 'node_start',
            node: {
                id: nodeId,
                action: {
                    type: action,
                    description: `${toolName} ${action}`,
                    params: input,
                },
            },
            handleId: this.threadId,
        });
    }
    sendNodeComplete(toolName, action, output, duration, input) {
        const nodeId = this.generateNodeId(toolName, action, input || {});
        this.sendToRenderer('task:nodeComplete', {
            type: 'node_complete',
            node: {
                id: nodeId,
                action: {
                    type: action,
                },
                result: output,
                duration,
            },
            handleId: this.threadId,
        });
    }
    sendTaskCompleted(result) {
        this.sendToRenderer('task:completed', {
            type: 'task_completed',
            handleId: this.threadId,
            result,
        });
    }
    sendTaskError(error) {
        this.sendToRenderer('task:error', {
            type: 'task_error',
            handleId: this.threadId,
            error,
        });
    }
    async initialize() {
        this.agent = createReactAgent({
            llm: this.model,
            tools: availableTools,
            stateModifier: STATE_MODIFIER,
            checkpointer: this.checkpointerEnabled ? this.checkpointer.getCheckpointer() : undefined,
        });
        this.logger.logAgentStart(this.threadId, 'initialize');
        console.log('[MainAgent] Initialized, thread:', this.threadId);
    }
    async run(task) {
        if (!this.agent) {
            await this.initialize();
        }
        this.status = 'running';
        this.currentTask = task;
        this.cancelRequested = false;
        currentAgentInstance = this;
        this.logger.logAgentStart(this.threadId, task);
        console.log('[MainAgent] Running task:', task);
        const steps = [];
        if (this.cancelRequested) {
            this.status = 'cancelled';
            this.logger.logError('Task cancelled before start', { task }, this.threadId, task);
            return { success: false, error: 'Task cancelled' };
        }
        try {
            const startTime = Date.now();
            const result = await this.agent.invoke({ messages: [{ role: 'user', content: task }] }, { configurable: { thread_id: this.threadId } });
            const duration = Date.now() - startTime;
            if (this.cancelRequested) {
                this.status = 'cancelled';
                this.logger.logError('Task cancelled during execution', { task, duration }, this.threadId, task);
                return { success: false, error: 'Task cancelled' };
            }
            this.status = 'completed';
            this.logger.logAgentEnd(this.threadId, result, task);
            console.log('[MainAgent] Task completed');
            let steps = [];
            let finalMessage = '';
            try {
                steps = this.extractSteps(result.messages);
                finalMessage = this.extractFinalMessage(result.messages);
            }
            catch (error) {
                console.error('[MainAgent] Failed to extract steps:', error);
            }
            this.sendTaskCompleted({
                result: {
                    success: true,
                    output: result,
                    duration,
                    steps,
                    finalMessage,
                },
            });
            return {
                success: true,
                output: result,
                messages: result.messages,
                duration,
                steps,
                finalMessage,
            };
        }
        catch (error) {
            this.status = 'error';
            this.logger.logError(error.message, { task, threadId: this.threadId }, this.threadId, task);
            console.error('[MainAgent] Task failed:', error);
            this.sendTaskError(error.message || 'Unknown error');
            return {
                success: false,
                error: error.message || 'Unknown error',
            };
        }
    }
    extractSteps(messages) {
        const steps = [];
        const toolCallMap = new Map();
        console.log('[MainAgent] extractSteps called with', messages.length, 'messages');
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const msgType = msg.type || msg.constructor?.name || 'unknown';
            const hasToolCalls = !!(msg.tool_calls && Array.isArray(msg.tool_calls));
            console.log(`[MainAgent] Message ${i}: type=${msgType}, hasToolCalls=${hasToolCalls}`);
            if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
                console.log(`[MainAgent] Found ${msg.tool_calls.length} tool_calls in message ${i}`);
                for (const tc of msg.tool_calls) {
                    const step = {
                        id: tc.id || `tc-${steps.length}`,
                        toolName: tc.name || 'unknown',
                        args: typeof tc.args === 'string' ? JSON.parse(tc.args || '{}') : tc.args || {},
                        status: 'completed',
                    };
                    steps.push(step);
                    if (tc.id) {
                        toolCallMap.set(tc.id, step);
                    }
                    console.log(`[MainAgent] Extracted step:`, JSON.stringify(step));
                }
            }
            const isToolMessage = msgType === 'tool' || msg.lc_direct_tool_output;
            if (isToolMessage && msg.tool_call_id) {
                const step = toolCallMap.get(msg.tool_call_id);
                if (step) {
                    try {
                        step.result = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
                    }
                    catch {
                        step.result = msg.content;
                    }
                    step.status = msg.status === 'error' ? 'error' : 'completed';
                    console.log(`[MainAgent] Linked result to step ${step.id}:`, step.status);
                }
                else {
                    console.log(`[MainAgent] ToolMessage with id ${msg.tool_call_id} not found in map`);
                }
            }
        }
        console.log('[MainAgent] extractSteps returning', steps.length, 'steps');
        return steps;
    }
    extractFinalMessage(messages) {
        const aiMessages = messages.filter((m) => {
            const type = m.type || m.constructor?.name || 'unknown';
            return type === 'ai' || type === 'AIMessage' || type === 'AIMessageChunk';
        });
        for (let i = aiMessages.length - 1; i >= 0; i--) {
            const msg = aiMessages[i];
            const content = msg.content;
            const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;
            if (hasToolCalls)
                continue;
            if (!content)
                continue;
            let contentStr = '';
            if (typeof content === 'string') {
                contentStr = content.trim();
            }
            else if (Array.isArray(content)) {
                contentStr = content
                    .map((b) => b.text || b.content || '')
                    .join('')
                    .trim();
            }
            else if (typeof content === 'object') {
                contentStr = content.text || content.content || '';
            }
            if (contentStr) {
                console.log(`[MainAgent] Final AI message at index ${i}:`, contentStr.substring(0, 200));
                return contentStr;
            }
        }
        return '';
    }
    isCheckpointerEnabled() {
        return this.checkpointerEnabled;
    }
}
export async function createMainAgent(config) {
    const agent = new MainAgent(config);
    await agent.initialize();
    return agent;
}
export default MainAgent;
