import { getPersistentMemory, PersistentMemory, SecurityScanResult } from './persistentMemory';

export class MemoryService {
  private persistentMemory: PersistentMemory;

  constructor(homeDir: string) {
    this.persistentMemory = getPersistentMemory(homeDir);
  }

  async read(): Promise<string> {
    return this.persistentMemory.read();
  }

  async readUser(): Promise<string> {
    return this.persistentMemory.readUser();
  }

  async add(content: string): Promise<boolean> {
    return this.persistentMemory.add(content);
  }

  async replace(oldText: string, newText: string): Promise<boolean> {
    return this.persistentMemory.replace(oldText, newText);
  }

  async remove(text: string): Promise<boolean> {
    return this.persistentMemory.remove(text);
  }

  scan(content: string): SecurityScanResult {
    return this.persistentMemory.scan(content);
  }

  async inject(): Promise<string> {
    const memory = await this.read();
    const user = await this.readUser();

    const normalizedMemory = memory.trim();
    const normalizedUser = user.trim();

    return [
      '## Persistent Memory',
      normalizedMemory || '# MEMORY.md\n\n- ',
      '',
      '## User Preferences',
      normalizedUser || '# USER.md\n\n- ',
    ].join('\n');
  }
}

let memoryServiceInstance: MemoryService | null = null;

export function getMemoryService(homeDir?: string): MemoryService {
  if (!memoryServiceInstance) {
    const resolvedHomeDir = homeDir || process.env.HOME || process.env.USERPROFILE || '~';
    memoryServiceInstance = new MemoryService(resolvedHomeDir);
  }
  return memoryServiceInstance;
}

export function resetMemoryService(): void {
  memoryServiceInstance = null;
}
