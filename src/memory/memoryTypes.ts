export type MemoryCandidateType = 'preference' | 'fact' | 'constraint';
export type MemoryCandidateSource = 'chat' | 'task_summary' | 'repeated_pattern';

export interface MemoryCandidate {
  id: string;
  type: MemoryCandidateType;
  content: string;
  confidence: number;
  source: MemoryCandidateSource;
  requiresConfirmation: boolean;
  reason: string;
  scope: 'user' | 'workspace';
}

export interface MemoryDecision {
  action: 'add' | 'replace' | 'ignore' | 'confirm';
  candidate: MemoryCandidate;
  existing?: string;
  reason: string;
}

export interface MemoryWorkflowResult {
  saved: string[];
  replaced: Array<{ oldText: string; newText: string }>;
  pendingConfirmation: MemoryCandidate[];
  ignored: Array<{ candidate: MemoryCandidate; reason: string }>;
}
