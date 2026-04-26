import { TaskResult, TaskRun, TaskSource, TaskVisualProviderSelection, createTaskEntityId } from '../task/types';
import { TaskOrchestrator } from '../task/TaskOrchestrator';
import { TaskResultRepository } from '../task/TaskResultRepository';
import { getBenchmarkRunRepository } from './BenchmarkRunRepository';
import { BenchmarkEvaluation, BenchmarkRunRecord, BenchmarkTask, BenchmarkTaskRunMetrics } from './types';
import { evaluateBenchmarkTask } from './evaluation';
import { normalizeVisualProviderSelection, resolveVisualProviderSelection } from '../visual/visualProviderMetadata';

export interface StartTaskRequest {
  task: string;
  source: TaskSource;
  threadId?: string;
  executionMode?: 'dom' | 'visual' | 'hybrid';
  templateId?: string;
  params?: Record<string, unknown>;
}

export interface StartTaskResponse {
  accepted: boolean;
  handle?: string;
  run?: TaskRun;
  error?: string;
}

export type StartTaskFn = (request: StartTaskRequest) => Promise<StartTaskResponse>;

export interface BenchmarkRunOptions {
  benchmark: BenchmarkTask;
  startTask: StartTaskFn;
  orchestrator: TaskOrchestrator;
  resultRepository: TaskResultRepository;
  source?: TaskSource;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface BenchmarkRunOutcome {
  record: BenchmarkRunRecord;
  evaluation?: BenchmarkEvaluation;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMetrics(taskRun: TaskRun, taskResult: TaskResult): BenchmarkTaskRunMetrics {
  const rawOutput = taskResult.rawOutput && typeof taskResult.rawOutput === 'object' ? (taskResult.rawOutput as Record<string, unknown>) : null;
  const visualMetrics = Array.isArray(rawOutput?.visualMetrics) ? (rawOutput?.visualMetrics as Array<Record<string, unknown>>) : [];
  const summaryMetrics = visualMetrics[0] || {};

  return {
    durationMs: Math.max(0, (taskRun.endedAt || taskResult.completedAt) - taskRun.startedAt),
    totalTurns: typeof summaryMetrics.totalTurns === 'number' ? summaryMetrics.totalTurns : 0,
    actionBatches: typeof summaryMetrics.actionBatches === 'number' ? summaryMetrics.actionBatches : 0,
    recoveryAttempts: typeof summaryMetrics.recoveryAttempts === 'number' ? summaryMetrics.recoveryAttempts : 0,
    verificationFailures: typeof summaryMetrics.verificationFailures === 'number' ? summaryMetrics.verificationFailures : 0,
    approvalInterruptions: typeof summaryMetrics.approvalInterruptions === 'number' ? summaryMetrics.approvalInterruptions : 0,
  };
}

function resolveVisualProvider(taskRun: TaskRun): TaskVisualProviderSelection | null {
  const metadata = taskRun.metadata && typeof taskRun.metadata === 'object' ? (taskRun.metadata as Record<string, unknown>) : null;
  const visualProvider = normalizeVisualProviderSelection(metadata?.visualProvider);

  if (!visualProvider) {
    return resolveVisualProviderSelection(metadata);
  }

  return visualProvider;
}

function resolveExecutionMode(taskRun: TaskRun, benchmark: BenchmarkTask): BenchmarkRunRecord['executionMode'] {
  const metadata = taskRun.metadata && typeof taskRun.metadata === 'object' ? (taskRun.metadata as Record<string, unknown>) : null;
  const metadataExecutionMode = metadata?.executionMode;
  if (metadataExecutionMode === 'dom' || metadataExecutionMode === 'visual' || metadataExecutionMode === 'hybrid') {
    return metadataExecutionMode;
  }

  const taskRouting = metadata?.taskRouting && typeof metadata.taskRouting === 'object'
    ? (metadata.taskRouting as Record<string, unknown>)
    : null;
  const routedExecutionMode = taskRouting?.executionMode;
  if (routedExecutionMode === 'dom' || routedExecutionMode === 'visual' || routedExecutionMode === 'hybrid') {
    return routedExecutionMode;
  }

  return benchmark.executionConfig?.executionMode;
}

function buildCompletedRecord(params: {
  benchmark: BenchmarkTask;
  taskRun: TaskRun;
  taskResult: TaskResult;
  startedAt?: number;
}): BenchmarkRunRecord {
  const completedAt = params.taskResult.completedAt || params.taskRun.endedAt || Date.now();
  const startedAt = params.startedAt ?? params.taskRun.startedAt ?? params.taskResult.completedAt ?? completedAt;
  const status: BenchmarkRunRecord['status'] =
    params.taskRun.status === 'completed'
      ? 'completed'
      : params.taskRun.status === 'failed'
        ? 'failed'
        : params.taskRun.status === 'cancelled'
          ? 'cancelled'
          : 'running';

  const metadata = params.taskRun.metadata && typeof params.taskRun.metadata === 'object'
    ? (params.taskRun.metadata as Record<string, unknown>)
    : null;
  const approval = metadata?.approval && typeof metadata.approval === 'object'
    ? (metadata.approval as Record<string, unknown>)
    : null;
  const visualProvider = resolveVisualProvider(params.taskRun);
  const record: BenchmarkRunRecord = {
    id: createTaskEntityId('benchmark-run'),
    benchmarkTaskId: params.benchmark.id,
    benchmarkTaskName: params.benchmark.name,
    runId: params.taskRun.id,
    source: params.taskRun.source,
    executionMode: resolveExecutionMode(params.taskRun, params.benchmark),
    adapterMode: params.benchmark.executionConfig?.adapterMode,
    visualProvider,
    taskRun: params.taskRun,
    taskResult: params.taskResult,
    status,
    startedAt,
    completedAt,
    approvalAudit: approval
      ? {
          pending: approval.pending === true,
          approved: approval.approved === true,
          reason: typeof approval.reason === 'string' ? approval.reason : undefined,
          requestedAt: typeof approval.requestedAt === 'number' ? approval.requestedAt : undefined,
          approvedAt: typeof approval.approvedAt === 'number' ? approval.approvedAt : undefined,
          matchedIntentKeywords: Array.isArray(approval.matchedIntentKeywords)
            ? approval.matchedIntentKeywords.filter((value): value is string => typeof value === 'string')
            : [],
          actionRiskReasons: Array.isArray(approval.actionRiskReasons)
            ? approval.actionRiskReasons.filter((value): value is string => typeof value === 'string')
            : [],
          actionTypes: Array.isArray(approval.actionTypes)
            ? approval.actionTypes.filter((value): value is string => typeof value === 'string')
            : [],
        }
      : undefined,
  };

  record.durationMs = completedAt - startedAt;
  return record;
}

export class BenchmarkRunService {
  evaluateCompletedRun(params: {
    benchmark: BenchmarkTask;
    taskRun: TaskRun;
    taskResult: TaskResult;
    startedAt?: number;
  }): BenchmarkRunOutcome {
    const record = buildCompletedRecord(params);
    const metrics = buildMetrics(params.taskRun, params.taskResult);
    const evaluation = evaluateBenchmarkTask({
      benchmark: params.benchmark,
      result: params.taskResult,
      metrics,
    });

    record.metrics = metrics;
    record.evaluation = evaluation;
    if (record.status === 'completed' && !evaluation.passed) {
      record.status = 'failed';
      record.error = evaluation.summary;
    }

    return {
      record,
      evaluation,
    };
  }

  private persist(record: BenchmarkRunRecord): void {
    try {
      getBenchmarkRunRepository().upsert(record);
    } catch (error) {
      console.error('[BenchmarkRunService] Failed to persist benchmark run:', error);
    }
  }

  async run(options: BenchmarkRunOptions): Promise<BenchmarkRunOutcome> {
    const startedAt = Date.now();
    const benchmarkRunId = createTaskEntityId('benchmark-run');
    const threadId = `benchmark-${options.benchmark.id}-${benchmarkRunId}`;
    const record: BenchmarkRunRecord = {
      id: benchmarkRunId,
      benchmarkTaskId: options.benchmark.id,
      benchmarkTaskName: options.benchmark.name,
      runId: '',
      source: options.source || 'scheduler',
      executionMode: options.benchmark.executionConfig?.executionMode,
      adapterMode: options.benchmark.executionConfig?.adapterMode,
      status: 'pending',
      startedAt,
    };

    const startResponse = await options.startTask({
      task: options.benchmark.prompt,
      source: options.source || 'scheduler',
      threadId,
      executionMode: options.benchmark.executionConfig?.executionMode,
      params: {
        benchmarkId: options.benchmark.id,
        benchmarkRunId,
      },
    });

    if (!startResponse.accepted || !startResponse.handle) {
      record.status = 'failed';
      record.completedAt = Date.now();
      record.durationMs = record.completedAt - startedAt;
      record.error = startResponse.error || 'Benchmark task was not accepted';
      this.persist(record);
      return { record };
    }

    record.runId = startResponse.handle;
    record.taskRun = startResponse.run || options.orchestrator.getRun(startResponse.handle) || undefined;
    record.status = 'running';

    const timeoutMs = options.timeoutMs || 10 * 60 * 1000;
    const pollIntervalMs = options.pollIntervalMs || 500;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const taskRun = options.orchestrator.getRun(record.runId);
      if (!taskRun) {
        await sleep(pollIntervalMs);
        continue;
      }

      record.taskRun = taskRun;

      if (taskRun.status === 'completed' || taskRun.status === 'failed' || taskRun.status === 'cancelled') {
        const taskResult = taskRun.resultId ? options.resultRepository.getById(taskRun.resultId) : null;
        record.taskResult = taskResult || undefined;
        record.completedAt = taskResult?.completedAt || taskRun.endedAt || Date.now();
        record.durationMs = record.completedAt - startedAt;

        if (!taskResult) {
          record.status = taskRun.status;
          record.error = `Task completed without a persisted result: ${record.runId}`;
          this.persist(record);
          return { record };
        }

        const outcome = this.evaluateCompletedRun({
          benchmark: options.benchmark,
          taskRun,
          taskResult,
          startedAt,
        });

        this.persist(outcome.record);
        return outcome;
      }

      await sleep(pollIntervalMs);
    }

    record.status = 'timeout';
    record.completedAt = Date.now();
    record.durationMs = record.completedAt - startedAt;
    record.error = `Benchmark timed out after ${timeoutMs}ms`;
    this.persist(record);
    return { record };
  }
}
