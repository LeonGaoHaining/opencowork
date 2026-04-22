import { BrowserWindow, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { TaskEngine } from '../core/runtime/TaskEngine';
import { sessionManager } from './SessionManager';
import { BrowserExecutor } from '../core/executor/BrowserExecutor';
import { CLIExecutor } from '../core/executor/CLIExecutor';
import { ActionType } from '../core/action/ActionSchema';
import { createMainAgent, MainAgent, AgentStep, AgentResult } from '../agents/mainAgent';
import { ScheduleType } from '../scheduler/types';
import { getIMConfigStore } from '../config/imConfig';
import { getSettingsManager } from '../config/settings';
import { createPreviewWindow } from './window';
import { getMemoryService } from '../memory';
import { getTaskStateStore } from '../core/runtime/taskStateStore';
import {
  getMCPClient,
  loadMCPConfig,
  saveMCPConfig,
  getMCPSamplingService,
  getMCPServerMode,
} from '../mcp';
import { getTaskOrchestrator } from '../core/task/TaskOrchestrator';
import { createTaskResultError, mapAgentResultToTaskResult } from '../core/task/resultMapper';
import { getTaskResultRepository } from '../core/task/TaskResultRepository';
import { getTaskTemplateRepository } from '../core/task/TaskTemplateRepository';
import { getTaskRunRepository } from '../core/task/TaskRunRepository';
import { resolveTemplateInput } from '../core/task/templateUtils';
import { getDispatchService } from '../im/DispatchService';
import { VisualAutomationService } from '../visual/VisualAutomationService';
import { HybridToolRouter } from '../visual';

const taskEngine = new TaskEngine();
const execFileAsync = promisify(execFile);

let browserExecutor: BrowserExecutor | null = null;
let cliExecutor: CLIExecutor | null = null;
export let sharedMainAgent: MainAgent | null = null;
let sharedThreadId: string = 'main-session';
let isAgentInitializing: boolean = false;
let agentInitPromise: Promise<void> | null = null;
let agentInitResolver: (() => void) | null = null;
let detachedPreviewWindow: BrowserWindow | null = null;
let mcpToolsChangedSubscribed = false;
let mcpToolsReloadInFlight = false;
const mcpToolSignatures = new Map<string, string>();
let visualAutomationService: VisualAutomationService | null = null;

function createMCPToolSignature(
  tools: Array<{ name: string; description?: string; inputSchema?: unknown }>
): string {
  return JSON.stringify(
    tools
      .map((tool) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
}

function generateAgentThreadId(): string {
  return `main-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureMCPToolsChangedSubscription(): void {
  if (mcpToolsChangedSubscribed) {
    return;
  }

  getMCPClient().onToolsChanged((serverName, tools) => {
    const nextSignature = createMCPToolSignature(tools);
    const previousSignature = mcpToolSignatures.get(serverName);
    if (previousSignature === nextSignature) {
      return;
    }

    mcpToolSignatures.set(serverName, nextSignature);
    console.log(`[IPC] MCP tools changed: ${serverName}, tools=${tools.length}`);
    if (sharedMainAgent && !mcpToolsReloadInFlight) {
      mcpToolsReloadInFlight = true;
      void sharedMainAgent
        .reloadSkills()
        .catch((error) => {
          console.error('[IPC] Failed to reload agent after MCP tool change:', error);
        })
        .finally(() => {
          mcpToolsReloadInFlight = false;
        });
    }
  });

  mcpToolsChangedSubscribed = true;
}

ensureMCPToolsChangedSubscription();
getMCPServerMode().registerTool(
  'task:status',
  async ({ handleId }) => taskEngine.getState(handleId),
  'Get task status by handleId',
  { handleId: 'string' }
);
getMCPServerMode().registerTool('task:list', async () => taskEngine.listTasks(), 'List tasks');
getMCPServerMode().registerTool(
  'task:execute',
  async ({ task, threadId }) => IPC_HANDLERS['task:start'](null, null, { task, threadId, source: 'mcp' }),
  'Execute a new task',
  { task: 'string', threadId: 'string?' }
);
getMCPServerMode().registerTool(
  'browser:navigate',
  async ({ url }) => {
    const executor = getBrowserExecutor();
    return executor.execute({
      id: `mcp-browser-goto-${Date.now()}`,
      type: ActionType.BROWSER_NAVIGATE,
      description: 'Navigate to URL',
      params: { url, waitUntil: 'domcontentloaded' },
    });
  },
  'Navigate browser to a URL',
  { url: 'string' }
);
getMCPServerMode().registerTool(
  'browser:screenshot',
  async ({ fullPage = false, selector }) => {
    const executor = getBrowserExecutor();
    return executor.execute({
      id: `mcp-browser-screenshot-${Date.now()}`,
      type: ActionType.BROWSER_SCREENSHOT,
      description: 'Take screenshot',
      params: { fullPage, selector },
    });
  },
  'Take browser screenshot',
  { fullPage: 'boolean?', selector: 'string?' }
);

function syncPreviewWindow(window: BrowserWindow | null): void {
  detachedPreviewWindow = window;
  taskEngine.setPreviewWindow(window);
  if (sharedMainAgent) {
    sharedMainAgent.setPreviewWindow(window);
  }
}

function ensureDetachedPreviewWindow(): BrowserWindow {
  if (detachedPreviewWindow && !detachedPreviewWindow.isDestroyed()) {
    return detachedPreviewWindow;
  }

  const window = createPreviewWindow();
  window.on('closed', () => {
    syncPreviewWindow(null);
  });
  syncPreviewWindow(window);
  return window;
}

function closeDetachedPreviewWindow(): void {
  if (!detachedPreviewWindow || detachedPreviewWindow.isDestroyed()) {
    syncPreviewWindow(null);
    return;
  }

  const window = detachedPreviewWindow;
  syncPreviewWindow(null);
  window.close();
}

function mapAgentStepsToSkillActions(steps: AgentStep[] | undefined): Array<{
  tool: string;
  args: unknown;
  result?: unknown;
  success: boolean;
}> {
  if (!steps || steps.length === 0) return [];

  return steps.map((step) => {
    const action = typeof step.args?.action === 'string' ? step.args.action : undefined;
    const tool = action ? `${step.toolName}:${action}` : step.toolName;
    const success = step.status !== 'error' && step.result?.success !== false;

    return {
      tool,
      args: step.args,
      result: step.result,
      success,
    };
  });
}

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

function getVisualAutomationService(): VisualAutomationService {
  if (!visualAutomationService) {
    visualAutomationService = new VisualAutomationService(getBrowserExecutor());
  }

  return visualAutomationService;
}

function shouldUseVisualPrimaryForBrowserAction(params: {
  action: string;
  selector?: string;
  text?: string;
}): { useVisual: boolean; reason: string } {
  const router = new HybridToolRouter();
  const decision = router.decide({
    task: [params.action, params.selector, params.text].filter(Boolean).join(' '),
    action: params.action as 'click' | 'input' | 'wait' | 'extract' | 'goto' | 'screenshot',
    selector: params.selector,
    requiresStrictExtraction: params.action === 'extract',
  });

  return {
    useVisual: decision.mode === 'cua',
    reason: decision.reason,
  };
}

// Set main window reference
export function setTaskEngineMainWindow(window: BrowserWindow | null): void {
  taskEngine.setMainWindow(window);
}

// Export taskEngine for direct access if needed
export function getTaskEngine(): TaskEngine {
  return taskEngine;
}

// Export sharedMainAgent for direct access if needed (v0.8.1 - Feishu integration)
export function getSharedMainAgent(): MainAgent | null {
  return sharedMainAgent;
}

export function setSharedMainAgent(agent: MainAgent | null): void {
  sharedMainAgent = agent;
}

// v2.0: Get main window for webview sync
let mainWindowRef: BrowserWindow | null = null;
export function setMainWindowRef(window: BrowserWindow | null): void {
  mainWindowRef = window;
}
export function getMainWindowRef(): BrowserWindow | null {
  return mainWindowRef;
}

async function ensureSharedAgent(
  mainWindow: BrowserWindow | null,
  previewWindow: BrowserWindow | null
): Promise<MainAgent> {
  const AGENT_INIT_TIMEOUT_MS = 60000;

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
    await Promise.race([
      agentInitPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Agent init wait timeout')), AGENT_INIT_TIMEOUT_MS)
      ),
    ]);
  }

  if (!sharedMainAgent) {
    throw new Error('Agent initialization failed');
  }

  sharedMainAgent.setMainWindow(mainWindow);
  sharedMainAgent.setPreviewWindow(previewWindow);
  return sharedMainAgent;
}

type IpcHandler = (
  mainWindow: BrowserWindow | null,
  previewWindow: BrowserWindow | null,
  payload: any
) => Promise<any>;

export const IPC_HANDLERS: Record<string, IpcHandler> = {
  // 任务相关 (v0.4 - 使用 MainAgent)
  'task:start': async (mainWindow, previewWindow, { task, threadId, source = 'chat', templateId }) => {
    console.log('[IPC] task:start:', task, 'threadId:', threadId, 'source:', source);

    try {
      const agent = await ensureSharedAgent(mainWindow, previewWindow);
      if (agent.getStatus() === 'running') {
        return {
          accepted: false,
          error: 'A task is already running',
        };
      }

      if (threadId) {
        agent.setThreadId(threadId);
        sharedThreadId = threadId;
      } else {
        const generatedThreadId = generateAgentThreadId();
        agent.setThreadId(generatedThreadId);
        sharedThreadId = generatedThreadId;
      }

      const handleId = agent.getThreadId();
      const taskOrchestrator = getTaskOrchestrator();
      const run = taskOrchestrator.startRun({
        runId: handleId,
        source,
        title: task,
        prompt: task,
        templateId,
        sessionId: handleId,
        metadata: {
          threadId: handleId,
        },
      });

      let latestAgentResult: AgentResult | null = null;

      void taskOrchestrator
        .executeRun(handleId, async () => {
          latestAgentResult = await agent.run(task);
          return mapAgentResultToTaskResult(latestAgentResult);
        })
        .then(async (result) => {
          console.log('[IPC] MainAgent completed, result:', result.summary);

          try {
            if (latestAgentResult) {
              const taskEngine = getTaskEngine();
              await taskEngine.checkSkillGenerationAfterTask(latestAgentResult, {
                taskDescription: task,
                actions: mapAgentStepsToSkillActions(latestAgentResult.steps),
              });
            }
          } catch (error) {
            console.warn('[IPC] checkSkillGeneration error:', error);
          }
        })
        .catch((error: any) => {
          console.error('[IPC] Background task:start error:', error);
          const taskError = createTaskResultError(error?.message || String(error));
          mainWindow?.webContents.send('task:error', {
            handleId,
            runId: handleId,
            status: 'failed',
            error: taskError,
          });
          mainWindow?.webContents.send('task:failed', {
            handleId,
            runId: handleId,
            status: 'failed',
            error: taskError,
          });
        });

      return {
        accepted: true,
        handle: handleId,
        run,
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
    const orchestrator = getTaskOrchestrator();
    orchestrator.pauseRun(handleId);
    if (sharedMainAgent && sharedMainAgent.getThreadId() === handleId) {
      sharedMainAgent.pause();
    } else {
      await taskEngine.pause(handleId);
    }
    mainWindow?.webContents.send('task:statusUpdate', { handleId, status: 'paused' });
    return { success: true };
  },

  'task:resume': async (mainWindow, previewWindow, { handleId }) => {
    const orchestrator = getTaskOrchestrator();
    orchestrator.resumeRun(handleId);
    if (sharedMainAgent && sharedMainAgent.getThreadId() === handleId) {
      sharedMainAgent.resume();
    } else {
      await taskEngine.resume(handleId);
    }
    mainWindow?.webContents.send('task:statusUpdate', { handleId, status: 'executing' });
    return { success: true };
  },

  'task:interrupt': async (mainWindow, previewWindow, { handleId, reason }) => {
    const orchestrator = getTaskOrchestrator();
    orchestrator.pauseRun(handleId);
    if (sharedMainAgent && sharedMainAgent.getThreadId() === handleId) {
      const state = await sharedMainAgent.interrupt(reason);
      mainWindow?.webContents.send('task:statusUpdate', { handleId, status: 'paused' });
      return state;
    }

    const state = await taskEngine.interrupt(handleId, reason);
    mainWindow?.webContents.send('task:statusUpdate', { handleId, status: 'paused' });
    return state;
  },

  'task:saveState': async (mainWindow, previewWindow, { handleId }) => {
    if (sharedMainAgent && sharedMainAgent.getThreadId() === handleId) {
      return await sharedMainAgent.saveState();
    }

    return await taskEngine.saveState(handleId);
  },

  'task:restoreState': async (mainWindow, previewWindow, { handleId, state }) => {
    const persistedState = state || (handleId ? getTaskStateStore().load(handleId) : null);
    if (
      persistedState?.runtimeType === 'main-agent' ||
      (!persistedState && sharedMainAgent?.getThreadId() === handleId)
    ) {
      if (!sharedMainAgent) {
        sharedMainAgent = await createMainAgent({
          threadId: persistedState?.threadId || handleId,
          logger: { level: 'debug', output: 'console' },
        });
      }
      sharedMainAgent.setMainWindow(mainWindow);
      sharedMainAgent.setPreviewWindow(previewWindow);

      const result = await sharedMainAgent.restoreFromState(persistedState);
      return {
        handle: sharedMainAgent.getThreadId(),
        status: sharedMainAgent.getStatus(),
        resumed: result.success,
      };
    }

    const restoredHandle = await taskEngine.restoreState(state || handleId);
    return {
      handle: restoredHandle.id,
      status: restoredHandle.status,
    };
  },

  'task:listSavedStates': async () => {
    return getTaskStateStore().list();
  },

  'task:deleteSavedState': async (mainWindow, previewWindow, { handleId }) => {
    getTaskStateStore().delete(handleId);
    return { success: true };
  },

  'task:stop': async (mainWindow, previewWindow, { handleId }) => {
    const orchestrator = getTaskOrchestrator();
    orchestrator.cancelRun(handleId);
    if (sharedMainAgent && sharedMainAgent.getThreadId() === handleId) {
      sharedMainAgent.requestCancel();
    } else {
      await taskEngine.cancel(handleId);
    }
    mainWindow?.webContents.send('task:statusUpdate', { handleId, status: 'cancelled' });
    return { success: true };
  },

  'task:restart': async (mainWindow, previewWindow, { handleId }) => {
    const orchestrator = getTaskOrchestrator();
    orchestrator.cancelRun(handleId);
    if (sharedMainAgent && sharedMainAgent.getThreadId() === handleId) {
      sharedMainAgent.requestCancel();
      mainWindow?.webContents.send('task:statusUpdate', { handleId, status: 'cancelled' });
      return { success: true, message: 'Task restart requested' };
    }
    await taskEngine.cancel(handleId);
    mainWindow?.webContents.send('task:statusUpdate', { handleId, status: 'cancelled' });
    return { success: true, message: 'Task restart requested' };
  },

  'task:complete': async (mainWindow, previewWindow, { handleId }) => {
    const orchestrator = getTaskOrchestrator();
    orchestrator.markCompleted(handleId);
    if (sharedMainAgent && sharedMainAgent.getThreadId() === handleId) {
      sharedMainAgent.requestCancel();
      mainWindow?.webContents.send('task:statusUpdate', { handleId, status: 'completed' });
      return { success: true, message: 'Task completion requested' };
    }
    mainWindow?.webContents.send('task:statusUpdate', { handleId, status: 'completed' });
    return { success: true, message: 'Task completion requested' };
  },

  'task:status': async (mainWindow, previewWindow, { handleId }) => {
    const orchestrator = getTaskOrchestrator();
    const snapshot = orchestrator.getStatusSnapshot(handleId);
    if (sharedMainAgent && sharedMainAgent.getThreadId() === handleId) {
      return { status: sharedMainAgent.getStatus(), handleId, run: snapshot.run, orchestratedStatus: snapshot.status };
    }
    const status = taskEngine.getState(handleId);
    return { status, run: snapshot.run, orchestratedStatus: snapshot.status };
  },

  'task:run:get': async (mainWindow, previewWindow, { runId }) => {
    try {
      return getTaskRunRepository().getById(runId);
    } catch (error: any) {
      console.error('[IPC] task:run:get error:', error);
      return null;
    }
  },

  'task:run:details': async (mainWindow, previewWindow, { runId }) => {
    try {
      const run = getTaskRunRepository().getById(runId);
      if (!run) {
        return null;
      }

      const result = run.resultId ? getTaskResultRepository().getById(run.resultId) : null;
      const template = run.templateId ? await getTaskTemplateRepository().getById(run.templateId) : null;
      const { getHistoryService } = await import('../history/historyService.js');
      const historyService = getHistoryService();
      const history = await historyService.getTaskByRunId(runId);

      return {
        run,
        result,
        template,
        history,
      };
    } catch (error: any) {
      console.error('[IPC] task:run:details error:', error);
      return null;
    }
  },

  'task:result:get': async (mainWindow, previewWindow, { resultId }) => {
    try {
      return getTaskResultRepository().getById(resultId);
    } catch (error: any) {
      console.error('[IPC] task:result:get error:', error);
      return null;
    }
  },

  'task:result:list': async (mainWindow, previewWindow, { limit = 50 } = {}) => {
    try {
      return getTaskResultRepository().listRecent(limit);
    } catch (error: any) {
      console.error('[IPC] task:result:list error:', error);
      return [];
    }
  },

  'task:run:list': async (mainWindow, previewWindow, { limit = 50 } = {}) => {
    try {
      return getTaskRunRepository().listRecent(limit);
    } catch (error: any) {
      console.error('[IPC] task:run:list error:', error);
      return [];
    }
  },

  'task:checkLoginPopup': async () => {
    return await taskEngine.checkAndHandleLoginPopup();
  },

  'preview:setMode': async (mainWindow, previewWindow, { mode }) => {
    if (mode === 'detached') {
      ensureDetachedPreviewWindow();
      return { success: true, mode };
    }

    if (mode === 'sidebar') {
      closeDetachedPreviewWindow();
      return { success: true, mode };
    }

    return { success: false, error: `Unsupported preview mode: ${mode}` };
  },

  // IM配置相关
  'im:load': async (mainWindow, previewWindow) => {
    try {
      const configStore = getIMConfigStore();
      const configs = await configStore.loadAll();
      console.log('[IPC] im:load returning configs:', JSON.stringify(configs));
      return configs;
    } catch (error: any) {
      console.error('[IPC] im:load error:', error);
      return {
        feishu: { enabled: false, appId: '', appSecret: '' },
        dingtalk: { enabled: false, appKey: '', appSecret: '' },
        wecom: { enabled: false, corpId: '', agentId: '', corpSecret: '' },
        slack: { enabled: false, botToken: '', signingSecret: '' },
      };
    }
  },

  'im:save': async (mainWindow, previewWindow, { platform, config }) => {
    try {
      const configStore = getIMConfigStore();
      const result = await configStore.save(platform, config);
      return result;
    } catch (error: any) {
      console.error('[IPC] im:save error:', error);
      return { success: false, error: error.message };
    }
  },

  'im:test': async (mainWindow, previewWindow, { platform, config }) => {
    try {
      if (platform === 'feishu') {
        const feishuConfig = config as { appId: string; appSecret: string };

        if (!feishuConfig.appId || !feishuConfig.appSecret) {
          return { success: false, error: '配置不能为空' };
        }
        if (!feishuConfig.appId.startsWith('cli_')) {
          return { success: false, error: 'App ID 必须以 cli_ 开头' };
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(
            'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                app_id: feishuConfig.appId,
                app_secret: feishuConfig.appSecret,
              }),
              signal: controller.signal,
            }
          );

          clearTimeout(timeout);

          if (response.ok) {
            return { success: true, message: '连接成功' };
          } else {
            const error = await response.json();
            return { success: false, error: error.msg || '连接失败' };
          }
        } catch (error: any) {
          clearTimeout(timeout);
          if (error.name === 'AbortError') {
            return { success: false, error: '连接超时(5s)' };
          }
          return { success: false, error: error.message || '连接失败' };
        }
      }
      return { success: false, error: `${platform} 平台即将支持` };
    } catch (error: any) {
      console.error('[IPC] im:test error:', error);
      return { success: false, error: error.message };
    }
  },

  'im:status': async (mainWindow, previewWindow, { platform }) => {
    try {
      const configStore = getIMConfigStore();
      const status = configStore.getStatus(platform);
      return status;
    } catch (error: any) {
      console.error('[IPC] im:status error:', error);
      return 'disconnected';
    }
  },

  'im:statusAll': async (mainWindow, previewWindow) => {
    try {
      const configStore = getIMConfigStore();
      const configs = configStore.getConfigs();
      const statuses: Record<string, string> = {};
      for (const platform of Object.keys(configs)) {
        statuses[platform] = configStore.getStatus(platform as any);
      }
      console.log('[IPC] im:statusAll returning:', JSON.stringify(statuses));
      return statuses;
    } catch (error: any) {
      console.error('[IPC] im:statusAll error:', error);
      return {
        feishu: 'disconnected',
        dingtalk: 'disconnected',
        wecom: 'disconnected',
        slack: 'disconnected',
      };
    }
  },

  'im:recentTasks': async (mainWindow, previewWindow, { limit = 20 } = {}) => {
    try {
      const dispatchService = getDispatchService();
      if (!dispatchService) {
        return [];
      }
      return dispatchService
        .getAllTasks()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit);
    } catch (error: any) {
      console.error('[IPC] im:recentTasks error:', error);
      return [];
    }
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

  'visual:run': async (mainWindow, previewWindow, payload) => {
    const service = getVisualAutomationService();
    const result = await service.runVisualTask({
      task: payload?.task,
      adapterMode: payload?.adapterMode,
      model: payload?.model,
      maxTurns: payload?.maxTurns,
      launchIfNeeded: payload?.launchIfNeeded,
      approvalEnabled: payload?.approvalEnabled,
    });

    return result;
  },

  'visual:approve': async (mainWindow, previewWindow, payload) => {
    const service = getVisualAutomationService();
    const result = await service.runApprovedVisualContinuation({
      task: payload?.task,
      actions: payload?.actions || [],
      adapterMode: payload?.adapterMode,
      model: payload?.model,
      maxTurns: payload?.maxTurns,
    });

    return result;
  },

  // 浏览器导航控制 (v2.0) - 使用 headed 浏览器
  'browser:navigate': async (mainWindow, previewWindow, { url }) => {
    const executor = getBrowserExecutor();
    const page = executor.getPage();
    if (page) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } else {
      await executor.launchHeadedBrowser({ url });
    }
    return { success: true };
  },

  // v2.0: Get browser current URL
  'browser:getCurrentUrl': async (mainWindow, previewWindow) => {
    const executor = getBrowserExecutor();
    const url = executor.getCurrentPageUrl();
    const title = await executor.getCurrentPageTitle();
    return { success: true, url, title };
  },

  // v2.0: Get CDP endpoint for webview connection
  'browser:getCDPEndpoint': async (mainWindow, previewWindow) => {
    const executor = getBrowserExecutor();
    const cdpEndpoint = await executor.getCDPEndpoint();
    return { success: true, cdpEndpoint };
  },

  // v2.0: Headed browser launch
  'browser:launchHeaded': async (mainWindow, previewWindow, options) => {
    try {
      const executor = getBrowserExecutor();
      await executor.launchHeadedBrowser(options);
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] browser:launchHeaded error:', error);
      return { success: false, error: error.message };
    }
  },

  // v2.0: Get cookies from Webview partition
  'browser:getWebviewCookies': async (mainWindow, previewWindow, { partition }) => {
    try {
      const { session } = require('electron');
      const targetPartition = partition || 'persist:automation';
      const webviewSession = session.fromPartition(targetPartition);
      const cookies = await webviewSession.cookies.get({});
      console.log('[IPC] Got cookies from partition', targetPartition, ':', cookies.length);
      return { success: true, cookies };
    } catch (error: any) {
      console.error('[IPC] browser:getWebviewCookies error:', error);
      return { success: false, error: error.message };
    }
  },

  // v2.0: Export session data (cookies, localStorage, sessionStorage) from Webview
  'browser:exportSession': async (
    mainWindow,
    previewWindow,
    { cookies, localStorage, sessionStorage, url }
  ) => {
    try {
      const userDataPath = app.getPath('userData');
      const sessionPath = path.join(userDataPath, 'browser', 'sessionData.json');
      const dir = path.dirname(sessionPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Save session data (cookies, localStorage, sessionStorage passed from Renderer)
      const sessionData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        cookies: cookies || [],
        localStorage: localStorage || {},
        sessionStorage: sessionStorage || {},
        sourceUrl: url || '',
      };

      fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2), 'utf-8');
      console.log('[IPC] Session exported to:', sessionPath);
      console.log(
        '[IPC] Session data - cookies:',
        cookies?.length || 0,
        'localStorage:',
        Object.keys(localStorage || {}).length,
        'sessionStorage:',
        Object.keys(sessionStorage || {}).length
      );

      return { success: true, sessionPath, cookiesCount: cookies?.length || 0 };
    } catch (error: any) {
      console.error('[IPC] browser:exportSession error:', error);
      return { success: false, error: error.message };
    }
  },

  // v2.0: Check if session data exists
  'browser:hasSession': async (mainWindow, previewWindow) => {
    try {
      const executor = getBrowserExecutor();
      const hasSession = executor.hasSessionData();
      return { success: true, hasSession };
    } catch (error: any) {
      console.error('[IPC] browser:hasSession error:', error);
      return { success: false, error: error.message };
    }
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
          const clickRoute = shouldUseVisualPrimaryForBrowserAction(action);
          if (clickRoute.useVisual) {
            result = await getVisualAutomationService().runBrowserActionFallback({
              action: 'click',
              selector: action.selector,
              routeReason: clickRoute.reason,
            });
            break;
          }
          result = await executor.execute({
            id: `ipc-click-${Date.now()}`,
            type: ActionType.BROWSER_CLICK,
            description: 'IPC Click',
            params: { selector: action.selector, index: action.index },
          });
          if (!result.success && result.error?.recoverable) {
            result = await getVisualAutomationService().runBrowserActionFallback({
              action: 'click',
              selector: action.selector,
              fallbackReason: result.error?.message,
            });
          }
          break;
        case 'input':
          const inputRoute = shouldUseVisualPrimaryForBrowserAction(action);
          if (inputRoute.useVisual) {
            result = await getVisualAutomationService().runBrowserActionFallback({
              action: 'input',
              selector: action.selector,
              text: action.text,
              routeReason: inputRoute.reason,
            });
            break;
          }
          result = await executor.execute({
            id: `ipc-input-${Date.now()}`,
            type: ActionType.BROWSER_INPUT,
            description: 'IPC Input',
            params: { selector: action.selector, text: action.text, clear: true },
          });
          if (!result.success && result.error?.recoverable) {
            result = await getVisualAutomationService().runBrowserActionFallback({
              action: 'input',
              selector: action.selector,
              text: action.text,
              fallbackReason: result.error?.message,
            });
          }
          break;
        case 'wait':
          const waitRoute = shouldUseVisualPrimaryForBrowserAction(action);
          if (waitRoute.useVisual) {
            result = await getVisualAutomationService().runBrowserActionFallback({
              action: 'wait',
              selector: action.selector,
              timeout: action.timeout,
              routeReason: waitRoute.reason,
            });
            break;
          }
          result = await executor.execute({
            id: `ipc-wait-${Date.now()}`,
            type: ActionType.BROWSER_WAIT,
            description: 'IPC Wait',
            params: { selector: action.selector, timeout: action.timeout || 10000 },
          });
          if (!result.success && result.error?.recoverable) {
            result = await getVisualAutomationService().runBrowserActionFallback({
              action: 'wait',
              selector: action.selector,
              timeout: action.timeout,
              fallbackReason: result.error?.message,
            });
          }
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
      const task = await historyService.getTask(taskId);
      if (!task) {
        return { success: false, error: `Task not found: ${taskId}` };
      }

      const result = await IPC_HANDLERS['task:start'](mainWindow, previewWindow, {
        task: task.task,
        threadId: task.metadata?.threadId,
        source: 'replay',
      });
      return { success: true, data: result };
    } catch (error: any) {
      console.error('[IPC] history:replay error:', error);
      return { success: false, error: error.message };
    }
  },

  'template:createFromHistory': async (
    mainWindow,
    previewWindow,
    { taskId }: { taskId: string }
  ) => {
    try {
      const { getHistoryService } = await import('../history/historyService.js');
      const historyService = getHistoryService();
      const task = await historyService.getTask(taskId);
      if (!task) {
        return { success: false, error: `Task not found: ${taskId}` };
      }

      const repository = getTaskTemplateRepository();
      if (task.metadata?.runId) {
        const template = await repository.createFromRun(task.metadata.runId);
        await historyService.updateTaskMetadata(taskId, {
          templateId: template.id,
        });
        return { success: true, data: template };
      }

      const template = await repository.createFromHistory({
        name: task.task.slice(0, 60),
        description: task.result?.summary || task.task,
        prompt: task.task,
        executionProfile: 'browser-first',
      });

      await historyService.updateTaskMetadata(taskId, {
        templateId: template.id,
      });

      return { success: true, data: template };
    } catch (error: any) {
      console.error('[IPC] template:createFromHistory error:', error);
      return { success: false, error: error.message };
    }
  },

  'template:createFromRun': async (
    mainWindow,
    previewWindow,
    { runId }: { runId: string }
  ) => {
    try {
      const repository = getTaskTemplateRepository();
      const template = await repository.createFromRun(runId);

      const { getHistoryService } = await import('../history/historyService.js');
      const historyService = getHistoryService();
      const historyTask = await historyService.getTaskByRunId(runId);
      if (historyTask) {
        await historyService.updateTaskMetadata(historyTask.id, {
          templateId: template.id,
        });
      }

      return { success: true, data: template };
    } catch (error: any) {
      console.error('[IPC] template:createFromRun error:', error);
      return { success: false, error: error.message };
    }
  },

  'template:list': async () => {
    try {
      const repository = getTaskTemplateRepository();
      return await repository.list();
    } catch (error: any) {
      console.error('[IPC] template:list error:', error);
      return [];
    }
  },

  'template:get': async (mainWindow, previewWindow, { templateId }: { templateId: string }) => {
    try {
      const repository = getTaskTemplateRepository();
      return await repository.getById(templateId);
    } catch (error: any) {
      console.error('[IPC] template:get error:', error);
      return null;
    }
  },

  'template:delete': async (
    mainWindow,
    previewWindow,
    { templateId }: { templateId: string }
  ) => {
    try {
      const repository = getTaskTemplateRepository();
      await repository.delete(templateId);
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] template:delete error:', error);
      return { success: false, error: error.message };
    }
  },

  'template:update': async (mainWindow, previewWindow, payload) => {
    try {
      const repository = getTaskTemplateRepository();
      const existing = await repository.getById(payload?.id);
      if (!existing) {
        return { success: false, error: `Template not found: ${payload?.id}` };
      }

      await repository.update({
        ...existing,
        name: payload?.name || existing.name,
        description: payload?.description || existing.description,
        inputSchema: payload?.inputSchema || existing.inputSchema,
        defaultInput: payload?.defaultInput || existing.defaultInput,
        executionProfile: payload?.executionProfile || existing.executionProfile,
        recommendedSkills: payload?.recommendedSkills || existing.recommendedSkills,
      });

      return { success: true };
    } catch (error: any) {
      console.error('[IPC] template:update error:', error);
      return { success: false, error: error.message };
    }
  },

  'template:create': async (mainWindow, previewWindow, payload) => {
    try {
      const repository = getTaskTemplateRepository();
      const template = await repository.createFromHistory({
        name: payload?.name || 'Untitled template',
        description: payload?.description || payload?.prompt || 'Reusable task template',
        prompt: payload?.prompt || payload?.description || '',
        inputSchema: payload?.inputSchema,
        defaultInput: payload?.defaultInput,
        executionProfile: payload?.executionProfile || 'browser-first',
      });
      return { success: true, data: template };
    } catch (error: any) {
      console.error('[IPC] template:create error:', error);
      return { success: false, error: error.message };
    }
  },

  'artifact:open': async (
    mainWindow,
    previewWindow,
    { uri }: { uri: string }
  ) => {
    try {
      const { shell } = await import('electron');
      if (/^https?:\/\//.test(uri)) {
        await shell.openExternal(uri);
        return { success: true, strategy: 'shell.openExternal' };
      }

      const openResult = await shell.openPath(uri);
      if (!openResult) {
        return { success: true, strategy: 'shell.openPath' };
      }

      return { success: false, error: openResult };
    } catch (error: any) {
      console.error('[IPC] artifact:open error:', error);
      return { success: false, error: error.message };
    }
  },

  'template:run': async (
    mainWindow,
    previewWindow,
    { templateId, input }: { templateId: string; input?: Record<string, unknown> }
  ) => {
    try {
      const repository = getTaskTemplateRepository();
      const template = await repository.getById(templateId);
      if (!template) {
        return { success: false, error: `Template not found: ${templateId}` };
      }

      const resolved = resolveTemplateInput(template, input);

      const result = await IPC_HANDLERS['task:start'](mainWindow, previewWindow, {
        task: resolved.prompt,
        source: 'chat',
        templateId,
      });

      return { success: true, data: result };
    } catch (error: any) {
      console.error('[IPC] template:run error:', error);
      return { success: false, error: error.message };
    }
  },

  // 概览指标 (v0.12)
  'overview:getMetrics': async (mainWindow, previewWindow, { dateRange }: { dateRange?: { start: number; end: number } } = {}) => {
    try {
      const { getHistoryService } = await import('../history/historyService.js');
      const { getScheduler } = await import('../scheduler/scheduler.js');
      const dispatchService = getDispatchService();

      const historyService = getHistoryService();
      const scheduler = getScheduler();

      const startDate = dateRange?.start || Date.now() - 7 * 24 * 60 * 60 * 1000;
      const endDate = dateRange?.end || Date.now();

      const allTasks = await historyService.listTasks({
        startDate,
        endDate,
        limit: 1000,
      });

      const completedTasks = allTasks.filter((t) => t.status === 'completed');
      const failedTasks = allTasks.filter((t) => t.status === 'failed');
      const runningTasks = allTasks.filter((t) => t.status === 'running');

      const totalDuration = allTasks.reduce((sum, t) => sum + (t.duration || 0), 0);
      const avgDuration = allTasks.length > 0 ? totalDuration / allTasks.length : 0;

      const successRate = allTasks.length > 0 ? (completedTasks.length / allTasks.length) * 100 : 0;

      const sourceStats: Record<string, number> = {};
      allTasks.forEach((task) => {
        const source = task.metadata?.source || 'unknown';
        sourceStats[source] = (sourceStats[source] || 0) + 1;
      });

      const dailyStats: Record<string, { completed: number; failed: number; total: number }> = {};
      allTasks.forEach((task) => {
        const date = new Date(task.startTime).toISOString().split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = { completed: 0, failed: 0, total: 0 };
        }
        dailyStats[date].total++;
        if (task.status === 'completed') dailyStats[date].completed++;
        if (task.status === 'failed') dailyStats[date].failed++;
      });

      const schedulerTasks = scheduler ? await scheduler.getAllTasks() : [];
      const activeSchedules = schedulerTasks.filter((t: any) => t.enabled).length;

      const imStats = dispatchService ? (dispatchService as any).getRecentTaskStats?.() || { total: 0, pending: 0, completed: 0, failed: 0 } : { total: 0, pending: 0, completed: 0, failed: 0 };

      return {
        success: true,
        data: {
          summary: {
            totalTasks: allTasks.length,
            completedTasks: completedTasks.length,
            failedTasks: failedTasks.length,
            runningTasks: runningTasks.length,
            successRate: Math.round(successRate * 10) / 10,
            avgDurationMs: Math.round(avgDuration),
            totalDurationMs: totalDuration,
          },
          sourceStats,
          dailyStats: Object.entries(dailyStats)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-14)
            .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {}),
          schedulerStats: {
            totalSchedules: schedulerTasks.length,
            activeSchedules,
          },
          imStats,
        },
      };
    } catch (error: any) {
      console.error('[IPC] overview:getMetrics error:', error);
      return { success: false, error: error.message };
    }
  },

  'history:search': async (mainWindow, previewWindow, { query, options } = {}) => {
    try {
      const { getHistoryService } = await import('../history/historyService.js');
      const historyService = getHistoryService();
      const results = await historyService.search(query || '', options || {});
      return { success: true, data: results };
    } catch (error: any) {
      console.error('[IPC] history:search error:', error);
      return { success: false, error: error.message };
    }
  },

  'history:summarizeSearch': async (mainWindow, previewWindow, { query, options } = {}) => {
    try {
      const { getHistoryService } = await import('../history/historyService.js');
      const historyService = getHistoryService();
      const results = await historyService.search(query || '', options || {});
      const summary = await historyService.summarizeSearch(query || '', results);
      return {
        success: true,
        data: {
          results,
          summary,
        },
      };
    } catch (error: any) {
      console.error('[IPC] history:summarizeSearch error:', error);
      return { success: false, error: error.message };
    }
  },

  'skill:list': async (mainWindow, previewWindow, payload = {}) => {
    try {
      const { SkillMarket } = await import('../skills/skillMarket.js');
      const market = new SkillMarket();
      const skills = await market.listInstalledSkills(payload.source);
      return skills;
    } catch (error: any) {
      console.error('[IPC] skill:list error:', error);
      return [];
    }
  },

  'skill:get': async (mainWindow, previewWindow, { name }: { name: string }) => {
    try {
      const { SkillMarket } = await import('../skills/skillMarket.js');
      const market = new SkillMarket();
      const skill = await market.getSkillManifest(name);
      return skill?.manifest || null;
    } catch (error: any) {
      console.error('[IPC] skill:get error:', error);
      return null;
    }
  },

  'skill:save': async (mainWindow, previewWindow, payload) => {
    try {
      const { SkillMarket } = await import('../skills/skillMarket.js');
      const market = new SkillMarket();
      const frontmatter = payload.frontmatter || {
        name: payload.name,
        description: payload.description,
      };
      await market.saveSkill(
        frontmatter,
        payload.content,
        payload.source || frontmatter.source || 'agent-created'
      );
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] skill:save error:', error);
      return { success: false, error: error.message };
    }
  },

  'skill:update': async (mainWindow, previewWindow, payload) => {
    try {
      const { SkillMarket } = await import('../skills/skillMarket.js');
      const market = new SkillMarket();
      const frontmatter = payload.frontmatter || {
        name: payload.name,
        description: payload.description,
      };
      await market.saveSkill(
        frontmatter,
        payload.content,
        payload.source || frontmatter.source || 'agent-created'
      );
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] skill:update error:', error);
      return { success: false, error: error.message };
    }
  },

  'skill:patch': async (mainWindow, previewWindow, { name, patch, source }) => {
    try {
      const { SkillMarket } = await import('../skills/skillMarket.js');
      const market = new SkillMarket();
      await market.patchSkill(name, patch, source || 'agent-created');
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] skill:patch error:', error);
      return { success: false, error: error.message };
    }
  },

  'skill:delete': async (mainWindow, previewWindow, { name, source }) => {
    try {
      const { SkillMarket } = await import('../skills/skillMarket.js');
      const market = new SkillMarket();
      await market.deleteSkill(name, source || 'agent-created');
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] skill:delete error:', error);
      return { success: false, error: error.message };
    }
  },

  'skill:increment': async (mainWindow, previewWindow, { name, source }) => {
    try {
      const { SkillMarket } = await import('../skills/skillMarket.js');
      const market = new SkillMarket();
      await market.incrementUsageCount(name, source || 'agent-created');
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] skill:increment error:', error);
      return { success: false, error: error.message };
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

  'skill:selectDirectory': async (mainWindow) => {
    try {
      const { dialog } = await import('electron');
      const result = mainWindow
        ? await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Select Skill Directory',
          })
        : await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Select Skill Directory',
          });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, cancelled: true };
      }

      return { success: true, path: result.filePaths[0] };
    } catch (error: any) {
      console.error('[IPC] skill:selectDirectory error:', error);
      return { success: false, error: error.message };
    }
  },

  'skill:validateDirectory': async (mainWindow, previewWindow, { path: skillPath }) => {
    try {
      if (!skillPath || typeof skillPath !== 'string') {
        return {
          success: false,
          valid: false,
          error: 'Skill path is required',
          code: 'PATH_REQUIRED',
        };
      }

      const resolvedPath = path.resolve(skillPath);
      const stats = await fs.promises.stat(resolvedPath).catch(() => null);
      if (!stats?.isDirectory()) {
        return {
          success: false,
          valid: false,
          error: 'Selected path is not a directory',
          code: 'NOT_DIRECTORY',
          path: resolvedPath,
        };
      }

      const manifestPath = path.join(resolvedPath, 'SKILL.md');
      const manifestStats = await fs.promises.stat(manifestPath).catch(() => null);
      if (!manifestStats?.isFile()) {
        return {
          success: false,
          valid: false,
          error: 'SKILL.md not found in selected directory',
          code: 'MISSING_SKILL_MD',
          path: resolvedPath,
        };
      }

      let preview: { name?: string; description?: string } = {};
      try {
        const { parseSkillFrontmatter } = await import('../skills/skillManifest.js');
        const content = await fs.promises.readFile(manifestPath, 'utf-8');
        const { frontmatter } = parseSkillFrontmatter(content);
        preview = {
          name: frontmatter.name || path.basename(resolvedPath),
          description: frontmatter.description || '',
        };
      } catch (error) {
        console.warn('[IPC] skill:validateDirectory preview parse failed:', error);
      }

      return {
        success: true,
        valid: true,
        path: resolvedPath,
        preview,
      };
    } catch (error: any) {
      console.error('[IPC] skill:validateDirectory error:', error);
      return { success: false, valid: false, error: error.message, code: 'VALIDATION_ERROR' };
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
      const { SkillMarket } = await import('../skills/skillMarket.js');
      const market = new SkillMarket();
      const skillsDir = await market.getSkillsDirectory();
      const candidatePaths = [path.join(skillsDir, 'agent-created'), skillsDir];
      const attemptedPaths: string[] = [];
      const attemptedStrategies: string[] = [];

      for (const candidatePath of candidatePaths) {
        attemptedPaths.push(candidatePath);
        attemptedStrategies.push(`shell.openPath:${candidatePath}`);
        const openResult = await shell.openPath(candidatePath);
        if (!openResult) {
          return { success: true, path: candidatePath, strategy: 'shell.openPath' };
        }
      }

      if (process.platform === 'linux') {
        const linuxOpenCommands: Array<{
          command: string;
          args: (targetPath: string) => string[];
        }> = [
          { command: 'gio', args: (targetPath: string) => ['open', targetPath] },
          { command: 'xdg-open', args: (targetPath: string) => [targetPath] },
        ];
        for (const { command, args } of linuxOpenCommands) {
          for (const candidatePath of candidatePaths) {
            attemptedStrategies.push(`${command}:${candidatePath}`);
            try {
              await execFileAsync(command, args(candidatePath), { timeout: 5000 });
              return { success: true, path: candidatePath, strategy: command };
            } catch (error) {
              // continue to next strategy
            }
          }
        }
      }

      for (const candidatePath of candidatePaths) {
        const entries = await fs.promises.readdir(candidatePath).catch(() => []);
        const skillDir = entries.find((entry) =>
          fs.existsSync(path.join(candidatePath, entry, 'SKILL.md'))
        );
        if (skillDir) {
          const skillFilePath = path.join(candidatePath, skillDir, 'SKILL.md');
          attemptedStrategies.push(`shell.showItemInFolder:${skillFilePath}`);
          shell.showItemInFolder(skillFilePath);
          return { success: true, path: skillFilePath, strategy: 'shell.showItemInFolder' };
        }
      }

      return {
        success: false,
        error: 'The item does not exist',
        path: skillsDir,
        attemptedPaths,
        attemptedStrategies,
      };
    } catch (error: any) {
      console.error('[IPC] skill:openDirectory error:', error);
      return { success: false, error: error.message };
    }
  },

  'settings:get': async () => {
    try {
      const settingsManager = getSettingsManager();
      return settingsManager.get();
    } catch (error: any) {
      console.error('[IPC] settings:get error:', error);
      return { success: false, error: error.message };
    }
  },

  'settings:set': async (mainWindow, previewWindow, payload) => {
    try {
      const settingsManager = getSettingsManager();
      if (payload.skill) {
        settingsManager.setSkillSettings(payload.skill);
      }
      if (payload.preview) {
        settingsManager.setPreviewSettings(payload.preview);
      }
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] settings:set error:', error);
      return { success: false, error: error.message };
    }
  },

  'skill:generate': async (mainWindow, previewWindow, payload) => {
    try {
      const { taskDescription, actionCount, rememberChoice } = payload;
      const taskEngine = getTaskEngine();
      await taskEngine.generateSkillFromTask(taskDescription, actionCount);
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] skill:generate error:', error);
      return { success: false, error: error.message };
    }
  },

  'memory:read': async () => {
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
      return await getMemoryService(homeDir).read();
    } catch (error: any) {
      console.error('[IPC] memory:read error:', error);
      return '# MEMORY.md\n\n- ';
    }
  },

  'memory:add': async (mainWindow, previewWindow, { content }) => {
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
      const success = await getMemoryService(homeDir).add(content);
      return { success };
    } catch (error: any) {
      console.error('[IPC] memory:add error:', error);
      return { success: false, error: error.message };
    }
  },

  'memory:replace': async (mainWindow, previewWindow, { oldText, newText }) => {
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
      const success = await getMemoryService(homeDir).replace(oldText, newText);
      return { success };
    } catch (error: any) {
      console.error('[IPC] memory:replace error:', error);
      return { success: false, error: error.message };
    }
  },

  'memory:remove': async (mainWindow, previewWindow, { text }) => {
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
      const success = await getMemoryService(homeDir).remove(text);
      return { success };
    } catch (error: any) {
      console.error('[IPC] memory:remove error:', error);
      return { success: false, error: error.message };
    }
  },

  'memory:inject': async () => {
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
      return await getMemoryService(homeDir).inject();
    } catch (error: any) {
      console.error('[IPC] memory:inject error:', error);
      return '';
    }
  },

  'memory:scan': async (mainWindow, previewWindow, { content }) => {
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
      return getMemoryService(homeDir).scan(content);
    } catch (error: any) {
      console.error('[IPC] memory:scan error:', error);
      return { safe: false, dangerousPatterns: [] };
    }
  },

  'mcp:listServers': async () => {
    const client = getMCPClient();
    const config = loadMCPConfig();
    const connected = client.listServers();
    const connectedMap = new Map(connected.map((server) => [server.name, server]));

    return Object.entries(config.servers).map(([name, serverConfig]) => ({
      name,
      config: serverConfig,
      status: connectedMap.get(name)?.status || 'disconnected',
      toolCount: connectedMap.get(name)?.tools.length || 0,
      error: connectedMap.get(name)?.error,
    }));
  },

  'mcp:listTools': async (mainWindow, previewWindow, { serverName }) => {
    const client = getMCPClient();
    if (serverName) {
      return await client.listTools(serverName);
    }
    return Array.from(client.getAllTools().values());
  },

  'mcp:saveConfig': async (mainWindow, previewWindow, { serverName, config }) => {
    if (!serverName || !config) {
      return { success: false, error: 'serverName and config are required' };
    }

    const fileConfig = loadMCPConfig();
    fileConfig.servers[serverName] = config;
    saveMCPConfig(fileConfig);
    return { success: true };
  },

  'mcp:getConfig': async () => {
    return loadMCPConfig();
  },

  'mcp:updateSettings': async (mainWindow, previewWindow, payload) => {
    const fileConfig = loadMCPConfig();
    fileConfig.sampling = {
      ...fileConfig.sampling,
      ...(payload?.sampling || {}),
      rateLimit: {
        ...fileConfig.sampling.rateLimit,
        ...(payload?.sampling?.rateLimit || {}),
      },
    };
    fileConfig.server = {
      ...fileConfig.server,
      ...(payload?.server || {}),
    };
    saveMCPConfig(fileConfig);
    return { success: true, data: fileConfig };
  },

  'mcp:connect': async (mainWindow, previewWindow, { serverName, config }) => {
    const client = getMCPClient();
    const fileConfig = loadMCPConfig();
    const resolvedConfig = config || fileConfig.servers[serverName];
    if (!resolvedConfig) {
      return { success: false, error: `MCP config not found for ${serverName}` };
    }

    await client.connect(serverName, resolvedConfig);
    fileConfig.servers[serverName] = resolvedConfig;
    saveMCPConfig(fileConfig);

    if (sharedMainAgent) {
      await sharedMainAgent.reloadSkills();
    }

    return {
      success: true,
      server: client.getServerState(serverName),
    };
  },

  'mcp:disconnect': async (mainWindow, previewWindow, { serverName }) => {
    const client = getMCPClient();
    await client.disconnect(serverName);

    if (sharedMainAgent) {
      await sharedMainAgent.reloadSkills();
    }

    return { success: true };
  },

  'mcp:sample': async (mainWindow, previewWindow, payload) => {
    try {
      return {
        success: true,
        data: await getMCPSamplingService().handleSamplingRequest(payload),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  'mcp:refreshTools': async (mainWindow, previewWindow, { serverName }) => {
    try {
      const client = getMCPClient();
      if (serverName) {
        return { success: true, data: await client.refreshTools(serverName) };
      }

      const refreshed = await Promise.all(
        client
          .listServers()
          .filter((server) => server.status === 'connected')
          .map(async (server) => ({
            serverName: server.name,
            tools: await client.refreshTools(server.name),
          }))
      );
      return { success: true, data: refreshed };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  'mcp:serverStart': async () => {
    try {
      const config = loadMCPConfig();
      await getMCPServerMode().startServer(config.server.port);
      return { success: true, data: getMCPServerMode().getStatus() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  'mcp:serverStop': async () => {
    try {
      await getMCPServerMode().stopServer();
      return { success: true, data: getMCPServerMode().getStatus() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  'mcp:serverStatus': async () => {
    return { success: true, data: getMCPServerMode().getStatus() };
  },

  'mcp:deleteServer': async (mainWindow, previewWindow, { serverName }) => {
    const client = getMCPClient();
    const fileConfig = loadMCPConfig();

    if (fileConfig.servers[serverName]) {
      delete fileConfig.servers[serverName];
      saveMCPConfig(fileConfig);
    }

    const serverState = client.getServerState(serverName);
    if (serverState && serverState.status !== 'disconnected') {
      await client.disconnect(serverName);
    }

    if (sharedMainAgent) {
      await sharedMainAgent.reloadSkills();
    }

    return { success: true };
  },
};
