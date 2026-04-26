import { getBrowserExecutor } from '../main/ipcHandlers';
import { TaskVisualProviderSelection } from '../core/task/types';
import { VisualAutomationService } from '../visual/VisualAutomationService';

export interface VisualBrowserTaskParams {
  task: string;
  adapterMode?: 'chat-structured' | 'responses-computer';
  maxTurns?: number;
  visualProvider?: TaskVisualProviderSelection | null;
}

export function resolveVisualAdapterMode(
  executionMode?: 'dom' | 'visual' | 'hybrid',
  visualProvider?: VisualBrowserTaskParams['visualProvider']
): 'chat-structured' | 'responses-computer' | undefined {
  if (visualProvider?.adapterMode) {
    return visualProvider.adapterMode;
  }

  if (executionMode === 'visual' || executionMode === 'hybrid') {
    return 'chat-structured';
  }

  return undefined;
}

export interface VisualBrowserServiceLike {
  runVisualTask: (params: VisualBrowserTaskParams) => Promise<any>;
}

export async function executeVisualBrowserTask(
  params: VisualBrowserTaskParams,
  serviceFactory: () => VisualBrowserServiceLike = () => new VisualAutomationService(getBrowserExecutor())
): Promise<any> {
  const service = serviceFactory();
  return service.runVisualTask({
    task: params.task,
    adapterMode: params.adapterMode || params.visualProvider?.adapterMode,
    maxTurns: params.maxTurns,
    visualProvider: params.visualProvider || undefined,
  });
}
