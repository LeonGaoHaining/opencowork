import { TaskHistoryRecord } from './taskHistory';

export class MemoryStore {
  private store: Map<string, TaskHistoryRecord> = new Map();
  private namespace: string[] = [];

  constructor(namespace: string[] = ['current']) {
    this.namespace = namespace;
  }

  async put(namespace: string[], key: string, value: TaskHistoryRecord): Promise<void> {
    const fullKey = this.makeKey(namespace, key);
    this.store.set(fullKey, { ...value });
  }

  async get(namespace: string[], key: string): Promise<TaskHistoryRecord | null> {
    const fullKey = this.makeKey(namespace, key);
    const value = this.store.get(fullKey);
    return value ? { ...value } : null;
  }

  async delete(namespace: string[], key: string): Promise<void> {
    const fullKey = this.makeKey(namespace, key);
    this.store.delete(fullKey);
  }

  async query(
    namespace: string[],
    filter: (record: TaskHistoryRecord) => boolean,
    options: { limit?: number; offset?: number } = {}
  ): Promise<TaskHistoryRecord[]> {
    const prefix = namespace.join(':') + ':';
    const results: TaskHistoryRecord[] = [];

    for (const [key, value] of this.store.entries()) {
      if (key.startsWith(prefix)) {
        if (filter(value)) {
          results.push({ ...value });
        }
      }
    }

    const offset = options.offset || 0;
    const limit = options.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async list(namespace: string[]): Promise<TaskHistoryRecord[]> {
    const prefix = namespace.join(':') + ':';
    const results: TaskHistoryRecord[] = [];

    for (const [key, value] of this.store.entries()) {
      if (key.startsWith(prefix)) {
        results.push({ ...value });
      }
    }

    return results;
  }

  private makeKey(namespace: string[], key: string): string {
    return [...namespace, key].join(':');
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async size(): Promise<number> {
    return this.store.size;
  }
}
