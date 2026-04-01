import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// src/renderer/components/SchedulerPanel.tsx
import { useState, useEffect } from 'react';
import { useSchedulerStore } from '../stores/schedulerStore';
import { ScheduleType } from '../../scheduler/types';
import { CronParser } from '../../scheduler/cronParser';
function SchedulerPanel() {
    const { tasks, isLoading, error, selectedTaskId, isOpen, loadTasks, createTask, updateTask, deleteTask, triggerTask, enableTask, disableTask, selectTask, setOpen, } = useSchedulerStore();
    const [activeTab, setActiveTab] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        scheduleType: ScheduleType.CRON,
        cron: '0 9 * * *',
        intervalMs: 3600000,
        startTime: '',
        taskDescription: '',
        timeout: 300000,
    });
    useEffect(() => {
        if (isOpen) {
            loadTasks();
        }
    }, [isOpen, loadTasks]);
    if (!isOpen)
        return null;
    const filteredTasks = tasks.filter((task) => {
        switch (activeTab) {
            case 'executing':
                return task.lastStatus === undefined && task.enabled;
            case 'scheduled':
                return task.enabled && task.lastStatus !== 'success';
            case 'completed':
                return task.lastStatus === 'success';
            default:
                return true;
        }
    });
    const handleCreate = async () => {
        const input = {
            name: formData.name,
            description: formData.description,
            enabled: true,
            schedule: {
                type: formData.scheduleType,
                cron: formData.scheduleType === ScheduleType.CRON ? formData.cron : undefined,
                intervalMs: formData.scheduleType === ScheduleType.INTERVAL ? formData.intervalMs : undefined,
                startTime: formData.scheduleType === ScheduleType.ONE_TIME
                    ? new Date(formData.startTime).getTime()
                    : undefined,
            },
            execution: {
                taskDescription: formData.taskDescription,
                timeout: formData.timeout,
                maxRetries: 3,
                retryDelayMs: 1000,
            },
        };
        await createTask(input);
        setShowCreateModal(false);
        setFormData({
            name: '',
            description: '',
            scheduleType: ScheduleType.CRON,
            cron: '0 9 * * *',
            intervalMs: 3600000,
            startTime: '',
            taskDescription: '',
            timeout: 300000,
        });
    };
    const handleDelete = async (id) => {
        if (confirm('确定删除此定时任务？')) {
            await deleteTask(id);
        }
    };
    const formatNextRun = (timestamp) => {
        if (!timestamp)
            return '-';
        return new Date(timestamp).toLocaleString('zh-CN');
    };
    const formatSchedule = (task) => {
        switch (task.schedule.type) {
            case ScheduleType.CRON:
                return task.schedule.cron || '-';
            case ScheduleType.INTERVAL:
                return `${Math.floor((task.schedule.intervalMs || 0) / 3600000)}小时`;
            case ScheduleType.ONE_TIME:
                return task.schedule.startTime
                    ? new Date(task.schedule.startTime).toLocaleString('zh-CN')
                    : '-';
        }
    };
    const cronPresets = CronParser.getPresets();
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex", children: [_jsx("div", { className: "flex-1 bg-black/50", onClick: () => setOpen(false) }), _jsxs("div", { className: "w-[800px] bg-surface border-l border-border flex flex-col", children: [_jsxs("div", { className: "h-14 flex items-center justify-between px-4 border-b border-border", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("h2", { className: "text-lg font-semibold text-white", children: "\u5B9A\u65F6\u4EFB\u52A1" }), _jsxs("span", { className: "text-sm text-text-muted", children: ["\u5171 ", tasks.length, " \u4E2A\u4EFB\u52A1"] })] }), _jsx("button", { onClick: () => setOpen(false), className: "p-1 rounded hover:bg-border text-text-muted hover:text-white", children: _jsx("svg", { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsxs("div", { className: "flex items-center gap-2 px-4 py-2 border-b border-border", children: [_jsx("button", { onClick: () => setShowCreateModal(true), className: "btn btn-primary text-sm", disabled: isLoading, children: "\u65B0\u5EFA\u4EFB\u52A1" }), _jsx("button", { onClick: loadTasks, className: "btn btn-secondary text-sm", disabled: isLoading, children: "\u5237\u65B0" })] }), _jsx("div", { className: "flex items-center gap-2 px-4 py-2 border-b border-border", children: ['all', 'executing', 'scheduled', 'completed'].map((tab) => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-3 py-1 rounded text-sm ${activeTab === tab ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}`, children: tab === 'all'
                                ? '全部'
                                : tab === 'executing'
                                    ? '执行中'
                                    : tab === 'scheduled'
                                        ? '待执行'
                                        : '已完成' }, tab))) }), _jsx("div", { className: "flex-1 overflow-y-auto p-4", children: isLoading && tasks.length === 0 ? (_jsx("div", { className: "flex items-center justify-center h-32 text-text-muted", children: "\u52A0\u8F7D\u4E2D..." })) : filteredTasks.length === 0 ? (_jsx("div", { className: "flex items-center justify-center h-32 text-text-muted", children: "\u6682\u65E0\u5B9A\u65F6\u4EFB\u52A1" })) : (_jsx("div", { className: "space-y-2", children: filteredTasks.map((task) => (_jsx("div", { className: `bg-elevated border rounded-lg p-4 hover:border-primary/50 transition-colors ${selectedTaskId === task.id ? 'border-primary/30' : 'border-border'}`, children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", onClick: () => selectTask(task.id), children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { className: "text-sm font-medium text-white", children: task.name }), !task.enabled && _jsx("span", { className: "text-xs text-text-muted", children: "(\u5DF2\u7981\u7528)" })] }), _jsx("p", { className: "text-xs text-text-muted mt-1", children: task.description }), _jsxs("div", { className: "flex items-center gap-4 mt-2 text-xs text-text-muted", children: [_jsxs("span", { children: ["\u8C03\u5EA6: ", formatSchedule(task)] }), _jsxs("span", { children: ["\u4E0B\u6B21\u6267\u884C: ", formatNextRun(task.nextRun)] }), _jsxs("span", { children: ["\u8FD0\u884C\u6B21\u6570: ", task.runCount] })] }), task.lastStatus && (_jsxs("div", { className: "mt-2 text-xs", children: [_jsxs("span", { className: `${task.lastStatus === 'success'
                                                                ? 'text-green-400'
                                                                : task.lastStatus === 'failed'
                                                                    ? 'text-red-400'
                                                                    : 'text-yellow-400'}`, children: ["\u4E0A\u6B21:", ' ', task.lastStatus === 'success'
                                                                    ? '成功'
                                                                    : task.lastStatus === 'failed'
                                                                        ? '失败'
                                                                        : '已取消'] }), task.lastError && (_jsxs("span", { className: "text-red-400 ml-2", children: ["- ", task.lastError] }))] }))] }), _jsxs("div", { className: "flex items-center gap-2", children: [task.enabled ? (_jsx("button", { onClick: () => disableTask(task.id), className: "btn btn-secondary text-xs", children: "\u7981\u7528" })) : (_jsx("button", { onClick: () => enableTask(task.id), className: "btn btn-primary text-xs", children: "\u542F\u7528" })), _jsx("button", { onClick: () => triggerTask(task.id), className: "btn btn-secondary text-xs", children: "\u6267\u884C" }), _jsx("button", { onClick: () => handleDelete(task.id), className: "p-1 text-text-muted hover:text-red-400", children: _jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }) })] })] }) }, task.id))) })) })] }), showCreateModal && (_jsxs("div", { className: "fixed inset-0 z-[60] flex", children: [_jsx("div", { className: "flex-1 bg-black/50", onClick: () => setShowCreateModal(false) }), _jsxs("div", { className: "w-[500px] bg-surface border border-border rounded-lg p-6 m-auto max-h-[80vh] overflow-y-auto", children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "\u65B0\u5EFA\u5B9A\u65F6\u4EFB\u52A1" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm text-text-muted", children: "\u4EFB\u52A1\u540D\u79F0" }), _jsx("input", { type: "text", value: formData.name, onChange: (e) => setFormData({ ...formData, name: e.target.value }), className: "w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1", placeholder: "\u8F93\u5165\u4EFB\u52A1\u540D\u79F0" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm text-text-muted", children: "\u4EFB\u52A1\u63CF\u8FF0" }), _jsx("input", { type: "text", value: formData.description, onChange: (e) => setFormData({ ...formData, description: e.target.value }), className: "w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1", placeholder: "\u8F93\u5165\u4EFB\u52A1\u63CF\u8FF0" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm text-text-muted", children: "\u8C03\u5EA6\u7C7B\u578B" }), _jsxs("select", { value: formData.scheduleType, onChange: (e) => setFormData({ ...formData, scheduleType: e.target.value }), className: "w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1", children: [_jsx("option", { value: ScheduleType.CRON, children: "Cron \u8868\u8FBE\u5F0F" }), _jsx("option", { value: ScheduleType.INTERVAL, children: "\u95F4\u9694\u6267\u884C" }), _jsx("option", { value: ScheduleType.ONE_TIME, children: "\u4E00\u6B21\u6027" })] })] }), formData.scheduleType === ScheduleType.CRON && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm text-text-muted", children: "Cron \u8868\u8FBE\u5F0F" }), _jsx("input", { type: "text", value: formData.cron, onChange: (e) => setFormData({ ...formData, cron: e.target.value }), className: "w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1", placeholder: "0 9 * * *" })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: cronPresets.map((preset) => (_jsx("button", { onClick: () => setFormData({ ...formData, cron: preset.expression }), className: "px-2 py-1 text-xs bg-background border border-border rounded hover:border-primary text-text-muted hover:text-white", children: preset.label }, preset.expression))) })] })), formData.scheduleType === ScheduleType.INTERVAL && (_jsxs("div", { children: [_jsx("label", { className: "text-sm text-text-muted", children: "\u95F4\u9694 (\u6BEB\u79D2)" }), _jsx("input", { type: "number", value: formData.intervalMs, onChange: (e) => setFormData({ ...formData, intervalMs: parseInt(e.target.value) || 0 }), className: "w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1", placeholder: "3600000 (1\u5C0F\u65F6)" }), _jsx("p", { className: "text-xs text-text-muted mt-1", children: "3600000 = 1\u5C0F\u65F6, 86400000 = 1\u5929" })] })), formData.scheduleType === ScheduleType.ONE_TIME && (_jsxs("div", { children: [_jsx("label", { className: "text-sm text-text-muted", children: "\u6267\u884C\u65F6\u95F4" }), _jsx("input", { type: "datetime-local", value: formData.startTime, onChange: (e) => setFormData({ ...formData, startTime: e.target.value }), className: "w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1" })] })), _jsxs("div", { children: [_jsx("label", { className: "text-sm text-text-muted", children: "\u4EFB\u52A1\u5185\u5BB9" }), _jsx("textarea", { value: formData.taskDescription, onChange: (e) => setFormData({ ...formData, taskDescription: e.target.value }), className: "w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1 h-24", placeholder: "\u63CF\u8FF0\u8981\u6267\u884C\u7684\u4EFB\u52A1..." })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm text-text-muted", children: "\u8D85\u65F6\u65F6\u95F4 (\u6BEB\u79D2)" }), _jsx("input", { type: "number", value: formData.timeout, onChange: (e) => setFormData({ ...formData, timeout: parseInt(e.target.value) || 0 }), className: "w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1", placeholder: "300000" })] })] }), _jsxs("div", { className: "flex justify-end gap-2 mt-6", children: [_jsx("button", { onClick: () => setShowCreateModal(false), className: "btn btn-secondary", children: "\u53D6\u6D88" }), _jsx("button", { onClick: handleCreate, className: "btn btn-primary", disabled: !formData.name || !formData.taskDescription, children: "\u521B\u5EFA" })] })] })] }))] }));
}
export default SchedulerPanel;
