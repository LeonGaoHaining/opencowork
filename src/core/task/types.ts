export type TaskSource = 'chat' | 'scheduler' | 'im' | 'mcp' | 'replay';

export type TaskStatus =
  | 'pending'
  | 'planning'
  | 'running'
  | 'waiting_user'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TaskArtifactType = 'text' | 'file' | 'link' | 'image' | 'table';

export interface TaskArtifact {
  id: string;
  type: TaskArtifactType;
  name: string;
  uri?: string;
  mimeType?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface ActionContract {
  supportedActions?: string[];
  supportedOperations?: string[];
  notes?: string[];
  workflowSemantics?: Array<{
    action: string;
    summary: string;
    examples?: string[];
  }>;
}

export interface TaskResultError {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface TaskResult {
  id: string;
  summary: string;
  structuredData?: unknown;
  artifacts: TaskArtifact[];
  rawOutput?: unknown;
  actionContract?: ActionContract;
  error?: TaskResultError;
  reusable: boolean;
  completedAt: number;
}

export interface TaskRun {
  id: string;
  source: TaskSource;
  status: TaskStatus;
  title: string;
  input: {
    prompt?: string;
    params?: Record<string, unknown>;
  };
  templateId?: string;
  sessionId?: string;
  startedAt: number;
  endedAt?: number;
  resultId?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskVisualProviderSignals {
  completionRate: number;
  costScore: number;
  latencyScore: number;
}

export interface TaskVisualCapabilitySnapshot {
  builtInComputerTool: boolean;
  batchedActions: boolean;
  nativeScreenshotRequest: boolean;
  structuredOutput: boolean;
  toolCalling: boolean;
  supportsReasoningControl: boolean;
  maxImageInputBytes?: number;
}

export interface TaskVisualProviderSelection {
  id: string;
  name: string;
  score: number;
  reasons: string[];
  adapterMode: 'chat-structured' | 'responses-computer';
  capabilities?: TaskVisualCapabilitySnapshot;
  signals?: TaskVisualProviderSignals;
}

export type TaskExecutionTargetKind = 'browser' | 'desktop' | 'hybrid';

export type TaskExecutionEnvironment = 'playwright' | 'vm' | 'container' | 'native-bridge';

export interface TaskExecutionTargetSnapshot {
  kind: TaskExecutionTargetKind;
  environment: TaskExecutionEnvironment;
}

export interface TaskTemplateInputField {
  type?: 'string';
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  origin?: {
    runId?: string;
    runIds?: string[];
    sessionId?: string;
    source?: TaskSource;
    executionMode?: 'dom' | 'visual' | 'hybrid';
  };
  inputSchema?: Record<string, TaskTemplateInputField | string>;
  defaultInput?: Record<string, unknown>;
  executionProfile: 'browser-first' | 'mixed';
  recommendedSkills?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface TaskWorkflowPackTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  inputSchema?: Record<string, TaskTemplateInputField | string>;
  defaultInput?: Record<string, unknown>;
  executionProfile: 'browser-first' | 'mixed';
  recommendedSkills?: string[];
}

export interface TaskWorkflowPack {
  id: string;
  name: string;
  category: string;
  description: string;
  summary: string;
  outcomes: string[];
  recommendedSkills?: string[];
  templates: TaskWorkflowPackTemplate[];
}

export interface TaskStatusEvent {
  runId: string;
  status: TaskStatus;
  progress?: number;
  message?: string;
}

export interface TaskCompletedEvent {
  runId: string;
  status: 'completed';
  result: TaskResult;
}

export interface TaskFailedEvent {
  runId: string;
  status: 'failed';
  error: TaskResultError;
}

export function createTaskEntityId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
