import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { BenchmarkSuiteRepository } from '../BenchmarkSuiteRepository';

describe('BenchmarkSuiteRepository', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = null;
  });

  it('loads benchmark suites from yaml and json', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencowork-benchmark-suites-'));

    fs.writeFileSync(
      path.join(tempDir, 'smoke.yaml'),
      [
        'id: suite-smoke',
        'name: Smoke Suite',
        'description: Smoke tests',
        'benchmarkIds:',
        '  - benchmark-dom-search',
        '  - benchmark-hybrid-form-fill',
        'tags:',
        '  - smoke',
      ].join('\n'),
      'utf-8'
    );

    fs.writeFileSync(
      path.join(tempDir, 'recovery.json'),
      JSON.stringify(
        {
          id: 'suite-recovery',
          name: 'Recovery Suite',
          benchmarkIds: ['benchmark-approval-recovery'],
        },
        null,
        2
      ),
      'utf-8'
    );

    const repository = new BenchmarkSuiteRepository(tempDir);
    const suites = repository.list();

    expect(suites).toHaveLength(2);
    expect(repository.getById('suite-smoke')?.benchmarkIds).toEqual([
      'benchmark-dom-search',
      'benchmark-hybrid-form-fill',
    ]);
    expect(repository.getById('suite-recovery')?.name).toBe('Recovery Suite');
  });
});
