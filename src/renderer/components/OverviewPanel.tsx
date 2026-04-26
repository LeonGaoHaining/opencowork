import React, { useEffect, useState } from 'react';
import { useOverviewStore, OverviewMetrics } from '../stores/overviewStore';
import { useTranslation } from '../i18n/useTranslation';
import {
  resolveVisualProviderLabel,
  resolveVisualProviderSelection,
} from '../../core/visual/visualProviderMetadata';

interface OverviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type DateRangeOption = '7d' | '14d' | '30d';

type RegressionSeverity = 'warning' | 'critical';

type AcceptanceStatus = 'pass' | 'risk' | 'pending';

interface BenchmarkTaskSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  tags?: string[];
}

interface BenchmarkRunSummary {
  id: string;
  benchmarkTaskId: string;
  status: string;
  startedAt: number;
  durationMs?: number;
  evaluation?: {
    passed: boolean;
    summary: string;
  };
  error?: string;
}

interface BenchmarkRunDetail extends BenchmarkRunSummary {
  benchmarkTaskName?: string;
  runId?: string;
  taskResult?: {
    id: string;
    summary: string;
    artifacts?: Array<{ id: string; type: string; name: string; uri?: string; content?: string }>;
    rawOutput?: unknown;
  };
  taskRun?: {
    id: string;
    status: string;
    startedAt: number;
    endedAt?: number;
    source?: string;
    title?: string;
    metadata?: Record<string, unknown>;
  };
  evaluation?: {
    passed: boolean;
    summary: string;
    checks?: Array<{ id: string; label: string; passed: boolean; detail?: string }>;
  };
}

interface BenchmarkSuiteSummary {
  id: string;
  name: string;
  description?: string;
  benchmarkIds: string[];
  tags?: string[];
}

interface BenchmarkSuiteRunSummary {
  id: string;
  benchmarkTaskSetId: string;
  benchmarkTaskSetName: string;
  status: string;
  startedAt: number;
  durationMs?: number;
  summary?: { total: number; passed: number; failed: number; timeout: number };
  error?: string;
}

interface BenchmarkSuiteRunDetail extends BenchmarkSuiteRunSummary {
  benchmarkRunIds?: string[];
  benchmarkRuns?: Array<{
    id: string;
    benchmarkTaskId: string;
    benchmarkTaskName: string;
    runId: string;
    status: string;
    startedAt: number;
    durationMs?: number;
    taskRun?: {
      metadata?: Record<string, unknown>;
    };
    evaluation?: {
      passed: boolean;
      summary: string;
      checks?: Array<{ id: string; label: string; passed: boolean; detail?: string }>;
    };
    error?: string;
  }>;
}

interface BenchmarkReportState {
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
  byBenchmark: Array<{
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
  }>;
  byExecutionMode: Array<{
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
  }>;
  byAdapterMode: Array<{
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
  }>;
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

interface AcceptanceCheck {
  id: string;
  label: string;
  status: AcceptanceStatus;
  detail: string;
}

export function OverviewPanel({ isOpen, onClose }: OverviewPanelProps) {
  const { t } = useTranslation();
  const { metrics, isLoading, error, dateRange, setDateRange, loadMetrics } = useOverviewStore();
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('7d');
  const [benchmarkTasks, setBenchmarkTasks] = useState<BenchmarkTaskSummary[]>([]);
  const [benchmarkRuns, setBenchmarkRuns] = useState<BenchmarkRunSummary[]>([]);
  const [benchmarkSuites, setBenchmarkSuites] = useState<BenchmarkSuiteSummary[]>([]);
  const [benchmarkSuiteRuns, setBenchmarkSuiteRuns] = useState<BenchmarkSuiteRunSummary[]>([]);
  const [benchmarkReport, setBenchmarkReport] = useState<BenchmarkReportState | null>(null);
  const [benchmarkLoadError, setBenchmarkLoadError] = useState<string | null>(null);
  const [benchmarkRunningId, setBenchmarkRunningId] = useState<string | null>(null);
  const [benchmarkSuiteRunningId, setBenchmarkSuiteRunningId] = useState<string | null>(null);
  const [benchmarkExportingFormat, setBenchmarkExportingFormat] = useState<'json' | 'csv' | null>(null);
  const [benchmarkExportMessage, setBenchmarkExportMessage] = useState<string | null>(null);
  const [selectedBenchmarkRun, setSelectedBenchmarkRun] = useState<BenchmarkRunDetail | null>(null);
  const [selectedBenchmarkRunLoading, setSelectedBenchmarkRunLoading] = useState(false);
  const [selectedBenchmarkRunError, setSelectedBenchmarkRunError] = useState<string | null>(null);
  const [selectedBenchmarkSuiteRun, setSelectedBenchmarkSuiteRun] = useState<BenchmarkSuiteRunDetail | null>(null);
  const [selectedBenchmarkSuiteRunLoading, setSelectedBenchmarkSuiteRunLoading] = useState(false);
  const [selectedBenchmarkSuiteRunError, setSelectedBenchmarkSuiteRunError] = useState<string | null>(null);

  const loadBenchmarks = async (): Promise<void> => {
    try {
      const [taskResult, runResult, suiteResult, suiteRunResult, reportResult] = await Promise.all([
        window.electron.invoke('benchmark:list'),
        window.electron.invoke('benchmark:run:list', { limit: 20 }),
        window.electron.invoke('benchmark:suite:list'),
        window.electron.invoke('benchmark:suite-run:list', { limit: 20 }),
        window.electron.invoke('benchmark:report'),
      ]);

      if (Array.isArray(taskResult)) {
        setBenchmarkTasks(
          taskResult.map((item) => ({
            id: typeof item?.id === 'string' ? item.id : 'unknown',
            name: typeof item?.name === 'string' ? item.name : 'Unnamed benchmark',
            category: typeof item?.category === 'string' ? item.category : 'unknown',
            description: typeof item?.description === 'string' ? item.description : '',
            tags: Array.isArray(item?.tags)
              ? item.tags.filter((tag: unknown): tag is string => typeof tag === 'string')
              : undefined,
          }))
        );
      } else {
        setBenchmarkTasks([]);
      }

      if (Array.isArray(runResult)) {
        setBenchmarkRuns(
          runResult.map((item) => ({
            id: typeof item?.id === 'string' ? item.id : 'unknown',
            benchmarkTaskId: typeof item?.benchmarkTaskId === 'string' ? item.benchmarkTaskId : 'unknown',
            status: typeof item?.status === 'string' ? item.status : 'unknown',
            startedAt: typeof item?.startedAt === 'number' ? item.startedAt : Date.now(),
            durationMs: typeof item?.durationMs === 'number' ? item.durationMs : undefined,
            evaluation:
              item?.evaluation && typeof item.evaluation === 'object'
                ? {
                    passed: Boolean((item.evaluation as Record<string, unknown>).passed),
                    summary:
                      typeof (item.evaluation as Record<string, unknown>).summary === 'string'
                        ? ((item.evaluation as Record<string, unknown>).summary as string)
                        : '',
                  }
                : undefined,
            error: typeof item?.error === 'string' ? item.error : undefined,
          }))
        );
      } else {
        setBenchmarkRuns([]);
      }

      if (Array.isArray(suiteResult)) {
        setBenchmarkSuites(
          suiteResult.map((item) => ({
            id: typeof item?.id === 'string' ? item.id : 'unknown',
            name: typeof item?.name === 'string' ? item.name : 'Unnamed suite',
            description: typeof item?.description === 'string' ? item.description : undefined,
            benchmarkIds: Array.isArray(item?.benchmarkIds)
              ? item.benchmarkIds.filter((benchmarkId: unknown): benchmarkId is string => typeof benchmarkId === 'string')
              : [],
            tags: Array.isArray(item?.tags)
              ? item.tags.filter((tag: unknown): tag is string => typeof tag === 'string')
              : undefined,
          }))
        );
      } else {
        setBenchmarkSuites([]);
      }

      if (Array.isArray(suiteRunResult)) {
        setBenchmarkSuiteRuns(
          suiteRunResult.map((item) => ({
            id: typeof item?.id === 'string' ? item.id : 'unknown',
            benchmarkTaskSetId:
              typeof item?.benchmarkTaskSetId === 'string' ? item.benchmarkTaskSetId : 'unknown',
            benchmarkTaskSetName:
              typeof item?.benchmarkTaskSetName === 'string' ? item.benchmarkTaskSetName : 'Unnamed suite',
            status: typeof item?.status === 'string' ? item.status : 'unknown',
            startedAt: typeof item?.startedAt === 'number' ? item.startedAt : Date.now(),
            durationMs: typeof item?.durationMs === 'number' ? item.durationMs : undefined,
            summary:
              item?.summary && typeof item.summary === 'object'
                ? {
                    total:
                      typeof (item.summary as Record<string, unknown>).total === 'number'
                        ? ((item.summary as Record<string, unknown>).total as number)
                        : 0,
                    passed:
                      typeof (item.summary as Record<string, unknown>).passed === 'number'
                        ? ((item.summary as Record<string, unknown>).passed as number)
                        : 0,
                    failed:
                      typeof (item.summary as Record<string, unknown>).failed === 'number'
                        ? ((item.summary as Record<string, unknown>).failed as number)
                        : 0,
                    timeout:
                      typeof (item.summary as Record<string, unknown>).timeout === 'number'
                        ? ((item.summary as Record<string, unknown>).timeout as number)
                        : 0,
                  }
                : undefined,
            error: typeof item?.error === 'string' ? item.error : undefined,
          }))
        );
      } else {
        setBenchmarkSuiteRuns([]);
      }

      if (reportResult?.success && reportResult.data && typeof reportResult.data === 'object') {
        const report = reportResult.data as Record<string, unknown>;
        setBenchmarkReport({
          summary:
            report.summary && typeof report.summary === 'object'
              ? {
                  totalRuns: typeof (report.summary as Record<string, unknown>).totalRuns === 'number' ? ((report.summary as Record<string, unknown>).totalRuns as number) : 0,
                  passedRuns: typeof (report.summary as Record<string, unknown>).passedRuns === 'number' ? ((report.summary as Record<string, unknown>).passedRuns as number) : 0,
                  failedRuns: typeof (report.summary as Record<string, unknown>).failedRuns === 'number' ? ((report.summary as Record<string, unknown>).failedRuns as number) : 0,
                  timeoutRuns: typeof (report.summary as Record<string, unknown>).timeoutRuns === 'number' ? ((report.summary as Record<string, unknown>).timeoutRuns as number) : 0,
                  successRate: typeof (report.summary as Record<string, unknown>).successRate === 'number' ? ((report.summary as Record<string, unknown>).successRate as number) : 0,
                  avgDurationMs: typeof (report.summary as Record<string, unknown>).avgDurationMs === 'number' ? ((report.summary as Record<string, unknown>).avgDurationMs as number) : 0,
                  avgRecoveryAttempts: typeof (report.summary as Record<string, unknown>).avgRecoveryAttempts === 'number' ? ((report.summary as Record<string, unknown>).avgRecoveryAttempts as number) : 0,
                  avgVerificationFailures: typeof (report.summary as Record<string, unknown>).avgVerificationFailures === 'number' ? ((report.summary as Record<string, unknown>).avgVerificationFailures as number) : 0,
                  avgApprovalInterruptions: typeof (report.summary as Record<string, unknown>).avgApprovalInterruptions === 'number' ? ((report.summary as Record<string, unknown>).avgApprovalInterruptions as number) : 0,
                }
              : {
                  totalRuns: 0,
                  passedRuns: 0,
                  failedRuns: 0,
                  timeoutRuns: 0,
                  successRate: 0,
                  avgDurationMs: 0,
                  avgRecoveryAttempts: 0,
                  avgVerificationFailures: 0,
                  avgApprovalInterruptions: 0,
                },
          byBenchmark: Array.isArray(report.byBenchmark)
            ? (report.byBenchmark as Array<Record<string, unknown>>).map((entry) => ({
                benchmarkTaskId: typeof entry.benchmarkTaskId === 'string' ? entry.benchmarkTaskId : 'unknown',
                benchmarkTaskName: typeof entry.benchmarkTaskName === 'string' ? entry.benchmarkTaskName : 'Unnamed benchmark',
                totalRuns: typeof entry.totalRuns === 'number' ? entry.totalRuns : 0,
                passedRuns: typeof entry.passedRuns === 'number' ? entry.passedRuns : 0,
                failedRuns: typeof entry.failedRuns === 'number' ? entry.failedRuns : 0,
                timeoutRuns: typeof entry.timeoutRuns === 'number' ? entry.timeoutRuns : 0,
                successRate: typeof entry.successRate === 'number' ? entry.successRate : 0,
                avgDurationMs: typeof entry.avgDurationMs === 'number' ? entry.avgDurationMs : 0,
                avgRecoveryAttempts: typeof entry.avgRecoveryAttempts === 'number' ? entry.avgRecoveryAttempts : 0,
                avgVerificationFailures: typeof entry.avgVerificationFailures === 'number' ? entry.avgVerificationFailures : 0,
                avgApprovalInterruptions: typeof entry.avgApprovalInterruptions === 'number' ? entry.avgApprovalInterruptions : 0,
                executionModes: entry.executionModes && typeof entry.executionModes === 'object' ? (entry.executionModes as Record<string, number>) : {},
                adapterModes: entry.adapterModes && typeof entry.adapterModes === 'object' ? (entry.adapterModes as Record<string, number>) : {},
                visualProviders:
                  entry.visualProviders && typeof entry.visualProviders === 'object'
                    ? (entry.visualProviders as Record<string, number>)
                    : {},
                latestRunAt: typeof entry.latestRunAt === 'number' ? entry.latestRunAt : undefined,
              }))
            : [],
          byExecutionMode: Array.isArray(report.byExecutionMode)
            ? (report.byExecutionMode as Array<Record<string, unknown>>).map((entry) => ({
                executionMode: typeof entry.executionMode === 'string' ? entry.executionMode : 'unknown',
                totalRuns: typeof entry.totalRuns === 'number' ? entry.totalRuns : 0,
                passedRuns: typeof entry.passedRuns === 'number' ? entry.passedRuns : 0,
                failedRuns: typeof entry.failedRuns === 'number' ? entry.failedRuns : 0,
                timeoutRuns: typeof entry.timeoutRuns === 'number' ? entry.timeoutRuns : 0,
                successRate: typeof entry.successRate === 'number' ? entry.successRate : 0,
                avgDurationMs: typeof entry.avgDurationMs === 'number' ? entry.avgDurationMs : 0,
                avgRecoveryAttempts: typeof entry.avgRecoveryAttempts === 'number' ? entry.avgRecoveryAttempts : 0,
                avgVerificationFailures:
                  typeof entry.avgVerificationFailures === 'number' ? entry.avgVerificationFailures : 0,
                avgApprovalInterruptions:
                  typeof entry.avgApprovalInterruptions === 'number' ? entry.avgApprovalInterruptions : 0,
              }))
            : [],
          byAdapterMode: Array.isArray(report.byAdapterMode)
            ? (report.byAdapterMode as Array<Record<string, unknown>>).map((entry) => ({
                adapterMode: typeof entry.adapterMode === 'string' ? entry.adapterMode : 'unknown',
                totalRuns: typeof entry.totalRuns === 'number' ? entry.totalRuns : 0,
                passedRuns: typeof entry.passedRuns === 'number' ? entry.passedRuns : 0,
                failedRuns: typeof entry.failedRuns === 'number' ? entry.failedRuns : 0,
                timeoutRuns: typeof entry.timeoutRuns === 'number' ? entry.timeoutRuns : 0,
                successRate: typeof entry.successRate === 'number' ? entry.successRate : 0,
                avgDurationMs: typeof entry.avgDurationMs === 'number' ? entry.avgDurationMs : 0,
                avgRecoveryAttempts: typeof entry.avgRecoveryAttempts === 'number' ? entry.avgRecoveryAttempts : 0,
                avgVerificationFailures:
                  typeof entry.avgVerificationFailures === 'number' ? entry.avgVerificationFailures : 0,
                avgApprovalInterruptions:
                  typeof entry.avgApprovalInterruptions === 'number' ? entry.avgApprovalInterruptions : 0,
              }))
            : [],
          approvalAudit:
            report.approvalAudit && typeof report.approvalAudit === 'object'
              ? {
                  totalTriggeredRuns:
                    typeof (report.approvalAudit as Record<string, unknown>).totalTriggeredRuns === 'number'
                      ? ((report.approvalAudit as Record<string, unknown>).totalTriggeredRuns as number)
                      : 0,
                  approvedRuns:
                    typeof (report.approvalAudit as Record<string, unknown>).approvedRuns === 'number'
                      ? ((report.approvalAudit as Record<string, unknown>).approvedRuns as number)
                      : 0,
                  pendingRuns:
                    typeof (report.approvalAudit as Record<string, unknown>).pendingRuns === 'number'
                      ? ((report.approvalAudit as Record<string, unknown>).pendingRuns as number)
                      : 0,
                  byActionType:
                    (report.approvalAudit as Record<string, unknown>).byActionType &&
                    typeof (report.approvalAudit as Record<string, unknown>).byActionType === 'object'
                      ? ((report.approvalAudit as Record<string, unknown>).byActionType as Record<string, number>)
                      : {},
                  byIntentKeyword:
                    (report.approvalAudit as Record<string, unknown>).byIntentKeyword &&
                    typeof (report.approvalAudit as Record<string, unknown>).byIntentKeyword === 'object'
                      ? ((report.approvalAudit as Record<string, unknown>).byIntentKeyword as Record<string, number>)
                      : {},
                  byRiskReason:
                    (report.approvalAudit as Record<string, unknown>).byRiskReason &&
                    typeof (report.approvalAudit as Record<string, unknown>).byRiskReason === 'object'
                      ? ((report.approvalAudit as Record<string, unknown>).byRiskReason as Record<string, number>)
                      : {},
                }
              : {
                  totalTriggeredRuns: 0,
                  approvedRuns: 0,
                  pendingRuns: 0,
                  byActionType: {},
                  byIntentKeyword: {},
                  byRiskReason: {},
                },
          executionModes:
            report.executionModes && typeof report.executionModes === 'object'
              ? (report.executionModes as Record<string, number>)
              : {},
          adapterModes:
            report.adapterModes && typeof report.adapterModes === 'object'
              ? (report.adapterModes as Record<string, number>)
              : {},
          visualProviders:
            report.visualProviders && typeof report.visualProviders === 'object'
              ? (report.visualProviders as Record<string, number>)
              : {},
        });
      } else {
        setBenchmarkReport(null);
      }

      setBenchmarkLoadError(null);
    } catch (loadError: unknown) {
      console.error('[OverviewPanel] benchmark load error:', loadError);
      setBenchmarkTasks([]);
      setBenchmarkRuns([]);
      setBenchmarkLoadError('Failed to load benchmarks');
    }
  };

  const handleRunBenchmark = async (benchmarkId: string) => {
    setBenchmarkRunningId(benchmarkId);
    try {
      await window.electron.invoke('benchmark:run', {
        benchmarkId,
        timeoutMs: 5 * 60 * 1000,
        pollIntervalMs: 500,
      });
      await loadBenchmarks();
    } catch (runError) {
      console.error('[OverviewPanel] benchmark:run error:', runError);
      setBenchmarkLoadError('Failed to run benchmark');
    } finally {
      setBenchmarkRunningId(null);
    }
  };

  const handleRunBenchmarkSuite = async (suiteId: string) => {
    setBenchmarkSuiteRunningId(suiteId);
    try {
      await window.electron.invoke('benchmark:suite:run', {
        suiteId,
        timeoutMs: 15 * 60 * 1000,
        pollIntervalMs: 500,
      });
      await loadBenchmarks();
    } catch (runError) {
      console.error('[OverviewPanel] benchmark:suite:run error:', runError);
      setBenchmarkLoadError('Failed to run benchmark suite');
    } finally {
      setBenchmarkSuiteRunningId(null);
    }
  };

  const handleExportBenchmarkReport = async (format: 'json' | 'csv') => {
    setBenchmarkExportingFormat(format);
    setBenchmarkExportMessage(null);
    try {
      const result = await window.electron.invoke('benchmark:report:export', { format });
      if (!result?.success || !result?.data?.path) {
        throw new Error(result?.error || 'Failed to export benchmark report');
      }

      setBenchmarkExportMessage(`Exported ${format.toUpperCase()} report: ${result.data.fileName}`);
      await window.electron.invoke('artifact:open', { uri: result.data.path });
    } catch (exportError: any) {
      console.error('[OverviewPanel] benchmark:report:export error:', exportError);
      setBenchmarkExportMessage(exportError?.message || 'Failed to export benchmark report');
    } finally {
      setBenchmarkExportingFormat(null);
    }
  };

  const handleViewBenchmarkRun = async (runId: string) => {
    setSelectedBenchmarkRunLoading(true);
    setSelectedBenchmarkRunError(null);
    try {
      const result = await window.electron.invoke('benchmark:run:get', { runId });
      if (!result || typeof result !== 'object') {
        throw new Error('Benchmark run not found');
      }

      setSelectedBenchmarkRun({
        id: typeof result.id === 'string' ? result.id : runId,
        benchmarkTaskId:
          typeof result.benchmarkTaskId === 'string' ? result.benchmarkTaskId : 'unknown',
        benchmarkTaskName:
          typeof result.benchmarkTaskName === 'string' ? result.benchmarkTaskName : undefined,
        runId: typeof result.runId === 'string' ? result.runId : undefined,
        status: typeof result.status === 'string' ? result.status : 'unknown',
        startedAt: typeof result.startedAt === 'number' ? result.startedAt : Date.now(),
        durationMs: typeof result.durationMs === 'number' ? result.durationMs : undefined,
        evaluation:
          result.evaluation && typeof result.evaluation === 'object'
            ? {
                passed: Boolean((result.evaluation as Record<string, unknown>).passed),
                summary:
                  typeof (result.evaluation as Record<string, unknown>).summary === 'string'
                    ? ((result.evaluation as Record<string, unknown>).summary as string)
                    : '',
                checks: Array.isArray((result.evaluation as Record<string, unknown>).checks)
                  ? ((result.evaluation as Record<string, unknown>).checks as Array<Record<string, unknown>>).map((check) => ({
                      id: typeof check.id === 'string' ? check.id : 'unknown',
                      label: typeof check.label === 'string' ? check.label : 'check',
                      passed: Boolean(check.passed),
                      detail: typeof check.detail === 'string' ? check.detail : undefined,
                    }))
                  : undefined,
              }
            : undefined,
        error: typeof result.error === 'string' ? result.error : undefined,
        taskResult:
          result.taskResult && typeof result.taskResult === 'object'
            ? {
                id:
                  typeof (result.taskResult as Record<string, unknown>).id === 'string'
                    ? ((result.taskResult as Record<string, unknown>).id as string)
                    : 'unknown',
                summary:
                  typeof (result.taskResult as Record<string, unknown>).summary === 'string'
                    ? ((result.taskResult as Record<string, unknown>).summary as string)
                    : '',
                artifacts: Array.isArray((result.taskResult as Record<string, unknown>).artifacts)
                  ? ((result.taskResult as Record<string, unknown>).artifacts as Array<Record<string, unknown>>).map((artifact) => ({
                      id: typeof artifact.id === 'string' ? artifact.id : 'unknown',
                      type: typeof artifact.type === 'string' ? artifact.type : 'text',
                      name: typeof artifact.name === 'string' ? artifact.name : 'artifact',
                      uri: typeof artifact.uri === 'string' ? artifact.uri : undefined,
                      content: typeof artifact.content === 'string' ? artifact.content : undefined,
                    }))
                  : undefined,
                rawOutput: (result.taskResult as Record<string, unknown>).rawOutput,
              }
            : undefined,
        taskRun:
          result.taskRun && typeof result.taskRun === 'object'
            ? {
                id:
                  typeof (result.taskRun as Record<string, unknown>).id === 'string'
                    ? ((result.taskRun as Record<string, unknown>).id as string)
                    : runId,
                status:
                  typeof (result.taskRun as Record<string, unknown>).status === 'string'
                    ? ((result.taskRun as Record<string, unknown>).status as string)
                    : 'unknown',
                startedAt:
                  typeof (result.taskRun as Record<string, unknown>).startedAt === 'number'
                    ? ((result.taskRun as Record<string, unknown>).startedAt as number)
                    : Date.now(),
                endedAt:
                  typeof (result.taskRun as Record<string, unknown>).endedAt === 'number'
                    ? ((result.taskRun as Record<string, unknown>).endedAt as number)
                    : undefined,
                source:
                  typeof (result.taskRun as Record<string, unknown>).source === 'string'
                    ? ((result.taskRun as Record<string, unknown>).source as string)
                    : undefined,
                title:
                  typeof (result.taskRun as Record<string, unknown>).title === 'string'
                    ? ((result.taskRun as Record<string, unknown>).title as string)
                    : undefined,
                metadata:
                  (result.taskRun as Record<string, unknown>).metadata &&
                  typeof (result.taskRun as Record<string, unknown>).metadata === 'object'
                    ? ((result.taskRun as Record<string, unknown>).metadata as Record<string, unknown>)
                    : undefined,
              }
            : undefined,
      });
    } catch (viewError) {
      console.error('[OverviewPanel] benchmark:run:get error:', viewError);
      setSelectedBenchmarkRun(null);
      setSelectedBenchmarkRunError('Failed to load benchmark run details');
    } finally {
      setSelectedBenchmarkRunLoading(false);
    }
  };

  const handleViewBenchmarkSuiteRun = async (runId: string) => {
    setSelectedBenchmarkSuiteRunLoading(true);
    setSelectedBenchmarkSuiteRunError(null);
    try {
      const result = await window.electron.invoke('benchmark:suite-run:get', { runId });
      if (!result || typeof result !== 'object') {
        throw new Error('Benchmark suite run not found');
      }

      setSelectedBenchmarkSuiteRun({
        id: typeof result.id === 'string' ? result.id : runId,
        benchmarkTaskSetId:
          typeof result.benchmarkTaskSetId === 'string' ? result.benchmarkTaskSetId : 'unknown',
        benchmarkTaskSetName:
          typeof result.benchmarkTaskSetName === 'string' ? result.benchmarkTaskSetName : 'Unnamed suite',
        status: typeof result.status === 'string' ? result.status : 'unknown',
        startedAt: typeof result.startedAt === 'number' ? result.startedAt : Date.now(),
        durationMs: typeof result.durationMs === 'number' ? result.durationMs : undefined,
        summary:
          result.summary && typeof result.summary === 'object'
            ? {
                total:
                  typeof (result.summary as Record<string, unknown>).total === 'number'
                    ? ((result.summary as Record<string, unknown>).total as number)
                    : 0,
                passed:
                  typeof (result.summary as Record<string, unknown>).passed === 'number'
                    ? ((result.summary as Record<string, unknown>).passed as number)
                    : 0,
                failed:
                  typeof (result.summary as Record<string, unknown>).failed === 'number'
                    ? ((result.summary as Record<string, unknown>).failed as number)
                    : 0,
                timeout:
                  typeof (result.summary as Record<string, unknown>).timeout === 'number'
                    ? ((result.summary as Record<string, unknown>).timeout as number)
                    : 0,
              }
            : undefined,
        benchmarkRunIds: Array.isArray(result.benchmarkRunIds)
          ? result.benchmarkRunIds.filter((id: unknown): id is string => typeof id === 'string')
          : undefined,
        benchmarkRuns: Array.isArray(result.benchmarkRuns)
          ? result.benchmarkRuns
              .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
              .map((item: Record<string, unknown>) => ({
                id: typeof item.id === 'string' ? item.id : 'unknown',
                benchmarkTaskId:
                  typeof item.benchmarkTaskId === 'string' ? item.benchmarkTaskId : 'unknown',
                benchmarkTaskName:
                  typeof item.benchmarkTaskName === 'string' ? item.benchmarkTaskName : 'Unnamed benchmark',
                runId: typeof item.runId === 'string' ? item.runId : 'unknown',
                status: typeof item.status === 'string' ? item.status : 'unknown',
                startedAt: typeof item.startedAt === 'number' ? item.startedAt : Date.now(),
                durationMs: typeof item.durationMs === 'number' ? item.durationMs : undefined,
                evaluation:
                  item.evaluation && typeof item.evaluation === 'object'
                    ? {
                        passed: Boolean((item.evaluation as Record<string, unknown>).passed),
                        summary:
                          typeof (item.evaluation as Record<string, unknown>).summary === 'string'
                            ? ((item.evaluation as Record<string, unknown>).summary as string)
                            : '',
                        checks: Array.isArray((item.evaluation as Record<string, unknown>).checks)
                          ? ((item.evaluation as Record<string, unknown>).checks as Array<Record<string, unknown>>).map((check) => ({
                              id: typeof check.id === 'string' ? check.id : 'unknown',
                              label: typeof check.label === 'string' ? check.label : 'check',
                              passed: Boolean(check.passed),
                              detail: typeof check.detail === 'string' ? check.detail : undefined,
                            }))
                          : undefined,
                      }
                    : undefined,
                error: typeof item.error === 'string' ? item.error : undefined,
              }))
          : undefined,
        error: typeof result.error === 'string' ? result.error : undefined,
      });
    } catch (viewError) {
      console.error('[OverviewPanel] benchmark:suite-run:get error:', viewError);
      setSelectedBenchmarkSuiteRun(null);
      setSelectedBenchmarkSuiteRunError('Failed to load benchmark suite run details');
    } finally {
      setSelectedBenchmarkSuiteRunLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number): string => new Date(timestamp).toLocaleString();

  const renderJson = (value: unknown): string => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadMetrics();
      void loadBenchmarks();
    }
  }, [isOpen, dateRange]);

  const handleDateRangeChange = (option: DateRangeOption) => {
    setDateRangeOption(option);
    const now = Date.now();
    let start: number;
    switch (option) {
      case '7d':
        start = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '14d':
        start = now - 14 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        start = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }
    setDateRange({ start, end: now });
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  const getSuiteRunSuccessRate = (run: BenchmarkSuiteRunSummary): number | null => {
    if (!run.summary || run.summary.total <= 0) {
      return null;
    }

    return Math.round((run.summary.passed / run.summary.total) * 1000) / 10;
  };

  const getSuiteTrendPoints = (suiteId: string): number[] => {
    return benchmarkSuiteRuns
      .filter((run) => run.benchmarkTaskSetId === suiteId)
      .sort((a, b) => a.startedAt - b.startedAt)
      .slice(-5)
      .map((run) => getSuiteRunSuccessRate(run))
      .filter((value): value is number => value !== null);
  };

  const getSuiteTrendDelta = (suiteId: string): number | null => {
    const recentRuns = benchmarkSuiteRuns
      .filter((run) => run.benchmarkTaskSetId === suiteId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 2);

    if (recentRuns.length < 2) {
      return null;
    }

    const latest = getSuiteRunSuccessRate(recentRuns[0]);
    const previous = getSuiteRunSuccessRate(recentRuns[1]);
    if (latest === null || previous === null) {
      return null;
    }

    return Math.round((latest - previous) * 10) / 10;
  };

  const getRegressionSeverity = (delta: number): RegressionSeverity | null => {
    if (delta <= -20) {
      return 'critical';
    }
    if (delta <= -10) {
      return 'warning';
    }

    return null;
  };

  const getRegressionTextClass = (severity: RegressionSeverity | null): string => {
    if (severity === 'critical') {
      return 'text-error';
    }
    if (severity === 'warning') {
      return 'text-warning';
    }

    return 'text-text-secondary';
  };

  const getRegressionContainerClass = (severity: RegressionSeverity | null): string => {
    if (severity === 'critical') {
      return 'border-error/30 bg-error/10';
    }
    if (severity === 'warning') {
      return 'border-warning/30 bg-warning/10';
    }

    return 'border-border bg-surface';
  };

  const getBenchmarkRunScore = (run: BenchmarkRunSummary): number =>
    run.status === 'completed' && run.evaluation?.passed ? 100 : 0;

  const getBenchmarkTrendPoints = (benchmarkId: string): number[] => {
    return benchmarkRuns
      .filter((run) => run.benchmarkTaskId === benchmarkId)
      .sort((a, b) => a.startedAt - b.startedAt)
      .slice(-5)
      .map((run) => getBenchmarkRunScore(run));
  };

  const getBenchmarkTrendDelta = (benchmarkId: string): number | null => {
    const recentRuns = benchmarkRuns
      .filter((run) => run.benchmarkTaskId === benchmarkId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 2);

    if (recentRuns.length < 2) {
      return null;
    }

    return getBenchmarkRunScore(recentRuns[0]) - getBenchmarkRunScore(recentRuns[1]);
  };

  const suiteRegressionSummary = benchmarkSuites
    .map((suite) => ({
      suiteId: suite.id,
      suiteName: suite.name,
      delta: getSuiteTrendDelta(suite.id),
      severity: getRegressionSeverity(getSuiteTrendDelta(suite.id) || 0),
    }))
    .filter(
      (entry): entry is { suiteId: string; suiteName: string; delta: number; severity: RegressionSeverity } =>
        entry.delta !== null && entry.severity !== null
    )
    .sort((a, b) => a.delta - b.delta);

  const benchmarkRegressionSummary = benchmarkTasks
    .map((task) => ({
      benchmarkId: task.id,
      benchmarkName: task.name,
      delta: getBenchmarkTrendDelta(task.id),
      severity: getRegressionSeverity(getBenchmarkTrendDelta(task.id) || 0),
    }))
    .filter(
      (entry): entry is { benchmarkId: string; benchmarkName: string; delta: number; severity: RegressionSeverity } =>
        entry.delta !== null && entry.severity !== null
    )
    .sort((a, b) => a.delta - b.delta);

  const benchmarkModeComparison = benchmarkReport?.byExecutionMode || [];
  const getModeEntry = (mode: string) => benchmarkModeComparison.find((entry) => entry.executionMode === mode);
  const benchmarkAdapterComparison = benchmarkReport?.byAdapterMode || [];
  const getAdapterEntry = (mode: string) =>
    benchmarkAdapterComparison.find((entry) => entry.adapterMode === mode);
  const benchmarkProviderDistribution = benchmarkReport?.visualProviders || {};
  const hybridEntry = getModeEntry('hybrid');
  const domEntry = getModeEntry('dom');
  const visualEntry = getModeEntry('visual');
  const adapterEntries = benchmarkAdapterComparison.filter((entry) => entry.adapterMode !== 'unknown');
  const totalApprovalReviewedRuns = (benchmarkReport?.approvalAudit.approvedRuns || 0) + (benchmarkReport?.approvalAudit.pendingRuns || 0);
  const benchmarkRegressionCount = benchmarkRegressionSummary.length;
  const suiteRegressionCount = suiteRegressionSummary.length;

  const p1AcceptanceChecks: AcceptanceCheck[] = [
    (() => {
      if (!hybridEntry || !domEntry || hybridEntry.totalRuns === 0 || domEntry.totalRuns === 0) {
        return {
          id: 'hybrid-vs-dom',
          label: 'Hybrid routing effectiveness',
          status: 'pending',
          detail: 'Need both DOM and Hybrid benchmark runs to compare completion rate.',
        };
      }

      if (hybridEntry.successRate > domEntry.successRate) {
        return {
          id: 'hybrid-vs-dom',
          label: 'Hybrid routing effectiveness',
          status: 'pass',
          detail: `Hybrid ${hybridEntry.successRate}% vs DOM ${domEntry.successRate}% success rate.`,
        };
      }

      return {
        id: 'hybrid-vs-dom',
        label: 'Hybrid routing effectiveness',
        status: 'risk',
        detail: `Hybrid ${hybridEntry.successRate}% is not above DOM ${domEntry.successRate}%.`,
      };
    })(),
    (() => {
      if (!hybridEntry) {
        return {
          id: 'recovery-coverage',
          label: 'Recovery evidence',
          status: 'pending',
          detail: 'Need hybrid benchmark runs to measure recovery attempts and verification failures.',
        };
      }

      if (hybridEntry.avgRecoveryAttempts > 0 || hybridEntry.avgVerificationFailures > 0 || (visualEntry?.avgRecoveryAttempts || 0) > 0) {
        return {
          id: 'recovery-coverage',
          label: 'Recovery evidence',
          status: 'pass',
          detail: `Hybrid recovery avg ${hybridEntry.avgRecoveryAttempts}, verification failures avg ${hybridEntry.avgVerificationFailures}.`,
        };
      }

      return {
        id: 'recovery-coverage',
        label: 'Recovery evidence',
        status: 'risk',
        detail: 'Recovery path exists, but benchmark data has not yet shown meaningful recovery activity.',
      };
    })(),
    (() => {
      if (!benchmarkReport || benchmarkReport.approvalAudit.totalTriggeredRuns === 0) {
        return {
          id: 'approval-audit',
          label: 'Approval coverage audit',
          status: 'pending',
          detail: 'No benchmark runs have triggered approval checkpoints yet.',
        };
      }

      if (totalApprovalReviewedRuns === benchmarkReport.approvalAudit.totalTriggeredRuns) {
        return {
          id: 'approval-audit',
          label: 'Approval coverage audit',
          status: 'pass',
          detail: `${benchmarkReport.approvalAudit.totalTriggeredRuns} triggered runs recorded with approval outcome metadata.`,
        };
      }

      return {
        id: 'approval-audit',
        label: 'Approval coverage audit',
        status: 'risk',
        detail: `${benchmarkReport.approvalAudit.totalTriggeredRuns} triggered runs found, but only ${totalApprovalReviewedRuns} have explicit approval outcome metadata.`,
      };
    })(),
    (() => {
      if (adapterEntries.length < 2) {
        return {
          id: 'adapter-comparison',
          label: 'Adapter comparison coverage',
          status: 'pending',
          detail: 'Need benchmark data from both chat-structured and responses-computer adapters.',
        };
      }

      const unstableAdapters = adapterEntries.filter((entry) => entry.successRate < 50);
      if (unstableAdapters.length === 0) {
        return {
          id: 'adapter-comparison',
          label: 'Adapter comparison coverage',
          status: 'pass',
          detail: adapterEntries
            .map((entry) => `${entry.adapterMode} ${entry.successRate}%`)
            .join(' / '),
        };
      }

      return {
        id: 'adapter-comparison',
        label: 'Adapter comparison coverage',
        status: 'risk',
        detail: `Low-performing adapters: ${unstableAdapters.map((entry) => `${entry.adapterMode} ${entry.successRate}%`).join(', ')}.`,
      };
    })(),
    (() => {
      if (benchmarkRegressionCount === 0 && suiteRegressionCount === 0) {
        return {
          id: 'regression-monitoring',
          label: 'Regression monitoring',
          status: 'pass',
          detail: 'No benchmark or suite regressions currently detected above configured thresholds.',
        };
      }

      return {
        id: 'regression-monitoring',
        label: 'Regression monitoring',
        status: 'risk',
        detail: `${benchmarkRegressionCount} benchmark regressions and ${suiteRegressionCount} suite regressions currently flagged.`,
      };
    })(),
  ];

  const p1PassCount = p1AcceptanceChecks.filter((check) => check.status === 'pass').length;
  const p1RiskCount = p1AcceptanceChecks.filter((check) => check.status === 'risk').length;
  const p1PendingCount = p1AcceptanceChecks.filter((check) => check.status === 'pending').length;

  const getAcceptanceStatusClass = (status: AcceptanceStatus): string => {
    if (status === 'pass') {
      return 'text-success';
    }
    if (status === 'risk') {
      return 'text-error';
    }
    return 'text-warning';
  };

  const getAcceptanceStatusLabel = (status: AcceptanceStatus): string => {
    if (status === 'pass') {
      return 'Pass';
    }
    if (status === 'risk') {
      return 'Risk';
    }
    return 'Pending';
  };

  const summary = metrics?.summary || {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    runningTasks: 0,
    successRate: 0,
    avgDurationMs: 0,
    totalDurationMs: 0,
  };
  const schedulerStats = metrics?.schedulerStats || { totalSchedules: 0, activeSchedules: 0 };
  const imStats = metrics?.imStats || { total: 0, pending: 0, completed: 0, failed: 0 };
  const visualStats = metrics?.visualStats || {
    totalRuns: 0,
    completedRuns: 0,
    successRate: 0,
    recoveredRuns: 0,
    approvalInterruptions: 0,
    verificationFailures: 0,
    recoveryAttempts: 0,
    triggerDistribution: {},
  };
  const sourceStats = metrics?.sourceStats || {};
  const dailyStatsArray = metrics
    ? Object.entries(metrics?.dailyStats || {}).map(([date, stats]) => ({
        date,
        ...stats,
      }))
    : [];

  const maxDailyTotal = Math.max(...dailyStatsArray.map((d) => d.total), 1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-[900px] max-h-[85vh] overflow-hidden rounded-xl border border-border bg-surface shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-white">{t('overview.title', '概览')}</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-elevated rounded-lg p-1">
              {(['7d', '14d', '30d'] as DateRangeOption[]).map((option) => (
                <button
                  key={option}
                  onClick={() => handleDateRangeChange(option)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    dateRangeOption === option
                      ? 'bg-primary text-white'
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  {option === '7d' ? '7天' : option === '14d' ? '14天' : '30天'}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-text-muted hover:bg-border hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && !metrics && (
            <div className="flex items-center justify-center h-64">
              <div className="text-text-muted">{t('common.loading', '加载中...')}</div>
            </div>
          )}

          {error && !metrics && (
            <div className="flex items-center justify-center h-64">
              <div className="text-error">{error}</div>
            </div>
          )}

          {metrics && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  label={t('overview.totalTasks', '总任务数')}
                  value={summary.totalTasks}
                  color="info"
                />
                <MetricCard
                  label={t('overview.completed', '已完成')}
                  value={summary.completedTasks}
                  color="success"
                />
                <MetricCard
                  label={t('overview.failed', '已失败')}
                  value={summary.failedTasks}
                  color="error"
                />
                <MetricCard
                  label={t('overview.successRate', '成功率')}
                  value={`${summary.successRate}%`}
                  color={summary.successRate >= 80 ? 'success' : summary.successRate >= 50 ? 'warning' : 'error'}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <MetricCard
                  label={t('overview.avgDuration', '平均耗时')}
                  value={formatDuration(summary.avgDurationMs)}
                  color="info"
                />
                <MetricCard
                  label={t('overview.totalDuration', '总耗时')}
                  value={formatDuration(summary.totalDurationMs)}
                  color="info"
                />
                <MetricCard
                  label={t('overview.running', '进行中')}
                  value={summary.runningTasks}
                  color="warning"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-elevated rounded-xl p-4">
                  <h3 className="text-sm font-medium text-text-secondary mb-3">
                    {t('overview.scheduler', '调度任务')}
                  </h3>
                  <div className="flex gap-6">
                    <div>
                        <div className="text-2xl font-bold text-white">
                         {schedulerStats.totalSchedules}
                        </div>
                      <div className="text-xs text-text-muted">{t('overview.total', '总数')}</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-success">
                         {schedulerStats.activeSchedules}
                        </div>
                      <div className="text-xs text-text-muted">{t('overview.active', '活跃')}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-elevated rounded-xl p-4">
                  <h3 className="text-sm font-medium text-text-secondary mb-3">
                    {t('overview.imTasks', 'IM 任务')}
                  </h3>
                  <div className="flex gap-4">
                    <div>
                       <div className="text-2xl font-bold text-white">{imStats.total}</div>
                      <div className="text-xs text-text-muted">{t('overview.total', '总数')}</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-success">
                         {imStats.completed}
                      </div>
                      <div className="text-xs text-text-muted">{t('overview.completed', '完成')}</div>
                    </div>
                    <div>
                       <div className="text-2xl font-bold text-error">{imStats.failed}</div>
                      <div className="text-xs text-text-muted">{t('overview.failed', '失败')}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-elevated rounded-xl p-4">
                <h3 className="text-sm font-medium text-text-secondary mb-3">
                  Hybrid / Visual benchmark
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard label="Visual runs" value={visualStats.totalRuns} color="info" />
                  <MetricCard label="Visual success" value={`${visualStats.successRate}%`} color={visualStats.successRate >= 80 ? 'success' : visualStats.successRate >= 50 ? 'warning' : 'error'} />
                  <MetricCard label="Recovered runs" value={visualStats.recoveredRuns} color="warning" />
                  <MetricCard label="Verification failures" value={visualStats.verificationFailures} color="error" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  <MetricCard label="Approval interruptions" value={visualStats.approvalInterruptions} color="warning" />
                  <MetricCard label="Recovery attempts" value={visualStats.recoveryAttempts} color="info" />
                  <MetricCard label="Completed visual runs" value={visualStats.completedRuns} color="success" />
                </div>
                <div className="mt-4">
                  <div className="text-xs text-text-muted mb-2">Recovery trigger distribution</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(visualStats.triggerDistribution).length === 0 ? (
                      <div className="text-sm text-text-muted">{t('overview.noData', '暂无数据')}</div>
                    ) : (
                      Object.entries(visualStats.triggerDistribution)
                        .sort(([, a], [, b]) => b - a)
                        .map(([trigger, count]) => (
                          <div key={trigger} className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-lg">
                            <span className="text-xs text-text-muted">{trigger}</span>
                            <span className="text-sm font-medium text-white">{count}</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-elevated rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-medium text-text-secondary">P1 acceptance summary</h3>
                  <div className="text-xs text-text-muted">{p1PassCount}/{p1AcceptanceChecks.length} passed</div>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <MetricCard label="Passed" value={p1PassCount} color="success" />
                  <MetricCard label="Risks" value={p1RiskCount} color="error" />
                  <MetricCard label="Pending" value={p1PendingCount} color="warning" />
                </div>
                <div className="space-y-2">
                  {p1AcceptanceChecks.map((check) => (
                    <div key={check.id} className="rounded-lg bg-surface px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-white">{check.label}</div>
                        <div className={`text-xs font-medium ${getAcceptanceStatusClass(check.status)}`}>
                          {getAcceptanceStatusLabel(check.status)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-text-muted">{check.detail}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-elevated rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-medium text-text-secondary">Benchmark report</h3>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-text-muted">{benchmarkReport?.summary.totalRuns || 0} runs</div>
                    <button
                      type="button"
                      onClick={() => {
                        void handleExportBenchmarkReport('json');
                      }}
                      disabled={benchmarkExportingFormat !== null}
                      className="rounded-md bg-border px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-border/80 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {benchmarkExportingFormat === 'json' ? 'Exporting...' : 'Export JSON'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleExportBenchmarkReport('csv');
                      }}
                      disabled={benchmarkExportingFormat !== null}
                      className="rounded-md bg-border px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-border/80 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {benchmarkExportingFormat === 'csv' ? 'Exporting...' : 'Export CSV'}
                    </button>
                  </div>
                </div>
                {benchmarkExportMessage && (
                  <div className="mb-3 text-xs text-text-muted">{benchmarkExportMessage}</div>
                )}
                {!benchmarkReport ? (
                  <div className="text-sm text-text-muted">{t('overview.noData', '暂无数据')}</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <MetricCard label="Success rate" value={`${benchmarkReport.summary.successRate}%`} color={benchmarkReport.summary.successRate >= 80 ? 'success' : benchmarkReport.summary.successRate >= 50 ? 'warning' : 'error'} />
                      <MetricCard label="Avg duration" value={formatDuration(benchmarkReport.summary.avgDurationMs)} color="info" />
                      <MetricCard label="Avg recovery" value={benchmarkReport.summary.avgRecoveryAttempts} color="warning" />
                      <MetricCard label="Avg verification failures" value={benchmarkReport.summary.avgVerificationFailures} color="error" />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 mt-4">
                      <div>
                        <div className="text-xs text-text-muted mb-2">Execution mode distribution</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(benchmarkReport.executionModes).length === 0 ? (
                            <div className="text-sm text-text-muted">{t('overview.noData', '暂无数据')}</div>
                          ) : (
                            Object.entries(benchmarkReport.executionModes)
                              .sort(([, a], [, b]) => b - a)
                              .map(([mode, count]) => (
                                <div key={mode} className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-lg">
                                  <span className="text-xs text-text-muted">{mode}</span>
                                  <span className="text-sm font-medium text-white">{count}</span>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-text-muted mb-2">Adapter mode distribution</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(benchmarkReport.adapterModes).length === 0 ? (
                            <div className="text-sm text-text-muted">{t('overview.noData', '暂无数据')}</div>
                          ) : (
                            Object.entries(benchmarkReport.adapterModes)
                              .sort(([, a], [, b]) => b - a)
                              .map(([mode, count]) => (
                                <div key={mode} className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-lg">
                                  <span className="text-xs text-text-muted">{mode}</span>
                                  <span className="text-sm font-medium text-white">{count}</span>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="text-xs text-text-muted mb-2">Visual provider distribution</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(benchmarkProviderDistribution).length === 0 ? (
                          <div className="text-sm text-text-muted">{t('overview.noData', '暂无数据')}</div>
                        ) : (
                          Object.entries(benchmarkProviderDistribution)
                            .sort(([, a], [, b]) => b - a)
                            .map(([providerId, count]) => (
                              <div key={providerId} className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-lg">
                                <span className="text-xs text-text-muted">{providerId}</span>
                                <span className="text-sm font-medium text-white">{count}</span>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="text-xs text-text-muted mb-2">DOM vs Hybrid comparison</div>
                      <div className="grid gap-3 md:grid-cols-3">
                        {(['dom', 'hybrid', 'visual'] as const).map((mode) => {
                          const entry = getModeEntry(mode);
                          return (
                            <div key={mode} className="rounded-lg bg-surface px-3 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium text-white uppercase">{mode}</div>
                                <div className={`text-sm font-medium ${entry && entry.successRate >= 80 ? 'text-success' : entry && entry.successRate >= 50 ? 'text-warning' : 'text-error'}`}>
                                  {entry ? `${entry.successRate}%` : 'n/a'}
                                </div>
                              </div>
                              <div className="mt-2 space-y-1 text-xs text-text-muted">
                                <div>{entry ? `${entry.totalRuns} runs` : 'No runs'}</div>
                                <div>{entry ? `${entry.passedRuns} passed / ${entry.failedRuns + entry.timeoutRuns} not passed` : ''}</div>
                                <div>{entry ? `avg ${formatDuration(entry.avgDurationMs)}` : ''}</div>
                                <div>{entry ? `recovery ${entry.avgRecoveryAttempts}` : ''}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="text-xs text-text-muted mb-2">Adapter comparison</div>
                      <div className="grid gap-3 md:grid-cols-3">
                        {(['chat-structured', 'responses-computer', 'unknown'] as const).map((mode) => {
                          const entry = getAdapterEntry(mode);
                          return (
                            <div key={mode} className="rounded-lg bg-surface px-3 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium text-white">{mode}</div>
                                <div
                                  className={`text-sm font-medium ${
                                    entry && entry.successRate >= 80
                                      ? 'text-success'
                                      : entry && entry.successRate >= 50
                                        ? 'text-warning'
                                        : 'text-error'
                                  }`}
                                >
                                  {entry ? `${entry.successRate}%` : 'n/a'}
                                </div>
                              </div>
                              <div className="mt-2 space-y-1 text-xs text-text-muted">
                                <div>{entry ? `${entry.totalRuns} runs` : 'No runs'}</div>
                                <div>{entry ? `${entry.passedRuns} passed / ${entry.failedRuns + entry.timeoutRuns} not passed` : ''}</div>
                                <div>{entry ? `avg ${formatDuration(entry.avgDurationMs)}` : ''}</div>
                                <div>{entry ? `recovery ${entry.avgRecoveryAttempts}` : ''}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg bg-surface px-3 py-3">
                        <div className="text-xs text-text-muted mb-2">Approval audit summary</div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <div className="text-lg font-medium text-white">{benchmarkReport.approvalAudit.totalTriggeredRuns}</div>
                            <div className="text-xs text-text-muted">Triggered</div>
                          </div>
                          <div>
                            <div className="text-lg font-medium text-success">{benchmarkReport.approvalAudit.approvedRuns}</div>
                            <div className="text-xs text-text-muted">Approved</div>
                          </div>
                          <div>
                            <div className="text-lg font-medium text-warning">{benchmarkReport.approvalAudit.pendingRuns}</div>
                            <div className="text-xs text-text-muted">Pending</div>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-lg bg-surface px-3 py-3">
                        <div className="text-xs text-text-muted mb-2">Top approval action types</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(benchmarkReport.approvalAudit.byActionType).length === 0 ? (
                            <div className="text-sm text-text-muted">{t('overview.noData', '暂无数据')}</div>
                          ) : (
                            Object.entries(benchmarkReport.approvalAudit.byActionType)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 5)
                              .map(([actionType, count]) => (
                                <div key={actionType} className="flex items-center gap-2 rounded-lg bg-elevated px-3 py-1.5">
                                  <span className="text-xs text-text-muted">{actionType}</span>
                                  <span className="text-sm font-medium text-white">{count}</span>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-xs text-text-muted mb-2">Top approval intent keywords</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(benchmarkReport.approvalAudit.byIntentKeyword).length === 0 ? (
                            <div className="text-sm text-text-muted">{t('overview.noData', '暂无数据')}</div>
                          ) : (
                            Object.entries(benchmarkReport.approvalAudit.byIntentKeyword)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 5)
                              .map(([keyword, count]) => (
                                <div key={keyword} className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-lg">
                                  <span className="text-xs text-text-muted">{keyword}</span>
                                  <span className="text-sm font-medium text-white">{count}</span>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-text-muted mb-2">Top approval risk reasons</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(benchmarkReport.approvalAudit.byRiskReason).length === 0 ? (
                            <div className="text-sm text-text-muted">{t('overview.noData', '暂无数据')}</div>
                          ) : (
                            Object.entries(benchmarkReport.approvalAudit.byRiskReason)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 5)
                              .map(([reason, count]) => (
                                <div key={reason} className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-lg">
                                  <span className="text-xs text-text-muted">{reason}</span>
                                  <span className="text-sm font-medium text-white">{count}</span>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {benchmarkReport.byBenchmark.slice(0, 5).map((entry) => (
                        <div key={entry.benchmarkTaskId} className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white truncate">{entry.benchmarkTaskName}</div>
                            <div className="text-xs text-text-muted truncate">
                              {entry.totalRuns} runs · {entry.passedRuns} passed · avg recovery {entry.avgRecoveryAttempts}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-sm font-medium ${entry.successRate >= 80 ? 'text-success' : entry.successRate >= 50 ? 'text-warning' : 'text-error'}`}>
                              {entry.successRate}%
                            </div>
                            <div className="text-xs text-text-muted">{formatDuration(entry.avgDurationMs)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="bg-elevated rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-medium text-text-secondary">Benchmark task set</h3>
                  <div className="text-xs text-text-muted">{benchmarkTasks.length} tasks</div>
                </div>
                {benchmarkRegressionSummary.length > 0 && (
                  <div className="mb-4 rounded-lg border border-error/30 bg-error/10 px-3 py-3">
                    <div className="text-sm font-medium text-error">Benchmark regression alerts</div>
                    <div className="mt-2 space-y-1.5">
                      {benchmarkRegressionSummary.slice(0, 5).map((entry) => (
                        <div key={entry.benchmarkId} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-text-secondary">{entry.benchmarkName}</span>
                          <span className={`font-medium ${getRegressionTextClass(entry.severity)}`}>
                            {entry.delta}% {entry.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {benchmarkLoadError ? (
                  <div className="text-sm text-error">{benchmarkLoadError}</div>
                ) : benchmarkTasks.length === 0 ? (
                  <div className="text-sm text-text-muted">{t('overview.noData', '暂无数据')}</div>
                ) : (
                  <div className="space-y-3">
                    {benchmarkTasks.map((task) => {
                      const recentRuns = benchmarkRuns
                        .filter((run) => run.benchmarkTaskId === task.id)
                        .slice(0, 2);
                      const trendPoints = getBenchmarkTrendPoints(task.id);
                      const trendDelta = getBenchmarkTrendDelta(task.id);
                      const regressionSeverity = trendDelta === null ? null : getRegressionSeverity(trendDelta);

                      return (
                        <div key={task.id} className={`rounded-lg border px-3 py-2 ${getRegressionContainerClass(regressionSeverity)}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white truncate">{task.name}</div>
                              <div className="text-xs text-text-muted truncate">{task.description}</div>
                              {trendDelta !== null && regressionSeverity && (
                                <div className={`mt-1 text-[11px] font-medium ${getRegressionTextClass(regressionSeverity)}`}>
                                  Regression detected: {trendDelta}% vs previous run ({regressionSeverity})
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                                  {task.category}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleRunBenchmark(task.id);
                                  }}
                                  disabled={benchmarkRunningId === task.id}
                                  className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {benchmarkRunningId === task.id ? 'Running...' : 'Run'}
                                </button>
                              </div>
                              <span className="text-[11px] text-text-muted">{task.id}</span>
                            </div>
                          </div>
                          {task.tags && task.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {task.tags.map((tag) => (
                                <span
                                  key={`${task.id}-${tag}`}
                                  className="rounded bg-border px-2 py-0.5 text-[11px] text-text-secondary"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg bg-elevated px-3 py-2">
                              <div className="text-[11px] text-text-muted mb-2">Recent pass trend</div>
                              {trendPoints.length === 0 ? (
                                <div className="text-xs text-text-muted">No trend data yet</div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-end gap-1 h-12">
                                    {trendPoints.map((point, index) => (
                                      <div key={`${task.id}-trend-${index}`} className="flex-1 flex flex-col items-center gap-1">
                                        <div
                                          className={`w-full rounded-t ${point >= 80 ? 'bg-success' : point >= 50 ? 'bg-warning' : 'bg-error'}`}
                                          style={{ height: `${Math.max(point, 8)}%` }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-text-muted">
                                    <span>last {trendPoints.length} runs</span>
                                    <span>{trendPoints[trendPoints.length - 1]}%</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="rounded-lg bg-elevated px-3 py-2">
                              <div className="text-[11px] text-text-muted mb-2">Latest delta vs previous</div>
                              {trendDelta === null ? (
                                <div className="text-xs text-text-muted">Need at least 2 runs</div>
                              ) : (
                                <div className="space-y-1">
                                  <div className={`text-lg font-medium ${trendDelta > 0 ? 'text-success' : trendDelta < 0 ? 'text-error' : 'text-text-secondary'}`}>
                                    {trendDelta > 0 ? '+' : ''}{trendDelta}%
                                  </div>
                                  <div className="text-xs text-text-muted">
                                    {trendDelta > 0
                                      ? 'Improved against previous run'
                                      : trendDelta < 0
                                        ? 'Regressed against previous run'
                                        : 'No change from previous run'}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 border-t border-border pt-2">
                            {recentRuns.length === 0 ? (
                              <div className="text-xs text-text-muted">No runs yet</div>
                            ) : (
                              <div className="space-y-1.5">
                                {recentRuns.map((run) => (
                                  <div key={run.id} className="flex items-center justify-between gap-2 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleViewBenchmarkRun(run.id);
                                      }}
                                      className="min-w-0 flex-1 text-left"
                                    >
                                      <span className="font-medium text-text-secondary">{run.status}</span>
                                      <span className="ml-2 text-text-muted truncate">
                                        {run.evaluation?.summary || run.error || ''}
                                      </span>
                                    </button>
                                    <div className="shrink-0 text-text-muted">
                                      {typeof run.durationMs === 'number' ? formatDuration(run.durationMs) : ''}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-elevated rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-medium text-text-secondary">Benchmark suites</h3>
                  <div className="text-xs text-text-muted">{benchmarkSuites.length} suites</div>
                </div>
                {suiteRegressionSummary.length > 0 && (
                  <div className="mb-4 rounded-lg border border-error/30 bg-error/10 px-3 py-3">
                    <div className="text-sm font-medium text-error">Regression alerts</div>
                    <div className="mt-2 space-y-1.5">
                      {suiteRegressionSummary.slice(0, 5).map((entry) => (
                        <div key={entry.suiteId} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-text-secondary">{entry.suiteName}</span>
                          <span className={`font-medium ${getRegressionTextClass(entry.severity)}`}>
                            {entry.delta}% {entry.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {benchmarkSuites.length === 0 ? (
                  <div className="text-sm text-text-muted">{t('overview.noData', '暂无数据')}</div>
                ) : (
                  <div className="space-y-3">
                    {benchmarkSuites.map((suite) => {
                      const recentRuns = benchmarkSuiteRuns.filter((run) => run.benchmarkTaskSetId === suite.id).slice(0, 2);
                      const trendPoints = getSuiteTrendPoints(suite.id);
                      const trendDelta = getSuiteTrendDelta(suite.id);
                      const regressionSeverity = trendDelta === null ? null : getRegressionSeverity(trendDelta);

                      return (
                        <div key={suite.id} className={`rounded-lg border px-3 py-2 ${getRegressionContainerClass(regressionSeverity)}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white truncate">{suite.name}</div>
                              <div className="text-xs text-text-muted truncate">{suite.description || suite.id}</div>
                                {trendDelta !== null && regressionSeverity && (
                                  <div className={`mt-1 text-[11px] font-medium ${getRegressionTextClass(regressionSeverity)}`}>
                                    Regression detected: {trendDelta}% vs previous run ({regressionSeverity})
                                  </div>
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                                  {suite.benchmarkIds.length} benchmarks
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleRunBenchmarkSuite(suite.id);
                                  }}
                                  disabled={benchmarkSuiteRunningId === suite.id}
                                  className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {benchmarkSuiteRunningId === suite.id ? 'Running...' : 'Run all'}
                                </button>
                              </div>
                              <span className="text-[11px] text-text-muted">{suite.id}</span>
                            </div>
                          </div>
                          {suite.tags && suite.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {suite.tags.map((tag) => (
                                <span key={`${suite.id}-${tag}`} className="rounded bg-border px-2 py-0.5 text-[11px] text-text-secondary">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg bg-elevated px-3 py-2">
                              <div className="text-[11px] text-text-muted mb-2">Recent success trend</div>
                              {trendPoints.length === 0 ? (
                                <div className="text-xs text-text-muted">No trend data yet</div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-end gap-1 h-12">
                                    {trendPoints.map((point, index) => (
                                      <div key={`${suite.id}-trend-${index}`} className="flex-1 flex flex-col items-center gap-1">
                                        <div
                                          className={`w-full rounded-t ${point >= 80 ? 'bg-success' : point >= 50 ? 'bg-warning' : 'bg-error'}`}
                                          style={{ height: `${Math.max(point, 8)}%` }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-text-muted">
                                    <span>last {trendPoints.length} runs</span>
                                    <span>{trendPoints[trendPoints.length - 1]}%</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="rounded-lg bg-elevated px-3 py-2">
                              <div className="text-[11px] text-text-muted mb-2">Latest delta vs previous</div>
                              {trendDelta === null ? (
                                <div className="text-xs text-text-muted">Need at least 2 completed suite runs</div>
                              ) : (
                                <div className="space-y-1">
                                  <div className={`text-lg font-medium ${trendDelta > 0 ? 'text-success' : trendDelta < 0 ? 'text-error' : 'text-text-secondary'}`}>
                                    {trendDelta > 0 ? '+' : ''}{trendDelta}%
                                  </div>
                                  <div className="text-xs text-text-muted">
                                    {trendDelta > 0
                                      ? 'Improved against previous run'
                                      : trendDelta < 0
                                        ? 'Regressed against previous run'
                                        : 'No change from previous run'}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 border-t border-border pt-2">
                            {recentRuns.length === 0 ? (
                              <div className="text-xs text-text-muted">No suite runs yet</div>
                            ) : (
                              <div className="space-y-1.5">
                                {recentRuns.map((run) => (
                                  <div key={run.id} className="flex items-center justify-between gap-2 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleViewBenchmarkSuiteRun(run.id);
                                      }}
                                      className="min-w-0 flex-1 text-left"
                                    >
                                      <span className="font-medium text-text-secondary">{run.status}</span>
                                      <span className="ml-2 text-text-muted truncate">
                                        {run.summary ? `${run.summary.passed}/${run.summary.total} passed` : run.error || ''}
                                      </span>
                                    </button>
                                    <div className="shrink-0 text-text-muted">
                                      {typeof run.durationMs === 'number' ? formatDuration(run.durationMs) : ''}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-elevated rounded-xl p-4">
                <h3 className="text-sm font-medium text-text-secondary mb-3">
                  {t('overview.sourceDistribution', '来源分布')}
                </h3>
                <div className="flex flex-wrap gap-2">
                   {Object.entries(sourceStats)
                    .sort(([, a], [, b]) => b - a)
                    .map(([source, count]) => (
                      <div
                        key={source}
                        className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-lg"
                      >
                        <span className="text-xs text-text-muted">{source}</span>
                        <span className="text-sm font-medium text-white">{count}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-elevated rounded-xl p-4">
                <h3 className="text-sm font-medium text-text-secondary mb-3">
                  {t('overview.dailyTrend', '每日趋势')}
                </h3>
                {dailyStatsArray.length === 0 ? (
                  <div className="text-sm text-text-muted text-center py-4">
                    {t('overview.noData', '暂无数据')}
                  </div>
                ) : (
                  <div className="flex items-end gap-1 h-32">
                    {dailyStatsArray.map(({ date, completed, failed, total }) => {
                      const heightPct = (total / maxDailyTotal) * 100;
                      const completedPct = total > 0 ? (completed / total) * 100 : 0;
                      return (
                        <div key={date} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full flex flex-col-reverse rounded-t relative" style={{ height: `${heightPct}%` }}>
                            <div
                              className="bg-success rounded-t"
                              style={{ height: `${completedPct}%` }}
                            />
                            <div
                              className="bg-error rounded-t"
                              style={{ height: `${100 - completedPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-muted mt-1">
                            {date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-success" />
                    <span className="text-xs text-text-muted">{t('overview.completed', '完成')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-error" />
                    <span className="text-xs text-text-muted">{t('overview.failed', '失败')}</span>
                  </div>
                </div>
              </div>

              {selectedBenchmarkRun && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                  <div className="max-h-[90vh] w-[min(960px,95vw)] overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl">
                    <div className="flex items-center justify-between border-b border-border px-5 py-4">
                      <div>
                        <div className="text-lg font-semibold text-white">
                          Benchmark Run Details
                        </div>
                        <div className="text-xs text-text-muted">
                          {selectedBenchmarkRun.benchmarkTaskName || selectedBenchmarkRun.benchmarkTaskId}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedBenchmarkRun(null)}
                        className="rounded p-1 text-text-muted transition-colors hover:bg-border hover:text-white"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="space-y-4 p-5">
                      {selectedBenchmarkRunLoading ? (
                        <div className="text-sm text-text-muted">Loading...</div>
                      ) : selectedBenchmarkRunError ? (
                        <div className="text-sm text-error">{selectedBenchmarkRunError}</div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <MetricCard label="Status" value={selectedBenchmarkRun.status} color="info" />
                            <MetricCard
                              label="Evaluation"
                              value={selectedBenchmarkRun.evaluation?.passed ? 'Passed' : 'Failed'}
                              color={selectedBenchmarkRun.evaluation?.passed ? 'success' : 'error'}
                            />
                            <MetricCard
                              label="Duration"
                              value={typeof selectedBenchmarkRun.durationMs === 'number' ? formatDuration(selectedBenchmarkRun.durationMs) : 'n/a'}
                              color="info"
                            />
                            <MetricCard
                              label="Started"
                              value={formatTimestamp(selectedBenchmarkRun.startedAt)}
                              color="info"
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-lg border border-border bg-elevated p-4">
                              <h4 className="mb-2 text-sm font-medium text-text-secondary">Evaluation Summary</h4>
                              <div className="text-sm text-white">
                                {selectedBenchmarkRun.evaluation?.summary || selectedBenchmarkRun.error || 'No summary available'}
                              </div>
                              {Array.isArray(selectedBenchmarkRun.evaluation?.checks) && (
                                <div className="mt-3 space-y-2">
                                  {selectedBenchmarkRun.evaluation.checks.map((check) => (
                                    <div key={check.id} className="rounded-md bg-surface px-3 py-2 text-xs">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium text-white">{check.label}</span>
                                        <span className={check.passed ? 'text-success' : 'text-error'}>
                                          {check.passed ? 'Passed' : 'Failed'}
                                        </span>
                                      </div>
                                      {check.detail && <div className="mt-1 text-text-muted">{check.detail}</div>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="rounded-lg border border-border bg-elevated p-4">
                              <h4 className="mb-2 text-sm font-medium text-text-secondary">Task Result</h4>
                              <div className="space-y-2 text-sm">
                                <div>
                                  <div className="text-xs text-text-muted">Task Run ID</div>
                                  <div className="break-all text-white">{selectedBenchmarkRun.runId || 'n/a'}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-text-muted">Summary</div>
                                  <div className="text-white">{selectedBenchmarkRun.taskResult?.summary || 'n/a'}</div>
                                </div>
                                {selectedBenchmarkRun.taskRun && (
                                  <div>
                                    <div className="text-xs text-text-muted">Task Run State</div>
                                    <div className="text-white">
                                      {selectedBenchmarkRun.taskRun.status} / {selectedBenchmarkRun.taskRun.title || 'Untitled'}
                                    </div>
                                    {resolveVisualProviderLabel(selectedBenchmarkRun.taskRun.metadata) && (
                                      <div className="mt-1 text-xs text-text-muted">
                                        Visual provider: {resolveVisualProviderLabel(selectedBenchmarkRun.taskRun.metadata)}
                                      </div>
                                    )}
                                    {resolveVisualProviderSelection(selectedBenchmarkRun.taskRun.metadata) && (
                                      <div className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-text-secondary">
                                        <div className="text-text-muted">Visual provider details</div>
                                        <div className="mt-1 text-white">
                                          {resolveVisualProviderSelection(selectedBenchmarkRun.taskRun.metadata)?.name}
                                        </div>
                                        <div className="mt-1 text-text-muted">
                                          score:{' '}
                                          <span className="text-text-secondary">
                                            {Math.round(resolveVisualProviderSelection(selectedBenchmarkRun.taskRun.metadata)?.score || 0)}
                                          </span>
                                        </div>
                                        {resolveVisualProviderSelection(selectedBenchmarkRun.taskRun.metadata)?.reasons.length ? (
                                          <div className="mt-2">
                                            <div className="mb-1 text-text-muted">reasons</div>
                                            <ul className="list-disc pl-4 text-text-secondary">
                                              {resolveVisualProviderSelection(selectedBenchmarkRun.taskRun.metadata)?.reasons.map((reason) => (
                                                <li key={reason}>{reason}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        ) : null}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-lg border border-border bg-elevated p-4">
                              <h4 className="mb-2 text-sm font-medium text-text-secondary">Artifacts</h4>
                              {selectedBenchmarkRun.taskResult?.artifacts && selectedBenchmarkRun.taskResult.artifacts.length > 0 ? (
                                <div className="space-y-2">
                                  {selectedBenchmarkRun.taskResult.artifacts.map((artifact) => (
                                    <div key={artifact.id} className="rounded-md bg-surface px-3 py-2 text-xs">
                                      <div className="font-medium text-white">{artifact.name}</div>
                                      <div className="text-text-muted">{artifact.type}{artifact.uri ? ` · ${artifact.uri}` : ''}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-text-muted">No artifacts</div>
                              )}
                            </div>

                            <div className="rounded-lg border border-border bg-elevated p-4">
                              <h4 className="mb-2 text-sm font-medium text-text-secondary">Raw Output</h4>
                              <pre className="max-h-72 overflow-auto rounded-md bg-surface p-3 text-xs text-text-secondary">
                                {renderJson(selectedBenchmarkRun.taskResult?.rawOutput || selectedBenchmarkRun)}
                              </pre>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedBenchmarkSuiteRun && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                  <div className="max-h-[90vh] w-[min(1100px,95vw)] overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl">
                    <div className="flex items-center justify-between border-b border-border px-5 py-4">
                      <div>
                        <div className="text-lg font-semibold text-white">Benchmark Suite Run Details</div>
                        <div className="text-xs text-text-muted">
                          {selectedBenchmarkSuiteRun.benchmarkTaskSetName || selectedBenchmarkSuiteRun.benchmarkTaskSetId}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedBenchmarkSuiteRun(null)}
                        className="rounded p-1 text-text-muted transition-colors hover:bg-border hover:text-white"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="space-y-4 p-5">
                      {selectedBenchmarkSuiteRunLoading ? (
                        <div className="text-sm text-text-muted">Loading...</div>
                      ) : selectedBenchmarkSuiteRunError ? (
                        <div className="text-sm text-error">{selectedBenchmarkSuiteRunError}</div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <MetricCard label="Status" value={selectedBenchmarkSuiteRun.status} color="info" />
                            <MetricCard
                              label="Passed"
                              value={selectedBenchmarkSuiteRun.summary?.passed || 0}
                              color="success"
                            />
                            <MetricCard
                              label="Failed"
                              value={(selectedBenchmarkSuiteRun.summary?.failed || 0) + (selectedBenchmarkSuiteRun.summary?.timeout || 0)}
                              color="error"
                            />
                            <MetricCard
                              label="Duration"
                              value={typeof selectedBenchmarkSuiteRun.durationMs === 'number' ? formatDuration(selectedBenchmarkSuiteRun.durationMs) : 'n/a'}
                              color="info"
                            />
                          </div>

                          <div className="rounded-lg border border-border bg-elevated p-4">
                            <div className="grid gap-3 md:grid-cols-4 text-sm">
                              <div>
                                <div className="text-xs text-text-muted">Suite Run ID</div>
                                <div className="break-all text-white">{selectedBenchmarkSuiteRun.id}</div>
                              </div>
                              <div>
                                <div className="text-xs text-text-muted">Started</div>
                                <div className="text-white">{formatTimestamp(selectedBenchmarkSuiteRun.startedAt)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-text-muted">Benchmarks</div>
                                <div className="text-white">{selectedBenchmarkSuiteRun.summary?.total || 0}</div>
                              </div>
                              <div>
                                <div className="text-xs text-text-muted">Result</div>
                                <div className="text-white">{selectedBenchmarkSuiteRun.error || `${selectedBenchmarkSuiteRun.summary?.passed || 0} passed`}</div>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-border bg-elevated p-4">
                            <h4 className="mb-3 text-sm font-medium text-text-secondary">Benchmark Outcomes</h4>
                            {selectedBenchmarkSuiteRun.benchmarkRuns && selectedBenchmarkSuiteRun.benchmarkRuns.length > 0 ? (
                              <div className="space-y-3">
                                {selectedBenchmarkSuiteRun.benchmarkRuns.map((run) => (
                                  <div key={run.id} className="rounded-lg bg-surface px-3 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-sm font-medium text-white">{run.benchmarkTaskName}</div>
                                      <div className="text-xs text-text-muted break-all">
                                          {run.benchmarkTaskId} / {run.runId}
                                        </div>
                                        {resolveVisualProviderLabel(run.taskRun?.metadata) && (
                                          <div className="mt-1 text-xs text-text-muted">
                                            provider: {resolveVisualProviderLabel(run.taskRun?.metadata)}
                                          </div>
                                        )}
                                        {resolveVisualProviderSelection(run.taskRun?.metadata) && (
                                          <div className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-text-secondary">
                                            <div className="text-text-muted">Visual provider details</div>
                                            <div className="mt-1 text-white">
                                              {resolveVisualProviderSelection(run.taskRun?.metadata)?.name}
                                            </div>
                                            <div className="mt-1 text-text-muted">
                                              score:{' '}
                                              <span className="text-text-secondary">
                                                {Math.round(resolveVisualProviderSelection(run.taskRun?.metadata)?.score || 0)}
                                              </span>
                                            </div>
                                            {resolveVisualProviderSelection(run.taskRun?.metadata)?.reasons.length ? (
                                              <div className="mt-2">
                                                <div className="mb-1 text-text-muted">reasons</div>
                                                <ul className="list-disc pl-4 text-text-secondary">
                                                  {resolveVisualProviderSelection(run.taskRun?.metadata)?.reasons.map((reason) => (
                                                    <li key={reason}>{reason}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            ) : null}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className={`text-xs font-medium ${run.evaluation?.passed ? 'text-success' : 'text-error'}`}>
                                          {run.status}
                                        </span>
                                        <span className="text-xs text-text-muted">
                                          {typeof run.durationMs === 'number' ? formatDuration(run.durationMs) : ''}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="mt-2 text-xs text-text-secondary">
                                      {run.evaluation?.summary || run.error || 'No evaluation summary'}
                                    </div>
                                    {Array.isArray(run.evaluation?.checks) && run.evaluation.checks.length > 0 && (
                                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                                        {run.evaluation.checks.map((check) => (
                                          <div key={`${run.id}-${check.id}`} className="rounded-md border border-border px-2.5 py-2 text-xs">
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="font-medium text-white">{check.label}</span>
                                              <span className={check.passed ? 'text-success' : 'text-error'}>
                                                {check.passed ? 'Passed' : 'Failed'}
                                              </span>
                                            </div>
                                            {check.detail && <div className="mt-1 text-text-muted">{check.detail}</div>}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-text-muted">No benchmark runs in this suite execution</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  color: 'success' | 'error' | 'warning' | 'info';
}

function MetricCard({ label, value, color }: MetricCardProps) {
  const colorClasses = {
    success: 'text-success',
    error: 'text-error',
    warning: 'text-warning',
    info: 'text-info',
  };

  return (
    <div className="bg-elevated rounded-xl p-4">
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</div>
      <div className="text-sm text-text-muted mt-1">{label}</div>
    </div>
  );
}

export default OverviewPanel;
