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

function buildRawOutput(output: unknown, visualTrace: VisualTraceEntry[]): unknown {
  if (visualTrace.length === 0) {
    return output;
  }

  if (output && typeof output === 'object' && !Array.isArray(output)) {
    return {
      ...(output as Record<string, unknown>),
      visualTrace,
    };
  }

  return {
    value: output,
    visualTrace,
  };
}

export function mapAgentResultToTaskResult(agentResult: AgentLikeResult): TaskResult {
  const completedAt = Date.now();
  const structuredData = deriveStructuredData(agentResult.output);
  const visualTrace = collectVisualTrace(agentResult);
  const summary =
    agentResult.finalMessage ||
    (typeof agentResult.output === 'string' ? agentResult.output : '') ||
    (agentResult.success ? '任务已完成' : agentResult.error || '任务执行失败');

  return {
    id: createTaskEntityId('result'),
    summary,
    structuredData,
    artifacts: buildStructuredArtifacts(summary, agentResult.output),
    rawOutput: buildRawOutput(agentResult.output, visualTrace),
    error: agentResult.success ? undefined : createTaskResultError(agentResult.error || '任务执行失败'),
    reusable: !!agentResult.success,
    completedAt,
  };
}
