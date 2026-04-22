import { describe, expect, it, vi } from 'vitest';
import { VisualModelAdapter } from '../../adapters/VisualModelAdapter';
import {
  VisualAdapterCapabilities,
  VisualObservation,
  VisualPageContext,
  VisualSessionHandle,
  VisualTurnRequest,
  VisualTurnResponse,
} from '../../types/visualProtocol';
import { BrowserExecutionAdapter } from '../BrowserExecutionAdapter';
import { ComputerUseRuntime } from '../ComputerUseRuntime';
import { ApprovalDecision, ApprovalGate } from '../../policy/ApprovalGate';

class StubAdapter implements VisualModelAdapter {
  constructor(private readonly response: VisualTurnResponse) {}

  getName(): string {
    return 'stub-adapter';
  }

  getCapabilities(): VisualAdapterCapabilities {
    return {
      builtInComputerTool: false,
      batchedActions: true,
      nativeScreenshotRequest: false,
      structuredOutput: true,
      toolCalling: false,
      supportsReasoningControl: false,
    };
  }

  async createSession(): Promise<VisualSessionHandle> {
    return {
      sessionId: 'stub-session',
      adapterMode: 'chat-structured',
      model: 'stub-model',
      capabilities: this.getCapabilities(),
    };
  }

  async runTurn(_session: VisualSessionHandle, _request: VisualTurnRequest): Promise<VisualTurnResponse> {
    return this.response;
  }

  async destroySession(_session: VisualSessionHandle): Promise<void> {}
}

class StubBrowserExecutionAdapter implements BrowserExecutionAdapter {
  executeActions = vi.fn(async (actions) => ({
    success: true,
    executed: actions,
  }));

  async captureObservation(): Promise<VisualObservation> {
    return {
      textualHints: 'stub observation',
      page: {
        url: 'https://example.test',
        title: 'Example',
      },
    };
  }

  async getPageContext(): Promise<VisualPageContext> {
    return {
      url: 'https://example.test',
      title: 'Example',
    };
  }
}

class StubApprovalGate implements ApprovalGate {
  constructor(
    private readonly shouldPause: boolean,
    private readonly decision: ApprovalDecision = { approved: false, reason: 'Approval required' }
  ) {}

  async shouldPauseForApproval(): Promise<boolean> {
    return this.shouldPause;
  }

  async requestApproval(): Promise<ApprovalDecision> {
    return this.decision;
  }
}

describe('ComputerUseRuntime', () => {
  it('returns pendingApproval when approval gate blocks the action batch', async () => {
    const adapter = new StubAdapter({
      status: 'actions_proposed',
      actions: [{ type: 'click', x: 10, y: 20 }],
    });
    const browser = new StubBrowserExecutionAdapter();
    const runtime = new ComputerUseRuntime(
      adapter,
      browser,
      new StubApprovalGate(true, { approved: false, reason: 'Need approval for click' })
    );

    const result = await runtime.runTask({
      runId: 'run-1',
      task: 'Click submit button',
      adapterSession: await adapter.createSession(),
      maxTurns: 1,
      approvalPolicy: { enabled: true },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('APPROVAL_REQUIRED');
    expect(result.pendingApproval?.actions).toHaveLength(1);
    expect(browser.executeActions).not.toHaveBeenCalled();
  });

  it('executes actions and completes when adapter finishes on the next turn', async () => {
    const responses: VisualTurnResponse[] = [
      {
        status: 'actions_proposed',
        actions: [{ type: 'type', text: 'penguin' }],
      },
      {
        status: 'completed',
        finalMessage: 'Search finished',
      },
    ];

    const adapter: VisualModelAdapter = {
      getName: () => 'sequenced-adapter',
      getCapabilities: () => ({
        builtInComputerTool: false,
        batchedActions: true,
        nativeScreenshotRequest: false,
        structuredOutput: true,
        toolCalling: false,
        supportsReasoningControl: false,
      }),
      createSession: async () => ({
        sessionId: 'sequence-session',
        adapterMode: 'chat-structured',
        model: 'stub-model',
        capabilities: {
          builtInComputerTool: false,
          batchedActions: true,
          nativeScreenshotRequest: false,
          structuredOutput: true,
          toolCalling: false,
          supportsReasoningControl: false,
        },
      }),
      runTurn: vi.fn(async () => responses.shift() || { status: 'failed', error: { code: 'EMPTY', message: 'No response', recoverable: false } }),
      destroySession: async () => {},
    };

    const browser = new StubBrowserExecutionAdapter();
    const runtime = new ComputerUseRuntime(adapter, browser, new StubApprovalGate(false));

    const result = await runtime.runTask({
      runId: 'run-2',
      task: 'Type penguin in the search box',
      adapterSession: await adapter.createSession({} as any),
      maxTurns: 2,
    });

    expect(result.success).toBe(true);
    expect(result.finalMessage).toBe('Search finished');
    expect(result.turns).toHaveLength(2);
    expect(browser.executeActions).toHaveBeenCalledTimes(1);
  });
});
