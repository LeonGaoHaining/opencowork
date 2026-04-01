import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const StepIcon = ({ status }) => {
    switch (status) {
        case 'pending':
            return _jsx("span", { className: "step-icon text-gray-400", children: "\u23F3" });
        case 'running':
            return _jsx("span", { className: "step-icon animate-spin", children: "\uD83D\uDD04" });
        case 'completed':
            return _jsx("span", { className: "step-icon text-green-400", children: "\u2705" });
        case 'error':
            return _jsx("span", { className: "step-icon text-red-400", children: "\u274C" });
        default:
            return _jsx("span", { className: "step-icon text-gray-400", children: "\u26AA" });
    }
};
const formatArgs = (args) => {
    if (!args)
        return '';
    if (args.url)
        return args.url;
    if (args.selector)
        return `点击: ${args.selector}`;
    if (args.command)
        return `执行: ${args.command}`;
    return JSON.stringify(args).substring(0, 50);
};
export function ChatMessage({ message }) {
    const isUser = message.role === 'user';
    return (_jsx("div", { className: `flex ${isUser ? 'justify-end' : 'justify-start'}`, children: _jsxs("div", { className: `${isUser ? 'message-user' : 'message-ai'} max-w-[80%] flex flex-col gap-2`, children: [_jsx("p", { className: "text-sm whitespace-pre-wrap", children: message.content }), message.steps && message.steps.length > 0 && (_jsx("div", { className: "steps-list mt-2 pl-2 border-l-2 border-gray-600", children: message.steps.map((step, index) => (_jsxs("div", { className: "step-item flex items-center gap-2 py-1 text-xs", children: [_jsx(StepIcon, { status: step.status }), _jsxs("span", { className: "step-tool text-blue-400 font-medium", children: [step.toolName, ":"] }), _jsx("span", { className: "step-args text-gray-300", children: formatArgs(step.args) }), step.duration && (_jsxs("span", { className: "step-duration text-gray-500 ml-2", children: ["(", step.duration, "ms)"] }))] }, step.id || index))) })), _jsx("span", { className: "text-xs text-white/50 mt-1 block", children: new Date(message.timestamp).toLocaleTimeString() })] }) }));
}
