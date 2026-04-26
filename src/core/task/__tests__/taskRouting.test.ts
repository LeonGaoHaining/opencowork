import { describe, expect, it } from 'vitest';
import { attachTaskRoutingToResult, resolveTaskExecutionRoute } from '../taskRouting';

describe('taskRouting', () => {
  it('defaults text-centric chat tasks to DOM execution', () => {
    const route = resolveTaskExecutionRoute({
      task: 'Summarize the open tabs',
      source: 'chat',
    });

    expect(route.executionMode).toBe('dom');
    expect(route.routeMode).toBe('dom');
    expect(route.explicit).toBe(false);
  });

  it('routes visually ambiguous tasks to visual execution', () => {
    const route = resolveTaskExecutionRoute({
      task: 'Click the menu button and continue',
      source: 'chat',
      isVisualTask: true,
    });

    expect(route.executionMode).toBe('visual');
    expect(route.routeMode).toBe('cua');
    expect(route.reason).toContain('visual interaction flow');
    expect(route.visualProviderRequirements).toMatchObject({
      builtInComputerTool: true,
      batchedActions: true,
      nativeScreenshotRequest: true,
    });
  });

  it('keeps explicit execution modes and marks them as explicit', () => {
    const route = resolveTaskExecutionRoute({
      task: 'Run the scheduled workflow',
      source: 'scheduler',
      executionMode: 'hybrid',
    });

    expect(route.executionMode).toBe('hybrid');
    expect(route.routeMode).toBe('hybrid');
    expect(route.explicit).toBe(true);
    expect(route.visualProviderRequirements).toMatchObject({
      structuredOutput: true,
      batchedActions: true,
      toolCalling: true,
      supportsReasoningControl: true,
    });
  });

  it('selects a visual provider when provider candidates are available', () => {
    const route = resolveTaskExecutionRoute({
      task: 'Click the menu button and continue',
      source: 'chat',
      executionMode: 'visual',
      visualProviders: [
        {
          id: 'alpha',
          name: 'Alpha',
          capabilities: {
            builtInComputerTool: true,
            batchedActions: true,
            nativeScreenshotRequest: true,
            structuredOutput: true,
            toolCalling: true,
            supportsReasoningControl: false,
          },
          signals: { completionRate: 0.94, costScore: 0.2, latencyScore: 18 },
        },
        {
          id: 'beta',
          name: 'Beta',
          capabilities: {
            builtInComputerTool: true,
            batchedActions: true,
            nativeScreenshotRequest: true,
            structuredOutput: true,
            toolCalling: true,
            supportsReasoningControl: true,
          },
          signals: { completionRate: 0.9, costScore: 0.15, latencyScore: 8 },
        },
      ],
      visualProviderRequirements: {
        builtInComputerTool: true,
        structuredOutput: true,
      },
    });

    expect(route.visualProvider?.id).toBe('beta');
    expect(route.visualProvider?.name).toBe('Beta');
    expect(route.visualProvider?.adapterMode).toBe('responses-computer');
    expect(typeof route.visualProvider?.score).toBe('number');
    expect(Array.isArray(route.visualProvider?.reasons)).toBe(true);
    expect(route.visualProvider?.capabilities?.builtInComputerTool).toBe(true);
    expect(route.visualProvider?.signals?.completionRate).toBe(0.9);
  });

  it('attaches routing metadata to raw result output', () => {
    const route = resolveTaskExecutionRoute({
      task: 'Open the dashboard',
      source: 'chat',
    });

    const result = attachTaskRoutingToResult(
      {
        id: 'result-1',
        summary: 'Done',
        artifacts: [],
        reusable: true,
        completedAt: 123,
      },
      route
    );

    expect(result.rawOutput).toMatchObject({
      taskRouting: route,
    });
  });
});
