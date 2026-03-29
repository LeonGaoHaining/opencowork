import { TaskHistoryRecord, HistoryQueryOptions } from './taskHistory';

export interface HistoryAPI {
  'GET /history': {
    query: HistoryQueryOptions;
    response: { tasks: TaskHistoryRecord[]; total: number };
  };

  'GET /history/:id': {
    params: { id: string };
    response: TaskHistoryRecord;
  };

  'POST /history/:id/replay': {
    params: { id: string };
    response: { taskId: string; status: 'started' };
  };

  'DELETE /history/:id': {
    params: { id: string };
    response: { success: boolean };
  };
}

export type HistoryEndpoint = keyof HistoryAPI;
export type HistoryRequest<E extends HistoryEndpoint> = HistoryAPI[E] extends { query: infer Q }
  ? { query: Q }
  : HistoryAPI[E] extends { params: infer P }
    ? { params: P }
    : never;
export type HistoryResponse<E extends HistoryEndpoint> = HistoryAPI[E]['response'];
