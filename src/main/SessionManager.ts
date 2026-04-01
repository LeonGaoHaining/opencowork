import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';

const MAX_SESSIONS = 100;

function generateId(): string {
  return crypto.randomUUID();
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
}

export interface TaskHistory {
  id: string;
  description: string;
  status: 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt?: number;
  logs: Array<{
    type: 'info' | 'success' | 'error' | 'step';
    message: string;
    timestamp: number;
  }>;
}

export interface SessionData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  tasks: TaskHistory[];
}

export interface SessionMeta {
  sessions: Array<{
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    messageCount: number;
    taskCount: number;
  }>;
  activeSessionId: string | null;
}

class SessionManager {
  private sessionsDir: string;
  private metaPath: string;
  private meta: SessionMeta;
  private updateLocks: Map<string, boolean> = new Map();
  private createLock: boolean = false;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.sessionsDir = path.join(userDataPath, 'sessions');
    this.metaPath = path.join(this.sessionsDir, 'meta.json');
    this.meta = this.loadMeta();
  }

  private async acquireUpdateLock(sessionId: string): Promise<() => void> {
    while (this.updateLocks.get(sessionId)) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    this.updateLocks.set(sessionId, true);
    return () => this.updateLocks.set(sessionId, false);
  }

  private ensureSessionsDir(): void {
    try {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    } catch (err) {
      console.error('[SessionManager] Failed to create sessions directory:', err);
    }
  }

  private loadMeta(): SessionMeta {
    this.ensureSessionsDir();
    try {
      const data = fs.readFileSync(this.metaPath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error('[SessionManager] Failed to load meta:', err);
    }
    return { sessions: [], activeSessionId: null };
  }

  private saveMeta(): void {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        fs.writeFileSync(this.metaPath, JSON.stringify(this.meta, null, 2), 'utf-8');
        return;
      } catch (err) {
        lastError = err as Error;
        console.error(
          `[SessionManager] Failed to save meta (attempt ${attempt}/${maxRetries}):`,
          err
        );
        if (attempt < maxRetries) {
          const delay = Math.min(100 * attempt, 500);
          const start = Date.now();
          while (Date.now() - start < delay) {
            /* spin wait */
          }
        }
      }
    }
    console.error('[SessionManager] Meta save failed after all retries:', lastError);
  }

  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, sessionId, 'session.json');
  }

  create(name?: string): SessionData {
    if (this.createLock) {
      throw new Error('Session creation in progress, please wait');
    }
    this.createLock = true;

    try {
      const session: SessionData = {
        id: generateId(),
        name: name || `会话 ${new Date().toLocaleString('zh-CN')}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        tasks: [],
      };

      const sessionDir = path.join(this.sessionsDir, session.id);
      fs.mkdirSync(sessionDir, { recursive: true });

      try {
        fs.writeFileSync(
          this.getSessionPath(session.id),
          JSON.stringify(session, null, 2),
          'utf-8'
        );
      } catch (err) {
        console.error('[SessionManager] Failed to write session file:', err);
        throw err;
      }

      this.meta.sessions.push({
        id: session.id,
        name: session.name,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: 0,
        taskCount: 0,
      });

      if (this.meta.sessions.length > MAX_SESSIONS) {
        const removed = this.meta.sessions.shift();
        if (removed) {
          const removedDir = path.join(this.sessionsDir, removed.id);
          if (fs.existsSync(removedDir)) {
            fs.rmSync(removedDir, { recursive: true, force: true });
          }
          console.log('[SessionManager] Max sessions reached, removed oldest:', removed.id);
        }
      }

      this.meta.activeSessionId = session.id;
      this.saveMeta();

      console.log('[SessionManager] Created session:', session.id);
      return session;
    } finally {
      this.createLock = false;
    }
  }

  get(sessionId: string): SessionData | null {
    const sessionPath = this.getSessionPath(sessionId);
    if (fs.existsSync(sessionPath)) {
      try {
        const data = fs.readFileSync(sessionPath, 'utf-8');
        return JSON.parse(data);
      } catch (err) {
        console.error('[SessionManager] Failed to load session:', err);
      }
    }
    return null;
  }

  update(sessionId: string, data: Partial<SessionData>): SessionData | null {
    if (this.updateLocks.get(sessionId)) {
      console.warn('[SessionManager] Update already in progress for:', sessionId);
      return null;
    }
    this.updateLocks.set(sessionId, true);

    try {
      const session = this.get(sessionId);
      if (!session) return null;

      const updated = { ...session, ...data, updatedAt: Date.now() };

      try {
        fs.writeFileSync(this.getSessionPath(sessionId), JSON.stringify(updated, null, 2), 'utf-8');
      } catch (err) {
        console.error('[SessionManager] Failed to update session:', err);
        return null;
      }

      const metaIndex = this.meta.sessions.findIndex((s) => s.id === sessionId);
      if (metaIndex !== -1) {
        this.meta.sessions[metaIndex] = {
          ...this.meta.sessions[metaIndex],
          name: updated.name,
          updatedAt: updated.updatedAt,
          messageCount: updated.messages.length,
          taskCount: updated.tasks.length,
        };
        this.saveMeta();
      }

      return updated;
    } finally {
      this.updateLocks.set(sessionId, false);
    }
  }

  delete(sessionId: string): boolean {
    const sessionPath = path.join(this.sessionsDir, sessionId);
    try {
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true });
      }
      this.meta.sessions = this.meta.sessions.filter((s) => s.id !== sessionId);
      if (this.meta.activeSessionId === sessionId) {
        this.meta.activeSessionId = this.meta.sessions[0]?.id || null;
      }
      this.saveMeta();
      return true;
    } catch (err) {
      console.error('[SessionManager] Failed to delete session:', err);
      return false;
    }
  }

  list(): SessionMeta {
    return this.meta;
  }

  setActive(sessionId: string): void {
    if (this.meta.sessions.find((s) => s.id === sessionId)) {
      this.meta.activeSessionId = sessionId;
      this.saveMeta();
    }
  }

  getActive(): SessionData | null {
    if (this.meta.activeSessionId) {
      return this.get(this.meta.activeSessionId);
    }
    return null;
  }
}

export const sessionManager = new SessionManager();
export default sessionManager;
