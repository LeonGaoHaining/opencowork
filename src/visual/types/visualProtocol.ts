export type VisualAdapterMode = 'responses-computer' | 'chat-structured' | 'custom';

export interface ApprovalPolicySnapshot {
  enabled: boolean;
  highImpactActions?: string[];
}

export interface PendingApproval {
  actions: UIAction[];
  reason: string;
  taskContext: VisualTaskContext;
}

export interface VisualPageContext {
  url?: string;
  title?: string;
  domSummary?: string;
  pageStructure?: unknown;
}

export type UIActionType =
  | 'click'
  | 'double_click'
  | 'move'
  | 'drag'
  | 'scroll'
  | 'keypress'
  | 'type'
  | 'wait'
  | 'screenshot';

export interface UIAction {
  type: UIActionType;
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  text?: string;
  keys?: string[];
  path?: Array<[number, number]> | Array<{ x: number; y: number }>;
  scrollX?: number;
  scrollY?: number;
  durationMs?: number;
}

export interface VisualTaskContext {
  task: string;
  instruction?: string;
  page: VisualPageContext;
  previousActions?: UIAction[];
  previousObservation?: string;
  approvalPolicy?: ApprovalPolicySnapshot;
}

export interface VisualObservation {
  screenshotBase64?: string;
  screenshotMimeType?: string;
  page?: VisualPageContext;
  textualHints?: string;
}

export interface VisualTurnRequest {
  runId: string;
  turnId: string;
  taskContext: VisualTaskContext;
  observation: VisualObservation;
  allowedActions: UIActionType[];
}

export type VisualTurnStatus = 'needs_observation' | 'actions_proposed' | 'completed' | 'failed';

export interface VisualTurnError {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface VisualTurnResponse {
  status: VisualTurnStatus;
  actions?: UIAction[];
  finalMessage?: string;
  modelMessage?: string;
  error?: VisualTurnError;
  rawProviderResponse?: unknown;
}

export interface VisualAdapterCapabilities {
  builtInComputerTool: boolean;
  batchedActions: boolean;
  nativeScreenshotRequest: boolean;
  structuredOutput: boolean;
  toolCalling: boolean;
  supportsReasoningControl: boolean;
  maxImageInputBytes?: number;
}

export interface VisualSessionHandle {
  sessionId: string;
  adapterMode: VisualAdapterMode;
  model: string;
  capabilities: VisualAdapterCapabilities;
  providerState?: Record<string, unknown>;
}

export interface VisualAdapterSessionConfig {
  model: string;
  systemPrompt: string;
  temperature?: number;
  timeoutMs?: number;
  maxTurns?: number;
  metadata?: Record<string, unknown>;
}

export interface ActionExecutionResult {
  success: boolean;
  executed: UIAction[];
  error?: VisualTurnError;
}

export interface VisualExecutionTurn {
  turnId: string;
  observationSummary?: string;
  proposedActions?: UIAction[];
  executedActions?: UIAction[];
  finalMessage?: string;
  duration: number;
}

export interface ComputerUseRunInput {
  runId: string;
  task: string;
  adapterSession: VisualSessionHandle;
  maxTurns: number;
  allowedActions?: UIActionType[];
  approvalPolicy?: ApprovalPolicySnapshot;
}

export interface ComputerUseRunResult {
  success: boolean;
  finalMessage?: string;
  turns: VisualExecutionTurn[];
  error?: VisualTurnError;
  pendingApproval?: PendingApproval;
}
