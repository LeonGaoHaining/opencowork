import { create } from 'zustand';
const MAX_SESSIONS = 100;
const MAX_MESSAGES_PER_SESSION = 200;
export const useSessionStore = create((set, get) => ({
    sessions: [],
    activeSessionId: null,
    activeSession: null,
    isLoading: false,
    loadSessions: async () => {
        set({ isLoading: true });
        try {
            if (window.electron) {
                const { data } = await window.electron.invoke('session:list');
                if (data?.meta?.sessions) {
                    let sessions = data.meta.sessions;
                    if (sessions.length > MAX_SESSIONS) {
                        sessions = sessions.slice(-MAX_SESSIONS);
                    }
                    set({
                        sessions,
                        activeSessionId: data.meta.activeSessionId,
                    });
                    if (data.meta.activeSessionId) {
                        await get().selectSession(data.meta.activeSessionId);
                    }
                }
            }
        }
        catch (err) {
            console.error('[sessionStore] Failed to load sessions:', err);
        }
        finally {
            set({ isLoading: false });
        }
    },
    createSession: async (name) => {
        try {
            if (window.electron) {
                const { data } = await window.electron.invoke('session:create', { name });
                if (data?.session) {
                    const session = data.session;
                    set((state) => {
                        let sessions = [
                            ...state.sessions,
                            {
                                id: session.id,
                                name: session.name,
                                createdAt: session.createdAt,
                                updatedAt: session.updatedAt,
                                messageCount: 0,
                                taskCount: 0,
                            },
                        ];
                        if (sessions.length > MAX_SESSIONS) {
                            sessions = sessions.slice(-MAX_SESSIONS);
                        }
                        return {
                            sessions,
                            activeSessionId: session.id,
                            activeSession: session,
                        };
                    });
                    return session;
                }
            }
        }
        catch (err) {
            console.error('[sessionStore] Failed to create session:', err);
        }
        return null;
    },
    selectSession: async (sessionId) => {
        try {
            if (window.electron) {
                const { data } = await window.electron.invoke('session:get', { sessionId });
                if (data?.session) {
                    set({ activeSessionId: sessionId, activeSession: data.session });
                    await window.electron.invoke('session:setActive', { sessionId });
                }
            }
        }
        catch (err) {
            console.error('[sessionStore] Failed to select session:', err);
        }
    },
    updateSession: async (sessionId, data) => {
        try {
            if (window.electron) {
                const { data: result } = await window.electron.invoke('session:update', {
                    sessionId,
                    data,
                });
                if (result?.session) {
                    set((state) => ({
                        sessions: state.sessions.map((s) => s.id === sessionId
                            ? {
                                ...s,
                                name: result.session.name,
                                updatedAt: result.session.updatedAt,
                                messageCount: result.session.messages?.length || 0,
                                taskCount: result.session.tasks?.length || 0,
                            }
                            : s),
                        activeSessionId: state.activeSessionId === sessionId ? sessionId : state.activeSessionId,
                        activeSession: state.activeSessionId === sessionId ? result.session : state.activeSession,
                    }));
                }
            }
        }
        catch (err) {
            console.error('[sessionStore] Failed to update session:', err);
        }
    },
    deleteSession: async (sessionId) => {
        try {
            if (window.electron) {
                const { data } = await window.electron.invoke('session:delete', { sessionId });
                if (data?.success) {
                    set((state) => {
                        const newSessions = state.sessions.filter((s) => s.id !== sessionId);
                        const newActiveId = state.activeSessionId === sessionId
                            ? newSessions[0]?.id || null
                            : state.activeSessionId;
                        return {
                            sessions: newSessions,
                            activeSessionId: newActiveId,
                            activeSession: newActiveId ? state.activeSession : null,
                        };
                    });
                }
            }
        }
        catch (err) {
            console.error('[sessionStore] Failed to delete session:', err);
        }
    },
    renameSession: async (sessionId, name) => {
        await get().updateSession(sessionId, { name });
    },
    addMessage: async (message) => {
        const { activeSessionId, activeSession } = get();
        if (!activeSessionId || !activeSession)
            return;
        let newMessages = [
            ...(activeSession.messages || []),
            {
                ...message,
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
            },
        ];
        if (newMessages.length > MAX_MESSAGES_PER_SESSION) {
            newMessages = newMessages.slice(-MAX_MESSAGES_PER_SESSION);
        }
        await get().updateSession(activeSessionId, { messages: newMessages });
    },
    saveMessages: async (messages) => {
        const { activeSessionId } = get();
        if (!activeSessionId)
            return;
        await get().updateSession(activeSessionId, { messages });
    },
}));
