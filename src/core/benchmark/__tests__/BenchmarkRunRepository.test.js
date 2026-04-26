import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { BenchmarkRunRepository } from '../BenchmarkRunRepository';
describe('BenchmarkRunRepository', () => {
    let tempDir = null;
    afterEach(() => {
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        tempDir = null;
    });
    it('persists and filters benchmark runs', () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencowork-benchmark-runs-'));
        const repository = new BenchmarkRunRepository(path.join(tempDir, 'benchmark-runs.json'));
        repository.upsert({
            id: 'run-1',
            benchmarkTaskId: 'benchmark-a',
            benchmarkTaskName: 'Benchmark A',
            runId: 'task-run-1',
            status: 'completed',
            startedAt: 100,
            completedAt: 200,
            durationMs: 100,
            evaluation: {
                passed: true,
                summary: 'ok',
                checks: [],
            },
        });
        repository.upsert({
            id: 'run-2',
            benchmarkTaskId: 'benchmark-b',
            benchmarkTaskName: 'Benchmark B',
            runId: 'task-run-2',
            status: 'failed',
            startedAt: 300,
            completedAt: 450,
            durationMs: 150,
            error: 'failed',
        });
        const saved = JSON.parse(fs.readFileSync(path.join(tempDir, 'benchmark-runs.json'), 'utf-8'));
        expect(saved).toHaveLength(2);
        expect(repository.getById('run-1')?.status).toBe('completed');
        expect(repository.listByBenchmarkId('benchmark-a')).toHaveLength(1);
        expect(repository.listRecent(1)[0].id).toBe('run-2');
    });
});
