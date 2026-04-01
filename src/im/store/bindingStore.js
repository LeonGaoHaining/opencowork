import fs from 'fs';
import path from 'path';
class BindingStore {
    filePath;
    bindings = new Map();
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
    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
                this.bindings = new Map(Object.entries(data));
                console.log('[BindingStore] Loaded', this.bindings.size, 'bindings');
            }
        }
        catch (error) {
            console.error('[BindingStore] Load failed:', error);
        }
    }
    save() {
        try {
            const data = Object.fromEntries(this.bindings);
            fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
        }
        catch (error) {
            console.error('[BindingStore] Save failed:', error);
        }
    }
    set(imUserId, binding) {
        const record = {
            ...binding,
            lastActive: Date.now(),
        };
        this.bindings.set(imUserId, record);
        this.save();
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
        this.save();
    }
    getAll() {
        return Array.from(this.bindings.values());
    }
    clear() {
        this.bindings.clear();
        this.save();
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
