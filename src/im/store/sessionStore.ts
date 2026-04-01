import { EventEmitter } from 'events';

export type SessionState =
  | 'idle'
  | 'awaiting_confirmation'
  | 'collecting_params'
  | 'executing'
  | 'completed';

export interface SessionContext {
  sessionId: string;
  userId: string;
  conversationId: string;
  state: SessionState;
  taskId?: string;
  data: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

const MAX_SESSIONS_SIZE = 300;
const TIMEOUT = 300000;

class SessionStateMachine extends EventEmitter {
  private sessions: Map<string, SessionContext> = new Map();
  private sessionInsertionOrder: string[] = [];
  private readonly TIMEOUT = TIMEOUT;

  createSession(userId: string, conversationId: string): string {
    if (this.sessions.size >= MAX_SESSIONS_SIZE) {
      const oldestKey = this.sessionInsertionOrder.shift();
      if (oldestKey) {
        this.sessions.delete(oldestKey);
        console.log('[SessionStateMachine] Max size reached, removed oldest session');
      }
    }
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session: SessionContext = {
      sessionId,
      userId,
      conversationId,
      state: 'idle',
      data: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.sessions.set(sessionId, session);
    this.sessionInsertionOrder.push(sessionId);
    console.log('[SessionStateMachine] Session created:', sessionId);
    return sessionId;
  }

  transition(sessionId: string, newState: SessionState, data?: Record<string, any>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn('[SessionStateMachine] Session not found:', sessionId);
      return;
    }

    const oldState = session.state;
    session.state = newState;
    session.updatedAt = Date.now();

    if (data) {
      session.data = { ...session.data, ...data };
    }

    console.log('[SessionStateMachine] Transition:', sessionId, oldState, '->', newState);
    this.emit('state:change', sessionId, oldState, newState);
  }

  getSession(sessionId: string): SessionContext | undefined {
    return this.sessions.get(sessionId);
  }

  getOrCreate(userId: string, conversationId: string): SessionContext {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.conversationId === conversationId) {
        if (Date.now() - session.updatedAt > this.TIMEOUT) {
          this.sessions.delete(session.sessionId);
          continue;
        }
        return session;
      }
    }

    const sessionId = this.createSession(userId, conversationId);
    return this.sessions.get(sessionId)!;
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getActiveSessions(): SessionContext[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.state !== 'completed' && Date.now() - s.updatedAt < this.TIMEOUT
    );
  }
}

let sessionStoreInstance: SessionStateMachine | null = null;

export function getSessionStore(): SessionStateMachine {
  if (!sessionStoreInstance) {
    sessionStoreInstance = new SessionStateMachine();
  }
  return sessionStoreInstance;
}
