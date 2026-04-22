import {
  VisualAdapterCapabilities,
  VisualAdapterSessionConfig,
  VisualSessionHandle,
  VisualTurnRequest,
  VisualTurnResponse,
} from '../types/visualProtocol';

export interface VisualModelAdapter {
  getName(): string;

  getCapabilities(): VisualAdapterCapabilities;

  createSession(config: VisualAdapterSessionConfig): Promise<VisualSessionHandle>;

  runTurn(session: VisualSessionHandle, request: VisualTurnRequest): Promise<VisualTurnResponse>;

  destroySession(session: VisualSessionHandle): Promise<void>;
}
