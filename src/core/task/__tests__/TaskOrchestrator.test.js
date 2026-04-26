import { describe, expect, it } from 'vitest';
import { TaskOrchestrator } from '../TaskOrchestrator';
class InMemoryRunRepository {
    runs = new Map();
    list() {
        return Array.from(this.runs.values());
    }
    upsert(run) {
        this.runs.set(run.id, { ...run });
    }
    getById(id) {
        return this.runs.get(id) || null;
    }
}
describe('TaskOrchestrator', () => {
    it('marks approval-required errors as waiting_user instead of failed', async () => {
        const repository = new InMemoryRunRepository();
        const orchestrator = new TaskOrchestrator(repository);
        const run = orchestrator.startRun({
            runId: 'run-approval',
            source: 'chat',
            prompt: 'Submit the form',
        });
        await expect(orchestrator.executeRun(run.id, async () => {
            const error = new Error('Approval required');
            Object.assign(error, { code: 'APPROVAL_REQUIRED' });
            throw error;
        })).rejects.toThrow('Approval required');
        expect(orchestrator.getRun(run.id)?.status).toBe('waiting_user');
    });
    it('merges run metadata patches without dropping previous fields', () => {
        const repository = new InMemoryRunRepository();
        const orchestrator = new TaskOrchestrator(repository);
        const run = orchestrator.startRun({
            runId: 'run-metadata',
            source: 'chat',
            prompt: 'Resume after takeover',
            metadata: {
                threadId: 'thread-1',
            },
        });
        orchestrator.updateMetadata(run.id, {
            takeover: {
                active: true,
            },
        });
        expect(orchestrator.getRun(run.id)?.metadata).toEqual({
            threadId: 'thread-1',
            takeover: {
                active: true,
            },
        });
    });
});
