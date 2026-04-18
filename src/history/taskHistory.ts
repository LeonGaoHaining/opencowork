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
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime: number;
  duration: number;
  steps: TaskStep[];
  result?: TaskResult;
  agentMemory?: Record<string, unknown>;
  metadata?: {
    model?: string;
    threadId?: string;
    [key: string]: unknown;
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

export interface HistorySearchOptions {
  limit?: number;
  sessionId?: string;
  dateRange?: {
    start: number;
    end: number;
  };
  status?: TaskHistoryRecord['status'];
}

export interface HistorySearchResult {
  sessionId: string;
  task: string;
  timestamp: number;
  status: TaskHistoryRecord['status'];
  match: string;
  score: number;
}
