import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTaskStore } from '../stores/taskStore';
import { useHistoryStore } from '../stores/historyStore';
import { useSchedulerStore } from '../stores/schedulerStore';
export function ControlBar() {
    const { task, setTakeover, showPlanViewer, setShowPlanViewer, previewMode, setPreviewMode } = useTaskStore();
    const { setIsOpen: setHistoryOpen } = useHistoryStore();
    const { setOpen: setSchedulerOpen } = useSchedulerStore();
    const handleTakeover = () => {
        setTakeover(true);
    };
    const handlePause = () => {
        console.log('Pause task');
    };
    const handleStop = () => {
        console.log('Stop task');
    };
    const handleCheckLogin = async () => {
        console.log('Checking login popup...');
        try {
            // 通过IPC调用主进程的checkAndHandleLoginPopup
            const result = await window.electron.invoke('task:checkLoginPopup', {});
            console.log('Check login result:', result);
            if (!result.handled) {
                alert(result.message || '未检测到登录弹窗');
            }
        }
        catch (error) {
            console.error('Check login error:', error);
        }
    };
    return (_jsxs("div", { className: "h-14 flex items-center justify-between px-4 border-t border-border bg-surface", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: handleCheckLogin, className: "btn btn-secondary", disabled: !task || task.status === 'idle', title: "\u68C0\u6D4B\u767B\u5F55\u5F39\u7A97", children: "\u68C0\u6D4B\u767B\u5F55" }), _jsx("button", { onClick: handleTakeover, className: "btn btn-secondary", disabled: !task || task.status === 'idle', children: "\u63A5\u7BA1" }), _jsx("button", { onClick: handlePause, className: "btn btn-secondary", disabled: !task || task.status !== 'executing', children: "\u6682\u505C" }), _jsx("button", { onClick: handleStop, className: "btn btn-danger", disabled: !task || task.status === 'idle' || task.status === 'completed', children: "\u505C\u6B62" })] }), _jsx("div", { className: "text-sm text-text-secondary", children: task ? (_jsxs("span", { children: [task.status === 'idle' && '等待任务', task.status === 'planning' && '规划中...', task.status === 'executing' && task.currentStep
                            ? `执行中: ${task.currentStep}`
                            : '执行中', task.status === 'paused' && '已暂停', task.status === 'waiting_confirm' && '等待确认', task.status === 'completed' && '已完成', task.status === 'failed' && `失败: ${task.error || '未知错误'}`] })) : ('无活动任务') }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { onClick: () => setPreviewMode('sidebar'), className: `w-10 h-10 flex items-center justify-center rounded-lg transition-all ${previewMode === 'sidebar'
                                    ? 'bg-primary text-white'
                                    : 'bg-elevated text-text-secondary hover:text-white hover:bg-border'}`, title: "\u4FA7\u8FB9\u9884\u89C8", children: _jsx("svg", { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6h16M4 12h16M4 18h7" }) }) }), _jsx("button", { onClick: () => setPreviewMode('detached'), className: `w-10 h-10 flex items-center justify-center rounded-lg transition-all ${previewMode === 'detached'
                                    ? 'bg-primary text-white'
                                    : 'bg-elevated text-text-secondary hover:text-white hover:bg-border'}`, title: "\u72EC\u7ACB\u7A97\u53E3", children: _jsx("svg", { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" }) }) })] }), _jsx("button", { onClick: () => setHistoryOpen(true), className: "btn btn-secondary", title: "\u4EFB\u52A1\u5386\u53F2", children: "\u5386\u53F2" }), _jsx("button", { onClick: () => setSchedulerOpen(true), className: "btn btn-secondary", title: "\u5B9A\u65F6\u4EFB\u52A1", children: "\u5B9A\u65F6" }), _jsx("button", { onClick: () => setShowPlanViewer(!showPlanViewer), className: `btn ${showPlanViewer ? 'btn-primary' : 'btn-secondary'}`, children: "\u8BA1\u5212" })] })] }));
}
