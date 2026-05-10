import React, { useEffect, useState } from 'react';
import { useOverviewStore, OverviewMetrics } from '../stores/overviewStore';
import { useTranslation } from '../i18n/useTranslation';
import {
  resolveVisualProviderLabel,
  resolveVisualProviderSelection,
} from '../../core/visual/visualProviderMetadata';
import { evaluateBenchmarkReleaseGate } from '../../core/benchmark/report';
import type { BenchmarkReport } from '../../core/benchmark/types';
import { getNumber, getRecord, getString, isRecord } from '../utils/object';

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
    stableBenchmarks: number;
    flakyBenchmarks: number;
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
    recentRunCount: number;
    recentPassedRuns: number;
    recentFailedRuns: number;
    recentTimeoutRuns: number;
    recentSuccessRate: number;
    consecutiveSuccessRuns: number;
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

interface BenchmarkGateState {
  status: 'pass' | 'risk' | 'pending';
  summary: string;
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
    detail: string;
  }>;
  stableBenchmarks: number;
  flakyBenchmarks: number;
  totalRuns: number;
  successRate: number;
  recentSuccessRateThreshold: number;
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
  const [benchmarkGate, setBenchmarkGate] = useState<BenchmarkGateState | null>(null);
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
            summary: isRecord(item.summary)
              ? {
                  total: getNumber(item.summary, 'total') || 0,
                  passed: getNumber(item.summary, 'passed') || 0,
                  failed: getNumber(item.summary, 'failed') || 0,
                  timeout: getNumber(item.summary, 'timeout') || 0,
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
        const nextBenchmarkReport: BenchmarkReportState = {
          summary: isRecord(report.summary)
            ? {
                totalRuns: getNumber(report.summary, 'totalRuns') || 0,
                passedRuns: getNumber(report.summary, 'passedRuns') || 0,
                failedRuns: getNumber(report.summary, 'failedRuns') || 0,
                timeoutRuns: getNumber(report.summary, 'timeoutRuns') || 0,
                successRate: getNumber(report.summary, 'successRate') || 0,
                avgDurationMs: getNumber(report.summary, 'avgDurationMs') || 0,
                avgRecoveryAttempts: getNumber(report.summary, 'avgRecoveryAttempts') || 0,
                avgVerificationFailures: getNumber(report.summary, 'avgVerificationFailures') || 0,
                avgApprovalInterruptions: getNumber(report.summary, 'avgApprovalInterruptions') || 0,
                stableBenchmarks: getNumber(report.summary, 'stableBenchmarks') || 0,
                flakyBenchmarks: getNumber(report.summary, 'flakyBenchmarks') || 0,
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
                stableBenchmarks: 0,
                flakyBenchmarks: 0,
              },
          byBenchmark: Array.isArray(report.byBenchmark)
            ? report.byBenchmark
                .filter(isRecord)
                .map((entry) => ({
                  benchmarkTaskId: getString(entry, 'benchmarkTaskId') || 'unknown',
                  benchmarkTaskName: getString(entry, 'benchmarkTaskName') || 'Unnamed benchmark',
                  totalRuns: getNumber(entry, 'totalRuns') || 0,
                  passedRuns: getNumber(entry, 'passedRuns') || 0,
                  failedRuns: getNumber(entry, 'failedRuns') || 0,
                  timeoutRuns: getNumber(entry, 'timeoutRuns') || 0,
                  successRate: getNumber(entry, 'successRate') || 0,
                  avgDurationMs: getNumber(entry, 'avgDurationMs') || 0,
                  avgRecoveryAttempts: getNumber(entry, 'avgRecoveryAttempts') || 0,
                  avgVerificationFailures: getNumber(entry, 'avgVerificationFailures') || 0,
                  avgApprovalInterruptions: getNumber(entry, 'avgApprovalInterruptions') || 0,
                  recentRunCount: getNumber(entry, 'recentRunCount') || 0,
                  recentPassedRuns: getNumber(entry, 'recentPassedRuns') || 0,
                  recentFailedRuns: getNumber(entry, 'recentFailedRuns') || 0,
                  recentTimeoutRuns: getNumber(entry, 'recentTimeoutRuns') || 0,
                  recentSuccessRate: getNumber(entry, 'recentSuccessRate') || 0,
                  consecutiveSuccessRuns: getNumber(entry, 'consecutiveSuccessRuns') || 0,
                  executionModes: isRecord(entry.executionModes) ? (entry.executionModes as Record<string, number>) : {},
                  adapterModes: isRecord(entry.adapterModes) ? (entry.adapterModes as Record<string, number>) : {},
                  visualProviders: isRecord(entry.visualProviders) ? (entry.visualProviders as Record<string, number>) : {},
                  latestRunAt: getNumber(entry, 'latestRunAt'),
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
        };
        setBenchmarkReport(nextBenchmarkReport);
        setBenchmarkGate(evaluateBenchmarkReleaseGate(nextBenchmarkReport as BenchmarkReport));
      } else {
        setBenchmarkReport(null);
        setBenchmarkGate(null);
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

        const evaluation = getRecord(result, 'evaluation');
        const taskResult = getRecord(result, 'taskResult');
        const taskRun = getRecord(result, 'taskRun');

        setSelectedBenchmarkRun({
          id: getString(result, 'id') || runId,
          benchmarkTaskId: getString(result, 'benchmarkTaskId') || 'unknown',
          benchmarkTaskName: getString(result, 'benchmarkTaskName') || undefined,
          runId: getString(result, 'runId') || undefined,
          status: getString(result, 'status') || 'unknown',
          startedAt: getNumber(result, 'startedAt') || Date.now(),
          durationMs: getNumber(result, 'durationMs'),
          evaluation: evaluation
            ? {
                passed: Boolean(evaluation.passed),
                summary: typeof evaluation.summary === 'string' ? evaluation.summary : '',
                checks: Array.isArray(evaluation.checks)
                  ? evaluation.checks
                      .filter(isRecord)
                      .map((check) => ({
                        id: getString(check, 'id') || 'unknown',
                        label: getString(check, 'label') || 'check',
                        passed: Boolean(check.passed),
                        detail: getString(check, 'detail'),
                      }))
                  : undefined,
              }
            : undefined,
          error: getString(result, 'error'),
          taskResult: taskResult
            ? {
                id: getString(taskResult, 'id') || 'unknown',
                summary: getString(taskResult, 'summary') || '',
                artifacts: Array.isArray(taskResult.artifacts)
                  ? taskResult.artifacts.filter(isRecord).map((artifact) => ({
                      id: getString(artifact, 'id') || 'unknown',
                      type: getString(artifact, 'type') || 'text',
                      name: getString(artifact, 'name') || 'artifact',
                      uri: getString(artifact, 'uri'),
                      content: getString(artifact, 'content'),
                    }))
                  : undefined,
                rawOutput: taskResult.rawOutput,
              }
            : undefined,
          taskRun: taskRun
            ? {
                id: getString(taskRun, 'id') || runId,
                status: getString(taskRun, 'status') || 'unknown',
                startedAt: getNumber(taskRun, 'startedAt') || Date.now(),
                endedAt: getNumber(taskRun, 'endedAt'),
                source: getString(taskRun, 'source'),
                title: getString(taskRun, 'title'),
                metadata: isRecord(taskRun.metadata) ? (taskRun.metadata as Record<string, unknown>) : undefined,
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

        const summary = getRecord(result, 'summary');
        setSelectedBenchmarkSuiteRun({
          id: getString(result, 'id') || runId,
          benchmarkTaskSetId: getString(result, 'benchmarkTaskSetId') || 'unknown',
          benchmarkTaskSetName: getString(result, 'benchmarkTaskSetName') || 'Unnamed suite',
          status: getString(result, 'status') || 'unknown',
          startedAt: getNumber(result, 'startedAt') || Date.now(),
          durationMs: getNumber(result, 'durationMs'),
          summary: summary
            ? {
                total: getNumber(summary, 'total') || 0,
                passed: getNumber(summary, 'passed') || 0,
                failed: getNumber(summary, 'failed') || 0,
                timeout: getNumber(summary, 'timeout') || 0,
              }
            : undefined,
          benchmarkRunIds: Array.isArray(result.benchmarkRunIds)
            ? result.benchmarkRunIds.filter((id: unknown): id is string => typeof id === 'string')
            : undefined,
          benchmarkRuns: Array.isArray(result.benchmarkRuns)
            ? result.benchmarkRuns
                .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
                .map((item: Record<string, unknown>) => ({
                  id: getString(item, 'id') || 'unknown',
                  benchmarkTaskId: getString(item, 'benchmarkTaskId') || 'unknown',
                  benchmarkTaskName: getString(item, 'benchmarkTaskName') || 'Unnamed benchmark',
                  runId: getString(item, 'runId') || 'unknown',
                  status: getString(item, 'status') || 'unknown',
                  startedAt: getNumber(item, 'startedAt') || Date.now(),
                  durationMs: getNumber(item, 'durationMs'),
                  evaluation: isRecord(item.evaluation)
                    ? {
                        passed: Boolean(item.evaluation.passed),
                        summary: typeof item.evaluation.summary === 'string' ? item.evaluation.summary : '',
                        checks: Array.isArray(item.evaluation.checks)
                          ? item.evaluation.checks.filter(isRecord).map((check) => ({
                              id: getString(check, 'id') || 'unknown',
                              label: getString(check, 'label') || 'check',
                              passed: Boolean(check.passed),
                              detail: getString(check, 'detail'),
                            }))
                          : undefined,
                      }
                    : undefined,
                  error: getString(item, 'error'),
                }))
            : undefined,
          error: getString(result, 'error'),
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
          <h2 className="text-lg font-semibold text-white">{t('overview.title')}</h2>
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
                  {option === '7d'
                    ? t('overview.range7d')
                    : option === '14d'
                      ? t('overview.range14d')
                      : t('overview.range30d')}
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
              <div className="text-text-muted">{t('common.loading')}</div>
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
                  label={t('overview.totalTasks')}
                  value={summary.totalTasks}
                  color="info"
                />
                <MetricCard
                  label={t('overview.completed')}
                  value={summary.completedTasks}
                  color="success"
                />
                <MetricCard
                  label={t('overview.failed')}
                  value={summary.failedTasks}
                  color="error"
                />
                <MetricCard
                  label={t('overview.successRate')}
                  value={`${summary.successRate}%`}
                  color={summary.successRate >= 80 ? 'success' : summary.successRate >= 50 ? 'warning' : 'error'}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <MetricCard
                  label={t('overview.avgDuration')}
                  value={formatDuration(summary.avgDurationMs)}
                  color="info"
                />
                <MetricCard
                  label={t('overview.totalDuration')}
                  value={formatDuration(summary.totalDurationMs)}
                  color="info"
                />
                <MetricCard
                  label={t('overview.running')}
                  value={summary.runningTasks}
                  color="warning"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-elevated rounded-xl p-4">
                  <h3 className="text-sm font-medium text-text-secondary mb-3">
                    {t('overview.scheduler')}
                  </h3>
                  <div className="flex gap-6">
                    <div>
                        <div className="text-2xl font-bold text-white">
                         {schedulerStats.totalSchedules}
                        </div>
                      <div className="text-xs text-text-muted">{t('overview.total')}</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-success">
                         {schedulerStats.activeSchedules}
                        </div>
                      <div className="text-xs text-text-muted">{t('overview.active')}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-elevated rounded-xl p-4">
                  <h3 className="text-sm font-medium text-text-secondary mb-3">
                    {t('overview.imTasks')}
                  </h3>
                  <div className="flex gap-4">
                    <div>
                       <div className="text-2xl font-bold text-white">{imStats.total}</div>
                      <div className="text-xs text-text-muted">{t('overview.total')}</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-success">
                         {imStats.completed}
                      </div>
                      <div className="text-xs text-text-muted">{t('overview.completed')}</div>
                    </div>
                    <div>
                       <div className="text-2xl font-bold text-error">{imStats.failed}</div>
                      <div className="text-xs text-text-muted">{t('overview.failed')}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-elevated rounded-xl p-4">
                <h3 className="text-sm font-medium text-text-secondary mb-3">
                  {t('overview.benchmarkReport')}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard label={t('overview.visualRuns')} value={visualStats.totalRuns} color="info" />
                  <MetricCard label={t('overview.visualSuccess')} value={`${visualStats.successRate}%`} color={visualStats.successRate >= 80 ? 'success' : visualStats.successRate >= 50 ? 'warning' : 'error'} />
                  <MetricCard label={t('overview.recoveredRuns')} value={visualStats.recoveredRuns} color="warning" />
                  <MetricCard label={t('overview.verificationFailures')} value={visualStats.verificationFailures} color="error" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  <MetricCard label={t('overview.approvalInterruptions')} value={visualStats.approvalInterruptions} color="warning" />
                  <MetricCard label={t('overview.recoveryAttempts')} value={visualStats.recoveryAttempts} color="info" />
                  <MetricCard label={t('overview.completedVisualRuns')} value={visualStats.completedRuns} color="success" />
                </div>
                <div className="mt-4">
                  <div className="text-xs text-text-muted mb-2">{t('overview.recoveryTriggerDistribution')}</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(visualStats.triggerDistribution).length === 0 ? (
                      <div className="text-sm text-text-muted">{t('overview.noData')}</div>
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
                  <h3 className="text-sm font-medium text-text-secondary">{t('overview.p1AcceptanceSummary')}</h3>
                  <div className="text-xs text-text-muted">{p1PassCount}/{p1AcceptanceChecks.length} passed</div>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <MetricCard label={t('overview.passed')} value={p1PassCount} color="success" />
                  <MetricCard label={t('overview.risks')} value={p1RiskCount} color="error" />
                  <MetricCard label={t('overview.pending')} value={p1PendingCount} color="warning" />
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
                  <h3 className="text-sm font-medium text-text-secondary">{t('overview.benchmarkReport')}</h3>
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
                  <div className="text-sm text-text-muted">{t('overview.noData')}</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <MetricCard label={t('overview.successRate')} value={`${benchmarkReport.summary.successRate}%`} color={benchmarkReport.summary.successRate >= 80 ? 'success' : benchmarkReport.summary.successRate >= 50 ? 'warning' : 'error'} />
                      <MetricCard label={t('overview.avgDuration')} value={formatDuration(benchmarkReport.summary.avgDurationMs)} color="info" />
                      <MetricCard label={t('overview.avgRecovery')} value={benchmarkReport.summary.avgRecoveryAttempts} color="warning" />
                      <MetricCard label={t('overview.avgVerificationFailures')} value={benchmarkReport.summary.avgVerificationFailures} color="error" />
                      <MetricCard label={t('overview.stableBenchmarks')} value={benchmarkReport.summary.stableBenchmarks} color="success" />
                      <MetricCard label={t('overview.flakyBenchmarks')} value={benchmarkReport.summary.flakyBenchmarks} color="warning" />
                    </div>
                    {benchmarkGate && (
                      <div className="mt-4 rounded-lg border border-border bg-surface p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-text-muted">{t('overview.benchmarkGate')}</div>
                            <div className={`mt-1 text-sm font-medium ${benchmarkGate.status === 'pass' ? 'text-success' : benchmarkGate.status === 'risk' ? 'text-warning' : 'text-text-secondary'}`}>
                              {benchmarkGate.status.toUpperCase()}
                            </div>
                          </div>
                          <div className="text-xs text-text-muted">
                            {benchmarkGate.stableBenchmarks} stable / {benchmarkGate.flakyBenchmarks} flaky
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-text-secondary">{benchmarkGate.summary}</div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {benchmarkGate.checks.slice(0, 4).map((check) => (
                            <div key={check.id} className="rounded-md bg-background px-3 py-2 text-xs">
                              <div className={`font-medium ${check.passed ? 'text-success' : 'text-warning'}`}>{check.label}</div>
                              <div className="mt-1 text-text-muted">{check.detail}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid gap-4 md:grid-cols-2 mt-4">
                      <div>
                        <div className="text-xs text-text-muted mb-2">Execution mode distribution</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(benchmarkReport.executionModes).length === 0 ? (
                            <div className="text-sm text-text-muted">{t('overview.noData')}</div>
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
                            <div className="text-sm text-text-muted">{t('overview.noData')}</div>
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
                          <div className="text-sm text-text-muted">{t('overview.noData')}</div>
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
                            <div className="text-sm text-text-muted">{t('overview.noData')}</div>
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
                            <div className="text-sm text-text-muted">{t('overview.noData')}</div>
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
                            <div className="text-sm text-text-muted">{t('overview.noData')}</div>
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
                            <div className="mt-1 text-[11px] text-text-muted">
                              recent {entry.recentRunCount} runs · {entry.recentSuccessRate}% recent success · {entry.consecutiveSuccessRuns} run streak
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-sm font-medium ${entry.successRate >= 80 ? 'text-success' : entry.successRate >= 50 ? 'text-warning' : 'text-error'}`}>
                              {entry.successRate}%
                            </div>
                            <div className="text-xs text-text-muted">{formatDuration(entry.avgDurationMs)}</div>
                            <div className="text-[11px] text-text-muted">{entry.recentPassedRuns} recent passed</div>
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
                  <div className="text-sm text-text-muted">{t('overview.noData')}</div>
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
                  <div className="text-sm text-text-muted">{t('overview.noData')}</div>
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
                  {t('overview.sourceDistribution')}
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
                  {t('overview.dailyTrend')}
                </h3>
                {dailyStatsArray.length === 0 ? (
                  <div className="text-sm text-text-muted text-center py-4">
                    {t('overview.noData')}
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
                    <span className="text-xs text-text-muted">{t('overview.completed')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-error" />
                    <span className="text-xs text-text-muted">{t('overview.failed')}</span>
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
