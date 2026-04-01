/**
 * 短期记忆
 * 位置: src/memory/shortTermMemory.ts
 *
 * 功能: 记录成功/失败轨迹，用于学习
 * 存储: 仅内存，不持久化
 */

import { AnyAction, ActionResult } from '../core/action/ActionSchema';
import { UIGraph } from '../types/uiElement';
import { RecoveryStrategy } from '../recovery/recoveryEngine';

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: 'action' | 'navigation' | 'extraction' | 'error' | 'recovery';
  action?: AnyAction;
  result?: ActionResult;
  pageUrl?: string;
  pageTitle?: string;
  uiGraph?: UIGraph;
  error?: {
    code: string;
    message: string;
    recoveryStrategy?: RecoveryStrategy;
  };
  nodeId?: string;
  nodeDescription?: string;
}

export interface TrajectorySegment {
  id: string;
  task: string;
  entries: MemoryEntry[];
  startTime: number;
  endTime?: number;
  success?: boolean;
}

export class ShortTermMemory {
  private entries: MemoryEntry[] = [];
  private trajectories: TrajectorySegment[] = [];
  private currentTrajectory: TrajectorySegment | null = null;
  private maxEntries: number = 200;
  private maxTrajectories: number = 50;

  startTrajectory(task: string): string {
    const id = `traj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentTrajectory = {
      id,
      task,
      entries: [],
      startTime: Date.now(),
    };
    console.log(`[Memory] Started trajectory: ${id}, task: ${task}`);
    return id;
  }

  addEntry(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): string {
    const fullEntry: MemoryEntry = {
      ...entry,
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.entries.push(fullEntry);

    if (this.currentTrajectory) {
      this.currentTrajectory.entries.push(fullEntry);
    }

    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    return fullEntry.id;
  }

  endTrajectory(success?: boolean): void {
    if (this.currentTrajectory) {
      this.currentTrajectory.endTime = Date.now();
      this.currentTrajectory.success = success;
      this.trajectories.push(this.currentTrajectory);
      console.log(`[Memory] Ended trajectory: ${this.currentTrajectory.id}, success: ${success}`);
      this.currentTrajectory = null;
    }

    if (this.trajectories.length > this.maxTrajectories) {
      this.trajectories = this.trajectories.slice(-this.maxTrajectories);
    }
  }

  recordAction(action: AnyAction, result: ActionResult, pageUrl?: string, nodeId?: string): void {
    this.addEntry({
      type: result.success ? 'action' : 'error',
      action,
      result,
      pageUrl,
      nodeId,
      error: result.success
        ? undefined
        : {
            code: result.error?.code || 'UNKNOWN',
            message: result.error?.message || 'Unknown error',
          },
    });
  }

  recordError(
    error: { code: string; message: string },
    context: {
      action?: AnyAction;
      pageUrl?: string;
      nodeId?: string;
      recoveryStrategy?: RecoveryStrategy;
    }
  ): void {
    this.addEntry({
      type: 'error',
      action: context.action,
      error: {
        code: error.code,
        message: error.message,
        recoveryStrategy: context.recoveryStrategy,
      },
      pageUrl: context.pageUrl,
      nodeId: context.nodeId,
    });
  }

  findSimilarAction(
    targetAction: Partial<AnyAction>,
    maxResults: number = 3
  ): { entry: MemoryEntry; similarity: number }[] {
    const results: { entry: MemoryEntry; similarity: number }[] = [];

    for (const entry of this.entries) {
      if (!entry.action || entry.type !== 'action') continue;

      const similarity = this.calculateSimilarity(entry.action, targetAction);
      if (similarity > 0.3) {
        results.push({ entry, similarity });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, maxResults);
  }

  getRecentErrors(count: number = 5): MemoryEntry[] {
    return this.entries
      .filter((e) => e.type === 'error')
      .slice(-count)
      .reverse();
  }

  getFailedSelectors(): string[] {
    const selectors: string[] = [];

    for (const entry of this.entries) {
      if (entry.type === 'error' && entry.action?.type === 'browser:click') {
        const selector = (entry.action.params as any)?.selector;
        if (selector) selectors.push(selector);
      }
    }

    return [...new Set(selectors)];
  }

  getLastSuccessfulEntry(): MemoryEntry | null {
    const entries = [...this.entries].reverse();
    return entries.find((e) => e.type === 'action' && e.result?.success) || null;
  }

  getMemorySnapshot(): {
    entryCount: number;
    trajectoryCount: number;
    recentErrors: MemoryEntry[];
    lastUrl: string | null;
  } {
    return {
      entryCount: this.entries.length,
      trajectoryCount: this.trajectories.length,
      recentErrors: this.getRecentErrors(3),
      lastUrl:
        this.entries.length > 0 ? this.entries[this.entries.length - 1].pageUrl || null : null,
    };
  }

  private calculateSimilarity(a: AnyAction, b: Partial<AnyAction>): number {
    if (a.type !== b.type) return 0;

    let score = 0.5;
    const aParams = a.params as any;
    const bParams = b.params as any;

    if (aParams?.selector && bParams?.selector) {
      score += aParams.selector === bParams.selector ? 0.3 : 0;
    }

    if (aParams?.text && bParams?.text) {
      score += aParams.text === bParams.text ? 0.2 : 0;
    }

    return Math.min(score, 1);
  }

  clear(): void {
    this.entries = [];
    this.trajectories = [];
    this.currentTrajectory = null;
    console.log('[Memory] Cleared all entries');
  }

  cleanup(): void {
    this.clear();
    console.log('[ShortTermMemory] Cleaned up');
  }
}
