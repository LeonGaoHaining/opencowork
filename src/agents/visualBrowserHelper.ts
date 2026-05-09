import { getBrowserExecutor } from '../main/ipcHandlers';
import { TaskVisualProviderSelection } from '../core/task/types';
import { VisualAutomationService } from '../visual/VisualAutomationService';
import { ComputerExecutionTarget } from '../visual/runtime/ComputerExecutionAdapter';

export interface VisualBrowserTaskParams {
  task: string;
  adapterMode?: 'chat-structured' | 'responses-computer';
  maxTurns?: number;
  approvalEnabled?: boolean;
  visualProvider?: TaskVisualProviderSelection | null;
  executionTarget?: ComputerExecutionTarget | null;
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
    approvalEnabled: params.approvalEnabled,
    visualProvider: params.visualProvider || undefined,
    executionTarget: params.executionTarget || undefined,
  });
}
