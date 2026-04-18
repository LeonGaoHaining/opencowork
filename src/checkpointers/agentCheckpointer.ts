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

import { MemorySaver, BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import * as path from 'path';

export interface CheckpointerConfig {
  type: 'memory' | 'sqlite';
  dbPath?: string;
}

export class AgentCheckpointer {
  private checkpointer: BaseCheckpointSaver;
  private config: CheckpointerConfig;

  constructor(config: CheckpointerConfig = { type: 'memory' }) {
    this.config = config;
    this.checkpointer = this.createCheckpointer();
  }

  private createCheckpointer(): BaseCheckpointSaver {
    switch (this.config.type) {
      case 'memory':
        console.log('[Checkpointer] Using MemorySaver');
        return new MemorySaver();
      case 'sqlite':
        console.log('[Checkpointer] Using SqliteSaver');
        return SqliteSaver.fromConnString(
          this.config.dbPath ||
            path.join(
              process.env.HOME || process.env.USERPROFILE || '~',
              '.opencowork',
              'checkpoints.sqlite'
            )
        );
      default:
        console.log('[Checkpointer] Unknown type, using MemorySaver');
        return new MemorySaver();
    }
  }

  getCheckpointer(): BaseCheckpointSaver {
    return this.checkpointer;
  }

  getConfig(): CheckpointerConfig {
    return this.config;
  }

  cleanup(): void {
    console.log('[Checkpointer] Cleaning up...');
    this.checkpointer = this.createCheckpointer();
  }
}

let checkpointerInstance: AgentCheckpointer | null = null;

export function getCheckpointer(config?: CheckpointerConfig): AgentCheckpointer {
  if (!checkpointerInstance) {
    checkpointerInstance = new AgentCheckpointer(config);
  }
  return checkpointerInstance;
}

export function createCheckpointer(config?: CheckpointerConfig): AgentCheckpointer {
  return new AgentCheckpointer(config);
}

export function resetCheckpointer(): void {
  if (checkpointerInstance) {
    checkpointerInstance.cleanup();
    checkpointerInstance = null;
  }
}

export default AgentCheckpointer;
