import { getBrowserExecutor } from '../main/ipcHandlers';
import { VisualAutomationService } from '../visual/VisualAutomationService';

export interface VisualBrowserTaskParams {
  task: string;
  adapterMode?: 'chat-structured' | 'responses-computer';
  maxTurns?: number;
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
    adapterMode: params.adapterMode,
    maxTurns: params.maxTurns,
  });
}
