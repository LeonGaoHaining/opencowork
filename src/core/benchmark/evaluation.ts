import { BenchmarkEvaluation, BenchmarkEvaluationCheck, BenchmarkTask, BenchmarkTaskRunMetrics } from './types';
import { TaskResult } from '../task/types';

function stringifyTaskResult(result: TaskResult): string {
  const parts: string[] = [result.summary];

  if (typeof result.rawOutput === 'string') {
    parts.push(result.rawOutput);
  } else if (result.rawOutput && typeof result.rawOutput === 'object') {
    try {
      parts.push(JSON.stringify(result.rawOutput));
    } catch {
      // ignore stringify issues for benchmark matching
    }
  }

  for (const artifact of result.artifacts) {
    parts.push(artifact.name);
    if (artifact.uri) {
      parts.push(artifact.uri);
    }
    if (artifact.content) {
      parts.push(artifact.content);
    }
  }

  return parts.join('\n').toLowerCase();
}

function createCheck(id: string, label: string, passed: boolean, detail?: string): BenchmarkEvaluationCheck {
  return {
    id,
    label,
    passed,
    detail,
  };
}

export function evaluateBenchmarkTask(params: {
  benchmark: BenchmarkTask;
  result: TaskResult;
  metrics?: Partial<BenchmarkTaskRunMetrics>;
}): BenchmarkEvaluation {
  const searchSpace = stringifyTaskResult(params.result);
  const checks: BenchmarkEvaluationCheck[] = [];

  const successKeywords = params.benchmark.expectedOutcome.successKeywords || [];
  if (successKeywords.length > 0) {
    const matchedKeywords = successKeywords.filter((keyword) => searchSpace.includes(keyword.toLowerCase()));
    checks.push(
      createCheck(
        'success-keywords',
        'Success keywords',
        matchedKeywords.length === successKeywords.length,
        matchedKeywords.length === successKeywords.length
          ? `Matched ${matchedKeywords.length}/${successKeywords.length} keywords`
          : `Matched ${matchedKeywords.length}/${successKeywords.length} keywords`
      )
    );
  }

  if (typeof params.benchmark.expectedOutcome.minArtifacts === 'number') {
    const artifactCount = params.result.artifacts.length;
    checks.push(
      createCheck(
        'min-artifacts',
        'Minimum artifacts',
        artifactCount >= params.benchmark.expectedOutcome.minArtifacts,
        `Found ${artifactCount}, expected at least ${params.benchmark.expectedOutcome.minArtifacts}`
      )
    );
  }

  if (params.benchmark.expectedOutcome.targetUrl) {
    const expectedUrl = params.benchmark.expectedOutcome.targetUrl.toLowerCase();
    const found = searchSpace.includes(expectedUrl);
    checks.push(
      createCheck(
        'target-url',
        'Target URL',
        found,
        found ? `Observed ${params.benchmark.expectedOutcome.targetUrl}` : `Missing ${params.benchmark.expectedOutcome.targetUrl}`
      )
    );
  }

  const passed = checks.length > 0 ? checks.every((check) => check.passed) : params.result.error ? false : true;
  const totalRecoveryAttempts = params.metrics?.recoveryAttempts || 0;
  const summary = passed
    ? `Benchmark passed with ${totalRecoveryAttempts} recovery attempt(s).`
    : `Benchmark failed with ${totalRecoveryAttempts} recovery attempt(s).`;

  return {
    passed,
    summary,
    checks,
  };
}
