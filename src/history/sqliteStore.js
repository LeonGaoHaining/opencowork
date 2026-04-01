import betterSqlite3 from 'better-sqlite3';
function safeJsonParse(data) {
    try {
        return JSON.parse(data);
    }
    catch (error) {
        console.error('[SQLiteStore] Failed to parse JSON:', error);
        return null;
    }
}
export class SQLiteStore {
    db;
    dbPath;
    constructor(dbPath = './history.db') {
        this.dbPath = dbPath;
        this.db = betterSqlite3(dbPath);
        this.initialize();
    }
    initialize() {
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
    async put(namespace, key, value) {
        const ns = namespace.join(':');
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO task_history (id, namespace, key, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const now = Date.now();
        const id = `${ns}:${key}`;
        stmt.run(id, ns, key, JSON.stringify(value), now, now);
    }
    async get(namespace, key) {
        const ns = namespace.join(':');
        const stmt = this.db.prepare(`
      SELECT data FROM task_history WHERE namespace = ? AND key = ?
    `);
        const row = stmt.get(ns, key);
        if (row) {
            return safeJsonParse(row.data);
        }
        return null;
    }
    async delete(namespace, key) {
        const ns = namespace.join(':');
        const stmt = this.db.prepare(`
      DELETE FROM task_history WHERE namespace = ? AND key = ?
    `);
        stmt.run(ns, key);
    }
    async query(namespace, options = {}) {
        const ns = namespace.join(':');
        const limit = options.limit || 50;
        const offset = options.offset || 0;
        const maxFetchLimit = 1000;
        if (options.filter) {
            const tempRecords = this.db
                .prepare(`SELECT data FROM task_history WHERE namespace = ? ORDER BY created_at DESC LIMIT ?`)
                .all(ns, maxFetchLimit);
            const parsedRecords = tempRecords
                .map((row) => safeJsonParse(row.data))
                .filter((r) => r !== null);
            const filtered = parsedRecords.filter(options.filter);
            if (tempRecords.length >= maxFetchLimit) {
                console.warn(`[SQLiteStore] Filter query hit limit of ${maxFetchLimit}, results may be incomplete`);
            }
            return filtered.slice(offset, offset + limit);
        }
        const stmt = this.db.prepare(`
      SELECT data FROM task_history WHERE namespace = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
        const rows = stmt.all(ns, limit, offset);
        return rows
            .map((row) => safeJsonParse(row.data))
            .filter((r) => r !== null);
    }
    async list(namespace) {
        const ns = namespace.join(':');
        const stmt = this.db.prepare(`
      SELECT data FROM task_history WHERE namespace = ?
      ORDER BY created_at DESC
    `);
        const rows = stmt.all(ns);
        return rows
            .map((row) => safeJsonParse(row.data))
            .filter((r) => r !== null);
    }
    async close() {
        try {
            this.db.close();
        }
        catch (error) {
            console.error('[SQLiteStore] Failed to close database:', error);
        }
    }
    async clear() {
        try {
            this.db.exec('DELETE FROM task_history');
        }
        catch (error) {
            console.error('[SQLiteStore] Failed to clear database:', error);
        }
    }
    async size() {
        try {
            const result = this.db.prepare('SELECT COUNT(*) as count FROM task_history').get();
            return result?.count || 0;
        }
        catch (error) {
            console.error('[SQLiteStore] Failed to get size:', error);
            return 0;
        }
    }
}
