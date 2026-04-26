import { TaskArtifact, TaskResult, TaskResultError, createTaskEntityId } from './types';

interface AgentLikeResult {
  success: boolean;
  output?: unknown;
  error?: string;
  finalMessage?: string;
  steps?: Array<{
    toolName?: string;
    args?: Record<string, unknown>;
    result?: unknown;
    status?: string;
  }>;
}

interface VisualTraceEntry {
  source: 'output' | 'step';
  toolName?: string;
  action?: string;
  routeReason?: string;
  fallbackReason?: string;
  approvedActions?: unknown[];
  turns?: unknown[];
}

interface VisualMetricsEntry {
  source: 'output' | 'step';
  toolName?: string;
  action?: string;
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
}

export function createTaskResultError(message: string, code: string = 'TASK_FAILED'): TaskResultError {
  return {
    code,
    message,
    recoverable: true,
  };
}

function isRowArray(value: unknown): value is Array<Record<string, unknown>> {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => item && typeof item === 'object' && !Array.isArray(item))
  );
}

function deriveStructuredData(output: unknown): unknown {
  if (isRowArray(output)) {
    return output;
  }

  if (output && typeof output === 'object') {
    const maybeRows = (output as Record<string, unknown>).rows;
    if (isRowArray(maybeRows)) {
      return maybeRows;
    }
  }

  return undefined;
}

function buildStructuredArtifacts(summary: string, output: unknown): TaskArtifact[] {
  const artifacts: TaskArtifact[] = [];
  const structuredData = deriveStructuredData(output);

  if (isRowArray(structuredData)) {
    const columns = Array.from(
      new Set(structuredData.flatMap((row) => Object.keys(row)))
    );
    artifacts.push({
      id: createTaskEntityId('artifact'),
      type: 'table',
      name: 'Structured rows',
      metadata: {
        columns,
        rows: structuredData,
      },
    });
  }

  if (typeof output === 'string' && /^https?:\/\//.test(output)) {
    artifacts.push({
      id: createTaskEntityId('artifact'),
      type: 'link',
      name: 'Output link',
      uri: output,
    });
  }

  if (typeof output === 'string' && /^\//.test(output)) {
    artifacts.push({
      id: createTaskEntityId('artifact'),
      type: 'file',
      name: 'Output file',
      uri: output,
    });
  }

  return artifacts;
}

function normalizeVisualTraceEntry(
  candidate: unknown,
  source: VisualTraceEntry['source'],
  toolName?: string,
  action?: string
): VisualTraceEntry | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const directTurns = Array.isArray(record.turns) ? record.turns : undefined;
  const nestedOutput =
    record.output && typeof record.output === 'object'
      ? (record.output as Record<string, unknown>)
      : undefined;
  const nestedTurns = Array.isArray(nestedOutput?.turns) ? nestedOutput?.turns : undefined;
  const approvedActions = Array.isArray(record.approvedActions)
    ? record.approvedActions
    : Array.isArray(nestedOutput?.approvedActions)
      ? nestedOutput?.approvedActions
      : undefined;
  const routeReason =
    typeof record.routeReason === 'string'
      ? record.routeReason
      : typeof nestedOutput?.routeReason === 'string'
        ? nestedOutput.routeReason
        : undefined;
  const fallbackReason =
    typeof record.fallbackReason === 'string'
      ? record.fallbackReason
      : typeof nestedOutput?.fallbackReason === 'string'
        ? nestedOutput.fallbackReason
        : undefined;
  const turns = directTurns || nestedTurns;

  if (!turns && !approvedActions && !routeReason && !fallbackReason) {
    return null;
  }

  return {
    source,
    toolName,
    action,
    routeReason,
    fallbackReason,
    approvedActions,
    turns,
  };
}

function normalizeVisualMetricsEntry(
  candidate: unknown,
  source: VisualMetricsEntry['source'],
  toolName?: string,
  action?: string
): VisualMetricsEntry | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const nestedOutput =
    record.output && typeof record.output === 'object'
      ? (record.output as Record<string, unknown>)
      : undefined;
  const rawMetrics =
    record.metrics && typeof record.metrics === 'object'
      ? (record.metrics as Record<string, unknown>)
      : nestedOutput?.metrics && typeof nestedOutput.metrics === 'object'
        ? (nestedOutput.metrics as Record<string, unknown>)
        : undefined;

  if (!rawMetrics) {
    return null;
  }

  return {
    source,
    toolName,
    action,
    totalTurns: typeof rawMetrics.totalTurns === 'number' ? rawMetrics.totalTurns : undefined,
    actionBatches: typeof rawMetrics.actionBatches === 'number' ? rawMetrics.actionBatches : undefined,
    proposedActionCount:
      typeof rawMetrics.proposedActionCount === 'number' ? rawMetrics.proposedActionCount : undefined,
    executedActionCount:
      typeof rawMetrics.executedActionCount === 'number' ? rawMetrics.executedActionCount : undefined,
    approvalInterruptions:
      typeof rawMetrics.approvalInterruptions === 'number'
        ? rawMetrics.approvalInterruptions
        : undefined,
    recoveryAttempts:
      typeof rawMetrics.recoveryAttempts === 'number' ? rawMetrics.recoveryAttempts : undefined,
    verificationFailures:
      typeof rawMetrics.verificationFailures === 'number'
        ? rawMetrics.verificationFailures
        : undefined,
    recoveryStrategies: Array.isArray(rawMetrics.recoveryStrategies)
      ? rawMetrics.recoveryStrategies.filter((value): value is string => typeof value === 'string')
      : undefined,
    recoveryDetails: Array.isArray(rawMetrics.recoveryDetails)
      ? rawMetrics.recoveryDetails
          .filter((value): value is Record<string, unknown> => !!value && typeof value === 'object')
          .map((detail) => ({
            strategy: typeof detail.strategy === 'string' ? detail.strategy : undefined,
            category: typeof detail.category === 'string' ? detail.category : undefined,
            trigger: typeof detail.trigger === 'string' ? detail.trigger : undefined,
            errorCode: typeof detail.errorCode === 'string' ? detail.errorCode : undefined,
            errorMessage: typeof detail.errorMessage === 'string' ? detail.errorMessage : undefined,
            failedActions: Array.isArray(detail.failedActions)
              ? detail.failedActions.filter((value): value is string => typeof value === 'string')
              : undefined,
            attempt: typeof detail.attempt === 'number' ? detail.attempt : undefined,
          }))
      : undefined,
    totalDurationMs:
      typeof rawMetrics.totalDurationMs === 'number' ? rawMetrics.totalDurationMs : undefined,
  };
}

function collectVisualTrace(agentResult: AgentLikeResult): VisualTraceEntry[] {
  const trace: VisualTraceEntry[] = [];

  const outputTrace = normalizeVisualTraceEntry(agentResult.output, 'output');
  if (outputTrace) {
    trace.push(outputTrace);
  }

  for (const step of agentResult.steps || []) {
    const stepTrace = normalizeVisualTraceEntry(
      step.result,
      'step',
      step.toolName,
      typeof step.args?.action === 'string' ? step.args.action : undefined
    );
    if (stepTrace) {
      trace.push(stepTrace);
    }
  }

  return trace;
}

function collectVisualMetrics(agentResult: AgentLikeResult): VisualMetricsEntry[] {
  const metrics: VisualMetricsEntry[] = [];

  const outputMetrics = normalizeVisualMetricsEntry(agentResult.output, 'output');
  if (outputMetrics) {
    metrics.push(outputMetrics);
  }

  for (const step of agentResult.steps || []) {
    const stepMetrics = normalizeVisualMetricsEntry(
      step.result,
      'step',
      step.toolName,
      typeof step.args?.action === 'string' ? step.args.action : undefined
    );
    if (stepMetrics) {
      metrics.push(stepMetrics);
    }
  }

  return metrics;
}

function buildRawOutput(
  output: unknown,
  visualTrace: VisualTraceEntry[],
  visualMetrics: VisualMetricsEntry[]
): unknown {
  if (visualTrace.length === 0 && visualMetrics.length === 0) {
    return output;
  }

  if (output && typeof output === 'object' && !Array.isArray(output)) {
    return {
      ...(output as Record<string, unknown>),
      visualTrace,
      visualMetrics,
    };
  }

  return {
    value: output,
    visualTrace,
    visualMetrics,
  };
}

export function mapAgentResultToTaskResult(agentResult: AgentLikeResult): TaskResult {
  const completedAt = Date.now();
  const structuredData = deriveStructuredData(agentResult.output);
  const visualTrace = collectVisualTrace(agentResult);
  const visualMetrics = collectVisualMetrics(agentResult);
  const summary =
    agentResult.finalMessage ||
    (typeof agentResult.output === 'string' ? agentResult.output : '') ||
    (agentResult.success ? '任务已完成' : agentResult.error || '任务执行失败');

  return {
    id: createTaskEntityId('result'),
    summary,
    structuredData,
    artifacts: buildStructuredArtifacts(summary, agentResult.output),
    rawOutput: buildRawOutput(agentResult.output, visualTrace, visualMetrics),
    error: agentResult.success ? undefined : createTaskResultError(agentResult.error || '任务执行失败'),
    reusable: !!agentResult.success,
    completedAt,
  };
}
