import * as fs from 'fs';
import * as path from 'path';

const MAX_MEMORY_CHARS = 3200;
const MAX_ENTRY_CHARS = 200;

interface MemoryUsage {
  totalChars: number;
  entryCount: number;
}

interface SecurityScanResult {
  safe: boolean;
  dangerousPatterns: DangerousPattern[];
}

interface DangerousPattern {
  type: 'prompt_injection' | 'system_override' | 'command_injection';
  match: string;
  severity: 'low' | 'medium' | 'high';
}

const DANGEROUS_PATTERNS: Array<{
  pattern: RegExp;
  type: DangerousPattern['type'];
  severity: DangerousPattern['severity'];
}> = [
  { pattern: /ignore previous instructions/i, type: 'prompt_injection', severity: 'high' },
  { pattern: /ignore all previous commands/i, type: 'prompt_injection', severity: 'high' },
  { pattern: /system prompt:/i, type: 'system_override', severity: 'medium' },
  { pattern: /\#\#\# system/i, type: 'system_override', severity: 'medium' },
  { pattern: /you are now/i, type: 'system_override', severity: 'medium' },
  { pattern: /disregard.*instruction/i, type: 'prompt_injection', severity: 'high' },
];

export class PersistentMemory {
  private memoryDir: string;
  private memoryFile: string;
  private userFile: string;
  private legacyMemoryDir: string;

  constructor(homeDir: string) {
    this.memoryDir = path.join(homeDir, '.opencowork', 'memories');
    this.legacyMemoryDir = path.join(homeDir, 'memories');
    this.memoryFile = path.join(this.memoryDir, 'MEMORY.md');
    this.userFile = path.join(this.memoryDir, 'USER.md');
    this.ensureDirectoryExists(this.memoryDir);
    this.migrateLegacyMemoryFiles();
    this.ensureFileExists(this.memoryFile, '# MEMORY.md\n\n- ');
    this.ensureFileExists(this.userFile, '# USER.md\n\n- ');
  }

  private migrateLegacyMemoryFiles(): void {
    if (!fs.existsSync(this.legacyMemoryDir)) {
      return;
    }

    const legacyMemoryFile = path.join(this.legacyMemoryDir, 'MEMORY.md');
    const legacyUserFile = path.join(this.legacyMemoryDir, 'USER.md');

    if (!fs.existsSync(this.memoryFile) && fs.existsSync(legacyMemoryFile)) {
      fs.copyFileSync(legacyMemoryFile, this.memoryFile);
    }

    if (!fs.existsSync(this.userFile) && fs.existsSync(legacyUserFile)) {
      fs.copyFileSync(legacyUserFile, this.userFile);
    }
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private ensureFileExists(filePath: string, defaultContent: string): void {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, defaultContent, 'utf-8');
    }
  }

  async read(): Promise<string> {
    try {
      return fs.readFileSync(this.memoryFile, 'utf-8');
    } catch (error) {
      console.error('[PersistentMemory] Failed to read:', error);
      return '# MEMORY.md\n\n- ';
    }
  }

  async readUser(): Promise<string> {
    try {
      return fs.readFileSync(this.userFile, 'utf-8');
    } catch (error) {
      console.error('[PersistentMemory] Failed to read user file:', error);
      return '# USER.md\n\n- ';
    }
  }

  async add(content: string): Promise<boolean> {
    const scanResult = this.scan(content);
    if (!scanResult.safe) {
      console.warn('[PersistentMemory] Dangerous content rejected:', scanResult.dangerousPatterns);
      return false;
    }

    try {
      const currentContent = await this.read();
      const lines = currentContent.split('\n').filter((line) => line.trim());

      const usage = this.getUsageSync(currentContent);
      if (usage.totalChars + content.length > MAX_MEMORY_CHARS) {
        console.warn('[PersistentMemory] Memory capacity exceeded');
        return false;
      }

      if (content.length > MAX_ENTRY_CHARS) {
        console.warn('[PersistentMemory] Entry too long, truncating');
        content = content.substring(0, MAX_ENTRY_CHARS);
      }

      if (this.hasDuplicate(currentContent, content)) {
        console.log('[PersistentMemory] Duplicate content, skipping');
        return true;
      }

      const newLine = `- ${content}`;
      lines.push(newLine);

      const updatedContent = lines.join('\n') + '\n';
      fs.writeFileSync(this.memoryFile, updatedContent, 'utf-8');

      console.log('[PersistentMemory] Added new entry');
      return true;
    } catch (error) {
      console.error('[PersistentMemory] Failed to add:', error);
      return false;
    }
  }

  async replace(oldText: string, newText: string): Promise<boolean> {
    const scanResult = this.scan(newText);
    if (!scanResult.safe) {
      console.warn('[PersistentMemory] Replacement content rejected');
      return false;
    }

    try {
      const currentContent = await this.read();
      const updatedContent = currentContent.replace(oldText, newText);
      fs.writeFileSync(this.memoryFile, updatedContent, 'utf-8');
      console.log('[PersistentMemory] Replaced entry');
      return true;
    } catch (error) {
      console.error('[PersistentMemory] Failed to replace:', error);
      return false;
    }
  }

  async remove(text: string): Promise<boolean> {
    try {
      const currentContent = await this.read();
      const lines = currentContent.split('\n').filter((line) => !line.includes(text));
      const updatedContent = lines.join('\n') + '\n';
      fs.writeFileSync(this.memoryFile, updatedContent, 'utf-8');
      console.log('[PersistentMemory] Removed entry');
      return true;
    } catch (error) {
      console.error('[PersistentMemory] Failed to remove:', error);
      return false;
    }
  }

  getUsage(): MemoryUsage {
    try {
      const content = fs.readFileSync(this.memoryFile, 'utf-8');
      return this.getUsageSync(content);
    } catch (error) {
      return { totalChars: 0, entryCount: 0 };
    }
  }

  private getUsageSync(content: string): MemoryUsage {
    const lines = content.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
    const totalChars = content.length;
    return {
      totalChars,
      entryCount: lines.length,
    };
  }

  private hasDuplicate(content: string, newEntry: string): boolean {
    const cleanNewEntry = newEntry.toLowerCase().trim();
    const lines = content.split('\n');
    for (const line of lines) {
      const cleanLine = line.toLowerCase().trim().replace(/^- /, '');
      if (cleanLine.includes(cleanNewEntry)) {
        return true;
      }
    }
    return false;
  }

  scan(content: string): SecurityScanResult {
    const dangerousPatterns: DangerousPattern[] = [];

    for (const { pattern, type, severity } of DANGEROUS_PATTERNS) {
      if (pattern.test(content)) {
        dangerousPatterns.push({
          type,
          match: content.match(pattern)?.[0] || '',
          severity,
        });
      }
    }

    return {
      safe: dangerousPatterns.length === 0,
      dangerousPatterns,
    };
  }
}

let memoryInstance: PersistentMemory | null = null;

export function getPersistentMemory(homeDir: string): PersistentMemory {
  if (!memoryInstance) {
    memoryInstance = new PersistentMemory(homeDir);
  }
  return memoryInstance;
}

export function resetPersistentMemory(): void {
  memoryInstance = null;
}

export function createPersistentMemory(homeDir: string): PersistentMemory {
  return new PersistentMemory(homeDir);
}

export type { MemoryUsage, SecurityScanResult, DangerousPattern };
