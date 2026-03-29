export interface TaskStep {
  id: string;
  toolName: string;
  args: Record<string, any>;
  result?: any;
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  duration?: number;
}

export interface TaskResult {
  success: boolean;
  output?: any;
  error?: string;
}

export interface TaskHistoryRecord {
  id: string;
  taskId: string;
  task: string;
  status: 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime: number;
  duration: number;
  steps: TaskStep[];
  result?: TaskResult;
  agentMemory?: Record<string, any>;
  metadata?: {
    model?: string;
    threadId?: string;
    [key: string]: any;
  };
}

export interface HistoryQueryOptions {
  limit?: number;
  offset?: number;
  status?: TaskHistoryRecord['status'];
  startDate?: number;
  endDate?: number;
  keyword?: string;
}
