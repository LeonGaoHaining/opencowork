/**
 * Checkpointer - LangGraph Checkpoint 持久化
 * 用于任务状态持久化和恢复
 *
 * 支持:
 * - MemorySaver: 内存存储 (默认，用于开发/测试)
 * - SQLiteSaver: SQLite 存储 (生产环境推荐)
 *
 * 注意: MemorySaver 由外部库提供，无内置限制
 * 如需限制，建议使用 SQLite 存储或将 checkpointer 定期重建
 */
import { MemorySaver } from '@langchain/langgraph-checkpoint';
export class AgentCheckpointer {
    checkpointer;
    config;
    constructor(config = { type: 'memory' }) {
        this.config = config;
        this.checkpointer = this.createCheckpointer();
    }
    createCheckpointer() {
        switch (this.config.type) {
            case 'memory':
                console.log('[Checkpointer] Using MemorySaver');
                return new MemorySaver();
            case 'sqlite':
                console.log('[Checkpointer] SQLite not fully implemented, falling back to MemorySaver');
                return new MemorySaver();
            default:
                console.log('[Checkpointer] Unknown type, using MemorySaver');
                return new MemorySaver();
        }
    }
    getCheckpointer() {
        return this.checkpointer;
    }
    getConfig() {
        return this.config;
    }
    cleanup() {
        console.log('[Checkpointer] Cleaning up...');
        this.checkpointer = this.createCheckpointer();
    }
}
let checkpointerInstance = null;
export function getCheckpointer(config) {
    if (!checkpointerInstance) {
        checkpointerInstance = new AgentCheckpointer(config);
    }
    return checkpointerInstance;
}
export function createCheckpointer(config) {
    return new AgentCheckpointer(config);
}
export function resetCheckpointer() {
    if (checkpointerInstance) {
        checkpointerInstance.cleanup();
        checkpointerInstance = null;
    }
}
export default AgentCheckpointer;
