import { TaskExecutionMode } from '../task/taskRouting';
import { TaskResult, TaskRun, TaskVisualProviderSelection } from '../task/types';

export type BenchmarkTaskCategory =
  | 'browser-interaction'
  | 'data-extraction'
  | 'form-filling'
  | 'multi-step'
  | 'recovery-scenario'
  | 'approval-scenario';

export type BenchmarkAdapterMode = 'chat-structured' | 'responses-computer';

export interface BenchmarkTaskExpectedOutcome {
  successKeywords?: string[];
  minArtifacts?: number;
  structuredDataSchema?: Record<string, unknown>;
  targetUrl?: string;
}

export interface BenchmarkTaskInitialState {
  initialUrl?: string;
  cookies?: Array<Record<string, unknown>>;
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
}

export interface BenchmarkTaskExecutionConfig {
  executionMode?: TaskExecutionMode;
  maxTurns?: number;
  adapterMode?: BenchmarkAdapterMode;
}

export interface BenchmarkTask {
  id: string;
  name: string;
  description: string;
  category: BenchmarkTaskCategory;
  prompt: string;
  expectedOutcome: BenchmarkTaskExpectedOutcome;
  initialState?: BenchmarkTaskInitialState;
  executionConfig?: BenchmarkTaskExecutionConfig;
  tags?: string[];
  version?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BenchmarkTaskSet {
  id: string;
  name: string;
  description?: string;
  benchmarkIds: string[];
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export type BenchmarkSuiteRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BenchmarkSuiteRunSummary {
  total: number;
  passed: number;
  failed: number;
  timeout: number;
}

export interface BenchmarkSuiteRunRecord {
  id: string;
  benchmarkTaskSetId: string;
  benchmarkTaskSetName: string;
  status: BenchmarkSuiteRunStatus;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  summary: BenchmarkSuiteRunSummary;
  benchmarkRunIds: string[];
  benchmarkRuns: BenchmarkRunRecord[];
  error?: string;
}

export interface BenchmarkTaskRunMetrics {
  durationMs: number;
  totalTurns: number;
  actionBatches: number;
  recoveryAttempts: number;
  verificationFailures: number;
  approvalInterruptions: number;
}

export type BenchmarkRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';

export interface BenchmarkEvaluationCheck {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface BenchmarkEvaluation {
  passed: boolean;
  summary: string;
  checks: BenchmarkEvaluationCheck[];
}

export interface BenchmarkRunRecord {
  id: string;
  benchmarkTaskId: string;
  benchmarkTaskName: string;
  runId: string;
  source?: string;
  executionMode?: TaskExecutionMode;
  adapterMode?: BenchmarkAdapterMode;
  visualProvider?: TaskVisualProviderSelection | null;
  taskRun?: TaskRun;
  taskResult?: TaskResult;
  status: BenchmarkRunStatus;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  metrics?: BenchmarkTaskRunMetrics;
  approvalAudit?: {
    pending?: boolean;
    approved?: boolean;
    reason?: string;
    requestedAt?: number;
    approvedAt?: number;
    matchedIntentKeywords: string[];
    actionRiskReasons: string[];
    actionTypes: string[];
  };
  evaluation?: BenchmarkEvaluation;
  error?: string;
}

export interface BenchmarkReportEntry {
  benchmarkTaskId: string;
  benchmarkTaskName: string;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  timeoutRuns: number;
  successRate: number;
  avgDurationMs: number;
  avgRecoveryAttempts: number;
  avgVerificationFailures: number;
  avgApprovalInterruptions: number;
  executionModes: Record<string, number>;
  adapterModes: Record<string, number>;
  visualProviders: Record<string, number>;
  latestRunAt?: number;
}

export interface BenchmarkExecutionModeReportEntry {
  executionMode: string;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  timeoutRuns: number;
  successRate: number;
  avgDurationMs: number;
  avgRecoveryAttempts: number;
  avgVerificationFailures: number;
  avgApprovalInterruptions: number;
}

export interface BenchmarkAdapterModeReportEntry {
  adapterMode: string;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  timeoutRuns: number;
  successRate: number;
  avgDurationMs: number;
  avgRecoveryAttempts: number;
  avgVerificationFailures: number;
  avgApprovalInterruptions: number;
}

export interface BenchmarkReport {
  summary: {
    totalRuns: number;
    passedRuns: number;
    failedRuns: number;
    timeoutRuns: number;
    successRate: number;
    avgDurationMs: number;
    avgRecoveryAttempts: number;
    avgVerificationFailures: number;
    avgApprovalInterruptions: number;
  };
  byBenchmark: BenchmarkReportEntry[];
  byExecutionMode: BenchmarkExecutionModeReportEntry[];
  byAdapterMode: BenchmarkAdapterModeReportEntry[];
  approvalAudit: {
    totalTriggeredRuns: number;
    approvedRuns: number;
    pendingRuns: number;
    byActionType: Record<string, number>;
    byIntentKeyword: Record<string, number>;
    byRiskReason: Record<string, number>;
  };
  executionModes: Record<string, number>;
  adapterModes: Record<string, number>;
  visualProviders: Record<string, number>;
}

export interface BenchmarkTaskRunResult {
  id: string;
  benchmarkTaskId: string;
  runId: string;
  status: 'completed' | 'failed' | 'cancelled';
  evaluatedSuccess: boolean;
  evaluationReason?: string;
  metrics: BenchmarkTaskRunMetrics;
  taskResult?: TaskResult;
  completedAt: number;
}
