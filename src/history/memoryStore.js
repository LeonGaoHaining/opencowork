function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => deepClone(item));
    }
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    const cloned = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}
const DEFAULT_MAX_SIZE = 1000;
export class MemoryStore {
    store = new Map();
    namespace = [];
    maxSize;
    constructor(namespace = ['current'], maxSize = DEFAULT_MAX_SIZE) {
        this.namespace = namespace;
        this.maxSize = maxSize;
    }
    async put(namespace, key, value) {
        if (this.store.size >= this.maxSize) {
            const oldestKey = this.store.keys().next().value;
            if (!oldestKey) {
                console.warn('[MemoryStore] No oldest key to evict');
                return;
            }
            this.store.delete(oldestKey);
            console.log('[MemoryStore] Max size reached, evicted oldest record');
        }
        const fullKey = this.makeKey(namespace, key);
        this.store.set(fullKey, deepClone(value));
    }
    async get(namespace, key) {
        const fullKey = this.makeKey(namespace, key);
        const value = this.store.get(fullKey);
        return value ? deepClone(value) : null;
    }
    async delete(namespace, key) {
        const fullKey = this.makeKey(namespace, key);
        this.store.delete(fullKey);
    }
    async query(namespace, filter, options = {}) {
        const prefix = namespace.join(':') + ':';
        const results = [];
        for (const [key, value] of this.store.entries()) {
            if (key.startsWith(prefix)) {
                if (filter(value)) {
                    results.push(deepClone(value));
                }
            }
        }
        const offset = options.offset || 0;
        const limit = options.limit || results.length;
        return results.slice(offset, offset + limit);
    }
    async list(namespace) {
        const prefix = namespace.join(':') + ':';
        const results = [];
        for (const [key, value] of this.store.entries()) {
            if (key.startsWith(prefix)) {
                results.push(deepClone(value));
            }
        }
        return results;
    }
    makeKey(namespace, key) {
        return [...namespace, key].join(':');
    }
    async clear() {
        this.store.clear();
    }
    async size() {
        return this.store.size;
    }
}
