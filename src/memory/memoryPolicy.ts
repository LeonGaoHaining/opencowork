import { getMemoryService } from './memoryService';
import { MemoryCandidate, MemoryDecision } from './memoryTypes';

const ONE_TIME_PATTERNS = [/这次/, /本次/, /今天/, /临时/, /当前/, /先/];

export class MemoryPolicy {
  evaluateCandidate(candidate: MemoryCandidate, currentMemory: string): MemoryDecision {
    const scan = getMemoryService().scan(candidate.content);
    if (!scan.safe) {
      return { action: 'ignore', candidate, reason: 'Candidate failed security scan.' };
    }

    if (ONE_TIME_PATTERNS.some((pattern) => pattern.test(candidate.content))) {
      return {
        action: 'ignore',
        candidate,
        reason: 'Looks like one-time context, not long-term memory.',
      };
    }

    if (currentMemory.includes(candidate.content)) {
      return { action: 'ignore', candidate, reason: 'Memory already contains this information.' };
    }

    if (candidate.type === 'fact' && candidate.requiresConfirmation) {
      return {
        action: 'confirm',
        candidate,
        reason: 'Fact memories require confirmation by default.',
      };
    }

    if (candidate.confidence >= 0.85) {
      return { action: 'add', candidate, reason: 'High-confidence long-term memory candidate.' };
    }

    return {
      action: 'confirm',
      candidate,
      reason: 'Candidate is useful but requires confirmation.',
    };
  }

  evaluateCandidates(candidates: MemoryCandidate[], currentMemory: string): MemoryDecision[] {
    return candidates.map((candidate) => this.evaluateCandidate(candidate, currentMemory));
  }
}

let memoryPolicyInstance: MemoryPolicy | null = null;

export function getMemoryPolicy(): MemoryPolicy {
  if (!memoryPolicyInstance) {
    memoryPolicyInstance = new MemoryPolicy();
  }
  return memoryPolicyInstance;
}

export function resetMemoryPolicy(): void {
  memoryPolicyInstance = null;
}
