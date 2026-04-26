import { jsx as _jsx } from "react/jsx-runtime";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../i18n/useTranslation', () => ({
    useTranslation: () => ({
        t: (_key, fallback) => (typeof fallback === 'string' ? fallback : _key),
    }),
}));
describe('MCPPanel', () => {
    const modulePath = '../MCPPanel.tsx';
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(window, 'electron', {
            configurable: true,
            value: {
                invoke: vi.fn().mockImplementation((channel, payload) => {
                    if (channel === 'mcp:listServers') {
                        return Promise.resolve({
                            success: true,
                            data: [
                                {
                                    name: 'slack-ops',
                                    config: { transport: 'streamable-http', url: 'https://example.com/mcp' },
                                    status: 'connected',
                                    toolCount: 2,
                                },
                            ],
                        });
                    }
                    if (channel === 'mcp:getConfig') {
                        return Promise.resolve({
                            success: true,
                            data: {
                                sampling: { enabled: true },
                                server: { enabled: false, port: 3100 },
                            },
                        });
                    }
                    if (channel === 'mcp:serverStatus') {
                        return Promise.resolve({ success: true, data: { running: false, port: null } });
                    }
                    if (channel === 'mcp:listTools' && payload?.serverName === 'slack-ops') {
                        return Promise.resolve({
                            success: true,
                            data: [
                                { name: 'slack_messages', description: 'Read Slack messages' },
                                { name: 'email_send', description: 'Send email updates' },
                            ],
                        });
                    }
                    return Promise.resolve({ success: true, data: [] });
                }),
            },
        });
    });
    it('shows business scenario cards based on available tools', async () => {
        const { MCPPanel } = await import(modulePath);
        render(_jsx(MCPPanel, { isOpen: true, onClose: vi.fn() }));
        await waitFor(() => {
            expect(screen.getByText('What MCP can unlock')).toBeInTheDocument();
        });
        expect(screen.getByText('Recommended business scenarios')).toBeInTheDocument();
        expect(screen.getByText('What MCP can unlock')).toBeInTheDocument();
        expect(screen.getByText('Best for')).toBeInTheDocument();
        expect(screen.getByText('Official setup')).toBeInTheDocument();
        expect(screen.getByText('Packaged HTTP server')).toBeInTheDocument();
        expect(screen.getByText('Manual reload')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getAllByText('Communication operations').length).toBeGreaterThan(0);
        });
        const useScenarioButtons = screen.getAllByRole('button', { name: 'mcpPanel.useScenario' });
        fireEvent.click(useScenarioButtons[0]);
        expect(screen.getByDisplayValue('mcp-communication-operations')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'mcpPanel.localStdio' })).toBeInTheDocument();
    });
    it('imports an MCP package and saves the connection config', async () => {
        const saveConfigMock = vi.fn().mockResolvedValue({ success: true, data: { success: true } });
        Object.defineProperty(window, 'electron', {
            configurable: true,
            value: {
                invoke: vi.fn().mockImplementation((channel, payload) => {
                    if (channel === 'mcp:saveConfig') {
                        return saveConfigMock(channel, payload);
                    }
                    if (channel === 'mcp:listServers') {
                        return Promise.resolve({ success: true, data: [] });
                    }
                    if (channel === 'mcp:getConfig') {
                        return Promise.resolve({ success: true, data: { sampling: { enabled: true }, server: { enabled: false, port: 3100 } } });
                    }
                    if (channel === 'mcp:serverStatus') {
                        return Promise.resolve({ success: true, data: { running: false, port: null } });
                    }
                    return Promise.resolve({ success: true, data: [] });
                }),
            },
        });
        const { MCPPanel } = await import(modulePath);
        render(_jsx(MCPPanel, { isOpen: true, onClose: vi.fn() }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Import Package' })).toBeEnabled();
        });
        const fileInput = document.querySelector('input[type="file"]');
        const packageFile = new File([
            JSON.stringify({
                kind: 'mcp-package',
                version: 1,
                connection: {
                    name: 'imported-slack',
                    config: { transport: 'streamable-http', url: 'https://example.com/mcp' },
                },
                tools: [{ name: 'slack_messages', description: 'Read Slack messages' }],
            }),
        ], 'imported-slack.mcp-package.json', { type: 'application/json' });
        fireEvent.click(screen.getByRole('button', { name: 'Import Package' }));
        fireEvent.change(fileInput, { target: { files: [packageFile] } });
        await waitFor(() => {
            expect(saveConfigMock).toHaveBeenCalledWith('mcp:saveConfig', expect.objectContaining({
                serverName: 'imported-slack',
                config: expect.objectContaining({
                    transport: 'streamable-http',
                    url: 'https://example.com/mcp',
                }),
            }));
        });
        expect(screen.getByText('Imported imported-slack package')).toBeInTheDocument();
    });
    it('exports the selected MCP connection as a package json', async () => {
        const createObjectURL = vi.fn().mockReturnValue('blob:mock-package');
        const revokeObjectURL = vi.fn();
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: createObjectURL,
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: revokeObjectURL,
        });
        const click = vi.fn();
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation(((tagName) => {
            if (tagName === 'a') {
                return {
                    href: '',
                    download: '',
                    rel: '',
                    click,
                };
            }
            return originalCreateElement(tagName);
        }));
        const { MCPPanel } = await import(modulePath);
        render(_jsx(MCPPanel, { isOpen: true, onClose: vi.fn() }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Export Package' })).toBeEnabled();
        });
        fireEvent.click(screen.getByRole('button', { name: 'Export Package' }));
        await waitFor(() => {
            expect(createObjectURL).toHaveBeenCalled();
            expect(click).toHaveBeenCalled();
            expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-package');
        });
        const blob = createObjectURL.mock.calls[0]?.[0];
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.size).toBeGreaterThan(0);
    });
});
