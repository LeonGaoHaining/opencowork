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

  return {
    hasVisualTrace:
      turns.length > 0 || approvedActions.length > 0 || routeReasons.length > 0 || fallbackReasons.length > 0,
    routeReasons: Array.from(new Set(routeReasons)),
    fallbackReasons: Array.from(new Set(fallbackReasons)),
    approvedActions,
    turns,
    entries,
  };
}
