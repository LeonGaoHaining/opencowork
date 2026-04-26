import { BrowserExecutor } from '../core/executor/BrowserExecutor';
import { TaskVisualProviderSelection } from '../core/task/types';
import { loadLLMConfig } from '../llm/config';
import {
  ChatCompletionsVisualAdapter,
  ComputerUseRuntime,
  PlaywrightBrowserExecutionAdapter,
  ResponsesVisualAdapter,
  RuleBasedApprovalGate,
  UIAction,
  VisualAdapterMode,
  VisualModelAdapter,
} from './index';

export interface RunVisualTaskParams {
  task: string;
  adapterMode?: VisualAdapterMode;
  model?: string;
  maxTurns?: number;
  launchIfNeeded?: boolean;
  approvalEnabled?: boolean;
  visualProvider?: TaskVisualProviderSelection | null;
}

export interface RunVisualBrowserFallbackParams {
  action: 'click' | 'input' | 'wait';
  selector?: string;
  text?: string;
  pressEnter?: boolean;
  timeout?: number;
  adapterMode?: VisualAdapterMode;
  maxTurns?: number;
  routeReason?: string;
  fallbackReason?: string;
}

export interface RunApprovedVisualContinuationParams {
  task: string;
  actions: UIAction[];
  adapterMode?: VisualAdapterMode;
  model?: string;
  maxTurns?: number;
}

export class VisualAutomationService {
  constructor(private readonly browserExecutor: BrowserExecutor) {}

  async runVisualTask(params: RunVisualTaskParams) {
    const config = loadLLMConfig();
    const adapterMode = params.adapterMode || 'chat-structured';
    const model = params.model || config.model;
    const maxTurns = params.maxTurns || 8;
    const launchIfNeeded = params.launchIfNeeded !== false;
    const approvalEnabled = params.approvalEnabled !== false;

    if (launchIfNeeded && !this.browserExecutor.getPage()) {
      await this.browserExecutor.launchBrowser();
    }

    const adapter = this.createAdapter(adapterMode);
    const adapterCapabilities = adapter.getCapabilities();
    const session = await adapter.createSession({
      model,
      systemPrompt:
        'Use the current browser state to complete the task safely. Prefer short action batches. Request more visual context when needed.',
      timeoutMs: config.timeout || 60000,
      maxTurns,
      metadata: {
        visualProvider: params.visualProvider || null,
      },
    });

    const browser = this.createBrowserAdapter();
    const runtime = this.createRuntime(adapter, browser);

    try {
      const result = await runtime.runTask({
        runId: session.sessionId,
        task: params.task,
        adapterSession: session,
        maxTurns,
        approvalPolicy: {
          enabled: approvalEnabled,
          highImpactActions: ['login', 'publish', 'send', 'delete', 'payment', 'upload'],
        },
      });

      return {
        adapter: adapter.getName(),
        adapterMode,
        model,
        routeReason: 'visual-runtime',
        maxTurns,
        visualProvider: params.visualProvider || null,
        visualProviderCapabilities: params.visualProvider?.capabilities || null,
        adapterCapabilities,
        ...result,
      };
    } finally {
      await adapter.destroySession(session);
    }
  }

  async runBrowserActionFallback(params: RunVisualBrowserFallbackParams) {
    const result = await this.runVisualTask({
      task: this.buildBrowserFallbackTask(params),
      adapterMode: params.adapterMode,
      maxTurns: params.maxTurns || 6,
      launchIfNeeded: true,
    });

    return {
      ...result,
      routeReason: params.routeReason || 'browser-action-visual-route',
      fallbackReason: params.fallbackReason,
      originalAction: params.action,
      selectorHint: params.selector,
    };
  }

  async runApprovedVisualContinuation(params: RunApprovedVisualContinuationParams) {
    const browser = this.createBrowserAdapter();
    const execution = await browser.executeActions(params.actions || []);

    if (!execution.success) {
      return {
        success: false,
        turns: [],
        error: execution.error,
        routeReason: 'approved-visual-actions',
      };
    }

    const continuationResult = await this.runVisualTask({
      task: params.task,
      adapterMode: params.adapterMode,
      model: params.model,
      maxTurns: params.maxTurns,
      launchIfNeeded: false,
      approvalEnabled: false,
    });

    return {
      ...continuationResult,
      routeReason: 'approved-visual-actions',
      approvedActions: execution.executed,
    };
  }

  protected createAdapter(mode: VisualAdapterMode): VisualModelAdapter {
    switch (mode) {
      case 'responses-computer':
        return new ResponsesVisualAdapter();
      case 'chat-structured':
        return new ChatCompletionsVisualAdapter();
      default:
        throw new Error(`Unsupported visual adapter mode: ${mode}`);
    }
  }

  protected createBrowserAdapter(): PlaywrightBrowserExecutionAdapter {
    return new PlaywrightBrowserExecutionAdapter(this.browserExecutor);
  }

  protected createRuntime(
    adapter: VisualModelAdapter,
    browser: PlaywrightBrowserExecutionAdapter
  ): ComputerUseRuntime {
    return new ComputerUseRuntime(adapter, browser, new RuleBasedApprovalGate());
  }

  private buildBrowserFallbackTask(params: RunVisualBrowserFallbackParams): string {
    switch (params.action) {
      case 'click':
        return `Use visual browser interaction to click the element that matches selector hint: ${params.selector || 'unknown target'}. If the target is not clearly visible, inspect the page and click the most likely matching interactive element.`;
      case 'input':
        return `Use visual browser interaction to focus the input matching selector hint: ${params.selector || 'unknown input'}, then type this text: ${params.text || ''}${params.pressEnter ? ', and press Enter after typing.' : '.'}`;
      case 'wait':
        return `Use visual browser interaction to inspect whether an element matching selector hint: ${params.selector || 'unknown target'} is visible. Wait briefly if needed before concluding.`;
      default:
        return 'Use visual browser interaction to inspect and continue the requested browser task.';
    }
  }
}
