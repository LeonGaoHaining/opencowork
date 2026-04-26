import { TaskVisualProviderSelection } from '../task/types';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function normalizeVisualProviderSelection(rawProvider: unknown): TaskVisualProviderSelection | null {
  const provider = asRecord(rawProvider);
  if (!provider) {
    return null;
  }

  const rawCapabilities = asRecord(provider.capabilities);
  const rawSignals = asRecord(provider.signals);

  return {
    id: typeof provider.id === 'string' ? provider.id : 'unknown',
    name: typeof provider.name === 'string' ? provider.name : 'Unknown provider',
    score: typeof provider.score === 'number' ? provider.score : 0,
    reasons: Array.isArray(provider.reasons)
      ? provider.reasons.filter((reason): reason is string => typeof reason === 'string')
      : [],
    adapterMode: provider.adapterMode === 'responses-computer' ? 'responses-computer' : 'chat-structured',
    capabilities: rawCapabilities
      ? {
          builtInComputerTool: rawCapabilities.builtInComputerTool === true,
          batchedActions: rawCapabilities.batchedActions === true,
          nativeScreenshotRequest: rawCapabilities.nativeScreenshotRequest === true,
          structuredOutput: rawCapabilities.structuredOutput === true,
          toolCalling: rawCapabilities.toolCalling === true,
          supportsReasoningControl: rawCapabilities.supportsReasoningControl === true,
          maxImageInputBytes:
            typeof rawCapabilities.maxImageInputBytes === 'number'
              ? rawCapabilities.maxImageInputBytes
              : undefined,
        }
      : undefined,
    signals: rawSignals
      ? {
          completionRate:
            typeof rawSignals.completionRate === 'number' ? rawSignals.completionRate : 0,
          costScore: typeof rawSignals.costScore === 'number' ? rawSignals.costScore : 0,
          latencyScore: typeof rawSignals.latencyScore === 'number' ? rawSignals.latencyScore : 0,
        }
      : undefined,
  };
}

export function resolveVisualProviderSelection(container: unknown): TaskVisualProviderSelection | null {
  const record = asRecord(container);
  if (!record) {
    return null;
  }

  const directProvider = normalizeVisualProviderSelection(record.visualProvider);
  if (directProvider) {
    return directProvider;
  }

  const routing = asRecord(record.taskRouting);
  if (!routing) {
    return null;
  }

  return normalizeVisualProviderSelection(routing.visualProvider);
}

export function resolveVisualProviderLabel(container: unknown): string | null {
  const provider = resolveVisualProviderSelection(container);
  return provider?.name || provider?.id || null;
}

export function listVisualProviderCapabilities(container: unknown): string[] {
  const provider = resolveVisualProviderSelection(container);
  if (!provider?.capabilities) {
    return [];
  }

  const capabilityLabels: Array<[boolean | undefined, string]> = [
    [provider.capabilities.builtInComputerTool, 'computer tool'],
    [provider.capabilities.batchedActions, 'batched actions'],
    [provider.capabilities.nativeScreenshotRequest, 'native screenshot'],
    [provider.capabilities.structuredOutput, 'structured output'],
    [provider.capabilities.toolCalling, 'tool calling'],
    [provider.capabilities.supportsReasoningControl, 'reasoning control'],
  ];

  return capabilityLabels
    .filter(([enabled]) => enabled)
    .map(([, label]) => label);
}
