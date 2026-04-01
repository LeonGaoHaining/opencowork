import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useTaskStore } from '../stores/taskStore';
export function ChatUI() {
    const { messages } = useTaskStore();
    return (_jsxs("div", { className: "h-full flex flex-col", children: [_jsxs("div", { className: "flex-1 overflow-y-auto p-4 space-y-4", children: [messages.length === 0 && (_jsx("div", { className: "h-full flex items-center justify-center", children: _jsxs("div", { className: "text-center text-text-muted", children: [_jsx("p", { className: "text-lg mb-2", children: "Welcome to OpenCowork" }), _jsx("p", { className: "text-sm", children: "Describe a task and I'll help you execute it" })] }) })), messages.map((message) => (_jsx(ChatMessage, { message: message }, message.id)))] }), _jsx("div", { className: "p-4 border-t border-border", children: _jsx(ChatInput, {}) })] }));
}
