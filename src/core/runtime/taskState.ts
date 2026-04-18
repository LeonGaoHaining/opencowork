import type { AnyAction, Plan } from '../action/ActionSchema';
import type { SerializedExecutionState } from '../planner/PlanExecutor';
import type { TaskStatus } from './TaskEngine';
import type { BrowserSnapshotState } from '../executor/BrowserExecutor';

export interface PersistedTaskState {
  version: number;
  handleId: string;
  runtimeType?: 'task-engine' | 'main-agent';
  threadId?: string;
  taskDescription: string;
  status: TaskStatus;
  progress: { current: number; total: number };
  plan: Plan | null;
  currentNodeId: string | null;
  completedNodeIds: string[];
  executedActions: AnyAction[];
  executionState: SerializedExecutionState;
  browserState: BrowserSnapshotState | null;
  conversationHistory: Array<{ role: string; content: string }>;
  metadata: {
    savedAt: number;
    integrityHash: string;
    restoreHints: string[];
  };
}

export interface PersistedTaskStateSummary {
  handleId: string;
  runtimeType?: 'task-engine' | 'main-agent';
  taskDescription: string;
  status: TaskStatus;
  savedAt: number;
  restoreHints: string[];
}
