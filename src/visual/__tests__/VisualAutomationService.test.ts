import { describe, expect, it, vi } from 'vitest';
import { BrowserExecutor } from '../../core/executor/BrowserExecutor';
import { VisualModelAdapter } from '../adapters/VisualModelAdapter';
import { VisualAutomationService } from '../VisualAutomationService';
import { BrowserExecutionAdapter } from '../runtime/BrowserExecutionAdapter';
import { ComputerUseRuntime } from '../runtime/ComputerUseRuntime';
import {
  ActionExecutionResult,
  VisualAdapterCapabilities,
  VisualObservation,
  VisualPageContext,
  VisualSessionHandle,
  VisualTurnRequest,
  VisualTurnResponse,
} from '../types/visualProtocol';

vi.mock('../../llm/config', () => ({
  loadLLMConfig: () => ({
    provider: 'openai',
    model: 'test-model',
    apiKey: 'test-key',
    baseUrl: 'https://example.test/v1',
    timeout: 5000,
  }),
}));

class StubVisualAdapter implements VisualModelAdapter {
  constructor(private readonly response: VisualTurnResponse) {}

  getName(): string {
    return 'stub-visual-adapter';
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
      model: 'test-model',
      capabilities: this.getCapabilities(),
    };
  }

  async runTurn(
    _session: VisualSessionHandle,
    _request: VisualTurnRequest
  ): Promise<VisualTurnResponse> {
    return this.response;
  }

  async destroySession(_session: VisualSessionHandle): Promise<void> {}
}

class StubBrowserAdapter implements BrowserExecutionAdapter {
  public executeActions = vi.fn(async (_actions) => this.executionResult);

  constructor(private readonly executionResult: ActionExecutionResult) {}

  async captureObservation(): Promise<VisualObservation> {
    return {
      textualHints: 'stub observation',
    };
  }

  async getPageContext(): Promise<VisualPageContext> {
    return {
      url: 'https://example.test',
      title: 'Example',
    };
  }
}

class StubRuntime extends ComputerUseRuntime {
  constructor(private readonly result: Awaited<ReturnType<ComputerUseRuntime['runTask']>>) {
    super(
      {
        getName: () => 'runtime-adapter',
        getCapabilities: () => ({
          builtInComputerTool: false,
          batchedActions: true,
          nativeScreenshotRequest: false,
          structuredOutput: true,
          toolCalling: false,
          supportsReasoningControl: false,
        }),
        createSession: async () => ({
          sessionId: 'runtime-session',
          adapterMode: 'chat-structured',
          model: 'test-model',
          capabilities: {
            builtInComputerTool: false,
            batchedActions: true,
            nativeScreenshotRequest: false,
            structuredOutput: true,
            toolCalling: false,
            supportsReasoningControl: false,
          },
        }),
        runTurn: async () => ({ status: 'completed', finalMessage: 'unused' }),
        destroySession: async () => {},
      },
      new StubBrowserAdapter({ success: true, executed: [] })
    );
  }

  override async runTask(_input: any) {
    return this.result;
  }
}

class TestVisualAutomationService extends VisualAutomationService {
  constructor(
    browserExecutor: BrowserExecutor,
    private readonly browserAdapter: BrowserExecutionAdapter,
    private readonly runtime: ComputerUseRuntime,
    private readonly adapter: VisualModelAdapter
  ) {
    super(browserExecutor);
  }

  protected override createBrowserAdapter() {
    return this.browserAdapter as any;
  }

  protected override createRuntime(_adapter: any, _browser: any) {
    return this.runtime;
  }

  protected override createAdapter(_mode: any) {
    return this.adapter;
  }
}

describe('VisualAutomationService', () => {
  it('returns execution error when approved actions fail before continuation', async () => {
    const browserExecutor = { getPage: () => ({}) } as BrowserExecutor;
    const service = new TestVisualAutomationService(
      browserExecutor,
      new StubBrowserAdapter({
        success: false,
        executed: [],
        error: {
          code: 'ACTION_EXECUTION_FAILED',
          message: 'Click failed',
          recoverable: true,
        },
      }),
      new StubRuntime({ success: true, turns: [], finalMessage: 'should not run' }),
      new StubVisualAdapter({ status: 'completed', finalMessage: 'unused' })
    );

    const result = await service.runApprovedVisualContinuation({
      task: 'Click submit and continue',
      actions: [{ type: 'click', x: 10, y: 20 }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('ACTION_EXECUTION_FAILED');
    expect(result.routeReason).toBe('approved-visual-actions');
  });

  it('continues visual execution after approved actions succeed', async () => {
    const browserExecutor = { getPage: () => ({}) } as BrowserExecutor;
    const browserAdapter = new StubBrowserAdapter({
      success: true,
      executed: [{ type: 'click', x: 10, y: 20 }],
    });
    const continuationRuntime = new StubRuntime({
      success: true,
      finalMessage: 'Approved path completed',
      turns: [{ turnId: 'turn-1', duration: 100 }],
    });
    const service = new TestVisualAutomationService(
      browserExecutor,
      browserAdapter,
      continuationRuntime,
      new StubVisualAdapter({ status: 'completed', finalMessage: 'unused' })
    );

    const result = await service.runApprovedVisualContinuation({
      task: 'Click submit and continue',
      actions: [{ type: 'click', x: 10, y: 20 }],
      maxTurns: 4,
    });

    expect(result.success).toBe(true);
    expect(result.finalMessage).toBe('Approved path completed');
    expect(result.routeReason).toBe('approved-visual-actions');
    expect(result.approvedActions).toHaveLength(1);
    expect(browserAdapter.executeActions).toHaveBeenCalledTimes(1);
  });
});
