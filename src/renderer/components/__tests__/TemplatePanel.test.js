import { jsx as _jsx } from "react/jsx-runtime";
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const runTemplate = vi.fn();
const prepareDraftFromTemplate = vi.fn();
vi.mock('../../stores/historyStore', () => ({
    useHistoryStore: () => ({
        runTemplate,
    }),
}));
vi.mock('../../stores/schedulerStore', () => ({
    useSchedulerStore: () => ({
        prepareDraftFromTemplate,
    }),
}));
vi.mock('../../i18n/useTranslation', () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));
describe('TemplatePanel', () => {
    const invoke = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    beforeEach(() => {
        vi.clearAllMocks();
        invoke.mockImplementation((channel) => {
            if (channel === 'template:list') {
                return Promise.resolve({
                    success: true,
                    data: [
                        {
                            id: 'template-1',
                            name: 'Visual Template',
                            description: 'Run a visual browser task',
                            origin: {
                                runId: 'run-1',
                                source: 'chat',
                                executionMode: 'visual',
                            },
                            inputSchema: { prompt: 'Prompt' },
                            defaultInput: { prompt: 'Open the menu and click publish' },
                            executionProfile: 'mixed',
                            createdAt: 1710000000000,
                            updatedAt: 1710000000000,
                        },
                    ],
                });
            }
            if (channel === 'workflow-pack:list') {
                return Promise.resolve({
                    success: true,
                    data: [
                        {
                            id: 'ecommerce-ops',
                            name: 'E-commerce Ops',
                            category: 'browser-heavy',
                            description: 'Pack',
                            summary: 'Catalog and campaign workflows',
                            outcomes: ['A'],
                            recommendedSkills: ['browser-search'],
                            templates: [
                                {
                                    id: 'catalog-audit',
                                    name: 'Catalog Audit Sweep',
                                    description: 'Audit',
                                    prompt: 'Audit current store backend',
                                    executionProfile: 'mixed',
                                },
                            ],
                        },
                    ],
                });
            }
            if (channel === 'workflow-pack:install') {
                return Promise.resolve({
                    success: true,
                    data: {
                        packId: 'ecommerce-ops',
                        installedTemplateIds: ['workflow-pack-ecommerce-ops-catalog-audit'],
                        installedCount: 1,
                        selectedTemplateId: 'template-1',
                    },
                });
            }
            if (channel === 'template:update' || channel === 'template:delete') {
                return Promise.resolve({ success: true });
            }
            return Promise.resolve({ success: true, data: [] });
        });
        Object.defineProperty(window, 'electron', {
            configurable: true,
            value: {
                invoke,
            },
        });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText,
            },
        });
    });
    it('defaults mixed templates to hybrid mode when running', async () => {
        const { TemplatePanel } = await import('../TemplatePanel');
        render(_jsx(TemplatePanel, { isOpen: true, onClose: vi.fn() }));
        await waitFor(() => {
            expect(screen.getByText('Visual Template')).toBeInTheDocument();
        });
        expect(screen.getByText('Template origin')).toBeInTheDocument();
        expect(screen.getByText('run-1')).toBeInTheDocument();
        const executionModeLabel = screen.getByText('taskPanels.executionMode');
        const executionModeSelect = executionModeLabel.parentElement?.querySelector('select');
        await waitFor(() => {
            expect(executionModeSelect.value).toBe('hybrid');
        });
        fireEvent.click(screen.getByRole('button', { name: 'taskPanels.runTemplate' }));
        expect(runTemplate).toHaveBeenCalledWith('template-1', {
            prompt: 'Open the menu and click publish',
        }, 'hybrid');
    });
    it('refreshes templates when a template changes', async () => {
        const { TemplatePanel } = await import('../TemplatePanel');
        render(_jsx(TemplatePanel, { isOpen: true, onClose: vi.fn() }));
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
    it('copies the template id from the details panel', async () => {
        const { TemplatePanel } = await import('../TemplatePanel');
        render(_jsx(TemplatePanel, { isOpen: true, onClose: vi.fn() }));
        await waitFor(() => {
            expect(screen.getByText('Visual Template')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', { name: 'taskPanels.copyId' }));
        expect(writeText).toHaveBeenCalledWith('template-1');
    });
    it('lists workflow packs and installs one into templates', async () => {
        const { TemplatePanel } = await import('../TemplatePanel');
        render(_jsx(TemplatePanel, { isOpen: true, onClose: vi.fn() }));
        await waitFor(() => {
            expect(screen.getByText('E-commerce Ops')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', { name: 'taskPanels.installPack' }));
        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('workflow-pack:install', { packId: 'ecommerce-ops' });
        });
        expect(invoke.mock.calls.filter(([channel]) => channel === 'template:list').length).toBeGreaterThanOrEqual(2);
    });
});
