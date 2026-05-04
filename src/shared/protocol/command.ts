import { createRuntimeId, now, RUNTIME_PROTOCOL_VERSION, RuntimeClient, RuntimeMode, RuntimeProtocolVersion } from './common';

export type RuntimeCommandType =
  | 'task/start'
  | 'task/interrupt'
  | 'task/resume'
  | 'task/cancel'
  | 'approval/respond';

export interface RuntimeCommand {
  version: RuntimeProtocolVersion;
  id: string;
  type: RuntimeCommandType;
  client: RuntimeClient;
  params: Record<string, unknown>;
  createdAt: number;
}

export interface StartTaskParams {
  task: string;
  displayTitle?: string;
  source?: string;
  client?: RuntimeClient;
  mode?: RuntimeMode;
  runId?: string;
  sessionId?: string;
  threadId?: string;
  templateId?: string;
  input?: Record<string, unknown>;
  params?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  executionMode?: string;
  executionTargetKind?: string;
}

export interface InterruptTaskParams {
  runId: string;
  reason?: string;
}

export interface ResumeTaskParams {
  runId: string;
}

export interface CancelTaskParams {
  runId: string;
  reason?: string;
}

export interface ApprovalResponseParams {
  requestId: string;
  runId: string;
  approved: boolean;
  reason?: string;
}

export interface ReadRunParams {
  runId: string;
}

export interface ListRunsParams {
  limit?: number;
}

export interface CreateRuntimeCommandParams {
  type: RuntimeCommandType;
  client: RuntimeClient;
  params?: Record<string, unknown>;
  id?: string;
  createdAt?: number;
}

export function createRuntimeCommand(params: CreateRuntimeCommandParams): RuntimeCommand {
  return {
    version: RUNTIME_PROTOCOL_VERSION,
    id: params.id || createRuntimeId('command'),
    type: params.type,
    client: params.client,
    params: params.params || {},
    createdAt: params.createdAt || now(),
  };
}
