import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { BenchmarkSuiteRunRepository } from '../BenchmarkSuiteRunRepository';
describe('BenchmarkSuiteRunRepository', () => {
    let tempDir = null;
    afterEach(() => {
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        tempDir = null;
    });
    it('persists and retrieves suite runs', () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencowork-benchmark-suite-runs-'));
        const repository = new BenchmarkSuiteRunRepository(path.join(tempDir, 'benchmark-suite-runs.json'));
        repository.upsert({
            id: 'suite-run-1',
            benchmarkTaskSetId: 'suite-smoke',
            benchmarkTaskSetName: 'Smoke Suite',
            status: 'completed',
            startedAt: 10,
            completedAt: 20,
            durationMs: 10,
            summary: { total: 2, passed: 2, failed: 0, timeout: 0 },
            benchmarkRunIds: ['run-1', 'run-2'],
            benchmarkRuns: [],
        });
        const saved = JSON.parse(fs.readFileSync(path.join(tempDir, 'benchmark-suite-runs.json'), 'utf-8'));
        expect(saved).toHaveLength(1);
        expect(repository.getById('suite-run-1')?.summary.passed).toBe(2);
        expect(repository.listRecent(1)[0].id).toBe('suite-run-1');
    });
});
