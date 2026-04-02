import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTaskStore } from '../stores/taskStore';
export function AskUserDialog() {
    const { askUserRequest, setAskUserRequest, respondToAskUser } = useTaskStore();
    const [remainingTime, setRemainingTime] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [customAnswer, setCustomAnswer] = useState('');
    useEffect(() => {
        if (!askUserRequest)
            return;
        setRemainingTime(askUserRequest.timeout);
        const timer = setInterval(() => {
            setRemainingTime((prev) => {
                if (prev <= 1000) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1000;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [askUserRequest]);
    if (!askUserRequest)
        return null;
    const formatTime = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        const answer = selectedOption || customAnswer;
        if (answer.trim()) {
            respondToAskUser(answer);
        }
    };
    const handleCancel = () => {
        try {
            if (window.electron) {
                window.electron.invoke('ask:user:response', {
                    requestId: askUserRequest.requestId,
                    answer: '',
                    cancelled: true,
                });
            }
            setAskUserRequest(null);
        }
        catch (error) {
            console.error('[AskUserDialog] handleCancel error:', error);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70", children: _jsxs("div", { className: "w-[400px] rounded-lg bg-[var(--color-surface)] p-6 shadow-lg", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-semibold text-[var(--color-text-primary)]", children: "\u9700\u8981\u786E\u8BA4" }), _jsxs("span", { className: "text-sm text-[var(--color-text-muted)]", children: ["\u5269\u4F59\u65F6\u95F4: ", formatTime(remainingTime)] })] }), _jsx("p", { className: "mb-6 text-[var(--color-text-secondary)]", children: askUserRequest.question }), askUserRequest.options && askUserRequest.options.length > 0 ? (_jsxs("form", { onSubmit: handleSubmit, children: [_jsx("div", { className: "mb-4 space-y-2", children: askUserRequest.options.map((option, index) => (_jsx("button", { type: "button", onClick: () => setSelectedOption(option), className: `w-full rounded-md p-3 text-left transition-colors ${selectedOption === option
                                    ? 'bg-[var(--color-primary)] text-white'
                                    : 'bg-[var(--color-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'}`, children: option }, index))) }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { type: "button", onClick: handleCancel, className: "flex-1 rounded-md bg-[var(--color-elevated)] px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]", children: "\u53D6\u6D88" }), _jsx("button", { type: "submit", disabled: !selectedOption, className: "flex-1 rounded-md bg-[var(--color-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50", children: "\u786E\u8BA4" })] })] })) : (_jsxs("form", { onSubmit: handleSubmit, children: [_jsx("div", { className: "mb-4", children: _jsx("textarea", { value: customAnswer, onChange: (e) => setCustomAnswer(e.target.value), placeholder: "\u8F93\u5165\u4F60\u7684\u56DE\u7B54...", className: "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)] p-3 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none", rows: 3 }) }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { type: "button", onClick: handleCancel, className: "flex-1 rounded-md bg-[var(--color-elevated)] px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]", children: "\u53D6\u6D88" }), _jsx("button", { type: "submit", disabled: !customAnswer.trim(), className: "flex-1 rounded-md bg-[var(--color-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50", children: "\u786E\u8BA4" })] })] })), remainingTime === 0 && (_jsx("p", { className: "mt-3 text-center text-sm text-[var(--color-error)]", children: "\u65F6\u95F4\u5DF2\u5230\u671F\uFF0C\u64CD\u4F5C\u5DF2\u53D6\u6D88" }))] }) }));
}
export default AskUserDialog;
