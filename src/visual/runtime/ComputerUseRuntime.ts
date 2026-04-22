import { generateId } from '../../core/action/ActionSchema';
import { VisualModelAdapter } from '../adapters/VisualModelAdapter';
import {
  ComputerUseRunInput,
  ComputerUseRunResult,
  UIActionType,
  VisualExecutionTurn,
  VisualTaskContext,
  VisualTurnResponse,
} from '../types/visualProtocol';
import { BrowserExecutionAdapter } from './BrowserExecutionAdapter';
import { ApprovalGate, NoopApprovalGate } from '../policy/ApprovalGate';

const DEFAULT_ALLOWED_ACTIONS: UIActionType[] = [
  'click',
  'double_click',
  'move',
  'drag',
  'scroll',
  'keypress',
  'type',
  'wait',
  'screenshot',
];

export class ComputerUseRuntime {
  constructor(
    private readonly adapter: VisualModelAdapter,
    private readonly browser: BrowserExecutionAdapter,
    private readonly approvalGate: ApprovalGate = new NoopApprovalGate()
  ) {}

  async runTask(input: ComputerUseRunInput): Promise<ComputerUseRunResult> {
    const turns: VisualExecutionTurn[] = [];
    const allowedActions = input.allowedActions || DEFAULT_ALLOWED_ACTIONS;

    for (let index = 0; index < input.maxTurns; index++) {
      const turnId = generateId();
      const startedAt = Date.now();
      const observation = await this.browser.captureObservation();
      const pageContext = await this.browser.getPageContext();
      const taskContext: VisualTaskContext = {
        task: input.task,
        page: pageContext,
        approvalPolicy: input.approvalPolicy,
      };

      const response = await this.adapter.runTurn(input.adapterSession, {
        runId: input.runId,
        turnId,
        taskContext,
        observation,
        allowedActions,
      });

      const turn = this.createTurn(turnId, observation.textualHints, response, Date.now() - startedAt);
      turns.push(turn);

      if (response.status === 'completed') {
        return {
          success: true,
          finalMessage: response.finalMessage,
          turns,
        };
      }

      if (response.status === 'failed') {
        return {
          success: false,
          turns,
          error: response.error,
        };
      }

      if (response.status === 'actions_proposed' && response.actions?.length) {
        const requiresApproval = await this.approvalGate.shouldPauseForApproval(
          response.actions,
          taskContext
        );

        if (requiresApproval) {
          const decision = await this.approvalGate.requestApproval(response.actions, taskContext);
          return {
            success: false,
            turns,
            error: {
              code: 'APPROVAL_REQUIRED',
              message: decision.reason || 'Approval required before executing visual actions',
              recoverable: true,
            },
            pendingApproval: {
              actions: response.actions,
              reason: decision.reason || 'Approval required before executing visual actions',
              taskContext,
            },
          };
        }

        const execution = await this.browser.executeActions(response.actions);
        turn.executedActions = execution.executed;
        if (!execution.success) {
          return {
            success: false,
            turns,
            error: execution.error,
          };
        }
      }
    }

    return {
      success: false,
      turns,
      error: {
        code: 'MAX_TURNS_EXCEEDED',
        message: `Exceeded max turns: ${input.maxTurns}`,
        recoverable: true,
      },
    };
  }

  private createTurn(
    turnId: string,
    observationSummary: string | undefined,
    response: VisualTurnResponse,
    duration: number
  ): VisualExecutionTurn {
    return {
      turnId,
      observationSummary,
      proposedActions: response.actions,
      finalMessage: response.finalMessage,
      duration,
    };
  }
}
