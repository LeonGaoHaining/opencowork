import { describe, expect, it, vi } from 'vitest';

vi.mock('../../main/ipcHandlers', () => ({
  getBrowserExecutor: vi.fn(),
}));

import { executeVisualBrowserTask } from '../visualBrowserHelper';

describe('visualBrowserHelper', () => {
  it('delegates visual browser execution to the visual automation service', async () => {
    const runVisualTask = vi.fn(async () => ({
      success: true,
      adapter: 'chat-completions-visual',
      adapterMode: 'chat-structured',
      model: 'test-model',
      routeReason: 'visual-runtime',
      maxTurns: 5,
      finalMessage: 'Visual task completed',
      turns: [{ turnId: 'turn-1', duration: 100 }],
    }));

    const result = await executeVisualBrowserTask(
      {
        task: 'Open the menu and click the publish button',
        adapterMode: 'chat-structured',
        maxTurns: 5,
      },
      () => ({ runVisualTask })
    );

    expect(runVisualTask).toHaveBeenCalledWith({
      task: 'Open the menu and click the publish button',
      adapterMode: 'chat-structured',
      maxTurns: 5,
    });
    expect(result.success).toBe(true);
    expect(result.finalMessage).toBe('Visual task completed');
  });

  it('preserves approval-required responses for the caller to handle', async () => {
    const runVisualTask = vi.fn(async () => ({
      success: false,
      adapter: 'responses-visual',
      adapterMode: 'responses-computer',
      model: 'test-model',
      routeReason: 'visual-runtime',
      maxTurns: 6,
      error: {
        code: 'APPROVAL_REQUIRED',
        message: 'Approval required before executing visual actions',
        recoverable: true,
      },
      pendingApproval: {
        actions: [{ type: 'click', x: 10, y: 20 }],
        reason: 'Approval required before executing visual actions',
        taskContext: {
          task: 'Click publish button',
          page: {},
        },
      },
      turns: [],
    }));

    const result = await executeVisualBrowserTask(
      {
        task: 'Click publish button',
        adapterMode: 'responses-computer',
      },
      () => ({ runVisualTask })
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('APPROVAL_REQUIRED');
    expect(result.pendingApproval?.actions).toHaveLength(1);
  });
});
