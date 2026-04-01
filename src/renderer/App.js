import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, Component } from 'react';
import { ChatUI } from './components/ChatUI';
import { ControlBar } from './components/ControlBar';
import { TaskStatus } from './components/TaskStatus';
import { TakeoverModal } from './components/TakeoverModal';
import { AskUserDialog } from './components/AskUserDialog';
import { SessionPanel } from './components/SessionPanel';
import { HistoryPanel } from './components/HistoryPanel';
import SchedulerPanel from './components/SchedulerPanel';
import { useTaskStore } from './stores/taskStore';
import { useSessionStore } from './stores/sessionStore';
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (_jsx("div", { className: "h-screen flex items-center justify-center bg-background", children: _jsxs("div", { className: "text-center p-8", children: [_jsx("div", { className: "text-red-400 text-xl mb-4", children: "Something went wrong" }), _jsx("div", { className: "text-text-muted text-sm mb-4", children: this.state.error?.message || 'An unexpected error occurred' }), _jsx("button", { onClick: () => window.location.reload(), className: "btn btn-primary", children: "Reload" })] }) }));
        }
        return this.props.children;
    }
}
function App() {
    const { isTakeover, task, addMessage, updateTaskStatus, updateTaskProgress, updateCurrentStep, setTaskError, addLog, setAskUserRequest, previewMode, setPreviewMode, messages, addActiveStep, updateActiveStep, clearActiveSteps, } = useTaskStore();
    const { saveMessages } = useSessionStore();
    const [screenshot, setScreenshot] = useState(null);
    const [imageKey, setImageKey] = useState(0);
    useEffect(() => {
        console.log('[Renderer] App useEffect running, window.electron:', !!window.electron);
        if (!window.electron) {
            console.error('[Renderer] window.electron not available!');
            return;
        }
        const unsubscribers = [];
        unsubscribers.push(window.electron.on('task:nodeStart', (event) => {
            console.log('[Renderer] Received task:nodeStart', event);
            const node = event.node;
            if (node?.action) {
                const stepId = node.id || `step-${Date.now()}`;
                const action = node.action;
                addActiveStep({
                    id: stepId,
                    toolName: action.type || 'unknown',
                    args: action.params || {},
                    status: 'running',
                });
                updateCurrentStep(`${action.type}: ${action.params ? JSON.stringify(action.params).substring(0, 50) : ''}`);
                addLog({ type: 'step', message: `执行步骤: ${action.type}` });
            }
        }));
        unsubscribers.push(window.electron.on('task:nodeComplete', (event) => {
            console.log('[Renderer] Received task:nodeComplete', event);
            const node = event.node;
            if (node?.id) {
                const isError = node.result?.error || node.result?.success === false;
                updateActiveStep(node.id, {
                    status: isError ? 'error' : 'completed',
                    result: node.result,
                    duration: node.duration,
                });
                addLog({ type: 'success', message: `完成: ${node.action?.type || '步骤'}` });
            }
        }));
        unsubscribers.push(window.electron.on('task:completed', (event) => {
            console.log('[Renderer] Received task:completed', event);
            console.log('[Renderer] event.result:', JSON.stringify(event.result).substring(0, 500));
            updateTaskStatus('completed');
            const { activeSteps } = useTaskStore.getState();
            const innerResult = event.result?.result || event.result || event.data || {};
            const resultText = innerResult.finalMessage || '任务已完成';
            console.log('[Renderer] finalMessage:', resultText);
            const steps = Array.isArray(innerResult.steps) ? innerResult.steps : [];
            const finalSteps = activeSteps.length > 0 ? activeSteps : steps.length > 0 ? steps : undefined;
            addMessage({
                role: 'ai',
                content: resultText,
                steps: finalSteps,
            });
            clearActiveSteps();
            addLog({ type: 'success', message: '任务执行完成' });
            saveMessages(useTaskStore.getState().messages);
        }));
        unsubscribers.push(window.electron.on('task:error', (event) => {
            console.log('[Renderer] Received task:error', event);
            const errorMsg = event.error?.message || event.error || '未知错误';
            setTaskError(errorMsg);
            updateTaskStatus('failed');
            clearActiveSteps();
            addMessage({
                role: 'ai',
                content: `任务执行失败: ${errorMsg}`,
            });
            addLog({ type: 'error', message: `错误: ${errorMsg}` });
            saveMessages(useTaskStore.getState().messages);
        }));
        unsubscribers.push(window.electron.on('ask:user:request', (event) => {
            console.log('[Renderer] Received ask:user:request', event);
            setAskUserRequest({
                requestId: event.requestId,
                question: event.question,
                options: event.options,
                defaultResponse: event.defaultResponse,
                timeout: event.timeout,
            });
            updateTaskStatus('waiting_confirm');
            addLog({ type: 'info', message: `等待用户确认: ${event.question}` });
        }));
        unsubscribers.push(window.electron.on('task:statusUpdate', (event) => {
            console.log('[Renderer] Received task:statusUpdate', event);
            if (event.status === 'replanning') {
                useTaskStore
                    .getState()
                    .addLog({ type: 'info', message: event.message || '正在重新规划' });
            }
        }));
        unsubscribers.push(window.electron.on('task:waiting_login', (event) => {
            console.log('[Renderer] Received task:waiting_login', event);
            updateTaskStatus('waiting_confirm');
            addLog({ type: 'info', message: event.message || '等待处理登录弹窗' });
        }));
        // Listen for screenshot updates
        unsubscribers.push(window.electron.on('preview:screenshot', (data) => {
            // 支持两种格式：1. { screenshot: base64 } 2. 直接 base64 字符串
            const screenshot = data?.screenshot || data;
            console.log('[Renderer] Received preview:screenshot, length:', screenshot?.length);
            setScreenshot(screenshot);
            setImageKey((k) => k + 1); // 强制刷新图片
        }));
        console.log('[Renderer] Registered event listeners, count:', unsubscribers.length);
        return () => {
            console.log('[Renderer] Cleaning up event listeners');
            unsubscribers.forEach((unsub) => unsub());
        };
    }, []);
    return (_jsx(ErrorBoundary, { children: _jsxs("div", { className: "h-screen flex flex-col bg-background", children: [_jsxs("header", { className: "h-12 flex items-center justify-between px-4 border-b border-border bg-surface", children: [_jsx("h1", { className: "text-lg font-semibold text-white", children: "OpenCowork" }), _jsx("div", { className: "text-sm text-text-muted", children: "v0.2.0" })] }), _jsxs("main", { className: "flex-1 flex overflow-hidden", children: [_jsx(SessionPanel, {}), _jsxs("div", { className: `flex flex-col overflow-hidden ${previewMode === 'sidebar' ? 'flex-1' : 'w-full'}`, children: [task && _jsx(TaskStatus, { task: task }), _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(ChatUI, {}) })] }), previewMode === 'sidebar' && (_jsxs("div", { className: "w-[40%] border-l border-border bg-surface flex flex-col", children: [_jsxs("div", { className: "h-12 flex items-center justify-between px-4 border-b border-border bg-elevated", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("svg", { className: "w-4 h-4 text-primary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" }) }), _jsx("span", { className: "text-sm text-text-secondary truncate max-w-[200px]", children: task?.currentStep || (screenshot ? '正在预览...' : '等待任务执行...') })] }), _jsx("button", { onClick: () => setPreviewMode('detached'), className: "p-1.5 rounded hover:bg-border text-text-muted hover:text-white", title: "\u6253\u5F00\u72EC\u7ACB\u7A97\u53E3", children: _jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" }) }) })] }), _jsx("div", { className: "flex-1 bg-background flex items-center justify-center p-2 overflow-hidden", children: screenshot ? (_jsx("img", { src: `data:image/jpeg;base64,${screenshot}`, alt: "Browser Preview", className: "w-full h-full object-contain rounded shadow" }, imageKey)) : (_jsxs("div", { className: "text-center text-text-muted", children: [_jsx("svg", { className: "w-12 h-12 mx-auto mb-2 opacity-50", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" }) }), _jsx("p", { className: "text-sm", children: "\u7B49\u5F85\u4EFB\u52A1\u6267\u884C..." })] })) }), task?.currentStep && (_jsx("div", { className: "h-8 px-4 border-t border-border bg-elevated flex items-center", children: _jsx("span", { className: "text-xs text-text-muted font-mono truncate", children: task.currentStep }) }))] }))] }), _jsx(ControlBar, {}), isTakeover && _jsx(TakeoverModal, {}), _jsx(AskUserDialog, {}), _jsx(HistoryPanel, {}), _jsx(SchedulerPanel, {})] }) }));
}
export default App;
