import fs from 'fs';
import path from 'path';

export interface BindingRecord {
  imUserId: string;
  desktopUserId: string;
  imPlatform: string;
  boundAt: number;
  lastActive: number;
}

class BindingStore {
  private filePath: string;
  private bindings: Map<string, BindingRecord> = new Map();
  private initialized = false;

  constructor() {
    this.filePath = '';
  }

  initialize(userDataPath: string): void {
    if (this.initialized) return;
    this.filePath = path.join(userDataPath, 'im-bindings.json');
    this.load();
    this.initialized = true;
  }

  private async load(): Promise<void> {
    try {
      if (this.filePath && fs.existsSync(this.filePath)) {
        const data = await fs.promises.readFile(this.filePath, 'utf-8');
        const parsed = JSON.parse(data);
        this.bindings = new Map(Object.entries(parsed));
        console.log('[BindingStore] Loaded', this.bindings.size, 'bindings');
      }
    } catch (error) {
      console.error('[BindingStore] Load failed:', error);
    }
  }

  private async save(): Promise<void> {
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
    } catch (error) {
      console.error('[BindingStore] Save failed:', error);
    }
  }

  set(imUserId: string, binding: Omit<BindingRecord, 'lastActive'>): void {
    const record: BindingRecord = {
      ...binding,
      lastActive: Date.now(),
    };
    this.bindings.set(imUserId, record);
    this.save().catch((err) => console.error('[BindingStore] Async save failed:', err));
  }

  async getAsync(imUserId: string): Promise<BindingRecord | undefined> {
    const record = this.bindings.get(imUserId);
    if (record) {
      record.lastActive = Date.now();
    }
    return record;
  }

  get(imUserId: string): BindingRecord | undefined {
    const record = this.bindings.get(imUserId);
    if (record) {
      record.lastActive = Date.now();
    }
    return record;
  }

  getByDesktopUserId(desktopUserId: string): BindingRecord | undefined {
    for (const binding of this.bindings.values()) {
      if (binding.desktopUserId === desktopUserId) {
        return binding;
      }
    }
    return undefined;
  }

  delete(imUserId: string): void {
    this.bindings.delete(imUserId);
    this.save().catch((err) => console.error('[BindingStore] Async save failed:', err));
  }

  getAll(): BindingRecord[] {
    return Array.from(this.bindings.values());
  }

  clear(): void {
    this.bindings.clear();
    this.save().catch((err) => console.error('[BindingStore] Async save failed:', err));
  }
}

let bindingStoreInstance: BindingStore | null = null;

export function getBindingStore(): BindingStore {
  if (!bindingStoreInstance) {
    bindingStoreInstance = new BindingStore();
  }
  return bindingStoreInstance;
}

export function initializeBindingStore(userDataPath: string): void {
  getBindingStore().initialize(userDataPath);
}
