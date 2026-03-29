import betterSqlite3 from 'better-sqlite3';
import { TaskHistoryRecord } from './taskHistory';

export class SQLiteStore {
  private db: any;
  private dbPath: string;

  constructor(dbPath: string = './history.db') {
    this.dbPath = dbPath;
    this.db = new (betterSqlite3 as any)(dbPath);
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_history (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_namespace ON task_history(namespace);
      CREATE INDEX IF NOT EXISTS idx_created_at ON task_history(created_at);
    `);
  }

  async put(namespace: string[], key: string, value: TaskHistoryRecord): Promise<void> {
    const ns = namespace.join(':');
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO task_history (id, namespace, key, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    const id = `${ns}:${key}`;
    stmt.run(id, ns, key, JSON.stringify(value), now, now);
  }

  async get(namespace: string[], key: string): Promise<TaskHistoryRecord | null> {
    const ns = namespace.join(':');
    const stmt = this.db.prepare(`
      SELECT data FROM task_history WHERE namespace = ? AND key = ?
    `);
    const row = stmt.get(ns, key);
    if (row) {
      return JSON.parse(row.data);
    }
    return null;
  }

  async delete(namespace: string[], key: string): Promise<void> {
    const ns = namespace.join(':');
    const stmt = this.db.prepare(`
      DELETE FROM task_history WHERE namespace = ? AND key = ?
    `);
    stmt.run(ns, key);
  }

  async query(
    namespace: string[],
    options: {
      filter?: (record: TaskHistoryRecord) => boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<TaskHistoryRecord[]> {
    const ns = namespace.join(':');
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    if (options.filter) {
      const tempRecords = this.db
        .prepare(`SELECT data FROM task_history WHERE namespace = ?`)
        .all(ns);
      const filtered = (tempRecords as { data: string }[])
        .map((row) => JSON.parse(row.data) as TaskHistoryRecord)
        .filter(options.filter);
      return filtered.slice(offset, offset + limit);
    }

    const stmt = this.db.prepare(`
      SELECT data FROM task_history WHERE namespace = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(ns, limit, offset);
    return (rows as { data: string }[]).map((row) => JSON.parse(row.data) as TaskHistoryRecord);
  }

  async list(namespace: string[]): Promise<TaskHistoryRecord[]> {
    const ns = namespace.join(':');
    const stmt = this.db.prepare(`
      SELECT data FROM task_history WHERE namespace = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(ns);
    return (rows as { data: string }[]).map((row) => JSON.parse(row.data) as TaskHistoryRecord);
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async clear(): Promise<void> {
    this.db.exec('DELETE FROM task_history');
  }

  async size(): Promise<number> {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM task_history').get();
    return result.count;
  }
}
