import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useTaskStore } from '../stores/taskStore';
export function ChatInput() {
    const [input, setInput] = useState('');
    const { addMessage, setTask, updateTaskStatus } = useTaskStore();
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim())
            return;
        const taskId = `task-${Date.now()}`;
        // Add user message
        addMessage({ role: 'user', content: input });
        // Create a new task
        setTask({
            id: taskId,
            status: 'planning',
            description: input,
            progress: { current: 0, total: 0 },
        });
        // Add AI response
        addMessage({
            role: 'ai',
            content: '任务已创建，开始执行...',
        });
        setInput('');
        // Debug: check if electron API exists
        console.log('[Renderer] window.electron:', window.electron);
        // Send to main process via IPC
        try {
            if (!window.electron) {
                throw new Error('window.electron not defined');
            }
            const result = await window.electron.invoke('task:start', { task: input });
            console.log('[Renderer] IPC result:', result);
            if (result?.success) {
                updateTaskStatus('executing');
            }
        }
        catch (error) {
            console.error('[Renderer] Failed to start task:', error);
            updateTaskStatus('failed');
            addMessage({
                role: 'ai',
                content: `错误: ${error instanceof Error ? error.message : '启动任务失败'}`,
            });
        }
    };
    return (_jsxs("form", { onSubmit: handleSubmit, className: "flex gap-3", children: [_jsx("input", { type: "text", value: input, onChange: (e) => setInput(e.target.value), placeholder: "\u8F93\u5165\u4EFB\u52A1\u63CF\u8FF0...", className: "input flex-1" }), _jsx("button", { type: "submit", className: "btn btn-primary px-6", disabled: !input.trim(), children: "\u53D1\u9001" })] }));
}
