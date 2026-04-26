import {
  BenchmarkAdapterModeReportEntry,
  BenchmarkExecutionModeReportEntry,
  BenchmarkReport,
  BenchmarkReportEntry,
  BenchmarkRunRecord,
} from './types';

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function incrementCounter(map: Record<string, number>, key: string | undefined): void {
  if (!key) {
    return;
  }

  map[key] = (map[key] || 0) + 1;
}

function escapeCsvCell(value: string | number): string {
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function createBenchmarkReport(records: BenchmarkRunRecord[]): BenchmarkReport {
  const executionModes: Record<string, number> = {};
  const adapterModes: Record<string, number> = {};
  const visualProviders: Record<string, number> = {};
  const approvalActionTypes: Record<string, number> = {};
  const approvalIntentKeywords: Record<string, number> = {};
  const approvalRiskReasons: Record<string, number> = {};
  const byBenchmarkMap = new Map<string, BenchmarkReportEntry>();
  const byExecutionModeMap = new Map<string, BenchmarkExecutionModeReportEntry>();
  const byAdapterModeMap = new Map<string, BenchmarkAdapterModeReportEntry>();

  let passedRuns = 0;
  let failedRuns = 0;
  let timeoutRuns = 0;
  let totalDurationMs = 0;
  let totalRecoveryAttempts = 0;
  let totalVerificationFailures = 0;
  let totalApprovalInterruptions = 0;
  let totalTriggeredRuns = 0;
  let approvedRuns = 0;
  let pendingRuns = 0;

  for (const record of records) {
    if (record.status === 'completed' && record.evaluation?.passed) {
      passedRuns += 1;
    } else if (record.status === 'timeout') {
      timeoutRuns += 1;
    } else if (record.status === 'failed' || record.status === 'cancelled' || (record.status === 'completed' && !record.evaluation?.passed)) {
      failedRuns += 1;
    }

    totalDurationMs += record.durationMs || 0;
    totalRecoveryAttempts += record.metrics?.recoveryAttempts || 0;
    totalVerificationFailures += record.metrics?.verificationFailures || 0;
    totalApprovalInterruptions += record.metrics?.approvalInterruptions || 0;
    incrementCounter(executionModes, record.executionMode);
    incrementCounter(adapterModes, record.adapterMode);
    incrementCounter(visualProviders, record.visualProvider?.id);

    if (record.approvalAudit) {
      totalTriggeredRuns += 1;
      if (record.approvalAudit.approved) {
        approvedRuns += 1;
      }
      if (record.approvalAudit.pending) {
        pendingRuns += 1;
      }
      for (const actionType of record.approvalAudit.actionTypes) {
        incrementCounter(approvalActionTypes, actionType);
      }
      for (const keyword of record.approvalAudit.matchedIntentKeywords) {
        incrementCounter(approvalIntentKeywords, keyword);
      }
      for (const riskReason of record.approvalAudit.actionRiskReasons) {
        incrementCounter(approvalRiskReasons, riskReason);
      }
    }

    const executionModeKey = record.executionMode || 'unknown';
    const executionModeEntry = byExecutionModeMap.get(executionModeKey) || {
      executionMode: executionModeKey,
      totalRuns: 0,
      passedRuns: 0,
      failedRuns: 0,
      timeoutRuns: 0,
      successRate: 0,
      avgDurationMs: 0,
      avgRecoveryAttempts: 0,
      avgVerificationFailures: 0,
      avgApprovalInterruptions: 0,
    };
    executionModeEntry.totalRuns += 1;
    if (record.status === 'completed' && record.evaluation?.passed) {
      executionModeEntry.passedRuns += 1;
    } else if (record.status === 'timeout') {
      executionModeEntry.timeoutRuns += 1;
    } else {
      executionModeEntry.failedRuns += 1;
    }
    executionModeEntry.avgDurationMs += record.durationMs || 0;
    executionModeEntry.avgRecoveryAttempts += record.metrics?.recoveryAttempts || 0;
    executionModeEntry.avgVerificationFailures += record.metrics?.verificationFailures || 0;
    executionModeEntry.avgApprovalInterruptions += record.metrics?.approvalInterruptions || 0;
    byExecutionModeMap.set(executionModeKey, executionModeEntry);

    const adapterModeKey = record.adapterMode || 'unknown';
    const adapterModeEntry = byAdapterModeMap.get(adapterModeKey) || {
      adapterMode: adapterModeKey,
      totalRuns: 0,
      passedRuns: 0,
      failedRuns: 0,
      timeoutRuns: 0,
      successRate: 0,
      avgDurationMs: 0,
      avgRecoveryAttempts: 0,
      avgVerificationFailures: 0,
      avgApprovalInterruptions: 0,
    };
    adapterModeEntry.totalRuns += 1;
    if (record.status === 'completed' && record.evaluation?.passed) {
      adapterModeEntry.passedRuns += 1;
    } else if (record.status === 'timeout') {
      adapterModeEntry.timeoutRuns += 1;
    } else {
      adapterModeEntry.failedRuns += 1;
    }
    adapterModeEntry.avgDurationMs += record.durationMs || 0;
    adapterModeEntry.avgRecoveryAttempts += record.metrics?.recoveryAttempts || 0;
    adapterModeEntry.avgVerificationFailures += record.metrics?.verificationFailures || 0;
    adapterModeEntry.avgApprovalInterruptions += record.metrics?.approvalInterruptions || 0;
    byAdapterModeMap.set(adapterModeKey, adapterModeEntry);

    const existing = byBenchmarkMap.get(record.benchmarkTaskId) || {
      benchmarkTaskId: record.benchmarkTaskId,
      benchmarkTaskName: record.benchmarkTaskName,
      totalRuns: 0,
      passedRuns: 0,
      failedRuns: 0,
      timeoutRuns: 0,
      successRate: 0,
      avgDurationMs: 0,
      avgRecoveryAttempts: 0,
      avgVerificationFailures: 0,
      avgApprovalInterruptions: 0,
      executionModes: {},
      adapterModes: {},
      visualProviders: {},
      latestRunAt: undefined,
    };

    existing.totalRuns += 1;
    if (record.status === 'completed' && record.evaluation?.passed) {
      existing.passedRuns += 1;
    } else if (record.status === 'timeout') {
      existing.timeoutRuns += 1;
    } else {
      existing.failedRuns += 1;
    }
    existing.avgDurationMs += record.durationMs || 0;
    existing.avgRecoveryAttempts += record.metrics?.recoveryAttempts || 0;
    existing.avgVerificationFailures += record.metrics?.verificationFailures || 0;
    existing.avgApprovalInterruptions += record.metrics?.approvalInterruptions || 0;
    incrementCounter(existing.executionModes, record.executionMode);
    incrementCounter(existing.adapterModes, record.adapterMode);
    incrementCounter(existing.visualProviders, record.visualProvider?.id);
    existing.latestRunAt = Math.max(existing.latestRunAt || 0, record.startedAt || 0);
    byBenchmarkMap.set(record.benchmarkTaskId, existing);
  }

  const byBenchmark = Array.from(byBenchmarkMap.values())
    .map((entry) => ({
      ...entry,
      successRate: entry.totalRuns > 0 ? roundToOneDecimal((entry.passedRuns / entry.totalRuns) * 100) : 0,
      avgDurationMs: entry.totalRuns > 0 ? Math.round(entry.avgDurationMs / entry.totalRuns) : 0,
      avgRecoveryAttempts: entry.totalRuns > 0 ? roundToOneDecimal(entry.avgRecoveryAttempts / entry.totalRuns) : 0,
      avgVerificationFailures:
        entry.totalRuns > 0 ? roundToOneDecimal(entry.avgVerificationFailures / entry.totalRuns) : 0,
      avgApprovalInterruptions:
        entry.totalRuns > 0 ? roundToOneDecimal(entry.avgApprovalInterruptions / entry.totalRuns) : 0,
    }))
    .sort((a, b) => b.totalRuns - a.totalRuns || a.benchmarkTaskName.localeCompare(b.benchmarkTaskName));

  const byExecutionMode = Array.from(byExecutionModeMap.values())
    .map((entry) => ({
      ...entry,
      successRate: entry.totalRuns > 0 ? roundToOneDecimal((entry.passedRuns / entry.totalRuns) * 100) : 0,
      avgDurationMs: entry.totalRuns > 0 ? Math.round(entry.avgDurationMs / entry.totalRuns) : 0,
      avgRecoveryAttempts: entry.totalRuns > 0 ? roundToOneDecimal(entry.avgRecoveryAttempts / entry.totalRuns) : 0,
      avgVerificationFailures:
        entry.totalRuns > 0 ? roundToOneDecimal(entry.avgVerificationFailures / entry.totalRuns) : 0,
      avgApprovalInterruptions:
        entry.totalRuns > 0 ? roundToOneDecimal(entry.avgApprovalInterruptions / entry.totalRuns) : 0,
    }))
    .sort((a, b) => b.totalRuns - a.totalRuns || a.executionMode.localeCompare(b.executionMode));

  const byAdapterMode = Array.from(byAdapterModeMap.values())
    .map((entry) => ({
      ...entry,
      successRate: entry.totalRuns > 0 ? roundToOneDecimal((entry.passedRuns / entry.totalRuns) * 100) : 0,
      avgDurationMs: entry.totalRuns > 0 ? Math.round(entry.avgDurationMs / entry.totalRuns) : 0,
      avgRecoveryAttempts: entry.totalRuns > 0 ? roundToOneDecimal(entry.avgRecoveryAttempts / entry.totalRuns) : 0,
      avgVerificationFailures:
        entry.totalRuns > 0 ? roundToOneDecimal(entry.avgVerificationFailures / entry.totalRuns) : 0,
      avgApprovalInterruptions:
        entry.totalRuns > 0 ? roundToOneDecimal(entry.avgApprovalInterruptions / entry.totalRuns) : 0,
    }))
    .sort((a, b) => b.totalRuns - a.totalRuns || a.adapterMode.localeCompare(b.adapterMode));

  const totalRuns = records.length;

  return {
    summary: {
      totalRuns,
      passedRuns,
      failedRuns,
      timeoutRuns,
      successRate: totalRuns > 0 ? roundToOneDecimal((passedRuns / totalRuns) * 100) : 0,
      avgDurationMs: totalRuns > 0 ? Math.round(totalDurationMs / totalRuns) : 0,
      avgRecoveryAttempts: totalRuns > 0 ? roundToOneDecimal(totalRecoveryAttempts / totalRuns) : 0,
      avgVerificationFailures: totalRuns > 0 ? roundToOneDecimal(totalVerificationFailures / totalRuns) : 0,
      avgApprovalInterruptions: totalRuns > 0 ? roundToOneDecimal(totalApprovalInterruptions / totalRuns) : 0,
    },
    byBenchmark,
    byExecutionMode,
    byAdapterMode,
    approvalAudit: {
      totalTriggeredRuns,
      approvedRuns,
      pendingRuns,
      byActionType: approvalActionTypes,
      byIntentKeyword: approvalIntentKeywords,
      byRiskReason: approvalRiskReasons,
    },
    executionModes,
    adapterModes,
    visualProviders,
  };
}

export function serializeBenchmarkReportJson(report: BenchmarkReport): string {
  return JSON.stringify(report, null, 2);
}

export function serializeBenchmarkReportCsv(report: BenchmarkReport): string {
  const headers = [
    'benchmarkTaskId',
    'benchmarkTaskName',
    'totalRuns',
    'passedRuns',
    'failedRuns',
    'timeoutRuns',
    'successRate',
    'avgDurationMs',
    'avgRecoveryAttempts',
    'avgVerificationFailures',
    'avgApprovalInterruptions',
    'executionModes',
    'adapterModes',
    'visualProviders',
    'latestRunAt',
  ];

  const rows = report.byBenchmark.map((entry) => [
    entry.benchmarkTaskId,
    entry.benchmarkTaskName,
    entry.totalRuns,
    entry.passedRuns,
    entry.failedRuns,
    entry.timeoutRuns,
    entry.successRate,
    entry.avgDurationMs,
    entry.avgRecoveryAttempts,
    entry.avgVerificationFailures,
    entry.avgApprovalInterruptions,
    JSON.stringify(entry.executionModes),
    JSON.stringify(entry.adapterModes),
    JSON.stringify(entry.visualProviders),
    entry.latestRunAt || '',
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell as string | number)).join(','))
    .join('\n');
}
