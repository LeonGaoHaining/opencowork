import { BrowserWindow } from 'electron';
import { TaskPlanner } from '../planner/TaskPlanner';
import { PlanExecutor } from '../planner/PlanExecutor';
import { TakeoverManager } from './TakeoverManager';
import { Replanner, ReplanTrigger, ReplanRequest, ExecutionState } from '../planner/Replanner';
import { AnyAction, Plan, generateId } from '../action/ActionSchema';
import { Observer } from '../../browser/observer';
import { Verifier } from '../../executor/verifier';
import {
  RecoveryEngine,
  RecoveryStrategy,
  RecoveryContext,
  RecoveryAction,
} from '../../recovery/recoveryEngine';
import { ShortTermMemory } from '../../memory/shortTermMemory';

export enum TaskStatus {
  IDLE = 'idle',
  PLANNING = 'planning',
  EXECUTING = 'executing',
  PAUSED = 'paused',
  WAITING_CONFIRM = 'waiting_confirm',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface TaskHandle {
  id: string;
  status: TaskStatus;
  plan?: Plan;
  progress: { current: number; total: number };
  createdAt: number;
  updatedAt: number;
  previousTaskResult?: any;
}

export interface TakeoverContext {
  currentNode: any;
  completedActions: AnyAction[];
  pendingNodes: any[];
  aiContext: {
    currentTask: string;
    conversationHistory: any[];
    variables: Record<string, any>;
  };
}

const MAX_TASKS = 500;

export class TaskEngine {
  private planner: TaskPlanner;
  private executor: PlanExecutor;
  private replanner: Replanner;
  private _takeoverManager: TakeoverManager;
  private tasks: Map<string, TaskHandle> = new Map();
  private taskOrder: string[] = [];
  private mainWindow: BrowserWindow | null = null;
  private previewWindow: BrowserWindow | null = null;
  private currentTaskId: string | null = null;
  private lastCompletedTaskId: string | null = null;

  private observer: Observer | null = null;
  private verifier: Verifier | null = null;
  private recoveryEngine: RecoveryEngine | null = null;
  private memory: ShortTermMemory;
  private agentModulesInitialized = false;

  private activePopupWait: { interval: NodeJS.Timeout; timeout: NodeJS.Timeout } | null = null;
  private activeUserConfirm: { interval: NodeJS.Timeout; timeout: NodeJS.Timeout } | null = null;

  cleanup(): void {
    this.clearPopupWait();
    this.clearUserConfirm();
    this.tasks.clear();
    this.taskOrder = [];
    this.mainWindow = null;
    this.previewWindow = null;
    this.executor
      .cleanup()
      .catch((err) => console.error('[TaskEngine] executor cleanup error:', err));
    console.log('[TaskEngine] Cleaned up');
  }

  constructor() {
    this.planner = new TaskPlanner();
    this.executor = new PlanExecutor();
    this.replanner = new Replanner();
    this._takeoverManager = new TakeoverManager();
    this.memory = new ShortTermMemory();
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  setPreviewWindow(window: BrowserWindow | null): void {
    this.previewWindow = window;
  }

  isTaskRunning(): boolean {
    return this.currentTaskId !== null;
  }

  async startTask(task: string, mainWindow?: BrowserWindow): Promise<TaskHandle> {
    if (mainWindow) {
      this.mainWindow = mainWindow;
    }

    // 检查是否有任务正在执行
    if (this.currentTaskId && this.tasks.has(this.currentTaskId)) {
      const currentHandle = this.tasks.get(this.currentTaskId);
      if (
        currentHandle &&
        (currentHandle.status === TaskStatus.EXECUTING ||
          currentHandle.status === TaskStatus.PLANNING)
      ) {
        throw new Error('已有任务正在执行中，请等待完成后再发起新任务');
      }
    }

    const handle: TaskHandle = {
      id: generateId(),
      status: TaskStatus.PLANNING,
      progress: { current: 0, total: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.currentTaskId = handle.id;
    this.tasks.set(handle.id, handle);

    if (!this.taskOrder.includes(handle.id)) {
      this.taskOrder.push(handle.id);
    }
    while (this.taskOrder.length > MAX_TASKS) {
      const oldestId = this.taskOrder.shift();
      if (oldestId) {
        this.tasks.delete(oldestId);
        console.log('[TaskEngine] Max tasks reached, removed oldest:', oldestId);
      }
    }

    try {
      console.log(`[TaskEngine] Starting task ${handle.id}:`, task);

      // 获取当前上下文
      let currentUrl = '';
      let currentPageContent = '';
      let pageStructure = null;

      try {
        currentUrl = await this.executor.getPageUrl();
        currentPageContent = await this.executor.getPageContent();
        pageStructure = await this.executor.getPageStructure();

        console.log('[TaskEngine] pageStructure retrieved:', {
          hasTitle: !!pageStructure?.title,
          linksCount: pageStructure?.links?.length || 0,
          containersCount: pageStructure?.containers?.length || 0,
          mainContentArea: pageStructure?.mainContentArea,
        });
      } catch (e) {
        console.log('[TaskEngine] Could not get current page info:', e);
      }

      // 获取上一个已完成任务的结果（用于上下文理解）
      let previousTaskResult = null;
      if (this.lastCompletedTaskId) {
        const previousHandle = this.tasks.get(this.lastCompletedTaskId);
        if (previousHandle && previousHandle.status === TaskStatus.COMPLETED) {
          previousTaskResult = previousHandle.previousTaskResult;
        }
      }

      const planContext: any = {
        currentUrl,
        currentPageContent,
        pageStructure,
      };

      // 如果有上一个任务的结果，传递给 TaskPlanner
      if (previousTaskResult) {
        planContext.previousTaskResult = previousTaskResult;
        console.log(
          '[TaskEngine] Passing previous task result to planner:',
          Object.keys(previousTaskResult)
        );
      }

      const plan = await this.planner.plan(task, planContext);

      handle.plan = plan;
      handle.status = TaskStatus.EXECUTING;
      handle.progress = {
        current: 0,
        total: plan.nodes.filter((n) => n.type === 'action').length,
      };

      // 任务开始，恢复预览传输
      this.executor.setTaskRunning(true);

      // 正确 await 任务执行完成
      await this.executePlan(handle.id);

      return handle;
    } catch (error: any) {
      console.error(`[TaskEngine] Failed to start task:`, error);
      handle.status = TaskStatus.FAILED;
      this.sendToRenderer('task:error', { handleId: handle.id, error: error.message });
      throw error;
    } finally {
      // 任务完成后清空当前任务ID
      if (this.currentTaskId === handle.id) {
        this.currentTaskId = null;
      }
      // 任务完成后继续传输预览，但降低 fps
      this.executor.setTaskRunning(false);
    }
  }

  private async executePlan(handleId: string): Promise<void> {
    const handle = this.tasks.get(handleId);
    if (!handle || !handle.plan) return;

    // 深拷贝 plan 防止执行期间被修改
    const planCopy = JSON.parse(JSON.stringify(handle.plan));

    // AI设备场景：添加任务执行超时保护（默认30分钟）
    const TASK_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    let timeoutId: NodeJS.Timeout | null = null;

    // 启动超时计时器
    const startTimeout = () => {
      timeoutId = setTimeout(async () => {
        console.error(`[TaskEngine] Task execution timeout: ${handleId}`);
        handle.status = TaskStatus.FAILED;
        this.sendToRenderer('task:error', {
          handleId,
          error: 'Task execution timeout (30 minutes)',
        });
        await this.cancel(handleId);
      }, TASK_TIMEOUT);
    };

    const clearTaskTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    // 启动实时截图
    this.executor.startScreencast();

    startTimeout();

    try {
      for await (const event of this.executor.execute(planCopy)) {
        switch (event.type) {
          case 'node_start':
            handle.progress.current++;
            // 如果是 ask:user action，设置状态为 waiting_confirm
            if (event.node.action?.type === 'ask:user') {
              handle.status = TaskStatus.WAITING_CONFIRM;
            }
            this.sendToRenderer('task:nodeStart', event);
            break;
          case 'node_complete':
            // 如果之前是 ask:user，恢复执行状态
            if (handle.status === TaskStatus.WAITING_CONFIRM) {
              handle.status = TaskStatus.EXECUTING;
            }
            this.sendToRenderer('task:nodeComplete', event);
            break;
          case 'node_error':
            console.error(`[TaskEngine] Node error:`, event.error);

            // 移除自动检测登录弹窗逻辑（方案B：改为用户触发式）
            // 登录弹窗检测改为用户手动触发：在UI界面点击"检测登录"按钮时调用
            // this.checkAndHandleLoginPopup()

            // ========== 优先使用 RecoveryEngine (v0.3新模块) ==========
            const recoveryResult = await this.handleNodeError(event, handle);

            if (recoveryResult.shouldContinue) {
              // 跳过或重试成功，继续下一步
              continue;
            }

            if (recoveryResult.shouldReplan) {
              // RecoveryEngine失败，交给Replanner处理
              console.log('[TaskEngine] RecoveryEngine failed, falling back to Replanner');
            } else {
              // RecoveryEngine放弃，发送错误
              this.sendToRenderer('task:error', event);
              break;
            }

            // ========== Replanner (仅当RecoveryEngine失败后) ==========
            // 尝试使用 LLM 驱动的 Replanner 恢复
            const errorCode = event.error?.code || 'UNKNOWN';
            const isRecoverable = event.error?.recoverable ?? true;

            if (isRecoverable && handle.plan) {
              const executionState: ExecutionState = {
                currentNodeId: event.node?.id || '',
                completedNodes: [],
                pageUrl:
                  event.node?.action?.type === 'browser:navigate'
                    ? (event.node.action.params as any)?.url
                    : undefined,
              };

              let retryCount = 0;
              let replanSuccess = false;
              const failedNodeId = event.node?.id;

              while (retryCount < 3 && !replanSuccess) {
                // 获取当前页面内容
                const pageContent = await this.executor.getPageContent();

                const replanRequest: ReplanRequest = {
                  trigger:
                    errorCode === 'SELECTOR_NOT_FOUND'
                      ? ReplanTrigger.SELECTOR_INVALID
                      : errorCode === 'NAVIGATION_ERROR'
                        ? ReplanTrigger.NAVIGATION_ERROR
                        : errorCode === 'WAIT_TIMEOUT'
                          ? ReplanTrigger.TIMEOUT
                          : ReplanTrigger.ACTION_FAILED,
                  failedNodeId: event.node?.id,
                  error: {
                    code: errorCode,
                    message: event.error?.message || 'Unknown error',
                    recoverable: isRecoverable,
                  },
                  executionState,
                  remainingPlan: handle.plan,
                  pageContent,
                };

                // 使用 LLM 决策的重试机制
                const replanResult = await this.replanner.decideWithRetry(
                  replanRequest,
                  retryCount
                );

                console.log(`[TaskEngine] Replan attempt ${retryCount + 1}:`, replanResult);

                if (replanResult.success && replanResult.canContinue) {
                  replanSuccess = true;
                  this.sendToRenderer('task:statusUpdate', {
                    status: 'replanning',
                    message: `正在重试 (${retryCount + 1}/3): ${replanResult.reason || '重新执行'}`,
                  });

                  // 应用 modifiedNodes 到计划
                  if (replanResult.modifiedNodes) {
                    for (const mod of replanResult.modifiedNodes) {
                      const nodeIndex = handle.plan.nodes.findIndex((n) => n.id === mod.nodeId);
                      if (nodeIndex !== -1) {
                        if (mod.retryCount === -1) {
                          // 跳过节点
                          handle.plan.nodes.splice(nodeIndex, 1);
                        } else if (mod.newSelector && handle.plan.nodes[nodeIndex].action) {
                          // 处理逗号分隔的选择器
                          let mainSelector = mod.newSelector;
                          let fallback: string[] = [];

                          if (mod.newSelector.includes(',')) {
                            const parts = mod.newSelector.split(',').map((s) => s.trim());
                            mainSelector = parts[0];
                            fallback = parts.slice(1);
                          }

                          // 如果有额外的 fallbackSelectors，合并
                          if (mod.fallbackSelectors && mod.fallbackSelectors.length > 0) {
                            fallback = [...fallback, ...mod.fallbackSelectors];
                          }

                          (handle.plan.nodes[nodeIndex].action.params as any).selector =
                            mainSelector;
                          if (fallback.length > 0) {
                            (handle.plan.nodes[nodeIndex].action.params as any).fallbackSelectors =
                              fallback;
                          }
                        } else if (mod.newAction && handle.plan.nodes[nodeIndex].action) {
                          handle.plan.nodes[nodeIndex].action = mod.newAction;
                        }
                      }
                    }
                  }

                  // 重规划成功后，重新执行当前失败的节点
                  if (failedNodeId) {
                    const retryNodeIndex = handle.plan.nodes.findIndex(
                      (n) => n.id === failedNodeId
                    );
                    if (retryNodeIndex !== -1) {
                      const retryNode = handle.plan.nodes[retryNodeIndex];
                      if (!retryNode.action) {
                        console.warn(`[TaskEngine] Retry node has no action, skipping`);
                        continue;
                      }

                      console.log(`[TaskEngine] Retrying failed node: ${failedNodeId}`);

                      try {
                        const retryResult = await this.executor.executeSingleAction(
                          retryNode.action
                        );

                        if (retryResult.success) {
                          console.log(`[TaskEngine] Retry succeeded for node: ${failedNodeId}`);
                          this.sendToRenderer('task:nodeComplete', {
                            node: retryNode,
                            result: retryResult,
                          });
                        } else {
                          console.log(
                            `[TaskEngine] Retry failed for node: ${failedNodeId}, retry count: ${retryCount + 1}`
                          );
                          retryCount++;
                          replanSuccess = false;

                          if (retryCount >= 3) {
                            break;
                          }
                          continue;
                        }
                      } catch (retryError: any) {
                        console.error(`[TaskEngine] Retry error:`, retryError);
                        retryCount++;
                        if (retryCount >= 3) {
                          replanSuccess = false;
                          break;
                        }
                        continue;
                      }
                    }
                  }

                  break;
                } else {
                  retryCount++;
                  if (retryCount >= 3) {
                    break;
                  }
                }
              }

              if (replanSuccess) {
                continue;
              }
            }

            // 发送错误事件
            this.sendToRenderer('task:error', event);
            break;
          case 'completed':
            handle.status = TaskStatus.COMPLETED;
            handle.previousTaskResult = event.summary;
            this.lastCompletedTaskId = handle.id;
            console.log(`[TaskEngine] Task completed, sending event to renderer`);
            this.sendToRenderer('task:completed', { handleId, result: event.summary });
            break;
          case 'failed':
            handle.status = TaskStatus.FAILED;
            console.log(`[TaskEngine] Task failed, sending event to renderer`);
            this.sendToRenderer('task:error', { handleId, error: event.error });
            break;
        }
        handle.updatedAt = Date.now();
      }
    } catch (error: any) {
      console.error(`[TaskEngine] Plan execution failed:`, error);
      handle.status = TaskStatus.FAILED;
      this.sendToRenderer('task:error', { handleId, error: error.message || 'Unknown error' });
      throw error;
    } finally {
      clearTaskTimeout();
      // 不再停止预览传输，而是保持低 fps 继续传输
      // 预览传输由 setTaskRunning(false) 在外层 finally 中处理
    }
  }

  async pause(handleId: string): Promise<void> {
    const handle = this.tasks.get(handleId);
    if (handle) {
      this.executor.pause();
      handle.status = TaskStatus.PAUSED;
      console.log(`[TaskEngine] Task paused: ${handleId}`);
    }
  }

  async resume(handleId: string): Promise<void> {
    const handle = this.tasks.get(handleId);
    if (handle) {
      this.executor.resume();
      handle.status = TaskStatus.EXECUTING;
      console.log(`[TaskEngine] Task resumed: ${handleId}`);
    }
  }

  async takeover(handleId: string): Promise<TakeoverContext | null> {
    const handle = this.tasks.get(handleId);
    if (!handle) return null;

    await this.pause(handleId);

    const completedActions: AnyAction[] = [];
    if (handle.plan?.nodes) {
      for (const node of handle.plan.nodes) {
        if (node.type === 'action' && node.action) {
          completedActions.push(node.action);
        }
      }
    }

    return {
      currentNode: null,
      completedActions,
      pendingNodes: [],
      aiContext: {
        currentTask:
          handle.progress.current > 0
            ? `Task in progress (${handle.progress.current}/${handle.progress.total})`
            : '',
        conversationHistory: [],
        variables: {},
      },
    };
  }

  async resumeFromUser(handleId: string, action: AnyAction): Promise<void> {
    console.log(`[TaskEngine] Resuming from user action:`, action);
    await this.resume(handleId);
  }

  async cancel(handleId: string): Promise<void> {
    const handle = this.tasks.get(handleId);
    if (handle) {
      this.executor.pause();
      this.clearPopupWait();
      this.clearUserConfirm();
      handle.status = TaskStatus.CANCELLED;
      console.log(`[TaskEngine] Task cancelled: ${handleId}`);
    }
  }

  private async waitForPopupClosed(): Promise<void> {
    if (this.activePopupWait) {
      this.clearPopupWait();
    }

    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        try {
          const status = await this.executor.checkLoginPopup();
          if (!status.hasPopup) {
            this.clearPopupWait();
            resolve();
          }
        } catch (e) {
          console.warn('[TaskEngine] Popup check error:', e);
        }
      }, 2000);

      const outerTimeout = setTimeout(() => {
        this.clearPopupWait();
        console.log('[TaskEngine] Popup wait timeout, continuing anyway');
        resolve();
      }, 60000);

      this.activePopupWait = { interval: checkInterval, timeout: outerTimeout };
    });
  }

  private clearPopupWait(): void {
    if (this.activePopupWait) {
      clearInterval(this.activePopupWait.interval);
      clearTimeout(this.activePopupWait.timeout);
      this.activePopupWait = null;
    }
  }

  getState(handleId: string): TaskHandle | null {
    return this.tasks.get(handleId) || null;
  }

  private agentModulesInitPromise: Promise<void> | null = null;

  private async ensureAgentModules(): Promise<void> {
    if (this.agentModulesInitialized) return;

    if (this.agentModulesInitPromise) {
      await this.agentModulesInitPromise;
      return;
    }

    this.agentModulesInitPromise = this.initializeAgentModules();

    try {
      await this.agentModulesInitPromise;
    } finally {
      this.agentModulesInitPromise = null;
    }
  }

  private async initializeAgentModules(): Promise<void> {
    if (this.agentModulesInitialized) return;

    const page = this.executor.getBrowserPage();
    if (!page) {
      console.warn('[TaskEngine] No browser page available for agent modules');
      return;
    }

    this.observer = new Observer(page);
    this.verifier = new Verifier(page);
    this.recoveryEngine = new RecoveryEngine(page);

    this.agentModulesInitialized = true;
    console.log('[TaskEngine] Agent modules initialized');
  }

  private async handleNodeError(
    event: any,
    handle: TaskHandle
  ): Promise<{ shouldContinue: boolean; shouldReplan: boolean }> {
    await this.ensureAgentModules();

    if (!this.observer || !this.verifier || !this.recoveryEngine) {
      return { shouldContinue: false, shouldReplan: true };
    }

    const currentGraph = await this.observer.capture();

    const verification = await this.verifier.verify(event.node.action, {
      success: false,
      error: event.error,
      duration: 0,
    });

    console.log('[TaskEngine] Verification result:', verification);

    this.memory.recordError(
      { code: event.error.code, message: event.error.message },
      { action: event.node.action, pageUrl: currentGraph.url, nodeId: event.node.id }
    );

    const recoveryContext: RecoveryContext = {
      failedAction: event.node.action,
      failedNodeId: event.node.id,
      actionResult: { success: false, error: event.error, duration: 0 },
      currentGraph,
      previousGraph: this.observer.getLastGraph(),
      retryCount: 0,
      maxRetries: 2,
    };

    const recoveryAction = await this.recoveryEngine.decide(recoveryContext);
    console.log('[TaskEngine] Recovery action:', recoveryAction);

    switch (recoveryAction.strategy) {
      case RecoveryStrategy.RETRY_SAME:
      case RecoveryStrategy.RETRY_WITH_WAIT:
        if (recoveryAction.waitMs) {
          const page = this.executor.getBrowserPage();
          if (page) {
            await page.waitForTimeout(recoveryAction.waitMs);
          } else {
            console.warn('[TaskEngine] Browser page not available, skipping wait');
          }
        }
        return await this.retryNode(event.node, handle);

      case RecoveryStrategy.USE_FALLBACK_SELECTOR:
        if (recoveryAction.newSelector) {
          (event.node.action.params as any).selector = recoveryAction.newSelector;
        }
        return await this.retryNode(event.node, handle);

      case RecoveryStrategy.REGENERATE_SELECTOR:
        const newSelector = await this.recoveryEngine.regenerateSelector(recoveryContext);
        if (newSelector) {
          (event.node.action.params as any).selector = newSelector;
          return await this.retryNode(event.node, handle);
        }
        return { shouldContinue: false, shouldReplan: true };

      case RecoveryStrategy.SKIP_STEP:
        console.log('[TaskEngine] Skipping failed step');
        return { shouldContinue: true, shouldReplan: false };

      case RecoveryStrategy.ASK_USER:
        handle.status = TaskStatus.WAITING_CONFIRM;
        this.sendToRenderer('task:waiting_user', {
          message: '操作失败，需要用户确认如何继续',
          nodeId: event.node.id,
        });
        return { shouldContinue: false, shouldReplan: false };

      case RecoveryStrategy.GIVE_UP:
      default:
        return { shouldContinue: false, shouldReplan: false };
    }
  }

  private async retryNode(
    node: any,
    handle: TaskHandle
  ): Promise<{ shouldContinue: boolean; shouldReplan: boolean }> {
    try {
      const retryResult = await this.executor.executeSingleAction(node.action);

      if (retryResult.success) {
        console.log('[TaskEngine] Retry succeeded');
        this.sendToRenderer('task:nodeComplete', { node, result: retryResult });
        return { shouldContinue: true, shouldReplan: false };
      } else {
        console.log('[TaskEngine] Retry failed, will trigger Replanner');
        return { shouldContinue: false, shouldReplan: true };
      }
    } catch (error) {
      console.error('[TaskEngine] Retry error:', error);
      return { shouldContinue: false, shouldReplan: true };
    }
  }

  async checkAndHandleLoginPopup(): Promise<{ handled: boolean; message: string }> {
    try {
      const popupStatus = await this.executor.checkLoginPopup();

      if (popupStatus.hasPopup) {
        console.log('[TaskEngine] Login popup detected, waiting for user to handle');

        // 暂停任务
        this.executor.pause();

        // 通知用户处理
        this.sendToRenderer('task:waiting_login', {
          message: '检测到登录弹窗，请完成登录后点击"继续"',
          popupType: popupStatus.popupType || 'unknown',
        });

        // 等待用户确认完成
        await this.waitForUserConfirm('login_completed');

        // 用户处理完成后，继续任务
        this.executor.resume();

        return { handled: true, message: '登录弹窗已处理' };
      }

      return { handled: false, message: '未检测到登录弹窗' };
    } catch (error) {
      console.error('[TaskEngine] Check login popup error:', error);
      return { handled: false, message: '检测失败' };
    }
  }

  private async waitForUserConfirm(confirmType: string): Promise<void> {
    if (this.activeUserConfirm) {
      this.clearUserConfirm();
    }

    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        try {
          const handle = this.tasks.get(this.currentTaskId || '');
          if (handle?.status === TaskStatus.EXECUTING) {
            this.clearUserConfirm();
            resolve();
          }
        } catch (e) {
          console.warn('[TaskEngine] User confirm check error:', e);
          this.clearUserConfirm();
          resolve();
        }
      }, 1000);

      const outerTimeout = setTimeout(() => {
        this.clearUserConfirm();
        console.log('[TaskEngine] User confirm wait timeout');
        resolve();
      }, 60000);

      this.activeUserConfirm = { interval: checkInterval, timeout: outerTimeout };
    });
  }

  private clearUserConfirm(): void {
    if (this.activeUserConfirm) {
      clearInterval(this.activeUserConfirm.interval);
      clearTimeout(this.activeUserConfirm.timeout);
      this.activeUserConfirm = null;
    }
  }

  private sendToRenderer(channel: string, data: any): void {
    console.log('[TaskEngine] sendToRenderer called:', {
      channel,
      mainWindowExists: !!this.mainWindow,
      mainWindowDestroyed: this.mainWindow?.isDestroyed(),
      previewWindowExists: !!this.previewWindow,
      data: JSON.stringify(data).substring(0, 100),
    });

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
      console.log('[TaskEngine] Sent to mainWindow:', channel);
    } else {
      console.warn('[TaskEngine] mainWindow not available or destroyed!');
    }

    if (this.previewWindow && !this.previewWindow.isDestroyed()) {
      this.previewWindow.webContents.send(channel, data);
      console.log('[TaskEngine] Sent to previewWindow:', channel);
    }
  }
}

export default TaskEngine;
