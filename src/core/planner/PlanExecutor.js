import { ExecutorRouter } from '../executor/ExecutorRouter';
export class PlanExecutor {
    plan = null;
    currentNodeId = null;
    paused = false;
    cancelled = false;
    callbacks = {};
    router;
    constructor() {
        this.router = new ExecutorRouter();
    }
    startScreencast() {
        this.router.browserExecutor.startScreencast();
    }
    stopScreencast() {
        this.router.browserExecutor.stopScreencast();
    }
    async getPageContent() {
        try {
            const content = await this.router.browserExecutor.getPageContent();
            return content || '';
        }
        catch (error) {
            console.error('[PlanExecutor] Failed to get page content:', error);
            return '';
        }
    }
    async getPageUrl() {
        try {
            const url = await this.router.browserExecutor.getPageUrl();
            return url || '';
        }
        catch (error) {
            console.error('[PlanExecutor] Failed to get page URL:', error);
            return '';
        }
    }
    async getPageStructure() {
        try {
            const structure = await this.router.browserExecutor.getPageStructure();
            return structure || null;
        }
        catch (error) {
            console.error('[PlanExecutor] Failed to get page structure:', error);
            return null;
        }
    }
    setActiveMode(active) {
        if (this.router.browserExecutor.setActiveMode) {
            this.router.browserExecutor.setActiveMode(active);
        }
    }
    setTaskRunning(running) {
        if (this.router.browserExecutor.setTaskRunning) {
            this.router.browserExecutor.setTaskRunning(running);
        }
    }
    async checkLoginPopup() {
        try {
            return await this.router.browserExecutor.checkLoginPopup();
        }
        catch (error) {
            console.error('[PlanExecutor] Failed to check login popup:', error);
            return { hasPopup: false };
        }
    }
    async *execute(plan, callbacks) {
        this.plan = plan;
        this.paused = false;
        this.cancelled = false;
        this.callbacks = callbacks || {};
        let lastResult = null;
        console.log(`[PlanExecutor] Starting execution of plan ${plan.id}`);
        const actionNodes = plan.nodes.filter((n) => n.type === 'action');
        for (const node of actionNodes) {
            if (this.cancelled) {
                console.log(`[PlanExecutor] Execution cancelled`);
                break;
            }
            while (this.paused) {
                yield { type: 'paused', node };
                await this.waitForResume();
            }
            this.currentNodeId = node.id;
            try {
                yield { type: 'node_start', node };
                if (node.action) {
                    const result = await this.executeAction(node.action);
                    if (result.success) {
                        lastResult = result;
                        yield { type: 'node_complete', node, result };
                        this.callbacks.onNodeComplete?.(node, result);
                    }
                    else {
                        const error = new Error(result.error?.message || 'Action failed');
                        yield {
                            type: 'node_error',
                            node,
                            error: {
                                message: error.message,
                                code: result.error?.code,
                                recoverable: result.error?.recoverable ?? true,
                            },
                        };
                        this.callbacks.onNodeError?.(node, error);
                        if (!result.error?.recoverable) {
                            yield { type: 'failed', error };
                            return;
                        }
                    }
                }
            }
            catch (error) {
                console.error(`[PlanExecutor] Node ${node.id} failed:`, error);
                yield { type: 'node_error', node, error: error };
                this.callbacks.onNodeError?.(node, error);
                yield { type: 'failed', error: error };
                return;
            }
        }
        if (!this.cancelled) {
            const formattedSummary = this.formatTaskSummary(lastResult, this.plan);
            yield { type: 'completed', summary: formattedSummary };
        }
    }
    formatTaskSummary(result, plan) {
        if (!result || !result.success) {
            return {};
        }
        const output = result.output;
        if (!output) {
            return result;
        }
        if (Array.isArray(output) && output.length > 0) {
            const formattedItems = output
                .map((item) => this.cleanHtmlText(item))
                .filter((item) => item.trim().length > 0)
                .map((item, index) => {
                const lines = item
                    .split('\n')
                    .map((l) => l.trim())
                    .filter((l) => l);
                const title = lines[0] || `结果 ${index + 1}`;
                const description = lines.slice(1, 3).join(' ').substring(0, 100);
                return { title, description: description + (description.length === 100 ? '...' : '') };
            });
            if (formattedItems.length > 0) {
                return {
                    success: true,
                    type: 'extract_results',
                    items: formattedItems,
                    totalCount: formattedItems.length,
                    formatted: this.formatAsList(formattedItems),
                };
            }
        }
        if (typeof output === 'string') {
            return {
                success: true,
                type: 'text',
                content: this.cleanHtmlText(output),
            };
        }
        return result;
    }
    cleanHtmlText(text) {
        return text
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
    }
    formatAsList(items) {
        return items
            .map((item, index) => `${index + 1}. ${item.title}${item.description ? `\n   ${item.description}` : ''}`)
            .join('\n\n');
    }
    async executeAction(action) {
        console.log(`[PlanExecutor] Executing action via router: ${action.type}`);
        return await this.router.execute(action);
    }
    async executeSingleAction(action) {
        console.log(`[PlanExecutor] Executing single action via router: ${action.type}`);
        return await this.router.execute(action);
    }
    async waitForResume() {
        const TIMEOUT_MS = 300000;
        let settled = false;
        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                settled = true;
                console.warn('[PlanExecutor] waitForResume timeout after 5 minutes');
                resolve();
            }, TIMEOUT_MS);
            const check = () => {
                if (settled)
                    return;
                if (!this.paused) {
                    clearTimeout(timeoutId);
                    resolve();
                }
                else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    pause() {
        this.paused = true;
        console.log(`[PlanExecutor] Paused at node ${this.currentNodeId}`);
    }
    resume() {
        this.paused = false;
        console.log(`[PlanExecutor] Resumed`);
    }
    jumpTo(nodeId) {
        if (this.plan) {
            const nodeExists = this.plan.nodes.some((n) => n.id === nodeId);
            if (nodeExists) {
                this.currentNodeId = nodeId;
                console.log(`[PlanExecutor] Jumped to node ${nodeId}`);
            }
        }
    }
    getCurrentNodeId() {
        return this.currentNodeId;
    }
    isPaused() {
        return this.paused;
    }
    isCancelled() {
        return this.cancelled;
    }
    cancel() {
        this.cancelled = true;
        console.log(`[PlanExecutor] Cancelled`);
    }
    async cleanup() {
        this.stopScreencast();
        await this.router.cleanup();
    }
    async getScreenshot() {
        return await this.router.browserExecutor.getScreenshot();
    }
    getBrowserPage() {
        if (!this.router?.browserExecutor)
            return null;
        return this.router.browserExecutor.getPage() || null;
    }
}
export default PlanExecutor;
