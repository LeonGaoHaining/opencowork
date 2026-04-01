import {
  AnyAction,
  Plan,
  PlanNode,
  generateId,
  ActionType,
  AskUserAction,
  ActionResult,
  ActionConstraints,
} from '../action/ActionSchema';
import { getLLMClient } from '../../llm/OpenAIResponses';
import { LLMMessage } from '../../llm/LLMClient';
import { AskUserExecutor } from '../executor/AskUserExecutor';

export enum ReplanTrigger {
  ACTION_FAILED = 'action_failed',
  SELECTOR_INVALID = 'selector_invalid',
  NAVIGATION_ERROR = 'navigation_error',
  TIMEOUT = 'timeout',
  USER_REJECTED = 'user_rejected',
}

export interface ReplanError {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface ReplanRequest {
  trigger: ReplanTrigger;
  failedNodeId?: string;
  error: ReplanError;
  executionState: ExecutionState;
  remainingPlan: Plan;
  pageContent?: string;
}

export interface ExecutionState {
  currentNodeId: string;
  completedNodes: string[];
  pageUrl?: string;
  pageContent?: string;
  availableUrls?: string[];
}

export interface ReplanResult {
  success: boolean;
  newPlan?: Plan;
  modifiedNodes?: ModifiedNode[];
  suggestions?: string[];
  reason?: string;
  canContinue: boolean;
}

export interface ModifiedNode {
  nodeId: string;
  newAction?: AnyAction;
  newSelector?: string;
  fallbackSelectors?: string[];
  retryCount?: number;
}

export interface RecoveryDecision {
  shouldRetry: boolean;
  strategy:
    | 'retry_same'
    | 'regenerate_selector'
    | 'simplify_action'
    | 'skip_step'
    | 'ask_user'
    | 'give_up';
  reason: string;
  newSelector?: string;
  newAction?: AnyAction;
}

export class Replanner {
  private llmClient = getLLMClient();
  private maxRetries = 3; // 保留，由外部(TaskEngine)控制重试次数
  private askUserExecutor: AskUserExecutor;

  constructor() {
    this.askUserExecutor = new AskUserExecutor();
  }

  async executeAskUser(question: string, options?: string[]): Promise<string | null> {
    const askUserAction: AskUserAction = {
      id: generateId(),
      type: ActionType.ASK_USER,
      description: question,
      params: { question, options },
      constraints: { timeout: 300000, retries: 0, requiresConfirm: false },
    };

    try {
      const result: ActionResult = await this.askUserExecutor.execute(askUserAction);

      if (result.success && result.output) {
        console.log('[Replanner] User answered:', result.output);
        return result.output.answer || null;
      }

      console.log('[Replanner] AskUser failed or cancelled:', result.error);
      return null;
    } catch (error) {
      console.error('[Replanner] ExecuteAskUser error:', error);
      return null;
    }
  }

  async replan(request: ReplanRequest): Promise<ReplanResult> {
    console.log(`[Replanner] Replanning due to:`, request.trigger);

    switch (request.trigger) {
      case ReplanTrigger.SELECTOR_INVALID:
        return await this.handleSelectorFailure(request);
      case ReplanTrigger.NAVIGATION_ERROR:
        return await this.handleNavigationError(request);
      case ReplanTrigger.TIMEOUT:
        return await this.handleTimeout(request);
      case ReplanTrigger.USER_REJECTED:
        return this.handleUserRejected(request);
      case ReplanTrigger.ACTION_FAILED:
        return await this.handleActionFailed(request);
      default:
        return {
          success: false,
          reason: 'unknown_trigger',
          canContinue: false,
        };
    }
  }

  private async handleSelectorFailure(request: ReplanRequest): Promise<ReplanResult> {
    const { error, executionState, remainingPlan } = request;
    const pageContent = executionState.pageContent || request.pageContent;

    if (!pageContent) {
      return {
        success: false,
        reason: 'no_page_content',
        canContinue: false,
      };
    }

    try {
      const selectorResult = await this.generateNewSelector(pageContent, error.message);

      if (!selectorResult.selectors || selectorResult.selectors.length === 0) {
        return {
          success: false,
          reason: 'selector_regeneration_failed',
          canContinue: false,
        };
      }

      const modifiedNodes: ModifiedNode[] = remainingPlan.nodes
        .filter((node) => node.id === request.failedNodeId)
        .map((node) => ({
          nodeId: node.id,
          newSelector: selectorResult.selectors[0],
          fallbackSelectors: selectorResult.selectors,
          retryCount: 1,
        }));

      return {
        success: true,
        modifiedNodes,
        suggestions: selectorResult.selectors,
        canContinue: true,
      };
    } catch (err) {
      console.error('[Replanner] Selector regeneration failed:', err);
      return {
        success: false,
        reason: 'selector_regeneration_error',
        canContinue: false,
      };
    }
  }

  private async generateNewSelector(
    pageContent: string,
    errorMessage: string
  ): Promise<{ selectors: string[]; strategy: string }> {
    const systemPrompt = `你是一个CSS选择器生成专家。根据页面HTML和错误信息，生成针对目标元素的选择器。

要求：
1. 分析页面结构，找到目标元素
2. 只生成 2-3 个针对当前操作的选择器
3. 优先使用精确选择器：ID、类名、属性
4. 避免使用模糊选择器如 "button"、"input"、"a"
5. 如果是点击操作，优先匹配可见的按钮元素
6. 如果是输入操作，优先匹配输入框元素

输出格式要求：
只输出一个JSON对象，不要其他内容。
格式：
{"selectors": ["选择器1", "选择器2"], "strategy": "选择的策略说明"}`;

    const userPrompt = `页面HTML片段：
${pageContent.substring(0, 8000)}

之前的错误：${errorMessage}

请生成多个可靠的选择器。`;

    try {
      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await this.llmClient.chat(messages);
      const content = response.content.trim();

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.selectors && Array.isArray(result.selectors)) {
          return {
            selectors: result.selectors,
            strategy: result.strategy || 'generated by LLM',
          };
        }
      }

      const fallbackSelectors = content
        .split('\n')
        .filter(
          (line) =>
            line.startsWith('.') ||
            line.startsWith('#') ||
            line.startsWith('[') ||
            line.startsWith('/')
        )
        .slice(0, 3);

      return {
        selectors: fallbackSelectors.length > 0 ? fallbackSelectors : ['body'],
        strategy: 'fallback from lines',
      };
    } catch (err) {
      console.error('[Replanner] LLM selector generation failed:', err);
      return {
        selectors: ['body'],
        strategy: 'fallback to body',
      };
    }
  }

  private async handleNavigationError(request: ReplanRequest): Promise<ReplanResult> {
    const { error, executionState } = request;

    const suggestions: string[] = [];

    if (executionState.pageUrl) {
      const searchUrl = this.generateSearchUrl(executionState.pageUrl);
      suggestions.push(searchUrl);
    }

    if (executionState.availableUrls) {
      suggestions.push(...executionState.availableUrls);
    }

    return {
      success: true,
      suggestions,
      canContinue: true,
    };
  }

  private generateSearchUrl(query: string): string {
    const encodedQuery = encodeURIComponent(query);
    return `https://www.baidu.com/s?wd=${encodedQuery}`;
  }

  private async handleTimeout(request: ReplanRequest): Promise<ReplanResult> {
    const { remainingPlan, error } = request;

    const timeoutActions = ['browser:wait'];
    const skipableNodes = remainingPlan.nodes.filter(
      (node) => node.action && timeoutActions.includes(node.action.type)
    );

    if (skipableNodes.length > 0) {
      return {
        success: true,
        modifiedNodes: skipableNodes.map((node) => ({
          nodeId: node.id,
          retryCount: 0,
        })),
        canContinue: true,
      };
    }

    return {
      success: false,
      reason: 'timeout_non_recoverable',
      canContinue: false,
    };
  }

  private handleUserRejected(request: ReplanRequest): ReplanResult {
    return {
      success: false,
      reason: 'user_rejected',
      canContinue: false,
    };
  }

  private async handleActionFailed(request: ReplanRequest): Promise<ReplanResult> {
    const { error, executionState, remainingPlan } = request;

    if (error.recoverable) {
      return {
        success: true,
        suggestions: ['retry_with_backoff', 'skip_step', 'ask_user'],
        canContinue: true,
      };
    }

    return {
      success: false,
      reason: error.code,
      canContinue: false,
    };
  }

  async validateSelector(selector: string, pageContent?: string): Promise<boolean> {
    if (!selector) return false;

    if (selector.startsWith('/') || selector.startsWith('(')) {
      return true;
    }

    if (selector.startsWith('.') || selector.startsWith('#') || selector.startsWith('[')) {
      return true;
    }

    return false;
  }

  private async llmDecideRecovery(request: ReplanRequest): Promise<RecoveryDecision> {
    const { trigger, error, executionState, remainingPlan } = request;

    const failedNode = remainingPlan.nodes.find((n) => n.id === request.failedNodeId);
    const nodeDescription =
      failedNode?.metadata?.description || failedNode?.action?.type || '未知节点';
    const actionParams = failedNode?.action?.params
      ? JSON.stringify(failedNode.action.params).substring(0, 200)
      : '无参数';

    const systemPrompt = `你是一个智能任务恢复专家。当任务执行失败时，你需要分析失败原因并决定如何恢复。`;

    const userPrompt = `任务执行失败，需要你决定如何恢复。

失败信息：
- 错误类型: ${trigger}
- 错误代码: ${error.code}
- 错误消息: ${error.message}
- 失败节点: ${nodeDescription}
- 节点参数: ${actionParams}
- 当前页面: ${executionState.pageUrl || '未知'}
- 已完成节点数: ${executionState.completedNodes.length}
- 剩余节点数: ${remainingPlan.nodes.length}

请分析失败原因，然后决定：
1. 是否重试? (shouldRetry: true/false)
2. 重试策略? (strategy: "retry_same" | "regenerate_selector" | "simplify_action" | "skip_step" | "ask_user" | "give_up")
3. 理由是什么?

只输出 JSON 格式，不要其他内容。格式如下：
{"shouldRetry": true/false, "strategy": "策略名", "reason": "理由", "newSelector": "新选择器(可选)", "newAction": "新动作描述(可选)"}`;

    try {
      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await this.llmClient.chat(messages);
      const content = response.content.trim();

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const decision = JSON.parse(jsonMatch[0]) as RecoveryDecision;
        console.log('[Replanner] LLM decision:', decision);
        return decision;
      }

      return {
        shouldRetry: false,
        strategy: 'give_up',
        reason: '无法解析LLM响应',
      };
    } catch (err) {
      console.error('[Replanner] LLM decision failed:', err);
      return {
        shouldRetry: false,
        strategy: 'give_up',
        reason: 'LLM调用失败',
      };
    }
  }

  async decideWithRetry(request: ReplanRequest, retryCount: number = 0): Promise<ReplanResult> {
    console.log(`[Replanner] decideWithRetry called, retry count: ${retryCount}`);

    if (retryCount >= this.maxRetries) {
      console.log('[Replanner] Max retries reached, giving up');
      return {
        success: false,
        reason: 'max_retries_reached',
        canContinue: false,
      };
    }

    const decision = await this.llmDecideRecovery(request);
    console.log('[Replanner] Recovery decision:', decision);

    if (!decision.shouldRetry || decision.strategy === 'give_up') {
      return {
        success: false,
        reason: decision.reason,
        canContinue: false,
      };
    }

    switch (decision.strategy) {
      case 'retry_same':
        return {
          success: true,
          modifiedNodes: request.failedNodeId
            ? [
                {
                  nodeId: request.failedNodeId,
                  retryCount: retryCount + 1,
                },
              ]
            : [],
          canContinue: true,
        };

      case 'regenerate_selector':
        if (decision.newSelector) {
          const modifiedNodes = request.remainingPlan.nodes
            .filter((node) => node.id === request.failedNodeId)
            .map((node) => ({
              nodeId: node.id,
              newSelector: decision.newSelector,
              retryCount: retryCount + 1,
            }));
          return {
            success: true,
            modifiedNodes,
            canContinue: true,
          };
        }
        return await this.handleSelectorFailure(request);

      case 'simplify_action':
        if (request.failedNodeId) {
          const failedNode = request.remainingPlan.nodes.find((n) => n.id === request.failedNodeId);
          if (failedNode?.action) {
            const simplifiedAction = this.simplifyAction(failedNode.action);
            return {
              success: true,
              modifiedNodes: [
                {
                  nodeId: request.failedNodeId,
                  newAction: simplifiedAction,
                  retryCount: retryCount + 1,
                },
              ],
              canContinue: true,
            };
          }
        }
        return {
          success: false,
          reason: 'cannot_simplify_action',
          canContinue: false,
        };

      case 'skip_step':
        if (request.failedNodeId) {
          return {
            success: true,
            modifiedNodes: [
              {
                nodeId: request.failedNodeId,
                retryCount: -1,
              },
            ],
            canContinue: true,
          };
        }
        return {
          success: false,
          reason: 'no_failed_node',
          canContinue: false,
        };

      case 'ask_user':
        console.log('[Replanner] Executing ask_user strategy, waiting for user response...');

        const userAnswer = await this.executeAskUser('任务执行遇到问题，是否继续尝试？', [
          '继续重试',
          '停止任务',
        ]);

        console.log('[Replanner] User answer:', userAnswer);

        if (userAnswer === '继续重试') {
          return {
            success: true,
            canContinue: true,
            reason: '用户选择继续重试',
          };
        }

        return {
          success: false,
          canContinue: false,
          reason: userAnswer === '停止任务' ? '用户选择停止' : '用户未响应',
        };

      default:
        return {
          success: false,
          reason: 'unknown_strategy',
          canContinue: false,
        };
    }
  }

  private simplifyAction(action: AnyAction): AnyAction {
    if (action.type === ActionType.BROWSER_INPUT) {
      return {
        ...action,
        params: {
          ...action.params,
          force: true,
        },
      };
    }
    return action;
  }

  cleanup(): void {
    this.askUserExecutor.cancelAll();
    console.log('[Replanner] Cleaned up');
  }
}

export default Replanner;
