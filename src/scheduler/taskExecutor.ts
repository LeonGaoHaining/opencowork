// src/scheduler/taskExecutor.ts

import { BrowserWindow } from 'electron';
import { QueuedTask, TaskExecutionResult, ExecutorMode, ExecutorConfig } from './types';
import { HistoryService } from '../history/historyService';
import { createMainAgent, AgentResult } from '../agents/mainAgent';

const DEFAULT_TASK_TIMEOUT = 300000; // 5 minutes

export class TaskExecutor {
  private historyService: HistoryService;
  private config: ExecutorConfig;
  private mainWindow: BrowserWindow | null = null;

  constructor(config: ExecutorConfig = { mode: ExecutorMode.INTEGRATED }) {
    this.historyService = new HistoryService();
    this.config = config;
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  async execute(task: QueuedTask): Promise<TaskExecutionResult> {
    const scheduledTask = task.scheduledTask;
    const startTime = Date.now();
    const timeout = scheduledTask.execution?.timeout || DEFAULT_TASK_TIMEOUT;

    console.log('[TaskExecutor] Starting scheduled task:', scheduledTask.name, 'timeout:', timeout);

    let historyRecordId: string | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Task ${scheduledTask.id} timed out after ${timeout}ms`)),
        timeout
      );
    });

    try {
      const historyRecord = await this.historyService.createTask(
        `[定时] ${scheduledTask.name}: ${scheduledTask.execution.taskDescription}`,
        {
          source: 'scheduler',
          scheduledTaskId: scheduledTask.id,
          scheduledTaskName: scheduledTask.name,
        }
      );
      historyRecordId = historyRecord.id;

      await this.historyService.startTaskById(historyRecord.id);

      let executionResult: Promise<void>;
      if (this.config.mode === ExecutorMode.INTEGRATED) {
        executionResult = this.executeWithMainAgent(
          scheduledTask.execution.taskDescription,
          scheduledTask.execution.timeout
        );
      } else {
        executionResult = this.executeStandalone(
          scheduledTask.execution.taskDescription,
          scheduledTask.execution.timeout
        );
      }

      await Promise.race([executionResult, timeoutPromise]);

      await this.historyService.completeTask(historyRecord.id, {
        success: true,
        output: 'Task completed successfully',
      });

      return {
        taskId: scheduledTask.id,
        status: 'success',
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        retryCount: task.retryCount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[TaskExecutor] Task failed:', scheduledTask.name, errorMessage);

      if (historyRecordId) {
        try {
          await this.historyService.completeTask(historyRecordId, {
            success: false,
            error: errorMessage,
          });
        } catch (e) {
          console.error('[TaskExecutor] Failed to update history:', e);
        }
      }

      return {
        taskId: scheduledTask.id,
        status: 'failed',
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        error: errorMessage,
        retryCount: task.retryCount,
      };
    }
  }

  private async executeWithMainAgent(description: string, timeout?: number): Promise<void> {
    console.log('[TaskExecutor] Execute with MainAgent:', description);

    const agent = await createMainAgent({
      threadId: `scheduler-${Date.now()}`,
      checkpointerEnabled: false,
    });

    if (this.mainWindow) {
      agent.setMainWindow(this.mainWindow);
    }

    const immediateTask = `请立即执行以下任务，不要创建定时任务：${description}`;
    const result: AgentResult = await agent.run(immediateTask);

    if (!result.success) {
      throw new Error(result.error || 'Agent execution failed');
    }

    console.log('[TaskExecutor] Agent completed:', result.finalMessage);
  }

  private async executeStandalone(description: string, timeout?: number): Promise<void> {
    console.log('[TaskExecutor] Execute standalone (placeholder):', description);
    await this.simulateExecution(timeout);
  }

  private async simulateExecution(timeout?: number): Promise<void> {
    const waitTime = timeout || 1000;
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitTime, 60000)));
  }
}
