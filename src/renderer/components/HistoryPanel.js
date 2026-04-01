import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useHistoryStore } from '../stores/historyStore';
export function HistoryPanel() {
    const { isOpen, isLoading, tasks, selectedTask, selectedTaskId, filter, total, setIsOpen, setFilter, setSelectedTaskId, loadTasks, deleteTask, replayTask, clearSelectedTask, } = useHistoryStore();
    const [activeTab, setActiveTab] = useState('all');
    const [searchKeyword, setSearchKeyword] = useState('');
    useEffect(() => {
        if (isOpen) {
            loadTasks();
        }
        // loadTasks is stable from Zustand store
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);
    useEffect(() => {
        const newFilter = { ...filter };
        if (activeTab !== 'all') {
            newFilter.status = activeTab;
        }
        else {
            delete newFilter.status;
        }
        setFilter(newFilter);
        // setFilter and filter are stable from Zustand store
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);
    const handleSearch = () => {
        setFilter({ ...filter, keyword: searchKeyword || undefined });
    };
    const handleTabChange = (tab) => {
        setActiveTab(tab);
    };
    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };
    const formatDuration = (ms) => {
        if (ms < 1000)
            return `${ms}ms`;
        if (ms < 60000)
            return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
                return 'text-green-400';
            case 'failed':
                return 'text-red-400';
            case 'cancelled':
                return 'text-yellow-400';
            default:
                return 'text-gray-400';
        }
    };
    if (!isOpen) {
        return null;
    }
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex", children: [_jsx("div", { className: "flex-1 bg-black/50", onClick: () => setIsOpen(false) }), _jsxs("div", { className: "w-[800px] bg-surface border-l border-border flex flex-col", children: [_jsxs("div", { className: "h-14 flex items-center justify-between px-4 border-b border-border", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("h2", { className: "text-lg font-semibold text-white", children: "\u4EFB\u52A1\u5386\u53F2" }), _jsxs("span", { className: "text-sm text-text-muted", children: ["\u5171 ", total, " \u6761\u8BB0\u5F55"] })] }), _jsx("button", { onClick: () => setIsOpen(false), className: "p-1 rounded hover:bg-border text-text-muted hover:text-white", children: _jsx("svg", { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsxs("div", { className: "flex items-center gap-4 px-4 py-2 border-b border-border", children: [_jsx("div", { className: "flex gap-1", children: ['all', 'completed', 'failed', 'cancelled'].map((tab) => (_jsx("button", { onClick: () => handleTabChange(tab), className: `px-3 py-1 rounded text-sm transition-colors ${activeTab === tab
                                        ? 'bg-primary text-white'
                                        : 'text-text-muted hover:text-white hover:bg-border'}`, children: tab === 'all'
                                        ? '全部'
                                        : tab === 'completed'
                                            ? '成功'
                                            : tab === 'failed'
                                                ? '失败'
                                                : '已取消' }, tab))) }), _jsx("div", { className: "flex-1" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "text", placeholder: "\u641C\u7D22\u4EFB\u52A1...", value: searchKeyword, onChange: (e) => setSearchKeyword(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleSearch(), className: "w-48 px-3 py-1 bg-background border border-border rounded text-sm text-white placeholder-text-muted focus:outline-none focus:border-primary" }), _jsx("button", { onClick: handleSearch, className: "btn btn-secondary text-sm", children: "\u641C\u7D22" })] })] }), _jsxs("div", { className: "flex-1 flex overflow-hidden", children: [_jsx("div", { className: "w-96 border-r border-border overflow-y-auto", children: isLoading && tasks.length === 0 ? (_jsx("div", { className: "flex items-center justify-center h-32 text-text-muted", children: "\u52A0\u8F7D\u4E2D..." })) : tasks.length === 0 ? (_jsx("div", { className: "flex items-center justify-center h-32 text-text-muted", children: "\u6682\u65E0\u4EFB\u52A1\u8BB0\u5F55" })) : (_jsx("div", { className: "p-2 space-y-1", children: tasks.map((task) => (_jsxs("div", { onClick: () => setSelectedTaskId(task.id), className: `p-3 rounded cursor-pointer transition-colors ${selectedTaskId === task.id
                                            ? 'bg-primary/20 border border-primary/30'
                                            : 'hover:bg-border/50 border border-transparent'}`, children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-white truncate", children: task.task }), _jsx("div", { className: "text-xs text-text-muted mt-1", children: formatTime(task.startTime) })] }), _jsx("span", { className: `text-xs ${getStatusColor(task.status)}`, children: task.status === 'completed'
                                                            ? '成功'
                                                            : task.status === 'failed'
                                                                ? '失败'
                                                                : '已取消' })] }), task.duration > 0 && (_jsxs("div", { className: "text-xs text-text-muted mt-1", children: ["\u8017\u65F6: ", formatDuration(task.duration)] }))] }, task.id))) })) }), _jsx("div", { className: "flex-1 flex flex-col overflow-hidden", children: selectedTask ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex-1 overflow-y-auto p-4", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-text-muted mb-1", children: "\u4EFB\u52A1\u63CF\u8FF0" }), _jsx("p", { className: "text-white", children: selectedTask.task })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-text-muted mb-1", children: "\u72B6\u6001" }), _jsx("span", { className: `text-sm ${getStatusColor(selectedTask.status)}`, children: selectedTask.status === 'completed'
                                                                            ? '成功'
                                                                            : selectedTask.status === 'failed'
                                                                                ? '失败'
                                                                                : '已取消' })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-text-muted mb-1", children: "\u8017\u65F6" }), _jsx("span", { className: "text-sm text-white", children: formatDuration(selectedTask.duration) })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-text-muted mb-1", children: "\u5F00\u59CB\u65F6\u95F4" }), _jsx("span", { className: "text-sm text-white", children: formatTime(selectedTask.startTime) })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-text-muted mb-1", children: "\u7ED3\u675F\u65F6\u95F4" }), _jsx("span", { className: "text-sm text-white", children: formatTime(selectedTask.endTime) })] })] }), selectedTask.result && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-text-muted mb-1", children: "\u7ED3\u679C" }), selectedTask.result.success ? (_jsx("div", { className: "text-sm text-green-400", children: "\u6267\u884C\u6210\u529F" })) : (_jsx("div", { className: "text-sm text-red-400", children: selectedTask.result.error || '执行失败' }))] })), selectedTask.steps && selectedTask.steps.length > 0 && (_jsxs("div", { children: [_jsxs("h3", { className: "text-sm font-medium text-text-muted mb-2", children: ["\u6267\u884C\u6B65\u9AA4 (", selectedTask.steps.length, ")"] }), _jsx("div", { className: "space-y-2", children: selectedTask.steps.map((step, index) => (_jsxs("div", { className: "bg-background rounded p-2 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-white font-mono", children: step.toolName }), _jsx("span", { className: `text-xs ${step.status === 'completed'
                                                                                        ? 'text-green-400'
                                                                                        : step.status === 'error'
                                                                                            ? 'text-red-400'
                                                                                            : step.status === 'running'
                                                                                                ? 'text-blue-400'
                                                                                                : 'text-gray-400'}`, children: step.status })] }), step.args && Object.keys(step.args).length > 0 && (_jsx("div", { className: "text-xs text-text-muted mt-1 font-mono", children: JSON.stringify(step.args).substring(0, 100) }))] }, step.id))) })] })), selectedTask.metadata && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-text-muted mb-1", children: "\u5143\u6570\u636E" }), _jsx("div", { className: "bg-background rounded p-2 text-xs font-mono text-text-muted", children: JSON.stringify(selectedTask.metadata, null, 2) })] }))] }) }), _jsxs("div", { className: "p-4 border-t border-border flex justify-between", children: [_jsx("button", { onClick: () => {
                                                        if (confirm('确定删除此任务记录？')) {
                                                            deleteTask(selectedTask.id);
                                                        }
                                                    }, className: "btn btn-danger text-sm", children: "\u5220\u9664" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => {
                                                                clearSelectedTask();
                                                            }, className: "btn btn-secondary text-sm", children: "\u5173\u95ED" }), _jsx("button", { onClick: () => replayTask(selectedTask.id), className: "btn btn-primary text-sm", children: "\u56DE\u653E" })] })] })] })) : (_jsx("div", { className: "flex-1 flex items-center justify-center text-text-muted", children: "\u9009\u62E9\u4E00\u4E2A\u4EFB\u52A1\u67E5\u770B\u8BE6\u60C5" })) })] })] })] }));
}
export default HistoryPanel;
