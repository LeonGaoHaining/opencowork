import { describe, expect, it } from 'vitest';
import { mapVisualTurnsToAgentSteps } from '../visualSteps';
describe('mapVisualTurnsToAgentSteps', () => {
    it('returns an empty array for non-array input', () => {
        expect(mapVisualTurnsToAgentSteps(null)).toEqual([]);
        expect(mapVisualTurnsToAgentSteps({})).toEqual([]);
    });
    it('maps visual turns into visual agent steps', () => {
        const result = mapVisualTurnsToAgentSteps([
            {
                turnId: 'turn-1',
                observationSummary: 'Search page visible',
                proposedActions: [{ type: 'click' }, { type: 'type' }],
                executedActions: [{ type: 'click' }, { type: 'type' }],
                duration: 1200,
            },
            {
                turnId: 'turn-2',
                finalMessage: 'Search completed',
                duration: 800,
            },
        ]);
        expect(result).toHaveLength(2);
        expect(result[0].toolName).toBe('visual');
        expect(result[0].args.summary).toBe('click, type');
        expect(result[0].status).toBe('completed');
        expect(result[1].result).toBe('Search completed');
        expect(result[1].status).toBe('completed');
    });
    it('marks turns without executed actions or final messages as running', () => {
        const result = mapVisualTurnsToAgentSteps([
            {
                turnId: 'turn-3',
                observationSummary: 'Inspecting page',
                proposedActions: [{ type: 'wait' }],
            },
        ]);
        expect(result[0].status).toBe('running');
        expect(result[0].result).toBe('wait');
    });
});
