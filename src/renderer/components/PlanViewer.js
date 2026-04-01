import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTaskStore } from '../stores/taskStore';
export function PlanViewer() {
    const { task, showPlanViewer } = useTaskStore();
    if (!showPlanViewer || !task?.plan) {
        return null;
    }
    const { plan } = task;
    return (_jsxs("div", { className: "h-full flex flex-col border-l border-border", children: [_jsxs("div", { className: "px-4 py-3 border-b border-border bg-surface", children: [_jsx("h3", { className: "font-medium", children: "\u6267\u884C\u8BA1\u5212" }), _jsxs("p", { className: "text-xs text-text-muted", children: ["\u5171 ", plan.nodes.length, " \u4E2A\u6B65\u9AA4"] })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-4", children: _jsx("div", { className: "space-y-2", children: plan.nodes.map((node, index) => (_jsxs("div", { className: `flex items-start gap-3 p-3 rounded-lg ${node.type === 'action'
                            ? 'bg-elevated'
                            : node.type === 'condition'
                                ? 'bg-warning/10 border border-warning/30'
                                : 'bg-accent/10 border border-accent/30'}`, children: [_jsx("div", { className: `w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0
                ${node.type === 'action' ? 'bg-primary text-white' : 'bg-surface'}
              `, children: index + 1 }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm truncate", children: node.metadata?.description || node.action?.description || 'Unknown step' }), node.action && (_jsx("p", { className: "text-xs text-text-muted font-mono mt-1", children: node.action.type }))] }), node.type !== 'action' && (_jsx("span", { className: `text-xs px-2 py-0.5 rounded ${node.type === 'condition' ? 'bg-warning/20 text-warning' : 'bg-accent/20 text-accent'}`, children: node.type === 'condition' ? '条件' : '循环' }))] }, node.id))) }) })] }));
}
