import { generateId } from '../../core/action/ActionSchema';
import { VisualModelAdapter } from '../adapters/VisualModelAdapter';
import {
  ComputerUseRunInput,
  ComputerUseRunResult,
  RecoveryDetail,
  ProviderComputerCallOutput,
  UIAction,
  UIActionType,
  VisualObservation,
  VisualExecutionTurn,
  VisualTaskContext,
  VisualTurnResponse,
} from '../types/visualProtocol';
import { ComputerExecutionAdapter } from './ComputerExecutionAdapter';
import { ApprovalGate, NoopApprovalGate, buildApprovalAudit } from '../policy/ApprovalGate';

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

const DEFAULT_DESKTOP_ALLOWED_ACTIONS: UIActionType[] = [
  ...DEFAULT_ALLOWED_ACTIONS,
  'open_application',
  'focus_window',
  'open_file',
  'save_file',
  'upload_file',
  'download_file',
];

const MAX_RECOVERY_ATTEMPTS = 3;
const RECOVERY_WAIT_MS = 1500;
const RECOVERY_SCROLL_Y = 600;
const VERIFIABLE_ACTION_TYPES = new Set<UIActionType>([
  'click',
  'double_click',
  'drag',
  'scroll',
  'keypress',
  'type',
]);

type RecoveryTrigger = NonNullable<RecoveryDetail['trigger']>;

type RecoveryStrategyName =
  | 'wait-and-reobserve'
  | 'scroll-and-reobserve'
  | 'restart-and-reobserve'
  | 'file-dialog-recover-and-reobserve'
  | 'refocus-and-reobserve'
  | 'reobserve-with-strategy-hint';

export class ComputerUseRuntime {
  constructor(
    private readonly adapter: VisualModelAdapter,
    private readonly computer: ComputerExecutionAdapter,
    private readonly approvalGate: ApprovalGate = new NoopApprovalGate()
  ) {}

  async runTask(input: ComputerUseRunInput): Promise<ComputerUseRunResult> {
    const turns: VisualExecutionTurn[] = [];
    const executionTarget = await this.computer.getExecutionTarget();
    const isDesktopTarget = executionTarget.kind === 'desktop' || executionTarget.environment !== 'playwright';
    const allowedActions = input.allowedActions || (isDesktopTarget ? DEFAULT_DESKTOP_ALLOWED_ACTIONS : DEFAULT_ALLOWED_ACTIONS);
    let actionBatches = 0;
    let proposedActionCount = 0;
    let executedActionCount = 0;
    let approvalInterruptions = 0;
    let recoveryAttempts = 0;
    let verificationFailures = 0;
    const recoveryStrategies: string[] = [];
    const recoveryDetails: RecoveryDetail[] = [];
    let totalDurationMs = 0;
    let previousObservation: string | undefined;
    let pendingComputerCallOutput: ProviderComputerCallOutput | undefined;

    for (let index = 0; index < input.maxTurns; index++) {
      const turnId = generateId();
      const startedAt = Date.now();
      const observation = await this.computer.captureObservation();
      const pageContext = await this.computer.getPageContext();
      const taskContext: VisualTaskContext = {
        task: input.task,
        page: pageContext,
        executionTarget,
        approvalPolicy: input.approvalPolicy,
        previousObservation,
      };

      const response = await this.adapter.runTurn(input.adapterSession, {
        runId: input.runId,
        turnId,
        taskContext,
        observation,
        allowedActions,
        providerComputerCallOutput: pendingComputerCallOutput,
      });
      pendingComputerCallOutput = undefined;

      const turn = this.createTurn(turnId, observation.textualHints, response, Date.now() - startedAt);
      totalDurationMs += turn.duration;
      turns.push(turn);

      if (response.status === 'completed') {
        return {
          success: true,
          finalMessage: response.finalMessage,
          turns,
          executionTarget,
          metrics: {
            totalTurns: turns.length,
            actionBatches,
            proposedActionCount,
            executedActionCount,
            approvalInterruptions,
            recoveryAttempts,
            verificationFailures,
            recoveryStrategies,
            recoveryDetails,
            totalDurationMs,
          },
        };
      }

      if (response.status === 'failed') {
        return {
          success: false,
          turns,
          executionTarget,
          error: response.error,
          metrics: {
            totalTurns: turns.length,
            actionBatches,
            proposedActionCount,
            executedActionCount,
            approvalInterruptions,
            recoveryAttempts,
            verificationFailures,
            recoveryStrategies,
            recoveryDetails,
            totalDurationMs,
          },
        };
      }

      if (response.status === 'actions_proposed' && response.actions?.length) {
        actionBatches += 1;
        proposedActionCount += response.actions.length;
        const requiresApproval = await this.approvalGate.shouldPauseForApproval(
          response.actions,
          taskContext
        );

        if (requiresApproval) {
          approvalInterruptions += 1;
          const decision = await this.approvalGate.requestApproval(response.actions, taskContext);
          const approvalAudit = buildApprovalAudit(response.actions, taskContext);
          return {
            success: false,
            turns,
            executionTarget,
            error: {
              code: 'APPROVAL_REQUIRED',
              message: decision.reason || 'Approval required before executing visual actions',
              recoverable: true,
            },
            pendingApproval: {
              actions: response.actions,
              reason: decision.reason || 'Approval required before executing visual actions',
              taskContext,
              audit: approvalAudit,
            },
            metrics: {
              totalTurns: turns.length,
              actionBatches,
              proposedActionCount,
              executedActionCount,
              approvalInterruptions,
              recoveryAttempts,
              verificationFailures,
              recoveryStrategies,
              recoveryDetails,
              totalDurationMs,
            },
          };
        }

        const execution = await this.computer.executeActions(response.actions);
        turn.executedActions = execution.executed;
        executedActionCount += execution.executed.length;
        if (response.providerComputerCall) {
          pendingComputerCallOutput = {
            type: 'computer_call_output',
            callId: response.providerComputerCall.callId,
          };
        }
        const verification = execution.success
          ? await this.verifyActionEffect(observation, response.actions)
          : null;

        if (verification && !verification.success) {
          verificationFailures += 1;
        }

        const executionError = !execution.success
          ? execution.error
          : verification && !verification.success
            ? verification.error
            : null;

        if (executionError) {
          const recovered = await this.tryRecoverExecutionFailure(
            executionError,
            response.actions,
            recoveryAttempts,
            isDesktopTarget
          );

          if (recovered.recovered) {
            recoveryAttempts += 1;
            if (recovered.strategy) {
              recoveryStrategies.push(recovered.strategy);
            }
            if (recovered.detail) {
              recoveryDetails.push(recovered.detail);
            }
            previousObservation = recovered.observationNotice;
            continue;
          }

          return {
            success: false,
            turns,
            executionTarget,
            error: executionError,
            metrics: {
              totalTurns: turns.length,
              actionBatches,
              proposedActionCount,
              executedActionCount,
              approvalInterruptions,
              recoveryAttempts,
              verificationFailures,
              recoveryStrategies,
              recoveryDetails,
              totalDurationMs,
            },
          };
        }

        previousObservation = undefined;
      }
    }

    return {
      success: false,
      turns,
      executionTarget,
      error: {
        code: 'MAX_TURNS_EXCEEDED',
        message: `Exceeded max turns: ${input.maxTurns}`,
        recoverable: true,
      },
      metrics: {
        totalTurns: turns.length,
        actionBatches,
        proposedActionCount,
        executedActionCount,
        approvalInterruptions,
        recoveryAttempts,
        verificationFailures,
        recoveryStrategies,
        recoveryDetails,
        totalDurationMs,
      },
    };
  }

  private async tryRecoverExecutionFailure(
    error: VisualTurnResponse['error'],
    actions: NonNullable<VisualTurnResponse['actions']>,
    recoveryAttempts: number,
    isDesktopTarget: boolean
  ): Promise<{ recovered: boolean; strategy?: string; observationNotice?: string; detail?: RecoveryDetail }> {
    if (!error?.recoverable || recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
      return { recovered: false };
    }

    const failedActions = actions.map((action) => action.type);
    const nextAttempt = recoveryAttempts + 1;
    const recoveryTrigger = this.classifyRecoveryTrigger(error, failedActions);
    const hasFileDialogAction = actions.some(
      (action) =>
        action.type === 'open_file' ||
        action.type === 'save_file' ||
        action.type === 'upload_file' ||
        action.type === 'download_file'
    );
    const hasWindowFocusAction = actions.some(
      (action) => action.type === 'focus_window' || action.type === 'open_application'
    );

    if (hasFileDialogAction) {
      if (typeof this.computer.restart === 'function') {
        await this.computer.restart();
      } else {
        await this.computer.executeActions([{ type: 'wait', durationMs: RECOVERY_WAIT_MS }]);
      }

      return {
        recovered: true,
        strategy: 'file-dialog-recover-and-reobserve',
        detail: {
          strategy: 'file-dialog-recover-and-reobserve',
          category: 'file',
          trigger: 'file-dialog-execution-failed',
          errorCode: error.code,
          errorMessage: error.message,
          failedActions,
          attempt: nextAttempt,
        },
        observationNotice: `Previous visual action batch failed with recoverable error: ${error.message}. Classified trigger: file-dialog-execution-failed. Restarted and re-observe the desktop workflow before retrying. Failed actions: ${failedActions.join(', ')}`,
      };
    }

    if (hasWindowFocusAction) {
      const focusRecoveryStrategy = recoveryAttempts === 0 ? 'refocus-and-reobserve' : 'restart-and-reobserve';
      return this.executeRecoveryStrategy(focusRecoveryStrategy, {
        error,
        recoveryTrigger: 'window-focus-execution-failed',
        failedActions,
        attempt: nextAttempt,
      });
    }

    const strategy = this.selectRecoveryStrategy(recoveryTrigger, recoveryAttempts, isDesktopTarget);
    return this.executeRecoveryStrategy(strategy, {
      error,
      recoveryTrigger,
      failedActions,
      attempt: nextAttempt,
    });
  }

  private selectRecoveryStrategy(
    recoveryTrigger: RecoveryTrigger,
    recoveryAttempts: number,
    isDesktopTarget: boolean
  ): RecoveryStrategyName {
    switch (recoveryTrigger) {
      case 'verification-no-effect':
        return recoveryAttempts === 0 ? 'wait-and-reobserve' : 'reobserve-with-strategy-hint';
      case 'viewport-execution-failed':
        return recoveryAttempts === 0 ? 'scroll-and-reobserve' : 'reobserve-with-strategy-hint';
      case 'window-focus-execution-failed':
        return recoveryAttempts === 0 ? 'refocus-and-reobserve' : 'restart-and-reobserve';
      case 'interaction-execution-failed':
        return isDesktopTarget
          ? recoveryAttempts === 0
            ? 'restart-and-reobserve'
            : recoveryAttempts === 1
              ? 'scroll-and-reobserve'
              : 'reobserve-with-strategy-hint'
          : recoveryAttempts === 0
          ? 'wait-and-reobserve'
          : recoveryAttempts === 1
            ? 'scroll-and-reobserve'
            : 'reobserve-with-strategy-hint';
      case 'input-execution-failed':
        return isDesktopTarget
          ? recoveryAttempts === 0
            ? 'refocus-and-reobserve'
            : 'reobserve-with-strategy-hint'
          : recoveryAttempts === 0
            ? 'wait-and-reobserve'
            : 'reobserve-with-strategy-hint';
      case 'generic-execution-failed':
      default:
        return recoveryAttempts === 0
          ? 'wait-and-reobserve'
          : recoveryAttempts === 1
            ? 'scroll-and-reobserve'
            : 'reobserve-with-strategy-hint';
    }
  }

  private async executeRecoveryStrategy(
    strategy: RecoveryStrategyName,
    params: {
      error: NonNullable<VisualTurnResponse['error']>;
      recoveryTrigger: RecoveryTrigger;
      failedActions: UIActionType[];
      attempt: number;
    }
  ): Promise<{ recovered: boolean; strategy?: string; observationNotice?: string; detail?: RecoveryDetail }> {
    const { error, recoveryTrigger, failedActions, attempt } = params;

    if (strategy === 'wait-and-reobserve') {
      await this.computer.executeActions([{ type: 'wait', durationMs: RECOVERY_WAIT_MS }]);
      return {
        recovered: true,
        strategy,
        detail: {
          strategy,
          category: 'timing',
          trigger: recoveryTrigger,
          errorCode: error.code,
          errorMessage: error.message,
          failedActions,
          attempt,
        },
        observationNotice: `Previous visual action batch failed with recoverable error: ${error.message}. Classified trigger: ${recoveryTrigger}. Waited ${RECOVERY_WAIT_MS}ms and re-observe before retrying. Failed actions: ${failedActions.join(', ')}`,
      };
    }

    if (strategy === 'scroll-and-reobserve') {
      await this.computer.executeActions([{ type: 'scroll', x: 0, y: 0, scrollY: RECOVERY_SCROLL_Y }]);
      return {
        recovered: true,
        strategy,
        detail: {
          strategy,
          category: 'viewport',
          trigger: recoveryTrigger,
          errorCode: error.code,
          errorMessage: error.message,
          failedActions,
          attempt,
        },
        observationNotice: `Previous visual action batch failed with recoverable error: ${error.message}. Classified trigger: ${recoveryTrigger}. Scrolled ${RECOVERY_SCROLL_Y}px and re-observe before retrying. Failed actions: ${failedActions.join(', ')}`,
      };
    }

    if (strategy === 'restart-and-reobserve') {
      if (typeof this.computer.restart === 'function') {
        await this.computer.restart();
      } else {
        await this.computer.executeActions([{ type: 'wait', durationMs: RECOVERY_WAIT_MS }]);
      }

      return {
        recovered: true,
        strategy,
        detail: {
          strategy,
          category: 'window',
          trigger: recoveryTrigger,
          errorCode: error.code,
          errorMessage: error.message,
          failedActions,
          attempt,
        },
        observationNotice: `Previous visual action batch failed with recoverable error: ${error.message}. Classified trigger: ${recoveryTrigger}. Restarted the desktop harness and re-observe before retrying. Failed actions: ${failedActions.join(', ')}`,
      };
    }

    if (strategy === 'file-dialog-recover-and-reobserve') {
      if (typeof this.computer.restart === 'function') {
        await this.computer.restart();
      } else {
        await this.computer.executeActions([{ type: 'wait', durationMs: RECOVERY_WAIT_MS }]);
      }

      return {
        recovered: true,
        strategy,
        detail: {
          strategy,
          category: 'file',
          trigger: 'file-dialog-execution-failed',
          errorCode: error.code,
          errorMessage: error.message,
          failedActions,
          attempt,
        },
        observationNotice: `Previous visual action batch failed with recoverable error: ${error.message}. Classified trigger: file-dialog-execution-failed. Restarted and re-observe the desktop workflow before retrying. Failed actions: ${failedActions.join(', ')}`,
      };
    }

    if (strategy === 'refocus-and-reobserve') {
      await this.computer.executeActions([{ type: 'wait', durationMs: RECOVERY_WAIT_MS }]);
      return {
        recovered: true,
        strategy,
        detail: {
          strategy,
          category: recoveryTrigger === 'input-execution-failed' ? 'input' : 'window',
          trigger: recoveryTrigger,
          errorCode: error.code,
          errorMessage: error.message,
          failedActions,
          attempt,
        },
        observationNotice: `Previous visual action batch failed with recoverable error: ${error.message}. Classified trigger: ${recoveryTrigger}. Refocused the desktop target and re-observe before retrying. Failed actions: ${failedActions.join(', ')}`,
      };
    }

    return {
      recovered: true,
      strategy,
      detail: {
        strategy,
        category: 'strategy',
        trigger: recoveryTrigger,
        errorCode: error.code,
        errorMessage: error.message,
        failedActions,
        attempt,
      },
      observationNotice: `Previous visual action batch failed with recoverable error: ${error.message}. Classified trigger: ${recoveryTrigger}. Re-observe the page and choose a different action strategy. Failed actions: ${failedActions.join(', ')}`,
    };
  }

  private classifyRecoveryTrigger(
    error: NonNullable<VisualTurnResponse['error']>,
    failedActions: UIActionType[]
  ): RecoveryTrigger {
    if (error.code === 'VERIFICATION_NO_EFFECT') {
      return 'verification-no-effect';
    }

    if (failedActions.some((action) => action === 'click' || action === 'double_click' || action === 'drag')) {
      return 'interaction-execution-failed';
    }

    if (failedActions.some((action) => action === 'type' || action === 'keypress')) {
      return 'input-execution-failed';
    }

    if (failedActions.some((action) => action === 'scroll')) {
      return 'viewport-execution-failed';
    }

    if (failedActions.some((action) => action === 'focus_window' || action === 'open_application')) {
      return 'window-focus-execution-failed';
    }

    if (failedActions.some((action) => action === 'open_file' || action === 'save_file' || action === 'upload_file' || action === 'download_file')) {
      return 'file-dialog-execution-failed';
    }

    return 'generic-execution-failed';
  }

  private async verifyActionEffect(
    beforeObservation: VisualObservation,
    actions: UIAction[]
  ): Promise<{ success: true } | { success: false; error: VisualTurnResponse['error'] }> {
    if (!actions.some((action) => VERIFIABLE_ACTION_TYPES.has(action.type))) {
      return { success: true };
    }

    const afterObservation = await this.computer.captureObservation();
    if (this.hasMeaningfulObservationChange(beforeObservation, afterObservation)) {
      return { success: true };
    }

    return {
      success: false,
      error: {
        code: 'VERIFICATION_NO_EFFECT',
        message: `Visual action batch produced no observable page change. Actions: ${actions.map((action) => action.type).join(', ')}`,
        recoverable: true,
      },
    };
  }

  private hasMeaningfulObservationChange(
    beforeObservation: VisualObservation,
    afterObservation: VisualObservation
  ): boolean {
    return (
      beforeObservation.page?.url !== afterObservation.page?.url ||
      beforeObservation.page?.title !== afterObservation.page?.title ||
      beforeObservation.page?.domSummary !== afterObservation.page?.domSummary ||
      beforeObservation.textualHints !== afterObservation.textualHints ||
      beforeObservation.screenshotBase64 !== afterObservation.screenshotBase64
    );
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
