import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskResultRepository } from '../TaskResultRepository';
describe('TaskResultRepository', () => {
    let tempDir = null;
    afterEach(() => {
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        tempDir = null;
    });
    const createRepository = () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencowork-results-'));
        return new TaskResultRepository(path.join(tempDir, 'task-results.json'));
    };
    const createResult = (overrides = {}) => ({
        id: 'result-1',
        summary: 'Found 3 vendors',
        artifacts: [],
        reusable: true,
        completedAt: 1000,
        ...overrides,
    });
    it('saves and loads results', () => {
        const repository = createRepository();
        const result = createResult();
        repository.save(result);
        expect(repository.getById(result.id)).toEqual(result);
        expect(repository.list()).toEqual([result]);
        expect(repository.listRecent()).toEqual([result]);
    });
    it('updates existing results by id', () => {
        const repository = createRepository();
        const first = createResult({ summary: 'First', completedAt: 1000 });
        const updated = createResult({ summary: 'Updated', completedAt: 2000 });
        repository.save(first);
        repository.save(updated);
        expect(repository.list()).toEqual([updated]);
        expect(repository.getById(first.id)?.summary).toBe('Updated');
    });
    it('returns recent results sorted by completedAt', () => {
        const repository = createRepository();
        const older = createResult({ id: 'result-older', completedAt: 1000 });
        const newer = createResult({ id: 'result-newer', completedAt: 2000 });
        repository.save(older);
        repository.save(newer);
        expect(repository.listRecent()).toEqual([newer, older]);
    });
});
