/**
 * 恢复引擎
 * 位置: src/recovery/recoveryEngine.ts
 *
 * 功能: LLM决策恢复策略
 * 改进: 添加LLM调用频率限制和selector验证
 */
import { getLLMClient } from '../llm/OpenAIResponses';
export var RecoveryStrategy;
(function (RecoveryStrategy) {
    RecoveryStrategy["RETRY_SAME"] = "retry_same";
    RecoveryStrategy["RETRY_WITH_WAIT"] = "retry_with_wait";
    RecoveryStrategy["USE_FALLBACK_SELECTOR"] = "use_fallback_selector";
    RecoveryStrategy["REGENERATE_SELECTOR"] = "regenerate_selector";
    RecoveryStrategy["SIMPLIFY_ACTION"] = "simplify_action";
    RecoveryStrategy["SKIP_STEP"] = "skip_step";
    RecoveryStrategy["RELOAD_PAGE"] = "reload_page";
    RecoveryStrategy["ASK_USER"] = "ask_user";
    RecoveryStrategy["GIVE_UP"] = "give_up";
})(RecoveryStrategy || (RecoveryStrategy = {}));
export class RecoveryEngine {
    page;
    llmClient = getLLMClient();
    strategyHistory = new Map();
    strategyHistoryOrder = [];
    llmCallCount = new Map();
    llmCallOrder = [];
    MAX_LLM_CALLS_PER_ACTION = 1;
    MAX_STRATEGY_HISTORY = 100;
    MAX_LLM_CALLS = 500;
    globalLLMCallCount = 0;
    GLOBAL_LLM_LIMIT = 10;
    constructor(page) {
        this.page = page;
    }
    cleanupStrategyHistory() {
        while (this.strategyHistoryOrder.length > this.MAX_STRATEGY_HISTORY) {
            const oldest = this.strategyHistoryOrder.shift();
            if (oldest) {
                this.strategyHistory.delete(oldest);
            }
        }
    }
    cleanupLlmCallCount() {
        while (this.llmCallOrder.length > this.MAX_LLM_CALLS) {
            const oldest = this.llmCallOrder.shift();
            if (oldest) {
                this.llmCallCount.delete(oldest);
            }
        }
    }
    cleanup() {
        this.strategyHistory.clear();
        this.strategyHistoryOrder = [];
        this.llmCallCount.clear();
        this.llmCallOrder = [];
        this.globalLLMCallCount = 0;
        this.page = null;
    }
    async decide(context) {
        const { actionResult, retryCount, maxRetries, failedAction } = context;
        if (retryCount >= maxRetries) {
            return this.giveUp('Max retries exceeded');
        }
        if (!actionResult.error?.recoverable) {
            return this.giveUp('Unrecoverable error');
        }
        const errorCode = actionResult.error?.code || '';
        console.log(`[RecoveryEngine] Deciding for error: ${errorCode}, retry: ${retryCount}`);
        switch (errorCode) {
            case 'SELECTOR_NOT_FOUND':
            case 'SELECTOR_ERROR':
                return this.handleSelectorError(context);
            case 'NAVIGATION_ERROR':
                return this.handleNavigationError(context);
            case 'WAIT_TIMEOUT':
                return this.handleTimeoutError(context);
            case 'CLICK_FAILED':
            case 'CLICK_ERROR':
                return this.handleClickError(context);
            default:
                return this.handleGenericError(context);
        }
    }
    handleSelectorError(context) {
        const { failedAction, currentGraph, retryCount } = context;
        const elementType = this.getActionTargetType(failedAction);
        const alternatives = currentGraph.elements.filter((e) => e.role === elementType);
        if (alternatives.length > 0 && retryCount === 0) {
            const alt = alternatives[0];
            return {
                strategy: RecoveryStrategy.USE_FALLBACK_SELECTOR,
                newSelector: alt.selector,
                reason: `Using fallback ${elementType}: ${alt.id}`,
            };
        }
        if (retryCount < 2) {
            return {
                strategy: RecoveryStrategy.REGENERATE_SELECTOR,
                reason: 'Regenerating selector via LLM',
            };
        }
        if (failedAction.type === 'browser:click' || failedAction.type === 'browser:input') {
            return {
                strategy: RecoveryStrategy.SIMPLIFY_ACTION,
                reason: 'Simplifying action',
            };
        }
        return this.giveUp('Selector recovery exhausted');
    }
    handleNavigationError(context) {
        return {
            strategy: RecoveryStrategy.RETRY_WITH_WAIT,
            waitMs: 2000,
            reason: 'Retrying navigation after 2s wait',
        };
    }
    handleTimeoutError(context) {
        const { retryCount } = context;
        if (retryCount === 0) {
            return {
                strategy: RecoveryStrategy.RETRY_WITH_WAIT,
                waitMs: 3000,
                reason: 'Waiting 3s before retry',
            };
        }
        return { strategy: RecoveryStrategy.SKIP_STEP, reason: 'Skipping wait step' };
    }
    handleClickError(context) {
        const { retryCount } = context;
        if (retryCount === 0) {
            return {
                strategy: RecoveryStrategy.RETRY_WITH_WAIT,
                waitMs: 500,
                reason: 'Waiting 500ms before click retry',
            };
        }
        return { strategy: RecoveryStrategy.SIMPLIFY_ACTION, reason: 'Simplifying click' };
    }
    handleGenericError(context) {
        const { retryCount } = context;
        if (retryCount < 2) {
            return { strategy: RecoveryStrategy.RETRY_SAME, reason: 'Retrying same action' };
        }
        return { strategy: RecoveryStrategy.ASK_USER, reason: 'Requesting user guidance' };
    }
    /**
     * LLM重新生成选择器 - 改进版（验证selector）
     */
    async regenerateSelector(context) {
        const { failedAction, failedNodeId, currentGraph } = context;
        const actionKey = `${failedNodeId}_${failedAction.type}`;
        const currentCalls = this.llmCallCount.get(actionKey) || 0;
        if (currentCalls >= this.MAX_LLM_CALLS_PER_ACTION) {
            console.log(`[RecoveryEngine] LLM call limit reached for ${actionKey}`);
            return null;
        }
        if (this.globalLLMCallCount >= this.GLOBAL_LLM_LIMIT) {
            console.log('[RecoveryEngine] Global LLM limit reached');
            return null;
        }
        const systemPrompt = `You are a CSS selector generation expert. Given the page UI graph and the failed action, generate a precise CSS selector.

Rules:
1. Prefer data-testid, id, aria-label, name attributes
2. Avoid generic selectors like "button", "input", "a"
3. Output ONLY the selector string, no explanations`;
        const userPrompt = `Page UIGraph (first 30 elements):
${JSON.stringify(currentGraph.elements.slice(0, 30).map((e) => ({
            id: e.id,
            role: e.role,
            label: e.label,
            selector: e.selector,
            priority: e.selectorPriority,
        })), null, 2)}

Failed action:
${JSON.stringify({ type: failedAction.type, params: failedAction.params }, null, 2)}

Generate a precise CSS selector. Output ONLY the selector string.`;
        try {
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ];
            const response = await this.llmClient.chat(messages);
            const selector = this.extractSelector(response.content);
            if (selector) {
                const isValid = await this.validateSelector(selector);
                if (isValid) {
                    this.llmCallCount.set(actionKey, currentCalls + 1);
                    this.cleanupLlmCallCount();
                    if (!this.llmCallOrder.includes(actionKey)) {
                        this.llmCallOrder.push(actionKey);
                    }
                    this.globalLLMCallCount++;
                    console.log('[RecoveryEngine] LLM generated and validated selector:', selector);
                    return selector;
                }
                else {
                    console.warn('[RecoveryEngine] LLM generated invalid selector:', selector);
                }
            }
            return null;
        }
        catch (error) {
            console.error('[RecoveryEngine] Selector regeneration failed:', error);
            return null;
        }
    }
    async validateSelector(selector) {
        try {
            const count = await this.page.locator(selector).count();
            return count > 0;
        }
        catch (error) {
            console.warn('[RecoveryEngine] Selector validation error:', error);
            return false;
        }
    }
    extractSelector(content) {
        const match = content.trim().match(/["']([#.\[][^\s"'#.\[\]]+)["']/);
        if (match)
            return match[1];
        const lines = content
            .split('\n')
            .filter((line) => line.startsWith('.') || line.startsWith('#') || line.startsWith('['));
        return lines[0] || null;
    }
    getActionTargetType(action) {
        switch (action.type) {
            case 'browser:click':
                return 'button';
            case 'browser:input':
                return 'input';
            default:
                return 'button';
        }
    }
    giveUp(reason) {
        return { strategy: RecoveryStrategy.GIVE_UP, reason };
    }
    recordStrategy(nodeId, strategy) {
        this.cleanupStrategyHistory();
        const history = this.strategyHistory.get(nodeId) || [];
        history.push(strategy);
        this.strategyHistory.set(nodeId, history);
        if (!this.strategyHistoryOrder.includes(nodeId)) {
            this.strategyHistoryOrder.push(nodeId);
        }
    }
    getStrategyHistory(nodeId) {
        return this.strategyHistory.get(nodeId) || [];
    }
    getPage() {
        return this.page;
    }
    clearLlmCallCount(actionKey) {
        this.llmCallCount.delete(actionKey);
        this.llmCallOrder = this.llmCallOrder.filter((k) => k !== actionKey);
    }
}
