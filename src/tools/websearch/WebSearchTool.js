/**
 * WebSearchTool - 网页搜索工具
 * 基于 Exa AI MCP 的实时网页搜索
 */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
const API_CONFIG = {
    BASE_URL: 'https://mcp.exa.ai',
    ENDPOINTS: {
        SEARCH: '/mcp',
    },
    DEFAULT_NUM_RESULTS: 8,
};
function log(level, message, meta) {
    const prefix = '[WebSearch]';
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} ${prefix} ${message}`;
    if (level === 'error') {
        console.error(logMessage, meta || '');
    }
    else if (level === 'warn') {
        console.warn(logMessage, meta || '');
    }
    else {
        console.log(logMessage, meta || '');
    }
}
export const websearchTool = tool(async (params) => {
    const startTime = Date.now();
    log('info', 'Starting websearch', { query: params.query, numResults: params.numResults });
    const searchRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
            name: 'web_search_exa',
            arguments: {
                query: params.query,
                type: params.type || 'auto',
                numResults: params.numResults || API_CONFIG.DEFAULT_NUM_RESULTS,
                livecrawl: params.livecrawl || 'fallback',
                contextMaxCharacters: params.contextMaxCharacters,
            },
        },
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    try {
        const headers = {
            accept: 'application/json, text/event-stream',
            'content-type': 'application/json',
        };
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SEARCH}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(searchRequest),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            const errorText = await response.text();
            log('error', 'Search API error', { status: response.status, error: errorText });
            return {
                success: false,
                error: {
                    code: 'SEARCH_ERROR',
                    message: `Search error (${response.status}): ${errorText}`,
                },
            };
        }
        const responseText = await response.text();
        const lines = responseText.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.substring(6));
                    if (data.result && data.result.content && data.result.content.length > 0) {
                        const duration = Date.now() - startTime;
                        log('info', 'Search completed', { query: params.query, duration });
                        return {
                            success: true,
                            title: `Web search: ${params.query}`,
                            output: data.result.content[0].text,
                            metadata: {},
                        };
                    }
                }
                catch {
                    continue;
                }
            }
        }
        const duration = Date.now() - startTime;
        log('info', 'No search results', { query: params.query, duration });
        return {
            success: true,
            title: `Web search: ${params.query}`,
            output: 'No search results found. Please try a different query.',
            metadata: {},
        };
    }
    catch (error) {
        clearTimeout(timeoutId);
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (error.name === 'AbortError') {
            log('error', 'Search timeout', { query: params.query });
            return {
                success: false,
                error: { code: 'SEARCH_TIMEOUT', message: 'Search request timed out' },
            };
        }
        log('error', 'Search failed', { query: params.query, error: errorMessage });
        return { success: false, error: { code: 'SEARCH_ERROR', message: errorMessage } };
    }
}, {
    name: 'websearch',
    description: 'Search the web using Exa AI - performs real-time web searches and can scrape content from specific URLs. Provides up-to-date information for current events and recent data.',
    schema: z.object({
        query: z.string().describe('Websearch query'),
        numResults: z.number().default(8).describe('Number of search results to return'),
        livecrawl: z
            .enum(['fallback', 'preferred'])
            .default('fallback')
            .describe("Live crawl mode: 'fallback' or 'preferred'"),
        type: z
            .enum(['auto', 'fast', 'deep'])
            .default('auto')
            .describe("Search type: 'auto', 'fast', or 'deep'"),
        contextMaxCharacters: z
            .number()
            .default(10000)
            .describe('Maximum characters for context string'),
    }),
});
