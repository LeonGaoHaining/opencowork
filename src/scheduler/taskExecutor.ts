// src/scheduler/taskExecutor.ts

import { QueuedTask, TaskExecutionResult, ExecutorMode, ExecutorConfig } from './types';
import { HistoryService } from '../history/historyService';

export class TaskExecutor {
  private historyService: HistoryService;
  private config: ExecutorConfig;

  constructor(config: ExecutorConfig = { mode: ExecutorMode.STANDALONE }) {
    this.historyService = new HistoryService();
    this.config = config;
  }

  async execute(task: QueuedTask): Promise<TaskExecutionResult> {
    const scheduledTask = task.scheduledTask;
    const startTime = Date.now();

    console.log('[TaskExecutor] Starting scheduled task:', scheduledTask.name);

    let historyRecordId: string | null = null;

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

      if (this.config.mode === ExecutorMode.INTEGRATED) {
        await this.executeWithMainAgent(
          scheduledTask.execution.taskDescription,
          scheduledTask.execution.timeout
        );
      } else {
        await this.executeStandalone(
          scheduledTask.execution.taskDescription,
          scheduledTask.execution.timeout
        );
      }

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
    // TODO: Integrate with MainAgent for actual task execution
    // This requires:
    // 1. Import MainAgent from '../agents/mainAgent'
    // 2. Create MainAgent instance
    // 3. Call agent.run(description) with timeout
    // 4. Handle the result and propagate to historyService
    await this.simulateExecution(timeout);
  }

  private async executeStandalone(description: string, timeout?: number): Promise<void> {
    console.log('[TaskExecutor] Execute standalone (placeholder):', description);
    // TODO: Implement standalone execution:
    // - Parse task description using LLM
    // - Execute actions using BrowserExecutor or CLIExecutor
    // - Report progress back to scheduler
    await this.simulateExecution(timeout);
  }

  private async simulateExecution(timeout?: number): Promise<void> {
    const waitTime = timeout || 1000;
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitTime, 60000)));
  }
}
