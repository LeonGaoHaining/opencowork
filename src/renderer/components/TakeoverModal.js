import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTaskStore } from '../stores/taskStore';
export function TakeoverModal() {
    const { setTakeover } = useTaskStore();
    const handleResumeAI = () => {
        // TODO: IPC call to resume from takeover
        console.log('Resume AI');
        setTakeover(false);
    };
    const handleRestart = () => {
        // TODO: IPC call to restart task
        console.log('Restart task');
        setTakeover(false);
    };
    const handleManualComplete = () => {
        // TODO: IPC call to complete manually
        console.log('Manual complete');
        setTakeover(false);
    };
    const handleCancel = () => {
        // TODO: IPC call to cancel task
        console.log('Cancel task');
        setTakeover(false);
    };
    return (_jsx("div", { className: "modal-overlay", children: _jsxs("div", { className: "modal-content text-center", children: [_jsxs("div", { className: "mb-6", children: [_jsx("div", { className: "w-12 h-12 mx-auto mb-4 rounded-full bg-warning/20 flex items-center justify-center", children: _jsx("svg", { className: "w-6 h-6 text-warning", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }) }), _jsx("h2", { className: "text-xl font-semibold mb-2", children: "\u5DF2\u63A5\u7BA1" }), _jsx("p", { className: "text-text-muted", children: "AI\u5DF2\u6682\u505C\uFF0C\u60A8\u53EF\u4EE5\u63A5\u7BA1\u6D4F\u89C8\u5668\u63A7\u5236" })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("button", { onClick: handleResumeAI, className: "btn btn-primary w-full", children: "\u4EA4\u8FD8AI\u63A7\u5236" }), _jsx("button", { onClick: handleRestart, className: "btn btn-secondary w-full", children: "\u91CD\u65B0\u5F00\u59CB" }), _jsx("button", { onClick: handleManualComplete, className: "btn btn-secondary w-full", children: "\u4EBA\u5DE5\u5B8C\u6210" }), _jsx("button", { onClick: handleCancel, className: "btn w-full text-text-muted hover:text-white", children: "\u53D6\u6D88\u4EFB\u52A1" })] })] }) }));
}
