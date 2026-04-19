import { TaskArtifact, TaskResult, TaskResultError, createTaskEntityId } from './types';

interface AgentLikeResult {
  success: boolean;
  output?: unknown;
  error?: string;
  finalMessage?: string;
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

export function mapAgentResultToTaskResult(agentResult: AgentLikeResult): TaskResult {
  const completedAt = Date.now();
  const structuredData = deriveStructuredData(agentResult.output);
  const summary =
    agentResult.finalMessage ||
    (typeof agentResult.output === 'string' ? agentResult.output : '') ||
    (agentResult.success ? '任务已完成' : agentResult.error || '任务执行失败');

  return {
    id: createTaskEntityId('result'),
    summary,
    structuredData,
    artifacts: buildStructuredArtifacts(summary, agentResult.output),
    rawOutput: agentResult.output,
    error: agentResult.success ? undefined : createTaskResultError(agentResult.error || '任务执行失败'),
    reusable: !!agentResult.success,
    completedAt,
  };
}
