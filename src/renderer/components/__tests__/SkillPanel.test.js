import { jsx as _jsx } from "react/jsx-runtime";
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../i18n/useTranslation', () => ({
    useTranslation: () => ({
        t: (_key, fallback) => fallback || _key,
    }),
}));
describe('SkillPanel', () => {
    const invoke = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
        invoke.mockImplementation((channel) => {
            if (channel === 'skill:list') {
                return Promise.resolve({
                    success: true,
                    data: [
                        {
                            name: 'daily-report',
                            version: '1.0.0',
                            description: 'Generate a daily report',
                            path: '/skills/daily-report',
                            installed: true,
                            source: 'official',
                            userInvocable: true,
                            useCases: ['Daily reporting', 'Team summary'],
                            inputSpec: 'Date range and data sources',
                            outputSpec: 'Markdown report and summary card',
                            failureHints: ['Check Slack connection', 'Verify email access'],
                            allowedTools: ['connector:slack', 'connector:email'],
                            tags: ['report', 'team'],
                        },
                    ],
                });
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
    it('renders productized skill contract fields', async () => {
        const { SkillPanel } = await import('../SkillPanel');
        render(_jsx(SkillPanel, { isOpen: true, onClose: vi.fn() }));
        await waitFor(() => {
            expect(screen.getByText('daily-report')).toBeInTheDocument();
        });
        expect(screen.getByText('用途')).toBeInTheDocument();
        expect(screen.getByText('Daily reporting')).toBeInTheDocument();
        expect(screen.getByText('输入')).toBeInTheDocument();
        expect(screen.getByText('Date range and data sources')).toBeInTheDocument();
        expect(screen.getByText('输出')).toBeInTheDocument();
        expect(screen.getByText('Markdown report and summary card')).toBeInTheDocument();
        expect(screen.getByText('失败提示')).toBeInTheDocument();
        expect(screen.getByText('Check Slack connection')).toBeInTheDocument();
        expect(screen.getByText('允许工具')).toBeInTheDocument();
        expect(screen.getByText('connector:slack')).toBeInTheDocument();
        expect(screen.getByText((_, element) => element?.textContent === '来源: official')).toBeInTheDocument();
        expect(screen.getByText('可用户调用')).toBeInTheDocument();
    });
    it('refreshes skill list when a skill changes', async () => {
        const { SkillPanel } = await import('../SkillPanel');
        render(_jsx(SkillPanel, { isOpen: true, onClose: vi.fn() }));
        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('skill:list');
        });
        act(() => {
            window.dispatchEvent(new CustomEvent('skill:changed', { detail: { name: 'saved-skill' } }));
        });
        await waitFor(() => {
            expect(invoke.mock.calls.filter(([channel]) => channel === 'skill:list').length).toBeGreaterThanOrEqual(2);
        });
        expect(screen.getByText('Skill library refreshed')).toBeInTheDocument();
    });
});
