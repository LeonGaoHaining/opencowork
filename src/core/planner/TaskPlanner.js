import { ActionType, generateId, } from '../action/ActionSchema';
import { getLLMClient } from '../../llm/OpenAIResponses';
export class TaskPlanner {
    systemPrompt = `你是一个任务规划助手，负责将用户任务分解为可执行的步骤序列。

可用Action类型：
- browser:navigate(url) - 导航到URL
- browser:click(selector, index?, textMatch?) - 点击元素（**不是提取**）
- browser:input(selector, text, clear?, pressEnter?) - 输入文本
- browser:wait(selector, timeout?) - 等待元素出现
- browser:extract(selector, type, multiple?) - 提取页面数据（仅用于读取数据，不是点击）
- browser:screenshot(fullPage?) - 页面截图
- cli:execute(command) - 执行CLI命令
- ask:user(question, options?) - 询问用户确认

重要规则：
1. **如果任务是"点击"、"打开"、"进入"某元素，必须使用 browser:click，不是 browser:extract**
2. 每个步骤必须对应一个可执行的Action
3. 对于复杂决策点，使用 ask:user 让用户确认
4. 描述要简洁明确，便于用户理解
5. 输出必须是有效的JSON格式
6. **选择器只返回纯CSS选择器**，禁止返回中文描述或自然语言
   - ✅ 正确: "button[type='submit']", ".article-card a", "#search-input"
   - ❌ 错误: "文章列表容器内的第一个链接"、"找到搜索按钮"
7. 选择器必须精确匹配目标元素：
   - 优先使用 ID (#id) 或唯一类名
   - 使用属性选择器：[type="submit"]、[name="search"]
   - 使用 textMatch 匹配按钮文本，如 "搜索"、"登录"
   - 避免使用模糊选择器如 "button"、"input"、"a"（除非用 index 限定）
   - index 仅作为最后手段
 8. **搜索类任务**（如"搜索XX"、"在XX网站搜索XX"）：
    - 必须使用 browser:input 并指定 pressEnter: true
    - ✅ 正确: browser:input + pressEnter: true
    - ❌ 错误: browser:input + browser:click 组合
    - **搜索后必须提取结果**：搜索完成后，需要添加 browser:extract 步骤提取搜索结果，否则用户无法看到搜索内容
    - ✅ 正确: navigate → input (pressEnter) → wait → extract (multiple: true)
    - ❌ 错误: navigate → input → 完成（没有extract）
9. **点击文章/内容类任务**（如"点击第一篇文章"、"打开第二个商品"、"查看这个页面的第一个链接"）：
   - 必须先分析 pageStructure 中的 links 和 containers 信息
   - 从 links 数组中查找与任务相关的链接，根据 parentContext（如 .feeds-feed, .article-list）筛选
   - 使用 textMatch 匹配链接文本，或使用精确的嵌套选择器
   - ❌ 错误: "a[0]"、"a:first"、"button:first"
   - ✅ 正确: ".feeds-feed a[data-type='note']", ".article-item a", "div.content > a:nth-child(1)"
10. **页面结构优先**：
    - pageStructure.links 包含当前页面所有链接及其上下文信息（parentContext、index、text）
    - pageStructure.containers 包含页面主要容器
    - 优先从 links 中匹配与任务相关的元素，而非使用模糊的索引
11. **点击具体位置元素**（如"点击第N个帖子"）：
    - 优先使用 pageStructure.links 中的位置信息（y坐标）判断
    - 主要内容区的帖子通常在 y > 100 的位置（侧边栏在 y < 100）
    - 第N个帖子 = 从上到下第N个主要内容区的链接
    - 避免使用 index 索引（容易受侧边栏干扰）
    - ✅ 正确: ".feeds-feed a", "section.feed-list a"
    - ❌ 错误: "a[1]", "a:nth-child(2)", "#exploreFeeds a[1]"
12. **页面元素位置参考**：
    - pageStructure.links 包含每个链接的 boundingBox 信息（y坐标）
    - y 坐标小于 100 的通常是侧边栏/导航
    - y 坐标大于 100 的通常是主要内容区
    - 根据任务描述的"第N个"选择对应位置范围的链接
13. **提取操作注意事项**（重要！）：
    - browser:extract 用于提取页面数据（文本、HTML等）
    - 如果选择器可能匹配**多个元素**（如搜索结果、列表项），必须设置 multiple: true
    - 如果只需要**单个元素**，使用更精确的选择器（添加 :first-child 或限定具体条件）
    - 搜索结果提取示例：
      - ✅ 正确: { "type": "browser:extract", "params": { "selector": "#content_left .c-container", "type": "text", "multiple": true } }
      - ✅ 正确: { "type": "browser:extract", "params": { "selector": "#content_left .c-container:first-child", "type": "text" } }
      - ❌ 错误: { "type": "browser:extract", "params": { "selector": "#content_left .c-container", "multiple": false } } （会导致 strict mode 错误）
14. **上下文理解**（重要！）：
    - 如果用户提供的新任务需要基于之前任务的结果进行分析（如"根据之前搜索的内容分析XX"），应该：
      - 优先使用上一个任务提取的结果（previousTaskResult）进行分析
      - 如果结果足够详细，**不需要重新搜索**，直接基于已有结果进行分析
      - 如果需要更多数据，再决定是否搜索补充
    - 任务规划必须完整：
      - 如果用户要求"分析"、"总结"、"判断"，必须包含分析步骤（可以用 ask:user 或在描述中说明分析结果）
      - 不能只提取数据就结束，必须完成用户的原始意图
15. **任务完整性**：
    - 提取数据后必须完成用户的原始任务意图
    - 如果用户要求"分析"，需要在计划中添加"分析提取的内容并给出结论"的步骤
    - 如果任务涉及"判断"、"总结"，应在最后输出明确的结论

输出格式示例：
{
  "nodes": [
    {
      "id": "node1",
      "type": "action",
      "action": {
        "type": "browser:navigate",
        "description": "打开百度首页",
        "params": { "url": "https://www.baidu.com" }
      }
    }
  ],
  "edges": [
    { "from": "root", "to": "node1", "type": "always" }
  ]
}`;
    async plan(task, context) {
        console.log(`[TaskPlanner] Planning task:`, task);
        try {
            const llm = getLLMClient();
            const userPrompt = `用户任务：${task}

当前上下文：
- 当前页面：${context.currentUrl || '无'}
${context.pageStructure
                ? `- 页面标题：${context.pageStructure.title || '无'}
- 页面链接列表（按视觉位置排序）:
${context.pageStructure.links
                    ?.slice(0, 15)
                    .map((l, i) => `${i + 1}. [y=${Math.round(l.boundingBox?.y || 0)}] ${l.text?.substring(0, 40) || '无文本'} [${l.parentContext || 'unknown'}]`)
                    .join('\n') || '无'}
- 主要容器：${context.pageStructure.containers?.slice(0, 5).join(', ') || '无'}
- 推测主要内容区：${context.pageStructure.mainContentArea || '无'}`
                : `- 当前页面内容摘要：${context.currentPageContent ? context.currentPageContent.substring(0, 500) + '...' : '无'}`}
${context.conversationHistory?.length
                ? `- 会话历史：
${context.conversationHistory.map((m) => `${m.role}: ${m.content}`).join('\n')}`
                : '- 会话历史：无'}
- 可用Actions：${context.availableActions?.join(', ') || '全部'}
${context.previousResults ? `- 上一步结果：${JSON.stringify(context.previousResults)}` : ''}
${context.previousTaskResult?.formatted
                ? `- 上一个任务提取的结果（供后续任务参考）：
${context.previousTaskResult.formatted}`
                : context.previousTaskResult?.content
                    ? `- 上一个任务提取的结果（供后续任务参考）：
${context.previousTaskResult.content.substring(0, 500)}`
                    : ''}

请将任务分解为可执行的步骤序列，输出JSON格式的计划。`;
            console.log('[TaskPlanner] pageStructure in context:', {
                hasPageStructure: !!context.pageStructure,
                title: context.pageStructure?.title,
                linksCount: context.pageStructure?.links?.length,
                firstLink: context.pageStructure?.links?.[0]?.text?.substring(0, 30),
            });
            const messages = [
                { role: 'system', content: this.systemPrompt },
                { role: 'user', content: userPrompt },
            ];
            const LLM_TIMEOUT_MS = 120000;
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('LLM planning timeout after 2 minutes')), LLM_TIMEOUT_MS));
            console.log('[TaskPlanner] Calling LLM...');
            const response = await Promise.race([llm.chat(messages), timeoutPromise]);
            console.log('[TaskPlanner] LLM response:', response.content);
            const plan = this.parseLLMResponse(response.content, task);
            if (plan && plan.nodes.length > 0) {
                return plan;
            }
            console.warn('[TaskPlanner] LLM response invalid, falling back to simple decompose');
            return this.createSimplePlan(task);
        }
        catch (error) {
            console.error('[TaskPlanner] LLM planning failed:', error);
            return this.createSimplePlan(task);
        }
    }
    async replan(request) {
        console.log(`[TaskPlanner] Replanning due to:`, request.trigger);
        try {
            const llm = getLLMClient();
            const userPrompt = `任务需要重新规划。

原因：${request.trigger}
失败节点：${request.failedNodeId || '无'}
错误信息：${request.error || '无'}
当前执行状态：${JSON.stringify(request.executionState || {})}

剩余计划：${JSON.stringify(request.remainingPlan || { nodes: [] })}

请生成新的计划，输出JSON格式。`;
            const messages = [
                { role: 'system', content: this.systemPrompt },
                { role: 'user', content: userPrompt },
            ];
            const response = await llm.chat(messages);
            const newPlan = this.parseLLMResponse(response.content, '');
            if (newPlan && newPlan.nodes.length > 0) {
                return {
                    success: true,
                    newPlan,
                    message: 'Replanned successfully',
                    canContinue: true,
                };
            }
            return {
                success: false,
                message: 'Failed to parse LLM response',
                canContinue: false,
            };
        }
        catch (error) {
            console.error('[TaskPlanner] Replanning failed:', error);
            return {
                success: false,
                message: `Replanning error: ${error instanceof Error ? error.message : 'Unknown'}`,
                canContinue: false,
            };
        }
    }
    validate(plan) {
        const errors = [];
        if (!plan.id)
            errors.push('Plan must have an id');
        if (!plan.rootNodeId)
            errors.push('Plan must have a rootNodeId');
        if (plan.nodes.length === 0)
            errors.push('Plan must have at least one node');
        const nodeIds = new Set(plan.nodes.map((n) => n.id));
        for (const edge of plan.edges) {
            if (!nodeIds.has(edge.from))
                errors.push(`Edge references unknown node: ${edge.from}`);
            if (!nodeIds.has(edge.to))
                errors.push(`Edge references unknown node: ${edge.to}`);
        }
        return { valid: errors.length === 0, errors };
    }
    parseLLMResponse(content, task) {
        try {
            let jsonStr = content.trim();
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
            const parsed = JSON.parse(jsonStr);
            const nodes = [];
            const edges = [];
            if (parsed.nodes && Array.isArray(parsed.nodes)) {
                for (const node of parsed.nodes) {
                    const action = this.parseAction(node.action);
                    if (action) {
                        nodes.push({
                            id: node.id || generateId(),
                            action,
                            type: node.type || 'action',
                            metadata: {
                                description: node.action?.description || action.description,
                                canUserTakeover: true,
                            },
                        });
                    }
                }
            }
            if (parsed.edges && Array.isArray(parsed.edges)) {
                for (const edge of parsed.edges) {
                    edges.push({
                        from: edge.from || 'root',
                        to: edge.to,
                        type: edge.type || 'always',
                    });
                }
            }
            if (nodes.length === 0) {
                return null;
            }
            const rootNodeId = nodes[0].id;
            return {
                id: generateId(),
                nodes,
                edges,
                rootNodeId,
            };
        }
        catch (error) {
            console.error('[TaskPlanner] Failed to parse LLM response:', error);
            return null;
        }
    }
    parseAction(actionJson) {
        if (!actionJson)
            return null;
        const type = actionJson.type || '';
        const params = actionJson.params || {};
        const description = actionJson.description || '';
        switch (type) {
            case 'browser:navigate':
                return {
                    id: generateId(),
                    type: ActionType.BROWSER_NAVIGATE,
                    description,
                    params: {
                        url: params.url,
                        waitUntil: params.waitUntil || 'domcontentloaded',
                    },
                };
            case 'browser:click':
                return {
                    id: generateId(),
                    type: ActionType.BROWSER_CLICK,
                    description,
                    params: {
                        selector: params.selector,
                        index: params.index || 0,
                    },
                };
            case 'browser:input':
                return {
                    id: generateId(),
                    type: ActionType.BROWSER_INPUT,
                    description,
                    params: {
                        selector: params.selector,
                        text: params.text,
                        clear: params.clear !== false,
                        delay: params.delay || 0,
                        pressEnter: params.pressEnter || false,
                    },
                };
            case 'browser:wait':
                return {
                    id: generateId(),
                    type: ActionType.BROWSER_WAIT,
                    description,
                    params: {
                        selector: params.selector,
                        timeout: params.timeout || 10000,
                        state: params.state || 'visible',
                    },
                };
            case 'browser:extract':
                return {
                    id: generateId(),
                    type: ActionType.BROWSER_EXTRACT,
                    description,
                    params: {
                        selector: params.selector,
                        type: params.type || 'text',
                        multiple: params.multiple || false,
                    },
                };
            case 'browser:screenshot':
                return {
                    id: generateId(),
                    type: ActionType.BROWSER_SCREENSHOT,
                    description,
                    params: {
                        fullPage: params.fullPage || false,
                        selector: params.selector,
                    },
                };
            case 'cli:execute':
                return {
                    id: generateId(),
                    type: ActionType.CLI_EXECUTE,
                    description,
                    params: {
                        command: params.command,
                        workingDir: params.workingDir,
                        env: params.env,
                    },
                };
            case 'ask:user':
                return {
                    id: generateId(),
                    type: ActionType.ASK_USER,
                    description,
                    params: {
                        question: params.question,
                        options: params.options,
                        defaultResponse: params.defaultResponse,
                    },
                    constraints: {
                        timeout: params.timeout || 300000,
                        retries: 0,
                        requiresConfirm: true,
                    },
                };
            default:
                console.warn('[TaskPlanner] Unknown action type:', type);
                return null;
        }
    }
    createSimplePlan(task) {
        console.log('[TaskPlanner] Creating simple plan for:', task);
        const actions = this.simpleDecompose(task);
        const nodes = [];
        const edges = [];
        let prevNodeId = null;
        for (const action of actions) {
            const nodeId = generateId();
            nodes.push({
                id: nodeId,
                action,
                type: 'action',
                metadata: {
                    description: action.description,
                    canUserTakeover: true,
                },
            });
            if (prevNodeId) {
                edges.push({
                    from: prevNodeId,
                    to: nodeId,
                    type: 'success',
                });
            }
            prevNodeId = nodeId;
        }
        const rootNodeId = nodes[0]?.id || generateId();
        if (nodes.length > 0 && edges.length === 0) {
            edges.push({
                from: 'root',
                to: nodes[0].id,
                type: 'always',
            });
        }
        return {
            id: generateId(),
            nodes,
            edges,
            rootNodeId,
        };
    }
    simpleDecompose(task) {
        try {
            const taskLower = task.toLowerCase();
            const urlMap = {
                百度: 'https://www.baidu.com',
                google: 'https://www.google.com',
                谷歌: 'https://www.google.com',
                淘宝: 'https://www.taobao.com',
                天猫: 'https://www.tmall.com',
                京东: 'https://www.jd.com',
                github: 'https://github.com',
                bilibili: 'https://www.bilibili.com',
                知乎: 'https://www.zhihu.com',
            };
            if (taskLower.includes('打开') || taskLower.includes('导航') || taskLower.includes('访问')) {
                const urlMatch = task.match(/https?:\/\/[^\s]+/);
                if (urlMatch) {
                    return [
                        {
                            id: generateId(),
                            type: ActionType.BROWSER_NAVIGATE,
                            description: `导航到 ${urlMatch[0]}`,
                            params: { url: urlMatch[0], waitUntil: 'domcontentloaded' },
                        },
                    ];
                }
                for (const [keyword, url] of Object.entries(urlMap)) {
                    if (taskLower.includes(keyword)) {
                        return [
                            {
                                id: generateId(),
                                type: ActionType.BROWSER_NAVIGATE,
                                description: `导航到 ${keyword}`,
                                params: { url, waitUntil: 'domcontentloaded' },
                            },
                        ];
                    }
                }
            }
            return [];
        }
        catch (error) {
            console.error('[TaskPlanner] simpleDecompose error:', error);
            return [];
        }
    }
}
export default TaskPlanner;
