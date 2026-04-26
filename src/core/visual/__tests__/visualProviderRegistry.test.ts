import { describe, expect, it } from 'vitest';
import {
  VisualCapabilityRegistry,
  getDefaultVisualCapabilityRegistry,
  selectBestVisualProvider,
  scoreVisualProvider,
} from '../visualProviderRegistry';

describe('visualProviderRegistry', () => {
  const providers = [
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
  ];

  it('selects the best eligible provider by routing score', () => {
    const result = selectBestVisualProvider(providers, {
      builtInComputerTool: true,
      structuredOutput: true,
    });

    expect(result.provider?.id).toBe('beta');
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons).toContain('meets built-in computer tool requirement');
    expect(result.reasons).toContain('selected provider Beta');
  });

  it('rejects providers missing required capabilities', () => {
    const result = scoreVisualProvider(providers[0], {
      supportsReasoningControl: true,
    });

    expect(result.provider).toBeNull();
    expect(result.reasons).toContain('supportsReasoningControl required');
  });

  it('stores and lists providers in the capability registry', () => {
    const registry = new VisualCapabilityRegistry();
    registry.registerMany(providers);

    expect(registry.get('alpha')?.name).toBe('Alpha');
    expect(registry.list()).toHaveLength(2);
  });

  it('exposes a reusable default capability registry', () => {
    const registry = getDefaultVisualCapabilityRegistry();

    expect(registry.list().length).toBeGreaterThanOrEqual(2);
    expect(registry.get('responses-computer')?.name).toBe('Responses Computer');
  });
});
