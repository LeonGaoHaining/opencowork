import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function TaskStatus({ task }) {
    const progressPercent = task.progress.total > 0
        ? Math.round((task.progress.current / task.progress.total) * 100)
        : 0;
    return (_jsxs("div", { className: "px-4 py-3 border-b border-border bg-surface", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-sm font-medium", children: task.description }), _jsxs("span", { className: "text-sm text-text-muted", children: [task.progress.current, " / ", task.progress.total] })] }), _jsx("div", { className: "progress-bar", children: _jsx("div", { className: "progress-bar-fill", style: { width: `${progressPercent}%` } }) }), task.currentStep && (_jsxs("p", { className: "text-xs text-text-muted mt-2", children: ["\u5F53\u524D: ", task.currentStep] }))] }));
}
