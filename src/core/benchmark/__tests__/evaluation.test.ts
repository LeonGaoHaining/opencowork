import { describe, expect, it } from 'vitest';
import { evaluateBenchmarkTask } from '../evaluation';

describe('evaluateBenchmarkTask', () => {
  it('passes when keywords, artifacts, and url match', () => {
    const evaluation = evaluateBenchmarkTask({
      benchmark: {
        id: 'benchmark-1',
        name: 'Benchmark 1',
        description: 'desc',
        category: 'data-extraction',
        prompt: 'prompt',
        expectedOutcome: {
          successKeywords: ['done', 'summary'],
          minArtifacts: 1,
          targetUrl: 'https://example.com/success',
        },
        createdAt: 1,
        updatedAt: 1,
      },
      result: {
        id: 'result-1',
        summary: 'Done summary',
        artifacts: [{ id: 'artifact-1', type: 'link', name: 'Success page', uri: 'https://example.com/success' }],
        reusable: true,
        completedAt: 1,
        rawOutput: { finalUrl: 'https://example.com/success' },
      },
      metrics: { recoveryAttempts: 1 },
    });

    expect(evaluation.passed).toBe(true);
    expect(evaluation.checks).toHaveLength(3);
  });

  it('fails when required checks are missing', () => {
    const evaluation = evaluateBenchmarkTask({
      benchmark: {
        id: 'benchmark-2',
        name: 'Benchmark 2',
        description: 'desc',
        category: 'form-filling',
        prompt: 'prompt',
        expectedOutcome: {
          successKeywords: ['success'],
          minArtifacts: 2,
        },
        createdAt: 1,
        updatedAt: 1,
      },
      result: {
        id: 'result-2',
        summary: 'Almost there',
        artifacts: [{ id: 'artifact-1', type: 'text', name: 'Only one artifact' }],
        reusable: true,
        completedAt: 1,
      },
    });

    expect(evaluation.passed).toBe(false);
    expect(evaluation.checks.some((check) => !check.passed)).toBe(true);
  });
});
