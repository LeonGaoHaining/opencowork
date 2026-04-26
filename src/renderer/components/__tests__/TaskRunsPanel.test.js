import { jsx as _jsx } from "react/jsx-runtime";
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const runTemplate = vi.fn();
const prepareDraftFromTemplate = vi.fn();
const prepareDraftFromPrompt = vi.fn();
const setSelectedRunsPanelRunId = vi.fn();
const invoke = vi.fn(async (channel) => {
    if (channel === 'task:run:list') {
        return {
            success: true,
            data: [
                {
                    id: 'run-1',
                    source: 'chat',
                    status: 'completed',
                    title: 'Visual fallback task',
                    templateId: 'template-1',
                    input: { prompt: 'Search the page visually' },
                    startedAt: 1710000000000,
                    endedAt: 1710000005000,
                },
            ],
        };
    }
    if (channel === 'task:run:details') {
        return {
            success: true,
            data: {
                run: {
                    id: 'run-1',
                    source: 'chat',
                    status: 'completed',
                    title: 'Visual fallback task',
                    templateId: 'template-1',
                    input: { prompt: 'Search the page visually' },
                    startedAt: 1710000000000,
                    endedAt: 1710000005000,
                    metadata: {
                        visualProvider: {
                            id: 'responses-computer',
                            name: 'Responses Computer',
                            score: 92,
                            reasons: ['highest completion', 'supports computer tool'],
                            adapterMode: 'responses-computer',
                        },
                    },
                },
                result: {
                    id: 'result-1',
                    summary: 'Visual fallback completed successfully',
                    artifacts: [],
                    reusable: true,
                    completedAt: 1710000005000,
                    rawOutput: {
                        visualTrace: [
                            {
                                source: 'step',
                                routeReason: 'browser-action-visual-route',
                                fallbackReason: 'Recoverable selector failure',
                                approvedActions: [{ type: 'click' }],
                                turns: [
                                    {
                                        turnId: 'turn-1',
                                        proposedActions: [{ type: 'click' }, { type: 'type' }],
                                        executedActions: [{ type: 'click' }, { type: 'type' }],
                                        finalMessage: 'Search submitted',
                                        duration: 1200,
                                    },
                                ],
                            },
                        ],
                    },
                },
                template: null,
                history: null,
            },
        };
    }
    return { success: true, data: null };
});
vi.mock('../../stores/historyStore', () => ({
    useHistoryStore: () => ({
        runTemplate,
    }),
}));
vi.mock('../../stores/schedulerStore', () => ({
    useSchedulerStore: () => ({
        prepareDraftFromTemplate,
        prepareDraftFromPrompt,
    }),
}));
vi.mock('../../stores/taskStore', () => ({
    useTaskStore: () => ({
        selectedRunsPanelRunId: 'run-1',
        setSelectedRunsPanelRunId,
    }),
}));
vi.mock('../../i18n/useTranslation', () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));
vi.mock('../RelationBadge', () => ({
    default: ({ label, value, onClick, }) => onClick ? (_jsx("button", { onClick: onClick, children: `${label}:${value}` })) : (_jsx("span", { children: `${label}:${value}` })),
}));
vi.mock('../ArtifactViewer', () => ({
    default: () => _jsx("div", { children: "artifact-viewer" }),
}));
beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'dispatchEvent');
    window.electron = {
        invoke,
    };
});
import { TaskRunsPanel } from '../TaskRunsPanel';
describe('TaskRunsPanel', () => {
    it('renders persisted visual trace summary in run details', async () => {
        render(_jsx(TaskRunsPanel, { isOpen: true, onClose: vi.fn() }));
        await waitFor(() => {
            expect(screen.getByText('Visual fallback task')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Visual fallback task'));
        await waitFor(() => {
            expect(screen.getByText('taskPanels.visualTrace')).toBeInTheDocument();
        });
        expect(screen.getByText('template:template-1')).toBeInTheDocument();
        expect(screen.getByText('browser-action-visual-route')).toBeInTheDocument();
        expect(screen.getByText('Recoverable selector failure')).toBeInTheDocument();
        expect(screen.getByText('click')).toBeInTheDocument();
        expect(screen.getAllByText((_, element) => element?.textContent?.includes('Responses Computer') ?? false).length).toBeGreaterThan(0);
        expect(screen.getAllByText((_, element) => element?.textContent?.replace(/\s+/g, ' ').includes('score: 92') ?? false).length).toBeGreaterThan(0);
        expect(screen.getAllByText('highest completion').length).toBeGreaterThan(0);
        expect(screen.getByText('1')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'template:template-1' }));
        expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
    });
    it('refreshes selected run details when a template changes', async () => {
        render(_jsx(TaskRunsPanel, { isOpen: true, onClose: vi.fn() }));
        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('task:run:list', { limit: 100 });
        });
        act(() => {
            window.dispatchEvent(new CustomEvent('template:changed', { detail: { templateId: 'template-1' } }));
        });
        await waitFor(() => {
            expect(invoke.mock.calls.filter(([channel]) => channel === 'task:run:details').length).toBeGreaterThanOrEqual(2);
        });
    });
});
