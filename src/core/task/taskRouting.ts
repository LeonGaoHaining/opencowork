import { HybridToolRouter, HybridRouteDecision } from '../../visual';
import {
  ProviderRoutingRequirements,
  getDefaultVisualCapabilityRegistry,
  selectBestVisualProvider,
  VisualProviderDescriptor,
} from '../visual/visualProviderRegistry';
import { TaskResult, TaskSource, TaskVisualProviderSelection } from './types';

export type TaskExecutionMode = 'dom' | 'visual' | 'hybrid';

export interface TaskExecutionRoute {
  routeMode: HybridRouteDecision['mode'];
  executionMode: TaskExecutionMode;
  reason: string;
  explicit: boolean;
  source: TaskSource;
  visualProviderRequirements?: ProviderRoutingRequirements | null;
  visualProvider?: TaskVisualProviderSelection | null;
}

export interface ResolveTaskExecutionRouteInput {
  task: string;
  source: TaskSource;
  executionMode?: TaskExecutionMode;
  hasPriorDomFailure?: boolean;
  isVisualTask?: boolean;
  requiresStrictExtraction?: boolean;
  visualProviders?: VisualProviderDescriptor[];
  visualProviderRequirements?: ProviderRoutingRequirements;
}

const hybridToolRouter = new HybridToolRouter();

function deriveVisualProviderRequirements(
  routeMode: HybridRouteDecision['mode'],
  input: ResolveTaskExecutionRouteInput
): ProviderRoutingRequirements {
  const derived: ProviderRoutingRequirements = {};

  if (routeMode === 'cua') {
    derived.builtInComputerTool = true;
    derived.batchedActions = true;
    derived.nativeScreenshotRequest = true;
  }

  if (routeMode === 'hybrid') {
    derived.structuredOutput = true;
    derived.batchedActions = true;
    derived.toolCalling = true;
    derived.supportsReasoningControl = true;
  }

  if (/screenshot|截图|image|图像/i.test(input.task)) {
    derived.maxImageInputBytes = 1024 * 1024;
  }

  return {
    ...derived,
    ...(input.visualProviderRequirements || {}),
  };
}

function mapRouteModeToExecutionMode(routeMode: HybridRouteDecision['mode']): TaskExecutionMode {
  if (routeMode === 'dom') {
    return 'dom';
  }

  if (routeMode === 'hybrid') {
    return 'hybrid';
  }

  return 'visual';
}

function wrapRawOutput(rawOutput: unknown, routing: TaskExecutionRoute): unknown {
  if (rawOutput && typeof rawOutput === 'object' && !Array.isArray(rawOutput)) {
    return {
      ...(rawOutput as Record<string, unknown>),
      taskRouting: routing,
    };
  }

  return {
    value: rawOutput,
    taskRouting: routing,
  };
}

function resolveVisualProvider(
  providers: VisualProviderDescriptor[] | undefined,
  requirements: ProviderRoutingRequirements | undefined
): TaskExecutionRoute['visualProvider'] {
  const candidates =
    providers && providers.length > 0 ? providers : getDefaultVisualCapabilityRegistry().list();
  const selection = selectBestVisualProvider(candidates, requirements);
  if (!selection.provider) {
    return null;
  }

  return {
    id: selection.provider.id,
    name: selection.provider.name,
    score: selection.score,
    reasons: selection.reasons,
    adapterMode: selection.provider.capabilities.builtInComputerTool ? 'responses-computer' : 'chat-structured',
    capabilities: selection.provider.capabilities,
    signals: selection.provider.signals,
  };
}

export function resolveTaskExecutionRoute(
  input: ResolveTaskExecutionRouteInput
): TaskExecutionRoute {
  if (input.executionMode) {
    const routeMode = input.executionMode === 'dom' ? 'dom' : input.executionMode === 'hybrid' ? 'hybrid' : 'cua';
    const visualProviderRequirements =
      input.executionMode === 'dom' ? null : deriveVisualProviderRequirements(routeMode, input);

    return {
      routeMode,
      executionMode: input.executionMode,
      reason: `Explicit execution mode provided: ${input.executionMode}`,
      explicit: true,
      source: input.source,
      visualProviderRequirements,
      visualProvider:
        input.executionMode === 'dom'
          ? null
          : resolveVisualProvider(input.visualProviders, visualProviderRequirements || undefined),
    };
  }

  const decision = hybridToolRouter.decide({
    task: input.task,
    hasPriorDomFailure: input.hasPriorDomFailure,
    isVisualTask: input.isVisualTask,
    requiresStrictExtraction: input.requiresStrictExtraction,
  });
  const visualProviderRequirements =
    decision.mode === 'dom' ? null : deriveVisualProviderRequirements(decision.mode, input);

  return {
    routeMode: decision.mode,
    executionMode: mapRouteModeToExecutionMode(decision.mode),
    reason: decision.reason,
    explicit: false,
    source: input.source,
    visualProviderRequirements,
    visualProvider:
      decision.mode === 'dom'
        ? null
        : resolveVisualProvider(input.visualProviders, visualProviderRequirements || undefined),
  };
}

export function attachTaskRoutingToResult(result: TaskResult, routing: TaskExecutionRoute): TaskResult {
  return {
    ...result,
    rawOutput: wrapRawOutput(result.rawOutput, routing),
  };
}
