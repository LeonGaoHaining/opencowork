// src/scheduler/taskExecutor.ts

import { BrowserWindow } from 'electron';
import { QueuedTask, TaskExecutionResult, ExecutorMode, ExecutorConfig } from './types';
import { getHistoryService, HistoryService } from '../history/historyService';
import { createMainAgent, AgentResult } from '../agents/mainAgent';
import { executeVisualBrowserTask, resolveVisualAdapterMode } from '../agents/visualBrowserHelper';
import { mapAgentResultToTaskResult } from '../core/task/resultMapper';
import { getTaskTemplateRepository } from '../core/task/TaskTemplateRepository';
import { resolveTemplateInput } from '../core/task/templateUtils';
import { getTaskOrchestrator } from '../core/task/TaskOrchestrator';
import { createTaskEntityId } from '../core/task/types';
import { buildTaskExecutionMetadata } from '../core/task/taskModelMetadata';
import { attachTaskRoutingToResult, resolveTaskExecutionRoute } from '../core/task/taskRouting';

const DEFAULT_TASK_TIMEOUT = 300000; // 5 minutes

export class TaskExecutor {
  private historyService: HistoryService;
  private config: ExecutorConfig;
  private mainWindow: BrowserWindow | null = null;

  constructor(config: ExecutorConfig = { mode: ExecutorMode.INTEGRATED }) {
    this.historyService = getHistoryService();
    this.config = config;
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  async execute(task: QueuedTask): Promise<TaskExecutionResult & { resultSummary?: string; artifactsCount?: number; runId?: string }> {
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
      const runId = createTaskEntityId('scheduler-run');
      const taskOrchestrator = getTaskOrchestrator();
      const routing = resolveTaskExecutionRoute({
        task: scheduledTask.execution.taskDescription || scheduledTask.description,
        source: 'scheduler',
        executionMode: scheduledTask.execution.executionMode || undefined,
      });
      taskOrchestrator.startRun({
        runId,
        source: 'scheduler',
        title: scheduledTask.name,
        prompt: scheduledTask.execution.taskDescription || scheduledTask.description,
        params: scheduledTask.execution.input,
        templateId: scheduledTask.execution.templateId,
        metadata: buildTaskExecutionMetadata({
          source: 'scheduler',
          executionMode: routing.executionMode,
          templateId: scheduledTask.execution.templateId,
          visualProvider: routing.visualProvider,
          taskRouting: routing,
          extra: {
            scheduledTaskId: scheduledTask.id,
          },
        }),
      });

      const historyRecord = await this.historyService.createTask(
        `[定时] ${scheduledTask.name}: ${scheduledTask.execution.taskDescription || scheduledTask.execution.templateId || scheduledTask.description}`,
        {
          source: 'scheduler',
          scheduledTaskId: scheduledTask.id,
          scheduledTaskName: scheduledTask.name,
          templateId: scheduledTask.execution.templateId,
          executionMode: routing.executionMode,
          visualProvider: routing.visualProvider,
          runId,
        }
      );
      historyRecordId = historyRecord.id;

      await this.historyService.startTaskById(historyRecord.id);

      let executionResult: Promise<AgentResult | null>;
      if (this.config.mode === ExecutorMode.INTEGRATED) {
        executionResult = this.executeWithMainAgent(
          scheduledTask.execution.taskDescription,
          scheduledTask.execution.templateId,
          scheduledTask.execution.input,
          routing.executionMode,
          routing.visualProvider,
          scheduledTask.execution.timeout
        );
      } else {
        executionResult = this.executeStandalone(
          scheduledTask.execution.taskDescription || scheduledTask.description,
          scheduledTask.execution.timeout
        );
      }

      const taskResult = await taskOrchestrator.executeRun(runId, async () => {
        const agentResult = await Promise.race([executionResult, timeoutPromise]);
        const mappedResult = agentResult
          ? mapAgentResultToTaskResult(agentResult)
          : mapAgentResultToTaskResult({ success: true, output: 'Task completed successfully' });
        return attachTaskRoutingToResult(mappedResult, routing);
      });

      await this.historyService.completeTask(historyRecord.id, {
        success: true,
        output: taskResult.rawOutput,
        summary: taskResult.summary,
        artifacts: taskResult.artifacts,
        rawOutput: taskResult.rawOutput,
        structuredData: taskResult.structuredData,
        reusable: taskResult.reusable,
      });

      if (historyRecordId) {
        await this.historyService.updateTaskMetadata(historyRecordId, {
          source: 'scheduler',
          resultSummary: taskResult.summary,
          artifactsCount: taskResult.artifacts.length,
        });
      }

      return {
        taskId: scheduledTask.id,
        status: 'success',
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        retryCount: task.retryCount,
        runId,
        resultSummary: taskResult.summary,
        artifactsCount: taskResult.artifacts.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[TaskExecutor] Task failed:', scheduledTask.name, errorMessage);

      if (historyRecordId) {
        try {
          await this.historyService.completeTask(historyRecordId, {
            success: false,
            error: errorMessage,
            summary: errorMessage,
            reusable: false,
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

  private async executeWithMainAgent(
    description?: string,
    templateId?: string,
    input?: Record<string, unknown>,
    executionMode?: 'dom' | 'visual' | 'hybrid',
    visualProvider?: {
      id: string;
      name: string;
      score: number;
      reasons: string[];
      adapterMode: 'chat-structured' | 'responses-computer';
    } | null,
    timeout?: number
  ): Promise<AgentResult> {
    let resolvedDescription = description || '';
    if (templateId) {
      const template = await getTaskTemplateRepository().getById(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }
      resolvedDescription = resolveTemplateInput(template, input).prompt;
    }

    console.log('[TaskExecutor] Execute with MainAgent:', resolvedDescription);

    const agent = await createMainAgent({
      threadId: `scheduler-${Date.now()}`,
      checkpointerEnabled: false,
    });

    if (this.mainWindow) {
      agent.setMainWindow(this.mainWindow);
    }

    const immediateTask = `请立即执行以下任务，不要创建定时任务：${resolvedDescription}`;
    const result: AgentResult =
      executionMode === 'visual' || executionMode === 'hybrid'
        ? await executeVisualBrowserTask({
            task: immediateTask,
            adapterMode: resolveVisualAdapterMode(executionMode, visualProvider),
            maxTurns: 8,
            visualProvider,
          })
        : await agent.run(immediateTask);

    if (!result.success) {
      throw new Error(result.error || 'Agent execution failed');
    }

    console.log('[TaskExecutor] Agent completed:', result.finalMessage);
    return result;
  }

  private async executeStandalone(description: string, timeout?: number): Promise<AgentResult | null> {
    console.log('[TaskExecutor] Execute standalone (placeholder):', description);
    await this.simulateExecution(timeout);
    return {
      success: true,
      output: 'Task completed successfully',
      finalMessage: 'Task completed successfully',
    };
  }

  private async simulateExecution(timeout?: number): Promise<void> {
    const waitTime = timeout || 1000;
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitTime, 60000)));
  }
}
