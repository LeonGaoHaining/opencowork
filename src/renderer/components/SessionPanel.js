import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useTaskStore } from '../stores/taskStore';
export function SessionPanel() {
    const { sessions, activeSessionId, isLoading, loadSessions, createSession, selectSession, deleteSession, renameSession } = useSessionStore();
    const { setMessages, setSessionId } = useTaskStore();
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState('');
    useEffect(() => {
        loadSessions();
    }, []);
    const handleCreateSession = async () => {
        const session = await createSession();
        if (session) {
            setSessionId(session.id);
        }
    };
    const handleSelectSession = async (sessionId) => {
        await selectSession(sessionId);
        const { activeSession } = useSessionStore.getState();
        if (activeSession?.messages) {
            setMessages(activeSession.messages);
        }
        setSessionId(sessionId);
    };
    const handleRename = (sessionId, currentName) => {
        setEditingId(sessionId);
        setEditingName(currentName);
    };
    const handleRenameSubmit = async () => {
        if (editingId && editingName.trim()) {
            await renameSession(editingId, editingName.trim());
        }
        setEditingId(null);
        setEditingName('');
    };
    const handleDelete = async (sessionId, e) => {
        e.stopPropagation();
        if (confirm('确定删除此会话？')) {
            await deleteSession(sessionId);
        }
    };
    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };
    if (isLoading && sessions.length === 0) {
        return (_jsx("div", { className: "w-64 border-r border-border bg-surface p-4", children: _jsx("div", { className: "text-sm text-text-muted", children: "\u52A0\u8F7D\u4E2D..." }) }));
    }
    return (_jsxs("div", { className: "w-64 border-r border-border bg-surface flex flex-col", children: [_jsxs("div", { className: "h-12 flex items-center justify-between px-4 border-b border-border", children: [_jsx("span", { className: "text-sm font-medium text-white", children: "\u4F1A\u8BDD\u5386\u53F2" }), _jsx("button", { onClick: handleCreateSession, className: "p-1 rounded hover:bg-border text-text-muted hover:text-white", title: "\u65B0\u5EFA\u4F1A\u8BDD", children: _jsx("svg", { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) }) })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-2", children: sessions.length === 0 ? (_jsx("div", { className: "text-center text-sm text-text-muted py-8", children: "\u6682\u65E0\u4F1A\u8BDD" })) : (_jsx("div", { className: "space-y-1", children: sessions.map((session) => (_jsx("div", { onClick: () => handleSelectSession(session.id), className: `group p-3 rounded cursor-pointer transition-colors ${activeSessionId === session.id
                            ? 'bg-primary/20 border border-primary/30'
                            : 'hover:bg-border/50 border border-transparent'}`, children: editingId === session.id ? (_jsx("input", { type: "text", value: editingName, onChange: (e) => setEditingName(e.target.value), onBlur: handleRenameSubmit, onKeyDown: (e) => e.key === 'Enter' && handleRenameSubmit(), onClick: (e) => e.stopPropagation(), className: "w-full bg-background border border-border rounded px-2 py-1 text-sm text-white", autoFocus: true })) : (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-white truncate", children: session.name }), _jsx("div", { className: "text-xs text-text-muted mt-1", children: formatTime(session.updatedAt) })] }), _jsxs("div", { className: "flex items-center gap-1 opacity-0 group-hover:opacity-100", children: [_jsx("button", { onClick: (e) => {
                                                e.stopPropagation();
                                                handleRename(session.id, session.name);
                                            }, className: "p-1 rounded hover:bg-border text-text-muted hover:text-white", title: "\u91CD\u547D\u540D", children: _jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" }) }) }), _jsx("button", { onClick: (e) => handleDelete(session.id, e), className: "p-1 rounded hover:bg-border text-text-muted hover:text-red-400", title: "\u5220\u9664", children: _jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }) })] })] })) }, session.id))) })) })] }));
}
export default SessionPanel;
