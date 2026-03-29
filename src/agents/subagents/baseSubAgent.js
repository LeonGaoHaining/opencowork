/**
 * BaseSubAgent - 子 Agent 基类
 * 提供通用的 SubAgent 基础功能
 *
 * 设计原则：
 * 1. 每个 SubAgent 是一个独立的 StateGraph
 * 2. 通过 Tool 接口暴露给 Main Agent
 * 3. 使用 IPC Bridge 与实际执行器通信
 */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
export class BaseSubAgent {
    config;
    constructor(config) {
        this.config = config;
    }
    asTool() {
        return tool(async (params) => {
            try {
                const result = await this.execute(params);
                return result;
            }
            catch (error) {
                return {
                    success: false,
                    error: {
                        code: 'SUBAGENT_ERROR',
                        message: error.message || 'Execution failed',
                        recoverable: true,
                    },
                };
            }
        }, {
            name: this.config.name,
            description: this.config.description,
            schema: this.getSchema(),
        });
    }
    getName() {
        return this.config.name;
    }
    getDescription() {
        return this.config.description;
    }
}
export function createErrorResponse(error, recoverable = true) {
    return {
        success: false,
        error: {
            code: 'SUBAGENT_ERROR',
            message: error,
            recoverable,
        },
    };
}
export function createSuccessResponse(output) {
    return {
        success: true,
        output,
    };
}
export const BaseSubAgentParams = z.object({
    action: z.string(),
    params: z.any().optional(),
});
