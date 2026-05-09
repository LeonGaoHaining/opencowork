export type VisualAdapterMode = 'responses-computer' | 'chat-structured' | 'custom';

export interface ApprovalPolicySnapshot {
  enabled: boolean;
  highImpactActions?: string[];
}

export interface PendingApproval {
  actions: UIAction[];
  reason: string;
  taskContext: VisualTaskContext;
  audit?: ApprovalAuditSnapshot;
}

export interface ApprovalAuditSnapshot {
  matchedIntentKeywords: string[];
  actionRiskReasons: string[];
  actionTypes: UIActionType[];
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
  | 'screenshot'
  | 'open_application'
  | 'focus_window'
  | 'open_file'
  | 'save_file'
  | 'upload_file'
  | 'download_file';

export interface UIAction {
  type: UIActionType;
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  text?: string;
  targetPath?: string;
  applicationPath?: string;
  uri?: string;
  windowTitle?: string;
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
  executionTarget?: {
    kind: 'browser' | 'desktop' | 'hybrid';
    environment: 'playwright' | 'vm' | 'container' | 'native-bridge';
  };
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

export interface ProviderComputerCall {
  type: 'computer_call';
  callId: string;
  rawProviderItem?: unknown;
}

export interface ProviderComputerCallOutput {
  type: 'computer_call_output';
  callId: string;
}

export interface VisualTurnRequest {
  runId: string;
  turnId: string;
  taskContext: VisualTaskContext;
  observation: VisualObservation;
  allowedActions: UIActionType[];
  providerComputerCallOutput?: ProviderComputerCallOutput;
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
  providerComputerCall?: ProviderComputerCall;
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

export interface RecoveryDetail {
  strategy: string;
  category: 'timing' | 'viewport' | 'window' | 'file' | 'input' | 'strategy' | 'verification' | 'generic';
  trigger?:
    | 'verification-no-effect'
    | 'interaction-execution-failed'
    | 'input-execution-failed'
    | 'viewport-execution-failed'
    | 'window-focus-execution-failed'
    | 'file-dialog-execution-failed'
    | 'generic-execution-failed';
  errorCode?: string;
  errorMessage?: string;
  failedActions?: UIActionType[];
  attempt: number;
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
  executionTarget?: {
    kind: 'browser' | 'desktop' | 'hybrid';
    environment: 'playwright' | 'vm' | 'container' | 'native-bridge';
  };
  error?: VisualTurnError;
  pendingApproval?: PendingApproval;
  metrics?: {
    totalTurns: number;
    actionBatches: number;
    proposedActionCount: number;
    executedActionCount: number;
    approvalInterruptions: number;
    recoveryAttempts: number;
    verificationFailures?: number;
    recoveryStrategies?: string[];
    recoveryDetails?: RecoveryDetail[];
    totalDurationMs: number;
  };
}
