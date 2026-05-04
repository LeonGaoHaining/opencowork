import { create } from 'zustand';

const MAX_SESSIONS = 100;
const MAX_MESSAGES_PER_SESSION = 200;

export interface SessionMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  taskCount: number;
}

export interface SessionData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messages: any[];
  tasks: any[];
}

interface SessionState {
  sessions: SessionMeta[];
  activeSessionId: string | null;
  activeSession: SessionData | null;
  isLoading: boolean;

  loadSessions: () => Promise<void>;
  createSession: (name?: string) => Promise<SessionData | null>;
  selectSession: (sessionId: string) => Promise<void>;
  updateSession: (sessionId: string, data: Partial<SessionData>) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, name: string) => Promise<void>;
  addMessage: (message: any) => Promise<void>;
  saveMessages: (messages: any[]) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  activeSession: null,
  isLoading: false,

  loadSessions: async () => {
    set({ isLoading: true });
    try {
      if (window.electron) {
        const response = await window.electron.invoke('session:list');
        const payload = response?.data || response;
        const meta = payload?.sessions || payload?.meta;
        if (meta?.sessions) {
          let sessions = meta.sessions;
          if (sessions.length > MAX_SESSIONS) {
            sessions = sessions.slice(-MAX_SESSIONS);
          }
          set({
            sessions,
            activeSessionId: meta.activeSessionId,
          });
          if (meta.activeSessionId) {
            await get().selectSession(meta.activeSessionId);
          }
        }
      }
    } catch (err) {
      console.error('[sessionStore] Failed to load sessions:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createSession: async (name?: string) => {
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
    } catch (err) {
      console.error('[sessionStore] Failed to create session:', err);
    }
    return null;
  },

  selectSession: async (sessionId: string) => {
    try {
      if (window.electron) {
        const { data } = await window.electron.invoke('session:get', { sessionId });
        if (data?.session) {
          set({ activeSessionId: sessionId, activeSession: data.session });
          await window.electron.invoke('session:setActive', { sessionId });
        }
      }
    } catch (err) {
      console.error('[sessionStore] Failed to select session:', err);
    }
  },

  updateSession: async (sessionId: string, data: Partial<SessionData>) => {
    try {
      if (window.electron) {
        const { data: result } = await window.electron.invoke('session:update', {
          sessionId,
          data,
        });
        if (result?.session) {
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    name: result.session.name,
                    updatedAt: result.session.updatedAt,
                    messageCount: result.session.messages?.length || 0,
                    taskCount: result.session.tasks?.length || 0,
                  }
                : s
            ),
            activeSessionId:
              state.activeSessionId === sessionId ? sessionId : state.activeSessionId,
            activeSession:
              state.activeSessionId === sessionId ? result.session : state.activeSession,
          }));
        }
      }
    } catch (err) {
      console.error('[sessionStore] Failed to update session:', err);
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      if (window.electron) {
        const { data } = await window.electron.invoke('session:delete', { sessionId });
        if (data?.success) {
          set((state) => {
            const newSessions = state.sessions.filter((s) => s.id !== sessionId);
            const newActiveId =
              state.activeSessionId === sessionId
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
    } catch (err) {
      console.error('[sessionStore] Failed to delete session:', err);
    }
  },

  renameSession: async (sessionId: string, name: string) => {
    await get().updateSession(sessionId, { name });
  },

  addMessage: async (message: any) => {
    const { activeSessionId, activeSession } = get();
    if (!activeSessionId || !activeSession) return;

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

  saveMessages: async (messages: any[]) => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;

    await get().updateSession(activeSessionId, { messages });
  },
}));
