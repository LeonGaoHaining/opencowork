// src/scheduler/types.ts

export enum ScheduleType {
  CRON = 'cron',
  INTERVAL = 'interval',
  ONE_TIME = 'one-time',
}

export interface ScheduleConfig {
  type: ScheduleType;
  cron?: string;
  intervalMs?: number;
  startTime?: number;
}

export interface ExecutionConfig {
  taskDescription?: string;
  templateId?: string;
  input?: Record<string, unknown>;
  executionMode?: 'dom' | 'visual' | 'hybrid';
  timeout: number;
  maxRetries: number;
  retryDelayMs: number;
}

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  schedule: ScheduleConfig;
  execution: ExecutionConfig;
  lastRun?: number;
  nextRun?: number;
  lastStatus?: 'success' | 'failed' | 'cancelled';
  lastError?: string;
  lastRunId?: string;
  lastResultSummary?: string;
  lastArtifactsCount?: number;
  runCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface QueuedTask {
  id: string;
  scheduledTaskId: string;
  scheduledTask: ScheduledTask;
  priority: number;
  enqueuedAt: number;
  executeAt: number;
  retryCount: number;
}

export interface TaskExecutionResult {
  taskId: string;
  status: 'success' | 'failed' | 'cancelled';
  startTime: number;
  endTime: number;
  duration: number;
  error?: string;
  retryCount: number;
  runId?: string;
  resultSummary?: string;
  artifactsCount?: number;
}

export enum ExecutorMode {
  STANDALONE = 'standalone',
  INTEGRATED = 'integrated',
}

export interface ExecutorConfig {
  mode: ExecutorMode;
  timeout?: number;
}

export type CreateScheduledTaskInput = Omit<
  ScheduledTask,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'runCount'
  | 'lastRun'
  | 'nextRun'
  | 'lastStatus'
  | 'lastError'
  | 'lastRunId'
  | 'lastResultSummary'
  | 'lastArtifactsCount'
>;

export type UpdateScheduledTaskInput = Partial<Omit<ScheduledTask, 'id' | 'createdAt'>>;
