import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { PersistedTaskState, PersistedTaskStateSummary } from './taskState';

export class TaskStateStore {
  private stateDir: string;

  constructor(baseDir?: string) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
    this.stateDir = baseDir || path.join(homeDir, '.opencowork', 'task-states');
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
  }

  private getStatePath(handleId: string): string {
    return path.join(this.stateDir, `${handleId}.json`);
  }

  createIntegrityHash(state: Omit<PersistedTaskState, 'metadata'>): string {
    return crypto.createHash('sha256').update(JSON.stringify(state)).digest('hex');
  }

  save(state: PersistedTaskState): string {
    const filePath = this.getStatePath(state.handleId);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
    return filePath;
  }

  load(handleId: string): PersistedTaskState | null {
    const filePath = this.getStatePath(handleId);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PersistedTaskState;
    } catch (error) {
      console.error('[TaskStateStore] Failed to load state:', error);
      return null;
    }
  }

  list(): PersistedTaskStateSummary[] {
    try {
      const entries = fs
        .readdirSync(this.stateDir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => {
          const state = JSON.parse(
            fs.readFileSync(path.join(this.stateDir, file), 'utf-8')
          ) as PersistedTaskState;

          return {
            handleId: state.handleId,
            runtimeType: state.runtimeType,
            taskDescription: state.taskDescription,
            status: state.status,
            savedAt: state.metadata.savedAt,
            restoreHints: state.metadata.restoreHints,
          } satisfies PersistedTaskStateSummary;
        })
        .sort((a, b) => b.savedAt - a.savedAt);

      return entries;
    } catch (error) {
      console.error('[TaskStateStore] Failed to list states:', error);
      return [];
    }
  }

  delete(handleId: string): void {
    const filePath = this.getStatePath(handleId);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  }
}

let taskStateStoreInstance: TaskStateStore | null = null;

export function getTaskStateStore(): TaskStateStore {
  if (!taskStateStoreInstance) {
    taskStateStoreInstance = new TaskStateStore();
  }
  return taskStateStoreInstance;
}

export function resetTaskStateStore(): void {
  taskStateStoreInstance = null;
}
