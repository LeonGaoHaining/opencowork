import { BrowserWindow } from 'electron';
import { TaskEngine } from '../core/runtime/TaskEngine';
import { PreviewManager } from '../preview/PreviewManager';
import { sessionManager } from './SessionManager';
import { BrowserExecutor } from '../core/executor/BrowserExecutor';
import { CLIExecutor } from '../core/executor/CLIExecutor';
import { ActionType } from '../core/action/ActionSchema';

const taskEngine = new TaskEngine();
const previewManager = new PreviewManager();

let browserExecutor: BrowserExecutor | null = null;
let cliExecutor: CLIExecutor | null = null;

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

type IpcHandler = (
  mainWindow: BrowserWindow | null,
  previewWindow: BrowserWindow | null,
  payload: any
) => Promise<any>;

export const IPC_HANDLERS: Record<string, IpcHandler> = {
  // 任务相关
  'task:start': async (mainWindow, previewWindow, { task }) => {
    if (taskEngine.isTaskRunning()) {
      return { success: false, error: '已有任务正在执行中，请等待完成后再发起新任务' };
    }
    const handle = await taskEngine.startTask(task, mainWindow ?? undefined);
    return { handle };
  },

  'task:pause': async (mainWindow, previewWindow, { handleId }) => {
    await taskEngine.pause(handleId);
    return { success: true };
  },

  'task:resume': async (mainWindow, previewWindow, { handleId }) => {
    await taskEngine.resume(handleId);
    return { success: true };
  },

  'task:stop': async (mainWindow, previewWindow, { handleId }) => {
    await taskEngine.stop(handleId);
    return { success: true };
  },

  'task:status': async (mainWindow, previewWindow, { handleId }) => {
    const status = taskEngine.getStatus(handleId);
    return { status };
  },

  // 浏览器控制
  'browser:launch': async (mainWindow, previewWindow) => {
    const executor = getBrowserExecutor();
    await executor.ensureBrowser();
    return { success: true };
  },

  'browser:close': async (mainWindow, previewWindow) => {
    const executor = getBrowserExecutor();
    await executor.close();
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

  // Agent 相关 (v0.4)
  'agent:browser': async (mainWindow, previewWindow, params) => {
    console.log('[IPC] agent:browser:', params);
    try {
      const executor = getBrowserExecutor();
      const action = params;
      let result: any;

      switch (action.action) {
        case 'navigate':
        case 'goto':
          result = await executor.execute({ type: ActionType.BROWSER_NAVIGATE, params: { url: action.url, waitUntil: 'domcontentloaded' }, id: '', description: '' });
          break;
        case 'click':
          result = await executor.execute({ type: ActionType.BROWSER_CLICK, params: { selector: action.selector, index: action.index }, id: '', description: '' });
          break;
        case 'input':
          result = await executor.execute({ type: ActionType.BROWSER_INPUT, params: { selector: action.selector, text: action.text, clear: true }, id: '', description: '' });
          break;
        case 'wait':
          result = await executor.execute({ type: ActionType.BROWSER_WAIT, params: { selector: action.selector, timeout: action.timeout || 10000 }, id: '', description: '' });
          break;
        case 'extract':
          result = await executor.execute({ type: ActionType.BROWSER_EXTRACT, params: { selector: action.selector, type: 'text', multiple: action.multiple !== false }, id: '', description: '' });
          break;
        case 'screenshot':
          result = await executor.execute({ type: ActionType.BROWSER_SCREENSHOT, params: {}, id: '', description: '' });
          break;
        default:
          return { success: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action.action}` } };
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
      const action = { type: ActionType.CLI_EXECUTE, params: { command: params.command, args: params.args }, id: '', description: '' };
      const result = await executor.execute(action);
      return result;
    } catch (error: any) {
      console.error('[IPC] agent:cli error:', error);
      return { success: false, error: { code: 'CLI_ERROR', message: error.message } };
    }
  },

  'agent:vision': async (mainWindow, previewWindow, params) => {
    console.log('[IPC] agent:vision:', params);
    return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Vision executor not yet implemented' } };
  },
};
      }
    } catch (error: any) {
      console.error('[IPC] agent:browser error:', error);
      return { success: false, error: { code: 'BROWSER_ERROR', message: error.message } };
    }
  },

  'agent:cli': async (mainWindow, previewWindow, params) => {
    console.log('[IPC] agent:cli:', params);
    try {
      const executor = getCLIExecutor();
      const result = await executor.execute({
        type: 'cli:execute',
        params: { command: params.command, args: params.args },
      });
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
};
