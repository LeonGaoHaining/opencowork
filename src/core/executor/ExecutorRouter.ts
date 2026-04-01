import { AnyAction, ActionResult } from '../action/ActionSchema';
import { BrowserExecutor } from './BrowserExecutor';
import { CLIExecutor } from './CLIExecutor';
import { AskUserExecutor } from './AskUserExecutor';

export class ExecutorRouter {
  public browserExecutor: BrowserExecutor;
  private cliExecutor: CLIExecutor;
  private askUserExecutor: AskUserExecutor;

  constructor() {
    this.browserExecutor = new BrowserExecutor();
    this.cliExecutor = new CLIExecutor();
    this.askUserExecutor = new AskUserExecutor();
  }

  async execute(action: AnyAction): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      console.log(`[ExecutorRouter] Executing action: ${action.type}`);

      switch (action.type) {
        case 'browser:navigate':
        case 'browser:click':
        case 'browser:input':
        case 'browser:wait':
        case 'browser:extract':
        case 'browser:screenshot':
          return await this.browserExecutor.execute(action);

        case 'cli:execute':
          return await this.cliExecutor.execute(action);

        case 'ask:user':
          return await this.askUserExecutor.execute(action);

        default:
          return {
            success: false,
            error: {
              code: 'UNKNOWN_ACTION',
              message: `Unknown action type: ${action.type}`,
              recoverable: false,
            },
            duration: Date.now() - startTime,
          };
      }
    } catch (error: any) {
      console.error(`[ExecutorRouter] Action execution failed:`, error);
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error.message || 'Unknown error',
          recoverable: true,
        },
        duration: Date.now() - startTime,
      };
    }
  }

  async cleanup(): Promise<void> {
    await this.browserExecutor.cleanup();
    this.askUserExecutor.cancelAll();
    console.log('[ExecutorRouter] Cleaned up');
  }
}

export default ExecutorRouter;
