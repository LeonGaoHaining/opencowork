import { getMemoryExtractor } from './memoryExtractor';
import { getMemoryPolicy } from './memoryPolicy';
import { getMemoryService } from './memoryService';
import { MemoryCandidate, MemoryDecision, MemoryWorkflowResult } from './memoryTypes';

function createEmptyResult(): MemoryWorkflowResult {
  return {
    saved: [],
    replaced: [],
    pendingConfirmation: [],
    ignored: [],
  };
}

export class MemoryWorkflow {
  async processChatMemory(message: string): Promise<MemoryWorkflowResult> {
    const extractor = getMemoryExtractor();
    const policy = getMemoryPolicy();
    const memoryService = getMemoryService();
    const currentMemory = await memoryService.read();
    const candidates = await extractor.extractFromChat(message);
    const decisions = policy.evaluateCandidates(candidates, currentMemory);

    return this.applyDecisions(decisions, memoryService);
  }

  async processTaskMemory(task: string, summary: string): Promise<MemoryWorkflowResult> {
    const extractor = getMemoryExtractor();
    const policy = getMemoryPolicy();
    const memoryService = getMemoryService();
    const currentMemory = await memoryService.read();
    const candidates = await extractor.extractFromTaskSummary(task, summary);
    const decisions = policy.evaluateCandidates(candidates, currentMemory);

    return this.applyDecisions(decisions, memoryService);
  }

  async confirmCandidates(candidates: MemoryCandidate[]): Promise<MemoryWorkflowResult> {
    const memoryService = getMemoryService();
    const decisions: MemoryDecision[] = candidates.map((candidate) => ({
      action: 'add',
      candidate,
      reason: 'User confirmed memory candidate.',
    }));
    return this.applyDecisions(decisions, memoryService);
  }

  private async applyDecisions(
    decisions: MemoryDecision[],
    memoryService: ReturnType<typeof getMemoryService>
  ): Promise<MemoryWorkflowResult> {
    const result = createEmptyResult();

    for (const decision of decisions) {
      switch (decision.action) {
        case 'add': {
          const success = await memoryService.add(decision.candidate.content);
          if (success) {
            result.saved.push(decision.candidate.content);
          } else {
            result.ignored.push({
              candidate: decision.candidate,
              reason: 'Failed to save memory.',
            });
          }
          break;
        }
        case 'replace': {
          if (decision.existing) {
            const success = await memoryService.replace(
              decision.existing,
              decision.candidate.content
            );
            if (success) {
              result.replaced.push({
                oldText: decision.existing,
                newText: decision.candidate.content,
              });
            }
          }
          break;
        }
        case 'confirm':
          result.pendingConfirmation.push(decision.candidate);
          break;
        case 'ignore':
        default:
          result.ignored.push({ candidate: decision.candidate, reason: decision.reason });
          break;
      }
    }

    return result;
  }
}

let memoryWorkflowInstance: MemoryWorkflow | null = null;

export function getMemoryWorkflow(): MemoryWorkflow {
  if (!memoryWorkflowInstance) {
    memoryWorkflowInstance = new MemoryWorkflow();
  }
  return memoryWorkflowInstance;
}

export function resetMemoryWorkflow(): void {
  memoryWorkflowInstance = null;
}
