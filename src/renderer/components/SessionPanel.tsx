import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useTaskStore } from '../stores/taskStore';

export function SessionPanel() {
  const {
    sessions,
    activeSessionId,
    isLoading,
    loadSessions,
    createSession,
    selectSession,
    deleteSession,
    renameSession,
  } = useSessionStore();
  const { setMessages, setSessionId } = useTaskStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    loadSessions();
  }, []);

  const handleCreateSession = async () => {
    try {
      const session = await createSession();
      if (session) {
        setSessionId(session.id);
      }
    } catch (error) {
      console.error('[SessionPanel] handleCreateSession error:', error);
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    try {
      await selectSession(sessionId);
      const { activeSession } = useSessionStore.getState();
      if (activeSession?.messages) {
        setMessages(activeSession.messages);
      }
      setSessionId(sessionId);
    } catch (error) {
      console.error('[SessionPanel] handleSelectSession error:', error);
    }
  };

  const handleRename = (sessionId: string, currentName: string) => {
    setEditingId(sessionId);
    setEditingName(currentName);
  };

  const handleRenameSubmit = async () => {
    try {
      if (editingId && editingName.trim()) {
        await renameSession(editingId, editingName.trim());
      }
    } catch (error) {
      console.error('[SessionPanel] handleRenameSubmit error:', error);
    } finally {
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    try {
      e.stopPropagation();
      if (confirm('确定删除此会话？')) {
        await deleteSession(sessionId);
      }
    } catch (error) {
      console.error('[SessionPanel] handleDelete error:', error);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading && sessions.length === 0) {
    return (
      <div className="w-64 border-r border-border bg-surface p-4">
        <div className="text-sm text-text-muted">加载中...</div>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-border bg-surface flex flex-col">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-border">
        <span className="text-sm font-medium text-white">会话历史</span>
        <button
          onClick={handleCreateSession}
          className="p-1 rounded hover:bg-border text-text-muted hover:text-white"
          title="新建会话"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="text-center text-sm text-text-muted py-8">暂无会话</div>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className={`group p-3 rounded cursor-pointer transition-colors ${
                  activeSessionId === session.id
                    ? 'bg-primary/20 border border-primary/30'
                    : 'hover:bg-border/50 border border-transparent'
                }`}
              >
                {editingId === session.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-white"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{session.name}</div>
                      <div className="text-xs text-text-muted mt-1">
                        {formatTime(session.updatedAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRename(session.id, session.name);
                        }}
                        className="p-1 rounded hover:bg-border text-text-muted hover:text-white"
                        title="重命名"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDelete(session.id, e)}
                        className="p-1 rounded hover:bg-border text-text-muted hover:text-red-400"
                        title="删除"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SessionPanel;
