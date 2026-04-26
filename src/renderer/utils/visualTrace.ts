export interface VisualTraceTurn {
  turnId?: string;
  proposedActions?: Array<{ type?: string }>;
  executedActions?: Array<{ type?: string }>;
  finalMessage?: string;
  duration?: number;
}

export interface VisualTraceEntry {
  source?: 'output' | 'step';
  toolName?: string;
  action?: string;
  routeReason?: string;
  fallbackReason?: string;
  approvedActions?: Array<{ type?: string }>;
  turns?: VisualTraceTurn[];
}

export interface VisualTraceSummary {
  hasVisualTrace: boolean;
  routeReasons: string[];
  fallbackReasons: string[];
  approvedActions: Array<{ type?: string }>;
  turns: VisualTraceTurn[];
  entries: VisualTraceEntry[];
  metrics: {
    totalTurns?: number;
    actionBatches?: number;
    proposedActionCount?: number;
    executedActionCount?: number;
    approvalInterruptions?: number;
    recoveryAttempts?: number;
    verificationFailures?: number;
    recoveryStrategies?: string[];
    recoveryDetails?: Array<{
      strategy?: string;
      category?: string;
      trigger?: string;
      errorCode?: string;
      errorMessage?: string;
      failedActions?: string[];
      attempt?: number;
    }>;
    totalDurationMs?: number;
  };
}

export function extractVisualTraceSummary(rawOutput: unknown): VisualTraceSummary {
  const record = rawOutput && typeof rawOutput === 'object' ? (rawOutput as Record<string, unknown>) : null;
  const entries = Array.isArray(record?.visualTrace)
    ? (record?.visualTrace as VisualTraceEntry[])
    : [];
  const topLevelTurns = Array.isArray(record?.turns) ? (record?.turns as VisualTraceTurn[]) : [];
  const topLevelApprovedActions = Array.isArray(record?.approvedActions)
    ? (record?.approvedActions as Array<{ type?: string }>)
    : [];
  const turns = [...topLevelTurns, ...entries.flatMap((entry) => (Array.isArray(entry.turns) ? entry.turns : []))];
  const approvedActions = [
    ...topLevelApprovedActions,
    ...entries.flatMap((entry) =>
      Array.isArray(entry.approvedActions) ? entry.approvedActions : []
    ),
  ];
  const routeReasons = [
    ...(typeof record?.routeReason === 'string' ? [record.routeReason] : []),
    ...entries
      .map((entry) => entry.routeReason)
      .filter((value): value is string => typeof value === 'string'),
  ];
  const fallbackReasons = [
    ...(typeof record?.fallbackReason === 'string' ? [record.fallbackReason] : []),
    ...entries
      .map((entry) => entry.fallbackReason)
      .filter((value): value is string => typeof value === 'string'),
  ];
  const metricEntries = Array.isArray(record?.visualMetrics)
    ? (record.visualMetrics as Array<Record<string, unknown>>)
    : [];
  const metrics = metricEntries.reduce<VisualTraceSummary['metrics']>((acc, entry) => ({
    totalTurns: Math.max(acc.totalTurns || 0, typeof entry.totalTurns === 'number' ? entry.totalTurns : 0) || acc.totalTurns,
    actionBatches:
      Math.max(acc.actionBatches || 0, typeof entry.actionBatches === 'number' ? entry.actionBatches : 0) ||
      acc.actionBatches,
    proposedActionCount:
      Math.max(
        acc.proposedActionCount || 0,
        typeof entry.proposedActionCount === 'number' ? entry.proposedActionCount : 0
      ) || acc.proposedActionCount,
    executedActionCount:
      Math.max(
        acc.executedActionCount || 0,
        typeof entry.executedActionCount === 'number' ? entry.executedActionCount : 0
      ) || acc.executedActionCount,
    approvalInterruptions:
      Math.max(
        acc.approvalInterruptions || 0,
        typeof entry.approvalInterruptions === 'number' ? entry.approvalInterruptions : 0
      ) || acc.approvalInterruptions,
    recoveryAttempts:
      Math.max(acc.recoveryAttempts || 0, typeof entry.recoveryAttempts === 'number' ? entry.recoveryAttempts : 0) ||
      acc.recoveryAttempts,
    verificationFailures:
      Math.max(
        acc.verificationFailures || 0,
        typeof entry.verificationFailures === 'number' ? entry.verificationFailures : 0
      ) || acc.verificationFailures,
    recoveryStrategies: Array.from(
      new Set([
        ...(acc.recoveryStrategies || []),
        ...(Array.isArray(entry.recoveryStrategies)
          ? entry.recoveryStrategies.filter((value): value is string => typeof value === 'string')
          : []),
      ])
    ),
    recoveryDetails: [
      ...(acc.recoveryDetails || []),
      ...(Array.isArray(entry.recoveryDetails)
        ? entry.recoveryDetails.filter(
            (value): value is NonNullable<VisualTraceSummary['metrics']['recoveryDetails']>[number] =>
              !!value && typeof value === 'object'
          )
        : []),
    ],
    totalDurationMs:
      Math.max(acc.totalDurationMs || 0, typeof entry.totalDurationMs === 'number' ? entry.totalDurationMs : 0) ||
      acc.totalDurationMs,
  }), {});

  return {
    hasVisualTrace:
      turns.length > 0 || approvedActions.length > 0 || routeReasons.length > 0 || fallbackReasons.length > 0,
    routeReasons: Array.from(new Set(routeReasons)),
    fallbackReasons: Array.from(new Set(fallbackReasons)),
    approvedActions,
    turns,
    entries,
    metrics,
  };
}
