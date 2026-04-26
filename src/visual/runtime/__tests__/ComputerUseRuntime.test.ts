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
  private observationQueue: VisualObservation[] = [];
  private observationCount = 0;

  executeActions = vi.fn(async (actions) => ({
    success: true,
    executed: actions,
  }));

  setObservations(observations: VisualObservation[]): void {
    this.observationQueue = [...observations];
  }

  async captureObservation(): Promise<VisualObservation> {
    if (this.observationQueue.length > 0) {
      return this.observationQueue.shift() as VisualObservation;
    }

    this.observationCount += 1;

    return {
      textualHints: `stub observation ${this.observationCount}`,
      page: {
        url: 'https://example.test',
        title: `Example ${this.observationCount}`,
        domSummary: `summary-${this.observationCount}`,
      },
      screenshotBase64: `shot-${this.observationCount}`,
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
    expect(result.metrics?.approvalInterruptions).toBe(1);
    expect(result.metrics?.proposedActionCount).toBe(1);
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
    expect(result.metrics?.totalTurns).toBe(2);
    expect(result.metrics?.actionBatches).toBe(1);
    expect(result.metrics?.executedActionCount).toBe(1);
  });

  it('retries recoverable execution failures before succeeding', async () => {
    const responses: VisualTurnResponse[] = [
      {
        status: 'actions_proposed',
        actions: [{ type: 'click', x: 12, y: 24 }],
      },
      {
        status: 'actions_proposed',
        actions: [{ type: 'click', x: 12, y: 24 }],
      },
      {
        status: 'completed',
        finalMessage: 'Recovered after retry',
      },
    ];

    const adapter: VisualModelAdapter = {
      getName: () => 'recovering-adapter',
      getCapabilities: () => ({
        builtInComputerTool: false,
        batchedActions: true,
        nativeScreenshotRequest: false,
        structuredOutput: true,
        toolCalling: false,
        supportsReasoningControl: false,
      }),
      createSession: async () => ({
        sessionId: 'recover-session',
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
    browser.executeActions = vi
      .fn()
      .mockResolvedValueOnce({
        success: false,
        executed: [{ type: 'click', x: 12, y: 24 }],
        error: {
          code: 'ACTION_EXECUTION_FAILED',
          message: 'Transient click failure',
          recoverable: true,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        executed: [{ type: 'wait', durationMs: 1500 }],
      })
      .mockResolvedValueOnce({
        success: true,
        executed: [{ type: 'click', x: 12, y: 24 }],
      });

    const runtime = new ComputerUseRuntime(adapter, browser, new StubApprovalGate(false));

    const result = await runtime.runTask({
      runId: 'run-3',
      task: 'Click the unstable button',
      adapterSession: await adapter.createSession({} as any),
      maxTurns: 3,
    });

    expect(result.success).toBe(true);
    expect(result.finalMessage).toBe('Recovered after retry');
    expect(result.metrics?.recoveryAttempts).toBe(1);
    expect(result.metrics?.recoveryDetails).toMatchObject([
      {
        strategy: 'wait-and-reobserve',
        category: 'timing',
        trigger: 'interaction-execution-failed',
        errorCode: 'ACTION_EXECUTION_FAILED',
        attempt: 1,
        failedActions: ['click'],
      },
    ]);
    expect(browser.executeActions).toHaveBeenCalledTimes(3);
  });

  it('uses scroll-based recovery on a second recoverable failure', async () => {
    const responses: VisualTurnResponse[] = [
      {
        status: 'actions_proposed',
        actions: [{ type: 'click', x: 12, y: 24 }],
      },
      {
        status: 'actions_proposed',
        actions: [{ type: 'click', x: 12, y: 24 }],
      },
      {
        status: 'actions_proposed',
        actions: [{ type: 'click', x: 12, y: 24 }],
      },
      {
        status: 'completed',
        finalMessage: 'Recovered after scroll retry',
      },
    ];

    const adapter: VisualModelAdapter = {
      getName: () => 'recovering-scroll-adapter',
      getCapabilities: () => ({
        builtInComputerTool: false,
        batchedActions: true,
        nativeScreenshotRequest: false,
        structuredOutput: true,
        toolCalling: false,
        supportsReasoningControl: false,
      }),
      createSession: async () => ({
        sessionId: 'recover-scroll-session',
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
    browser.executeActions = vi
      .fn()
      .mockResolvedValueOnce({
        success: false,
        executed: [{ type: 'click', x: 12, y: 24 }],
        error: {
          code: 'ACTION_EXECUTION_FAILED',
          message: 'First transient click failure',
          recoverable: true,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        executed: [{ type: 'wait', durationMs: 1500 }],
      })
      .mockResolvedValueOnce({
        success: false,
        executed: [{ type: 'click', x: 12, y: 24 }],
        error: {
          code: 'ACTION_EXECUTION_FAILED',
          message: 'Second transient click failure',
          recoverable: true,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        executed: [{ type: 'scroll', x: 0, y: 0, scrollY: 600 }],
      })
      .mockResolvedValueOnce({
        success: true,
        executed: [{ type: 'click', x: 12, y: 24 }],
      });

    const runtime = new ComputerUseRuntime(adapter, browser, new StubApprovalGate(false));

    const result = await runtime.runTask({
      runId: 'run-4',
      task: 'Click the unstable button after scrolling',
      adapterSession: await adapter.createSession({} as any),
      maxTurns: 4,
    });

    expect(result.success).toBe(true);
    expect(result.finalMessage).toBe('Recovered after scroll retry');
    expect(result.metrics?.recoveryAttempts).toBe(2);
    expect(result.metrics?.recoveryDetails).toMatchObject([
      {
        strategy: 'wait-and-reobserve',
        category: 'timing',
        trigger: 'interaction-execution-failed',
        attempt: 1,
      },
      {
        strategy: 'scroll-and-reobserve',
        category: 'viewport',
        trigger: 'interaction-execution-failed',
        attempt: 2,
      },
    ]);
    expect(browser.executeActions).toHaveBeenCalledTimes(5);
  });

  it('treats no observable page change as a recoverable verification failure', async () => {
    const responses: VisualTurnResponse[] = [
      {
        status: 'actions_proposed',
        actions: [{ type: 'click', x: 20, y: 40 }],
      },
      {
        status: 'actions_proposed',
        actions: [{ type: 'click', x: 20, y: 40 }],
      },
      {
        status: 'completed',
        finalMessage: 'Recovered after verification retry',
      },
    ];

    const adapter: VisualModelAdapter = {
      getName: () => 'verification-adapter',
      getCapabilities: () => ({
        builtInComputerTool: false,
        batchedActions: true,
        nativeScreenshotRequest: false,
        structuredOutput: true,
        toolCalling: false,
        supportsReasoningControl: false,
      }),
      createSession: async () => ({
        sessionId: 'verification-session',
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
    browser.setObservations([
      {
        textualHints: 'same screen',
        page: { url: 'https://example.test', title: 'Example', domSummary: 'before' },
        screenshotBase64: 'same-shot',
      },
      {
        textualHints: 'same screen',
        page: { url: 'https://example.test', title: 'Example', domSummary: 'before' },
        screenshotBase64: 'same-shot',
      },
      {
        textualHints: 'changed screen',
        page: { url: 'https://example.test/next', title: 'Next', domSummary: 'after' },
        screenshotBase64: 'changed-shot',
      },
      {
        textualHints: 'verified next screen',
        page: { url: 'https://example.test/done', title: 'Done', domSummary: 'done' },
        screenshotBase64: 'done-shot',
      },
      {
        textualHints: 'changed screen',
        page: { url: 'https://example.test/next', title: 'Next', domSummary: 'after' },
        screenshotBase64: 'changed-shot',
      },
    ]);

    const runtime = new ComputerUseRuntime(adapter, browser, new StubApprovalGate(false));

    const result = await runtime.runTask({
      runId: 'run-5',
      task: 'Click and verify page transition',
      adapterSession: await adapter.createSession({} as any),
      maxTurns: 3,
    });

    expect(result.success).toBe(true);
    expect(result.metrics?.verificationFailures).toBe(1);
    expect(result.metrics?.recoveryDetails).toMatchObject([
      {
        strategy: 'wait-and-reobserve',
        category: 'timing',
        trigger: 'verification-no-effect',
        errorCode: 'VERIFICATION_NO_EFFECT',
        failedActions: ['click'],
      },
    ]);
  });

  it('uses scroll-first recovery for viewport-triggered failures', async () => {
    const responses: VisualTurnResponse[] = [
      {
        status: 'actions_proposed',
        actions: [{ type: 'scroll', scrollY: 400 }],
      },
      {
        status: 'actions_proposed',
        actions: [{ type: 'click', x: 10, y: 10 }],
      },
      {
        status: 'completed',
        finalMessage: 'Recovered after viewport scroll strategy',
      },
    ];

    const adapter: VisualModelAdapter = {
      getName: () => 'viewport-adapter',
      getCapabilities: () => ({
        builtInComputerTool: false,
        batchedActions: true,
        nativeScreenshotRequest: false,
        structuredOutput: true,
        toolCalling: false,
        supportsReasoningControl: false,
      }),
      createSession: async () => ({
        sessionId: 'viewport-session',
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
    browser.executeActions = vi
      .fn()
      .mockResolvedValueOnce({
        success: false,
        executed: [{ type: 'scroll', scrollY: 400 }],
        error: {
          code: 'ACTION_EXECUTION_FAILED',
          message: 'Scroll did not move viewport',
          recoverable: true,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        executed: [{ type: 'scroll', x: 0, y: 0, scrollY: 600 }],
      })
      .mockResolvedValueOnce({
        success: true,
        executed: [{ type: 'click', x: 10, y: 10 }],
      });

    const runtime = new ComputerUseRuntime(adapter, browser, new StubApprovalGate(false));

    const result = await runtime.runTask({
      runId: 'run-6',
      task: 'Scroll to reveal content and continue',
      adapterSession: await adapter.createSession({} as any),
      maxTurns: 3,
    });

    expect(result.success).toBe(true);
    expect(result.metrics?.recoveryDetails).toMatchObject([
      {
        strategy: 'scroll-and-reobserve',
        category: 'viewport',
        trigger: 'viewport-execution-failed',
        failedActions: ['scroll'],
      },
    ]);
  });
});
