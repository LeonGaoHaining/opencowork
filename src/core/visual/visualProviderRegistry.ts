import { VisualAdapterCapabilities } from '../../visual/types/visualProtocol';
import { ChatCompletionsVisualAdapter } from '../../visual/adapters/ChatCompletionsVisualAdapter';
import { ResponsesVisualAdapter } from '../../visual/adapters/ResponsesVisualAdapter';

export interface ProviderSignals {
  completionRate: number;
  costScore: number;
  latencyScore: number;
}

export interface VisualProviderDescriptor {
  id: string;
  name: string;
  capabilities: VisualAdapterCapabilities;
  signals: ProviderSignals;
  tags?: string[];
}

export interface ProviderRoutingRequirements {
  builtInComputerTool?: boolean;
  batchedActions?: boolean;
  nativeScreenshotRequest?: boolean;
  structuredOutput?: boolean;
  toolCalling?: boolean;
  supportsReasoningControl?: boolean;
  maxImageInputBytes?: number;
}

export interface ProviderRoutingResult {
  provider: VisualProviderDescriptor | null;
  score: number;
  reasons: string[];
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function satisfiesRequirements(
  capabilities: VisualAdapterCapabilities,
  requirements: ProviderRoutingRequirements
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];

  const booleanChecks: Array<[keyof ProviderRoutingRequirements, keyof VisualAdapterCapabilities, string]> = [
    ['builtInComputerTool', 'builtInComputerTool', 'builtInComputerTool required'],
    ['batchedActions', 'batchedActions', 'batchedActions required'],
    ['nativeScreenshotRequest', 'nativeScreenshotRequest', 'nativeScreenshotRequest required'],
    ['structuredOutput', 'structuredOutput', 'structuredOutput required'],
    ['toolCalling', 'toolCalling', 'toolCalling required'],
    ['supportsReasoningControl', 'supportsReasoningControl', 'supportsReasoningControl required'],
  ];

  for (const [requirementKey, capabilityKey, reasonLabel] of booleanChecks) {
    if (requirements[requirementKey] === true && capabilities[capabilityKey] !== true) {
      reasons.push(reasonLabel);
    }
  }

  if (
    typeof requirements.maxImageInputBytes === 'number' &&
    typeof capabilities.maxImageInputBytes === 'number' &&
    capabilities.maxImageInputBytes < requirements.maxImageInputBytes
  ) {
    reasons.push('maxImageInputBytes too small');
  }

  return { ok: reasons.length === 0, reasons };
}

export function scoreVisualProvider(
  provider: VisualProviderDescriptor,
  requirements: ProviderRoutingRequirements = {}
): ProviderRoutingResult {
  const requirementCheck = satisfiesRequirements(provider.capabilities, requirements);
  if (!requirementCheck.ok) {
    return { provider: null, score: Number.NEGATIVE_INFINITY, reasons: requirementCheck.reasons };
  }

  const capabilityMatches = [
    provider.capabilities.builtInComputerTool,
    provider.capabilities.batchedActions,
    provider.capabilities.nativeScreenshotRequest,
    provider.capabilities.structuredOutput,
    provider.capabilities.toolCalling,
    provider.capabilities.supportsReasoningControl,
  ].filter(Boolean).length;

  const capabilityBonus = capabilityMatches * 8;
  const completionBonus = provider.signals.completionRate * 100;
  const costPenalty = provider.signals.costScore * 12;
  const latencyPenalty = provider.signals.latencyScore;
  const score = completionBonus + capabilityBonus - costPenalty - latencyPenalty;
  const reasons = [
    `completion ${Math.round(provider.signals.completionRate * 100)}%`,
    `cost ${formatScore(provider.signals.costScore)}`,
    `latency ${formatScore(provider.signals.latencyScore)}`,
    `capability bonus ${capabilityBonus}`,
  ];

  if (requirements.builtInComputerTool) {
    reasons.push('meets built-in computer tool requirement');
  }
  if (requirements.structuredOutput) {
    reasons.push('meets structured output requirement');
  }
  if (requirements.toolCalling) {
    reasons.push('meets tool-calling requirement');
  }
  if (requirements.supportsReasoningControl) {
    reasons.push('meets reasoning-control requirement');
  }
  if (typeof requirements.maxImageInputBytes === 'number') {
    reasons.push(`supports image budget ${requirements.maxImageInputBytes}`);
  }

  return {
    provider,
    score,
    reasons,
  };
}

export function selectBestVisualProvider(
  providers: VisualProviderDescriptor[],
  requirements: ProviderRoutingRequirements = {}
): ProviderRoutingResult {
  const scored = providers.map((provider) => scoreVisualProvider(provider, requirements));
  const eligible = scored.filter((entry) => entry.provider !== null);

  if (eligible.length === 0) {
    return { provider: null, score: Number.NEGATIVE_INFINITY, reasons: ['no eligible providers'] };
  }

  eligible.sort((a, b) => b.score - a.score || a.provider!.id.localeCompare(b.provider!.id));
  return {
    ...eligible[0],
    reasons: [...eligible[0].reasons, `selected provider ${eligible[0].provider!.name}`],
  };
}

export class VisualCapabilityRegistry {
  private readonly providers = new Map<string, VisualProviderDescriptor>();

  register(provider: VisualProviderDescriptor): void {
    this.providers.set(provider.id, provider);
  }

  registerMany(providers: VisualProviderDescriptor[]): void {
    for (const provider of providers) {
      this.register(provider);
    }
  }

  get(id: string): VisualProviderDescriptor | undefined {
    return this.providers.get(id);
  }

  list(): VisualProviderDescriptor[] {
    return Array.from(this.providers.values());
  }
}

let defaultVisualCapabilityRegistry: VisualCapabilityRegistry | null = null;

export function getDefaultVisualCapabilityRegistry(): VisualCapabilityRegistry {
  if (!defaultVisualCapabilityRegistry) {
    defaultVisualCapabilityRegistry = new VisualCapabilityRegistry();
    defaultVisualCapabilityRegistry.registerMany(getDefaultVisualProviders());
  }

  return defaultVisualCapabilityRegistry;
}

export function getDefaultVisualProviders(): VisualProviderDescriptor[] {
  return [
    {
      id: 'responses-computer',
      name: 'Responses Computer',
      capabilities: new ResponsesVisualAdapter().getCapabilities(),
      signals: {
        completionRate: 0.94,
        costScore: 0.18,
        latencyScore: 14,
      },
      tags: ['default', 'computer-use'],
    },
    {
      id: 'chat-structured',
      name: 'Chat Structured',
      capabilities: new ChatCompletionsVisualAdapter().getCapabilities(),
      signals: {
        completionRate: 0.9,
        costScore: 0.12,
        latencyScore: 22,
      },
      tags: ['default', 'structured'],
    },
  ];
}
