import fs from 'fs';
import path from 'path';
const MAX_BINDINGS_SIZE = 500;
class BindingStore {
    filePath;
    bindings = new Map();
    bindingInsertionOrder = [];
    initialized = false;
    constructor() {
        this.filePath = '';
    }
    initialize(userDataPath) {
        if (this.initialized)
            return;
        this.filePath = path.join(userDataPath, 'im-bindings.json');
        this.load();
        this.initialized = true;
    }
    async load() {
        try {
            if (this.filePath && fs.existsSync(this.filePath)) {
                const data = await fs.promises.readFile(this.filePath, 'utf-8');
                const parsed = JSON.parse(data);
                this.bindings = new Map(Object.entries(parsed));
                console.log('[BindingStore] Loaded', this.bindings.size, 'bindings');
            }
        }
        catch (error) {
            console.error('[BindingStore] Load failed:', error);
        }
    }
    async save() {
        try {
            if (!this.filePath) {
                console.warn('[BindingStore] File path not set, skipping save');
                return;
            }
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true });
            }
            const data = JSON.stringify(Object.fromEntries(this.bindings), null, 2);
            await fs.promises.writeFile(this.filePath, data, 'utf-8');
        }
        catch (error) {
            console.error('[BindingStore] Save failed:', error);
        }
    }
    set(imUserId, binding) {
        if (this.bindings.size >= MAX_BINDINGS_SIZE && !this.bindings.has(imUserId)) {
            const oldestKey = this.bindingInsertionOrder.shift();
            if (oldestKey) {
                this.bindings.delete(oldestKey);
                console.log('[BindingStore] Max size reached, removed oldest binding');
            }
        }
        if (!this.bindings.has(imUserId)) {
            this.bindingInsertionOrder.push(imUserId);
        }
        const record = {
            ...binding,
            lastActive: Date.now(),
        };
        this.bindings.set(imUserId, record);
        this.save().catch((err) => console.error('[BindingStore] Async save failed:', err));
    }
    async getAsync(imUserId) {
        const record = this.bindings.get(imUserId);
        if (record) {
            record.lastActive = Date.now();
        }
        return record;
    }
    get(imUserId) {
        const record = this.bindings.get(imUserId);
        if (record) {
            record.lastActive = Date.now();
        }
        return record;
    }
    getByDesktopUserId(desktopUserId) {
        for (const binding of this.bindings.values()) {
            if (binding.desktopUserId === desktopUserId) {
                return binding;
            }
        }
        return undefined;
    }
    delete(imUserId) {
        this.bindings.delete(imUserId);
        this.save().catch((err) => console.error('[BindingStore] Async save failed:', err));
    }
    getAll() {
        return Array.from(this.bindings.values());
    }
    clear() {
        this.bindings.clear();
        this.save().catch((err) => console.error('[BindingStore] Async save failed:', err));
    }
}
let bindingStoreInstance = null;
export function getBindingStore() {
    if (!bindingStoreInstance) {
        bindingStoreInstance = new BindingStore();
    }
    return bindingStoreInstance;
}
export function initializeBindingStore(userDataPath) {
    getBindingStore().initialize(userDataPath);
}
