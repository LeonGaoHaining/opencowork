import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { BenchmarkTaskRepository } from '../BenchmarkTaskRepository';

describe('BenchmarkTaskRepository', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = null;
  });

  it('loads yaml and json benchmark definitions', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencowork-benchmarks-'));

    fs.writeFileSync(
      path.join(tempDir, 'search.yaml'),
      [
        'id: benchmark-search',
        'name: Search benchmark',
        'description: Find and summarize results',
        'category: data-extraction',
        'prompt: Search for the target item and summarize it.',
        'expectedOutcome:',
        '  successKeywords:',
        '    - target',
        '    - summary',
        '  minArtifacts: 1',
        'initialState:',
        '  initialUrl: https://example.com',
        'executionConfig:',
        '  executionMode: dom',
        '  maxTurns: 5',
        'tags:',
        '  - smoke',
        '  - benchmark',
      ].join('\n'),
      'utf-8'
    );

    fs.writeFileSync(
      path.join(tempDir, 'form.json'),
      JSON.stringify(
        {
          id: 'benchmark-form',
          name: 'Form benchmark',
          description: 'Fill a form successfully',
          category: 'form-filling',
          prompt: 'Complete the registration form.',
          expectedOutcome: {
            successKeywords: ['complete'],
            targetUrl: 'https://example.com/done',
          },
          executionConfig: {
            executionMode: 'hybrid',
            adapterMode: 'responses-computer',
          },
          tags: ['hybrid'],
        },
        null,
        2
      ),
      'utf-8'
    );

    const repository = new BenchmarkTaskRepository(tempDir);
    const tasks = repository.list();

    expect(tasks).toHaveLength(2);
    expect(repository.getById('benchmark-search')?.executionConfig?.maxTurns).toBe(5);
    expect(repository.getById('benchmark-form')?.executionConfig?.adapterMode).toBe(
      'responses-computer'
    );
    expect(tasks[0].id).toBe('benchmark-form');
    expect(tasks[1].id).toBe('benchmark-search');
  });

  it('skips invalid definitions and duplicate ids', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencowork-benchmarks-'));

    fs.writeFileSync(
      path.join(tempDir, 'valid.yaml'),
      [
        'id: benchmark-valid',
        'name: Valid benchmark',
        'description: A valid task',
        'category: multi-step',
        'prompt: Do the valid thing.',
        'expectedOutcome:',
        '  successKeywords:',
        '    - valid',
      ].join('\n'),
      'utf-8'
    );

    fs.writeFileSync(
      path.join(tempDir, 'invalid.yaml'),
      [
        'id: benchmark-invalid',
        'name: Invalid benchmark',
        'description: Missing prompt and outcome',
        'category: unknown',
      ].join('\n'),
      'utf-8'
    );

    fs.writeFileSync(
      path.join(tempDir, 'duplicate.json'),
      JSON.stringify(
        {
          id: 'benchmark-valid',
          name: 'Duplicate benchmark',
          description: 'Same id as valid task',
          category: 'multi-step',
          prompt: 'Duplicate prompt',
          expectedOutcome: {},
        },
        null,
        2
      ),
      'utf-8'
    );

    const repository = new BenchmarkTaskRepository(tempDir);
    const tasks = repository.list();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('benchmark-valid');
    expect(repository.getById('benchmark-invalid')).toBeNull();
  });
});
