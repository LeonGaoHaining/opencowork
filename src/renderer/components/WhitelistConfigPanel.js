import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { DEFAULT_WHITELIST_CONFIG, } from '../../config/whitelistConfig';
export function WhitelistConfigPanel({ isOpen, onClose }) {
    const [activeTab, setActiveTab] = useState('cli');
    const [config, setConfig] = useState(DEFAULT_WHITELIST_CONFIG);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState(null);
    useEffect(() => {
        if (isOpen) {
            loadConfig();
        }
    }, [isOpen]);
    const loadConfig = async () => {
        setIsLoading(true);
        try {
            const loadedConfig = await window.electron.invoke('whitelist:load');
            setConfig(loadedConfig || DEFAULT_WHITELIST_CONFIG);
        }
        catch (error) {
            console.error('[WhitelistConfigPanel] Failed to load config:', error);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            const result = await window.electron.invoke('whitelist:save', { config });
            if (result.success) {
                setMessage({ type: 'success', text: '配置保存成功' });
            }
            else {
                setMessage({ type: 'error', text: result.validation.errors.join(', ') });
            }
        }
        catch (error) {
            setMessage({ type: 'error', text: `保存失败: ${error}` });
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleReset = async () => {
        if (confirm('确定重置为默认配置？')) {
            setConfig(DEFAULT_WHITELIST_CONFIG);
            await handleSave();
        }
    };
    function updatePathEntryWithPermissions(entry, updates) {
        if (updates.permissions) {
            return {
                ...entry,
                ...updates,
                permissions: { ...entry.permissions, ...updates.permissions },
            };
        }
        return { ...entry, ...updates };
    }
    const updatePathEntry = (index, updates) => {
        const newEntries = [...config.paths.entries];
        newEntries[index] = updatePathEntryWithPermissions(newEntries[index], updates);
        setConfig({ ...config, paths: { ...config.paths, entries: newEntries } });
    };
    const updateAgentTool = (index, updates) => {
        const newTools = [...config.agents.tools];
        newTools[index] = { ...newTools[index], ...updates };
        setConfig({ ...config, agents: { ...config.agents, tools: newTools } });
    };
    const updateCLICommand = (index, updates) => {
        const newCommands = [...config.cli.commands];
        newCommands[index] = { ...newCommands[index], ...updates };
        setConfig({ ...config, cli: { ...config.cli, commands: newCommands } });
    };
    const getRiskLevelBadgeClass = (riskLevel) => {
        switch (riskLevel) {
            case 'low':
                return 'bg-green-400/20 text-green-400';
            case 'medium':
                return 'bg-yellow-400/20 text-yellow-400';
            case 'high':
                return 'bg-orange-400/20 text-orange-400';
            case 'critical':
                return 'bg-red-400/20 text-red-400';
            default:
                return 'bg-gray-400/20 text-gray-400';
        }
    };
    if (!isOpen) {
        return null;
    }
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex", children: [_jsx("div", { className: "flex-1 bg-black/50", onClick: onClose }), _jsxs("div", { className: "w-[900px] bg-surface border-l border-border flex flex-col", children: [_jsxs("div", { className: "h-14 flex items-center justify-between px-4 border-b border-border", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("h2", { className: "text-lg font-semibold text-white", children: "\u767D\u540D\u5355\u914D\u7F6E" }), message && (_jsx("span", { className: `text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`, children: message.text }))] }), _jsx("button", { onClick: onClose, className: "p-1 rounded hover:bg-border text-text-muted hover:text-white", children: _jsx("svg", { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsxs("div", { className: "flex items-center gap-4 px-4 py-2 border-b border-border", children: [_jsx("div", { className: "flex gap-1", children: ['cli', 'paths', 'agents', 'network'].map((tab) => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-2 rounded text-sm transition-colors ${activeTab === tab
                                        ? 'bg-primary text-white'
                                        : 'text-text-muted hover:text-white hover:bg-border'}`, children: tab === 'cli'
                                        ? 'CLI 命令'
                                        : tab === 'paths'
                                            ? '路径访问'
                                            : tab === 'agents'
                                                ? 'Agent 工具'
                                                : '网络访问' }, tab))) }), _jsx("div", { className: "flex-1" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: handleReset, className: "btn btn-secondary text-sm", children: "\u91CD\u7F6E" }), _jsx("button", { onClick: handleSave, disabled: isSaving, className: "btn btn-primary text-sm", children: isSaving ? '保存中...' : '保存' })] })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-4", children: isLoading ? (_jsx("div", { className: "flex items-center justify-center h-32 text-text-muted", children: "\u52A0\u8F7D\u4E2D..." })) : (_jsxs(_Fragment, { children: [activeTab === 'cli' && (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-white", children: "\u542F\u7528 CLI \u767D\u540D\u5355" }), _jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: config.cli.enabled, onChange: (e) => setConfig({
                                                                    ...config,
                                                                    cli: { ...config.cli, enabled: e.target.checked },
                                                                }), className: "sr-only peer" }), _jsx("div", { className: "w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" })] })] }) }), _jsx("div", { className: "border border-border rounded-lg overflow-hidden", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-elevated", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-4 py-2 text-sm font-medium text-text-muted", children: "\u547D\u4EE4" }), _jsx("th", { className: "text-left px-4 py-2 text-sm font-medium text-text-muted", children: "\u53C2\u6570" }), _jsx("th", { className: "text-left px-4 py-2 text-sm font-medium text-text-muted", children: "\u98CE\u9669\u7B49\u7EA7" }), _jsx("th", { className: "text-center px-4 py-2 text-sm font-medium text-text-muted", children: "\u542F\u7528" })] }) }), _jsx("tbody", { children: config.cli.commands.map((cmd, index) => (_jsxs("tr", { className: "border-t border-border", children: [_jsx("td", { className: "px-4 py-2", children: _jsx("span", { className: "text-sm text-white font-mono", children: cmd.command }) }), _jsx("td", { className: "px-4 py-2", children: _jsx("input", { type: "text", value: cmd.args?.join(', ') || '', onChange: (e) => updateCLICommand(index, {
                                                                            args: e.target.value
                                                                                .split(',')
                                                                                .map((s) => s.trim())
                                                                                .filter(Boolean),
                                                                        }), className: "w-full bg-background border border-border rounded px-2 py-1 text-sm text-white", placeholder: "\u53C2\u6570\u5217\u8868" }) }), _jsx("td", { className: "px-4 py-2", children: _jsxs("select", { value: cmd.riskLevel, onChange: (e) => updateCLICommand(index, {
                                                                            riskLevel: e.target.value,
                                                                        }), className: `px-2 py-1 rounded text-sm border ${getRiskLevelBadgeClass(cmd.riskLevel)} border-transparent`, children: [_jsx("option", { value: "low", children: "\u4F4E" }), _jsx("option", { value: "medium", children: "\u4E2D" }), _jsx("option", { value: "high", children: "\u9AD8" }), _jsx("option", { value: "critical", children: "\u6781\u9AD8" })] }) }), _jsx("td", { className: "px-4 py-2 text-center", children: _jsx("input", { type: "checkbox", checked: cmd.allowed, onChange: (e) => updateCLICommand(index, { allowed: e.target.checked }), className: "w-4 h-4" }) })] }, cmd.command))) })] }) })] })), activeTab === 'paths' && (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-white", children: "\u542F\u7528\u8DEF\u5F84\u767D\u540D\u5355" }), _jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: config.paths.enabled, onChange: (e) => setConfig({
                                                                    ...config,
                                                                    paths: { ...config.paths, enabled: e.target.checked },
                                                                }), className: "sr-only peer" }), _jsx("div", { className: "w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" })] })] }) }), _jsx("div", { className: "border border-border rounded-lg overflow-hidden", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-elevated", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-4 py-2 text-sm font-medium text-text-muted", children: "\u8DEF\u5F84" }), _jsx("th", { className: "text-center px-4 py-2 text-sm font-medium text-text-muted", children: "\u8BFB\u53D6" }), _jsx("th", { className: "text-center px-4 py-2 text-sm font-medium text-text-muted", children: "\u5199\u5165" }), _jsx("th", { className: "text-center px-4 py-2 text-sm font-medium text-text-muted", children: "\u6267\u884C" }), _jsx("th", { className: "text-center px-4 py-2 text-sm font-medium text-text-muted", children: "\u542F\u7528" })] }) }), _jsx("tbody", { children: config.paths.entries.map((entry, index) => (_jsxs("tr", { className: "border-t border-border", children: [_jsx("td", { className: "px-4 py-2", children: _jsx("span", { className: "text-sm text-white font-mono", children: entry.path }) }), _jsx("td", { className: "px-4 py-2 text-center", children: _jsx("input", { type: "checkbox", checked: entry.permissions.read, onChange: (e) => updatePathEntry(index, {
                                                                            permissions: { ...entry.permissions, read: e.target.checked },
                                                                        }), className: "w-4 h-4" }) }), _jsx("td", { className: "px-4 py-2 text-center", children: _jsx("input", { type: "checkbox", checked: entry.permissions.write, onChange: (e) => updatePathEntry(index, {
                                                                            permissions: { ...entry.permissions, write: e.target.checked },
                                                                        }), className: "w-4 h-4" }) }), _jsx("td", { className: "px-4 py-2 text-center", children: _jsx("input", { type: "checkbox", checked: entry.permissions.execute, onChange: (e) => updatePathEntry(index, {
                                                                            permissions: {
                                                                                ...entry.permissions,
                                                                                execute: e.target.checked,
                                                                            },
                                                                        }), className: "w-4 h-4" }) }), _jsx("td", { className: "px-4 py-2 text-center", children: _jsx("input", { type: "checkbox", checked: entry.allowed, onChange: (e) => updatePathEntry(index, { allowed: e.target.checked }), className: "w-4 h-4" }) })] }, entry.path))) })] }) })] })), activeTab === 'agents' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-white", children: "\u542F\u7528 Agent \u5DE5\u5177\u767D\u540D\u5355" }), _jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: config.agents.enabled, onChange: (e) => setConfig({
                                                                        ...config,
                                                                        agents: { ...config.agents, enabled: e.target.checked },
                                                                    }), className: "sr-only peer" }), _jsx("div", { className: "w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-text-muted", children: "\u6700\u5927\u6B65\u6570/\u4EFB\u52A1:" }), _jsx("input", { type: "number", value: config.agents.maxStepsPerTask || 100, onChange: (e) => setConfig({
                                                                ...config,
                                                                agents: {
                                                                    ...config.agents,
                                                                    maxStepsPerTask: parseInt(e.target.value) || 100,
                                                                },
                                                            }), className: "w-20 bg-background border border-border rounded px-2 py-1 text-sm text-white" })] })] }), _jsx("div", { className: "border border-border rounded-lg overflow-hidden", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-elevated", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-4 py-2 text-sm font-medium text-text-muted", children: "\u5DE5\u5177\u540D\u79F0" }), _jsx("th", { className: "text-left px-4 py-2 text-sm font-medium text-text-muted", children: "\u63CF\u8FF0" }), _jsx("th", { className: "text-center px-4 py-2 text-sm font-medium text-text-muted", children: "\u542F\u7528" })] }) }), _jsx("tbody", { children: config.agents.tools.map((tool, index) => (_jsxs("tr", { className: "border-t border-border", children: [_jsx("td", { className: "px-4 py-2", children: _jsx("span", { className: "text-sm text-white font-mono", children: tool.toolName }) }), _jsx("td", { className: "px-4 py-2", children: _jsx("input", { type: "text", value: tool.description || '', onChange: (e) => updateAgentTool(index, { description: e.target.value }), className: "w-full bg-background border border-border rounded px-2 py-1 text-sm text-white", placeholder: "\u63CF\u8FF0" }) }), _jsx("td", { className: "px-4 py-2 text-center", children: _jsx("input", { type: "checkbox", checked: tool.allowed, onChange: (e) => updateAgentTool(index, { allowed: e.target.checked }), className: "w-4 h-4" }) })] }, tool.toolName))) })] }) })] })), activeTab === 'network' && (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-white", children: "\u542F\u7528\u7F51\u7EDC\u767D\u540D\u5355" }), _jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: config.network.enabled, onChange: (e) => setConfig({
                                                                    ...config,
                                                                    network: { ...config.network, enabled: e.target.checked },
                                                                }), className: "sr-only peer" }), _jsx("div", { className: "w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" })] })] }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-white mb-2", children: "\u5141\u8BB8\u7684\u4E3B\u673A" }), _jsx("div", { className: "border border-border rounded-lg overflow-hidden", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-elevated", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-4 py-2 text-sm font-medium text-text-muted", children: "\u4E3B\u673A" }), _jsx("th", { className: "text-center px-4 py-2 text-sm font-medium text-text-muted", children: "\u542F\u7528" })] }) }), _jsx("tbody", { children: config.network.hosts.map((host, index) => (_jsxs("tr", { className: "border-t border-border", children: [_jsx("td", { className: "px-4 py-2", children: _jsx("span", { className: "text-sm text-white font-mono", children: host.host }) }), _jsx("td", { className: "px-4 py-2 text-center", children: _jsx("input", { type: "checkbox", checked: host.allowed, onChange: (e) => {
                                                                                    const newHosts = [...config.network.hosts];
                                                                                    newHosts[index] = {
                                                                                        ...newHosts[index],
                                                                                        allowed: e.target.checked,
                                                                                    };
                                                                                    setConfig({
                                                                                        ...config,
                                                                                        network: { ...config.network, hosts: newHosts },
                                                                                    });
                                                                                }, className: "w-4 h-4" }) })] }, host.host))) })] }) })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-white mb-2", children: "\u963B\u6B62\u7684\u7AEF\u53E3" }), _jsx("div", { className: "flex flex-wrap gap-2", children: [22, 3389, 3306, 5432, 27017, 6379].map((port) => (_jsxs("label", { className: `px-3 py-1 rounded cursor-pointer ${config.network.blockedPorts.includes(port)
                                                            ? 'bg-red-400/20 text-red-400 border border-red-400/30'
                                                            : 'bg-elevated text-text-muted border border-border'}`, children: [_jsx("input", { type: "checkbox", checked: config.network.blockedPorts.includes(port), onChange: (e) => {
                                                                    if (e.target.checked) {
                                                                        setConfig({
                                                                            ...config,
                                                                            network: {
                                                                                ...config.network,
                                                                                blockedPorts: [...config.network.blockedPorts, port],
                                                                            },
                                                                        });
                                                                    }
                                                                    else {
                                                                        setConfig({
                                                                            ...config,
                                                                            network: {
                                                                                ...config.network,
                                                                                blockedPorts: config.network.blockedPorts.filter((p) => p !== port),
                                                                            },
                                                                        });
                                                                    }
                                                                }, className: "sr-only" }), port] }, port))) })] })] }))] })) })] })] }));
}
export default WhitelistConfigPanel;
