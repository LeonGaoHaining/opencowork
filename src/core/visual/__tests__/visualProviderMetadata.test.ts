import { describe, expect, it } from 'vitest';
import {
  listVisualProviderCapabilities,
  normalizeVisualProviderSelection,
  resolveVisualProviderLabel,
  resolveVisualProviderSelection,
} from '../visualProviderMetadata';

describe('visualProviderMetadata', () => {
  it('normalizes provider metadata into the task selection shape', () => {
    const selection = normalizeVisualProviderSelection({
      id: 'responses-computer',
      name: 'Responses Computer',
      score: 87,
      reasons: ['best completion'],
      adapterMode: 'responses-computer',
      capabilities: {
        builtInComputerTool: true,
        batchedActions: true,
        nativeScreenshotRequest: true,
        structuredOutput: false,
        toolCalling: true,
        supportsReasoningControl: true,
      },
      signals: {
        completionRate: 0.87,
        costScore: 0.2,
        latencyScore: 16,
      },
    });

    expect(selection).toEqual({
      id: 'responses-computer',
      name: 'Responses Computer',
      score: 87,
      reasons: ['best completion'],
      adapterMode: 'responses-computer',
      capabilities: {
        builtInComputerTool: true,
        batchedActions: true,
        nativeScreenshotRequest: true,
        structuredOutput: false,
        toolCalling: true,
        supportsReasoningControl: true,
        maxImageInputBytes: undefined,
      },
      signals: {
        completionRate: 0.87,
        costScore: 0.2,
        latencyScore: 16,
      },
    });
  });

  it('resolves direct and routed provider metadata consistently', () => {
    const direct = resolveVisualProviderSelection({
      visualProvider: {
        id: 'chat-structured',
        name: 'Chat Structured',
        score: 73,
        reasons: [],
      },
    });

    const routed = resolveVisualProviderSelection({
      taskRouting: {
        visualProvider: {
          id: 'responses-computer',
          name: 'Responses Computer',
          score: 92,
          reasons: ['highest completion'],
          adapterMode: 'responses-computer',
        },
      },
    });

    expect(direct?.id).toBe('chat-structured');
    expect(direct?.adapterMode).toBe('chat-structured');
    expect(routed?.id).toBe('responses-computer');
    expect(resolveVisualProviderLabel({ taskRouting: { visualProvider: routed } })).toBe(
      'Responses Computer'
    );
    expect(
      listVisualProviderCapabilities({
        taskRouting: {
          visualProvider: {
            ...routed,
            capabilities: {
              builtInComputerTool: true,
              batchedActions: true,
              nativeScreenshotRequest: true,
              structuredOutput: false,
              toolCalling: true,
              supportsReasoningControl: true,
            },
          },
        },
      })
    ).toContain('computer tool');
  });
});
