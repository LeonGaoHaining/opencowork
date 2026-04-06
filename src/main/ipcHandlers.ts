import { BrowserWindow } from 'electron';
import { TaskEngine } from '../core/runtime/TaskEngine';
import { PreviewManager } from '../preview/PreviewManager';
import { sessionManager } from './SessionManager';
import { BrowserExecutor } from '../core/executor/BrowserExecutor';
import { CLIExecutor } from '../core/executor/CLIExecutor';
import { ActionType } from '../core/action/ActionSchema';
import { createMainAgent, MainAgent } from '../agents/mainAgent';
import { ScheduleType } from '../scheduler/types';

const taskEngine = new TaskEngine();
const previewManager = new PreviewManager();

let browserExecutor: BrowserExecutor | null = null;
let cliExecutor: CLIExecutor | null = null;
let sharedMainAgent: MainAgent | null = null;
let sharedThreadId: string = 'main-session';
let isAgentInitializing: boolean = false;
let agentInitPromise: Promise<void> | null = null;
let agentInitResolver: (() => void) | null = null;

function getBrowserExecutor(): BrowserExecutor {
  if (!browserExecutor) {
    browserExecutor = new BrowserExecutor();
  }
  return browserExecutor;
}

function getCLIExecutor(): CLIExecutor {
  if (!cliExecutor) {
    cliExecutor = new CLIExecutor();
  }
  return cliExecutor;
}

export { getBrowserExecutor, getCLIExecutor };

// Set main window reference
export function setTaskEngineMainWindow(window: BrowserWindow | null): void {
  taskEngine.setMainWindow(window);
}

// Set preview window reference
export function setTaskEnginePreviewWindow(window: BrowserWindow | null): void {
  taskEngine.setPreviewWindow(window);
}

// Export taskEngine for direct access if needed
export function getTaskEngine(): TaskEngine {
  return taskEngine;
}

// Export previewManager for direct access if needed
export function getPreviewManager(): PreviewManager {
  return previewManager;
}

// Export sharedMainAgent for direct access if needed (v0.8.1 - Feishu integration)
export function getSharedMainAgent(): MainAgent | null {
  return sharedMainAgent;
}

type IpcHandler = (
  mainWindow: BrowserWindow | null,
  previewWindow: BrowserWindow | null,
  payload: any
) => Promise<any>;

export const IPC_HANDLERS: Record<string, IpcHandler> = {
  // 任务相关 (v0.4 - 使用 MainAgent)
  'task:start': async (mainWindow, previewWindow, { task, threadId }) => {
    console.log('[IPC] task:start:', task, 'threadId:', threadId);

    const AGENT_INIT_TIMEOUT_MS = 60000;

    try {
      if (!sharedMainAgent && !isAgentInitializing) {
        isAgentInitializing = true;
        console.log('[IPC] Creating shared MainAgent...');
        agentInitPromise = new Promise((resolve) => {
          agentInitResolver = resolve;
        });

        const initPromise = createMainAgent({
          logger: { level: 'debug', output: 'console' },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Agent initialization timeout')), AGENT_INIT_TIMEOUT_MS)
        );

        try {
          sharedMainAgent = await Promise.race([initPromise, timeoutPromise]);
          sharedMainAgent.setMainWindow(mainWindow);
          sharedMainAgent.setPreviewWindow(previewWindow);
          isAgentInitializing = false;
          console.log('[IPC] Shared MainAgent created, threadId:', sharedMainAgent.getThreadId());
          if (agentInitResolver) {
            agentInitResolver();
            agentInitPromise = null;
            agentInitResolver = null;
          }
        } catch (initError) {
          isAgentInitializing = false;
          agentInitPromise = null;
          agentInitResolver = null;
          throw initError;
        }
      } else if (isAgentInitializing && agentInitPromise) {
        console.log('[IPC] Agent is still initializing, waiting...');
        try {
          await Promise.race([
            agentInitPromise,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Agent init wait timeout')), AGENT_INIT_TIMEOUT_MS)
            ),
          ]);
        } catch (timeoutError) {
          console.error('[IPC] Agent init wait timeout');
          return {
            success: false,
            error: 'Agent initialization timeout',
          };
        }
      }

      const agent = sharedMainAgent;
      if (!agent) {
        console.error('[IPC] Agent not initialized');
        return {
          success: false,
          error: 'Agent initialization failed',
        };
      }
      if (threadId) {
        agent.setThreadId(threadId);
        sharedThreadId = threadId;
      } else {
        agent.setThreadId(sharedThreadId);
      }

      const handleId = agent.getThreadId();
      console.log('[IPC] Starting MainAgent, handleId:', handleId);

      const result = await agent.run(task);

      console.log('[IPC] MainAgent completed, result:', result.success);

      return {
        success: result.success,
        handle: handleId,
        output: result.output,
        error: result.error,
        duration: result.duration,
      };
    } catch (error: any) {
      console.error('[IPC] task:start error:', error);
      isAgentInitializing = false;

      return {
        success: false,
        error: error.message || 'Agent execution failed',
      };
    }
  },

  'task:pause': async (mainWindow, previewWindow, { handleId }) => {
    if (sharedMainAgent && sharedMainAgent.getThreadId() === handleId) {
      sharedMainAgent.pause();
      return { success: true };
    }
    await taskEngine.pause(handleId);
    return { success: true };
  },

  'task:resume': async (mainWindow, previewWindow, { handleId }) => {
    if (sharedMainAgent && sharedMainAgent.getThreadId() === handleId) {
      sharedMainAgent.resume();
      return { success: true };
    }
    await taskEngine.resume(handleId);
    return { success: true };
  },

  'task:stop': async (mainWindow, previewWindow, { handleId }) => {
    if (sharedMainAgent && sharedMainAgent.getThreadId() === handleId) {
      sharedMainAgent.requestCancel();
      return { success: true };
    }
    await taskEngine.cancel(handleId);
    return { success: true };
  },

  'task:status': async (mainWindow, previewWindow, { handleId }) => {
    if (sharedMainAgent && sharedMainAgent.getThreadId() === handleId) {
      const status = sharedMainAgent.getStatus();
      return { status, handleId };
    }
    const status = taskEngine.getState(handleId);
    return { status };
  },

  // 浏览器控制
  'browser:launch': async (mainWindow, previewWindow) => {
    const executor = getBrowserExecutor();
    await executor.launchBrowser();
    return { success: true };
  },

  'browser:close': async (mainWindow, previewWindow) => {
    const executor = getBrowserExecutor();
    await executor.closeBrowser();
    return { success: true };
  },

  // 会话相关
  'session:create': async (mainWindow, previewWindow, { name }) => {
    const session = sessionManager.create(name);
    return { session };
  },

  'session:list': async (mainWindow, previewWindow) => {
    const sessions = sessionManager.list();
    return { sessions };
  },

  'session:get': async (mainWindow, previewWindow, { sessionId }) => {
    const session = sessionManager.get(sessionId);
    return { session };
  },

  'session:update': async (mainWindow, previewWindow, { sessionId, data }) => {
    const session = sessionManager.update(sessionId, data);
    return { session };
  },

  'session:delete': async (mainWindow, previewWindow, { sessionId }) => {
    const success = sessionManager.delete(sessionId);
    return { success };
  },

  'session:setActive': async (mainWindow, previewWindow, { sessionId }) => {
    sessionManager.setActive(sessionId);
    return { success: true };
  },

  'session:getActive': async (mainWindow, previewWindow) => {
    const session = sessionManager.getActive();
    return { session };
  },

  // Agent 相关 (v0.4) - MainAgent 直接调用
  'agent:browser': async (mainWindow, previewWindow, params) => {
    console.log('[IPC] agent:browser:', params);
    try {
      const executor = getBrowserExecutor();
      const action = params;
      let result: any;

      switch (action.action) {
        case 'navigate':
        case 'goto':
          result = await executor.execute({
            id: `ipc-nav-${Date.now()}`,
            type: ActionType.BROWSER_NAVIGATE,
            description: 'IPC Navigate',
            params: { url: action.url, waitUntil: 'domcontentloaded' },
          });
          break;
        case 'click':
          result = await executor.execute({
            id: `ipc-click-${Date.now()}`,
            type: ActionType.BROWSER_CLICK,
            description: 'IPC Click',
            params: { selector: action.selector, index: action.index },
          });
          break;
        case 'input':
          result = await executor.execute({
            id: `ipc-input-${Date.now()}`,
            type: ActionType.BROWSER_INPUT,
            description: 'IPC Input',
            params: { selector: action.selector, text: action.text, clear: true },
          });
          break;
        case 'wait':
          result = await executor.execute({
            id: `ipc-wait-${Date.now()}`,
            type: ActionType.BROWSER_WAIT,
            description: 'IPC Wait',
            params: { selector: action.selector, timeout: action.timeout || 10000 },
          });
          break;
        case 'extract':
          result = await executor.execute({
            id: `ipc-extract-${Date.now()}`,
            type: ActionType.BROWSER_EXTRACT,
            description: 'IPC Extract',
            params: {
              selector: action.selector,
              type: 'text',
              multiple: action.multiple !== false,
            },
          });
          break;
        case 'screenshot':
          result = await executor.execute({
            id: `ipc-screenshot-${Date.now()}`,
            type: ActionType.BROWSER_SCREENSHOT,
            description: 'IPC Screenshot',
            params: {},
          });
          break;
        default:
          return {
            success: false,
            error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action.action}` },
          };
      }

      return result;
    } catch (error: any) {
      console.error('[IPC] agent:browser error:', error);
      return { success: false, error: { code: 'BROWSER_ERROR', message: error.message } };
    }
  },

  'agent:cli': async (mainWindow, previewWindow, params) => {
    console.log('[IPC] agent:cli:', params);
    try {
      const executor = getCLIExecutor();
      const action = {
        id: `cli-${Date.now()}`,
        type: ActionType.CLI_EXECUTE,
        description: `Execute CLI: ${params.command}`,
        params: {
          command: params.command,
        },
      };
      const result = await executor.execute(action as any);
      return result;
    } catch (error: any) {
      console.error('[IPC] agent:cli error:', error);
      return { success: false, error: { code: 'CLI_ERROR', message: error.message } };
    }
  },

  'agent:vision': async (mainWindow, previewWindow, params) => {
    console.log('[IPC] agent:vision:', params);
    return {
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Vision executor not yet implemented' },
    };
  },

  // 定时任务相关 (v0.6)
  'scheduler:list': async () => {
    try {
      const { getScheduler } = await import('../scheduler/scheduler.js');
      const scheduler = getScheduler();
      console.log(
        '[IPC] scheduler:list - scheduler tasks count:',
        scheduler.getAllTasks.toString()
      );
      const tasks = await scheduler.getAllTasks();
      console.log(
        '[IPC] scheduler:list returning tasks:',
        tasks?.length,
        JSON.stringify(tasks).substring(0, 100)
      );
      return tasks;
    } catch (error) {
      console.error('[IPC] scheduler:list error:', error);
      return [];
    }
  },

  'scheduler:create': async (mainWindow, previewWindow, task) => {
    try {
      const { getScheduler } = await import('../scheduler/scheduler.js');
      const scheduler = getScheduler();
      console.log('[IPC] scheduler:create - task:', JSON.stringify(task).substring(0, 100));
      const result = await scheduler.addTask(task);
      console.log('[IPC] scheduler:create - result:', JSON.stringify(result).substring(0, 100));
      return result;
    } catch (error) {
      console.error('[IPC] scheduler:create error:', error);
      return { success: false, error: String(error) };
    }
  },

  'scheduler:get': async (mainWindow, previewWindow, { id }: { id: string }) => {
    const { getScheduler } = await import('../scheduler/scheduler.js');
    const scheduler = getScheduler();
    return await scheduler.getTask(id);
  },

  'scheduler:update': async (
    mainWindow,
    previewWindow,
    { id, updates }: { id: string; updates: any }
  ) => {
    const { getScheduler } = await import('../scheduler/scheduler.js');
    const scheduler = getScheduler();
    return await scheduler.updateTask(id, updates);
  },

  'scheduler:delete': async (mainWindow, previewWindow, { id }: { id: string }) => {
    const { getScheduler } = await import('../scheduler/scheduler.js');
    const scheduler = getScheduler();
    return await scheduler.deleteTask(id);
  },

  'scheduler:trigger': async (mainWindow, previewWindow, { id }: { id: string }) => {
    const { getScheduler } = await import('../scheduler/scheduler.js');
    const scheduler = getScheduler();
    return await scheduler.triggerTask(id);
  },

  // 飞书机器人相关 (v0.8.1 - 长连接模式，feishu:handle 不再需要，保留兼容)
  'feishu:handle': async (mainWindow, previewWindow, payload) => {
    return { success: true, message: 'Long connection mode - callback not needed' };
  },

  'feishu:execute': async (mainWindow, previewWindow, payload) => {
    try {
      if (!payload?.taskId || !payload?.description) {
        return { success: false, error: 'Missing taskId or description' };
      }

      const { getScheduler } = await import('../scheduler/scheduler.js');
      const scheduler = getScheduler();

      const task = await scheduler.addTask({
        name: payload.taskId,
        description: payload.description,
        schedule: { type: ScheduleType.ONE_TIME },
        execution: {
          taskDescription: payload.description,
          timeout: 300000,
          maxRetries: 0,
          retryDelayMs: 1000,
        },
        enabled: true,
      });

      await scheduler.triggerTask(task.id);

      return { success: true, taskId: task.id };
    } catch (error: any) {
      console.error('[IPC] feishu:execute error:', error);
      return { success: false, error: error.message };
    }
  },

  'feishu:task': async (mainWindow, previewWindow, { task, userId }) => {
    try {
      if (!task) {
        return { success: false, error: 'Missing task' };
      }

      const agent = sharedMainAgent;
      if (!agent) {
        return { success: false, error: 'Agent not initialized' };
      }

      console.log('[IPC] feishu:task - Running task with sharedMainAgent:', task);

      const result = await agent.run(task);

      console.log('[IPC] feishu:task - Completed:', result.success);

      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    } catch (error: any) {
      console.error('[IPC] feishu:task error:', error);
      return { success: false, error: error.message };
    }
  },

  'feishu:takeover': async (mainWindow, previewWindow, payload) => {
    try {
      const { taskId, userId } = payload || {};
      if (!taskId || !userId) {
        return { success: false, error: 'Missing taskId or userId' };
      }

      const taskEngine = getTaskEngine();
      const result = await taskEngine.takeover(taskId);
      return { success: result !== null, error: result ? undefined : 'Task not found' };
    } catch (error: any) {
      console.error('[IPC] feishu:takeover error:', error);
      return { success: false, error: error.message };
    }
  },

  'feishu:return': async (mainWindow, previewWindow, payload) => {
    try {
      const { userId } = payload || {};
      if (!userId) {
        return { success: false, error: 'Missing userId' };
      }

      const taskEngine = getTaskEngine();
      await taskEngine.resume(userId);
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] feishu:return error:', error);
      return { success: false, error: error.message };
    }
  },

  'feishu:cancel': async (mainWindow, previewWindow, payload) => {
    try {
      const { taskId } = payload || {};
      if (!taskId) {
        return { success: false, error: 'Missing taskId' };
      }

      const taskEngine = getTaskEngine();
      await taskEngine.cancel(taskId);
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] feishu:cancel error:', error);
      return { success: false, error: error.message };
    }
  },

  'feishu:bind': async (mainWindow, previewWindow, payload) => {
    try {
      const { imUserId, desktopUserId } = payload || {};
      if (!imUserId || !desktopUserId) {
        return { success: false, error: 'Missing imUserId or desktopUserId' };
      }

      const { getBindingStore } = await import('../im/store/bindingStore.js');
      const bindingStore = getBindingStore();
      bindingStore.set(imUserId, {
        imUserId,
        desktopUserId,
        imPlatform: 'feishu',
        boundAt: Date.now(),
      });
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] feishu:bind error:', error);
      return { success: false, error: error.message };
    }
  },

  // 历史记录相关 (v0.8)
  'history:list': async (mainWindow, previewWindow, { options }: { options?: any }) => {
    try {
      const { getHistoryService } = await import('../history/historyService.js');
      const historyService = getHistoryService();
      const tasks = await historyService.listTasks(options || {});
      return { data: tasks, total: tasks.length };
    } catch (error: any) {
      console.error('[IPC] history:list error:', error);
      return { success: false, error: error.message };
    }
  },

  'history:get': async (mainWindow, previewWindow, { taskId }: { taskId: string }) => {
    try {
      const { getHistoryService } = await import('../history/historyService.js');
      const historyService = getHistoryService();
      const task = await historyService.getTask(taskId);
      return { data: task };
    } catch (error: any) {
      console.error('[IPC] history:get error:', error);
      return { success: false, error: error.message };
    }
  },

  'history:delete': async (mainWindow, previewWindow, { taskId }: { taskId: string }) => {
    try {
      const { getHistoryService } = await import('../history/historyService.js');
      const historyService = getHistoryService();
      await historyService.deleteTask(taskId);
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] history:delete error:', error);
      return { success: false, error: error.message };
    }
  },

  'history:replay': async (mainWindow, previewWindow, { taskId }: { taskId: string }) => {
    try {
      const { getHistoryService } = await import('../history/historyService.js');
      const historyService = getHistoryService();
      const result = await historyService.replayTask(taskId);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('[IPC] history:replay error:', error);
      return { success: false, error: error.message };
    }
  },

  'skill:list': async (mainWindow, previewWindow) => {
    try {
      const { SkillMarket } = await import('../skills/skillMarket.js');
      const market = new SkillMarket();
      const skills = await market.listInstalledSkills();
      return skills;
    } catch (error: any) {
      console.error('[IPC] skill:list error:', error);
      return [];
    }
  },

  'skill:install': async (mainWindow, previewWindow, { path: skillPath }: { path: string }) => {
    try {
      const { SkillMarket } = await import('../skills/skillMarket.js');
      const market = new SkillMarket();
      const result = await market.installSkill(skillPath);
      return result;
    } catch (error: any) {
      console.error('[IPC] skill:install error:', error);
      return { success: false, error: error.message };
    }
  },

  'skill:uninstall': async (mainWindow, previewWindow, { name }: { name: string }) => {
    try {
      const { SkillMarket } = await import('../skills/skillMarket.js');
      const market = new SkillMarket();
      const result = await market.uninstallSkill(name);
      return result;
    } catch (error: any) {
      console.error('[IPC] skill:uninstall error:', error);
      return { success: false, error: error.message };
    }
  },

  'skill:openDirectory': async (mainWindow, previewWindow) => {
    try {
      const { shell } = await import('electron');
      const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
      const skillsDir = `${homeDir}/.opencowork/skills`;
      await shell.openPath(skillsDir);
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] skill:openDirectory error:', error);
      return { success: false, error: error.message };
    }
  },
};
