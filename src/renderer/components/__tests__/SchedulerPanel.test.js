import { jsx as _jsx } from "react/jsx-runtime";
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const loadTasks = vi.fn();
const createTask = vi.fn(async () => undefined);
const updateTask = vi.fn();
const deleteTask = vi.fn();
const triggerTask = vi.fn();
const enableTask = vi.fn();
const disableTask = vi.fn();
const selectTask = vi.fn();
const setOpen = vi.fn();
const clearDraft = vi.fn();
const openRunsPanel = vi.fn();
const schedulerStoreState = {
    tasks: [],
    isLoading: false,
    error: null,
    selectedTaskId: null,
    isOpen: true,
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    triggerTask,
    enableTask,
    disableTask,
    selectTask,
    setOpen,
    draftTaskInput: null,
    clearDraft,
};
vi.mock('../../stores/schedulerStore', () => ({
    useSchedulerStore: () => schedulerStoreState,
    defaultTaskInput: {},
}));
vi.mock('../../stores/taskStore', () => ({
    useTaskStore: () => ({
        openRunsPanel,
    }),
}));
vi.mock('../../i18n/useTranslation', () => ({
    useTranslation: () => ({
        t: (key, params) => {
            if (key === 'schedulerPanel.totalTasks') {
                return `${params?.count || 0} tasks`;
            }
            return key;
        },
    }),
}));
describe('SchedulerPanel', () => {
    const invoke = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
        invoke.mockImplementation((channel) => {
            if (channel === 'template:list') {
                return Promise.resolve({ success: true, data: [] });
            }
            return Promise.resolve({ success: true, data: [] });
        });
        Object.defineProperty(window, 'electron', {
            configurable: true,
            value: {
                invoke,
            },
        });
    });
    it('passes executionMode when creating a scheduled task', async () => {
        const { default: SchedulerPanel } = await import('../SchedulerPanel');
        render(_jsx(SchedulerPanel, {}));
        fireEvent.click(screen.getByRole('button', { name: 'schedulerPanel.addTask' }));
        await waitFor(() => {
            expect(screen.getByText('schedulerPanel.createTask')).toBeInTheDocument();
        });
        const taskNameInput = screen.getByPlaceholderText('schedulerPanel.placeholder.taskName');
        const taskDescriptionInput = screen.getByPlaceholderText('schedulerPanel.placeholder.taskDescription');
        const taskContentTextarea = screen.getByPlaceholderText('schedulerPanel.placeholder.taskContent');
        fireEvent.change(taskNameInput, { target: { value: 'Visual Scheduler Task' } });
        fireEvent.change(taskDescriptionInput, { target: { value: 'Run with visual mode' } });
        fireEvent.change(taskContentTextarea, { target: { value: 'Open the menu and click publish' } });
        const executionModeSelect = screen.getAllByRole('combobox')[2];
        fireEvent.change(executionModeSelect, { target: { value: 'hybrid' } });
        fireEvent.click(screen.getByRole('button', { name: 'schedulerPanel.create' }));
        await waitFor(() => {
            expect(createTask).toHaveBeenCalled();
        });
        expect(createTask).toHaveBeenCalledWith(expect.objectContaining({
            execution: expect.objectContaining({
                executionMode: 'hybrid',
            }),
        }));
    });
    it('refreshes templates when a template changes', async () => {
        const { default: SchedulerPanel } = await import('../SchedulerPanel');
        render(_jsx(SchedulerPanel, {}));
        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('template:list');
        });
        act(() => {
            window.dispatchEvent(new CustomEvent('template:changed', { detail: { templateId: 'template-1' } }));
        });
        await waitFor(() => {
            expect(invoke.mock.calls.filter(([channel]) => channel === 'template:list').length).toBeGreaterThanOrEqual(2);
        });
    });
    it('opens the template panel from a scheduled task badge', async () => {
        schedulerStoreState.tasks = [
            {
                id: 'task-1',
                name: 'Weekly sync',
                description: 'Run the weekly sync workflow',
                enabled: true,
                schedule: { type: 'cron', cron: '0 9 * * 1' },
                nextRun: null,
                runCount: 3,
                execution: {
                    templateId: 'template-1',
                    executionMode: 'dom',
                    input: {},
                },
            },
        ];
        schedulerStoreState.selectedTaskId = null;
        const { default: SchedulerPanel } = await import('../SchedulerPanel');
        render(_jsx(SchedulerPanel, {}));
        await waitFor(() => {
            expect(screen.getByText('Weekly sync')).toBeInTheDocument();
        });
        const handler = vi.fn();
        window.addEventListener('template:open', handler);
        fireEvent.click(screen.getByRole('button', { name: /template.*template-1/i }));
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0]).toMatchObject({
            type: 'template:open',
            detail: { templateId: 'template-1' },
        });
        window.removeEventListener('template:open', handler);
    });
});
