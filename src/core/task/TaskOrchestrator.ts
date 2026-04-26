import { TaskResult, TaskResultError, TaskRun, TaskSource, TaskStatus, createTaskEntityId } from './types';
import { getTaskRunRepository, TaskRunRepository } from './TaskRunRepository';
import { getTaskResultRepository, TaskResultRepository } from './TaskResultRepository';

export interface TaskRunner {
  (): Promise<TaskResult>;
}

export interface StartTaskRunRequest {
  source: TaskSource;
  title?: string;
  prompt?: string;
  params?: Record<string, unknown>;
  templateId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  runId?: string;
}

export interface TaskRunStatusSnapshot {
  run: TaskRun | null;
  status: TaskStatus | 'idle';
}

export class TaskOrchestrator {
  private runs = new Map<string, TaskRun>();
  private repository: TaskRunRepository;
  private resultRepository: TaskResultRepository;

  constructor(repository: TaskRunRepository = getTaskRunRepository()) {
    this.repository = repository;
    this.resultRepository = getTaskResultRepository();
    for (const run of this.repository.list()) {
      this.runs.set(run.id, run);
    }
  }

  private persistRun(run: TaskRun): void {
    this.runs.set(run.id, run);
    this.repository.upsert(run);
  }

  startRun(request: StartTaskRunRequest): TaskRun {
    const now = Date.now();
    const run: TaskRun = {
      id: request.runId || createTaskEntityId('run'),
      source: request.source,
      status: 'planning',
      title: request.title || request.prompt || 'Untitled task',
      input: {
        prompt: request.prompt,
        params: request.params,
      },
      templateId: request.templateId,
      sessionId: request.sessionId,
      startedAt: now,
      metadata: request.metadata,
    };

    this.persistRun(run);
    return run;
  }

  updateStatus(runId: string, status: TaskStatus): TaskRun | null {
    const run = this.runs.get(runId);
    if (!run) {
      return null;
    }

    run.status = status;
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      run.endedAt = Date.now();
    }

    this.persistRun(run);
    return run;
  }

  completeRun(runId: string, result: TaskResult): TaskRun | null {
    const run = this.runs.get(runId);
    if (!run) {
      return null;
    }

    // Persist result
    try {
      this.resultRepository.save(result);
    } catch (error) {
      console.error('[TaskOrchestrator] Failed to persist result:', error);
    }

    run.status = 'completed';
    run.resultId = result.id;
    run.endedAt = result.completedAt;
    this.persistRun(run);
    return run;
  }

  updateMetadata(runId: string, metadataPatch: Record<string, unknown>): TaskRun | null {
    const run = this.runs.get(runId);
    if (!run) {
      return null;
    }

    run.metadata = {
      ...(run.metadata || {}),
      ...metadataPatch,
    };
    this.persistRun(run);
    return run;
  }

  failRun(runId: string, error: TaskResultError): TaskRun | null {
    const run = this.runs.get(runId);
    if (!run) {
      return null;
    }

    run.status = 'failed';
    run.endedAt = Date.now();
    run.metadata = {
      ...run.metadata,
      lastError: error,
    };
    this.persistRun(run);
    return run;
  }

  getRun(runId: string): TaskRun | null {
    const run = this.runs.get(runId);
    if (run) {
      return run;
    }

    const persistedRun = this.repository.getById(runId);
    if (persistedRun) {
      this.runs.set(runId, persistedRun);
    }
    return persistedRun;
  }

  pauseRun(runId: string): TaskRun | null {
    return this.updateStatus(runId, 'paused');
  }

  resumeRun(runId: string): TaskRun | null {
    return this.updateStatus(runId, 'running');
  }

  cancelRun(runId: string): TaskRun | null {
    return this.updateStatus(runId, 'cancelled');
  }

  markCompleted(runId: string): TaskRun | null {
    return this.updateStatus(runId, 'completed');
  }

  getStatusSnapshot(runId: string): TaskRunStatusSnapshot {
    const run = this.getRun(runId);
    return {
      run,
      status: run?.status || 'idle',
    };
  }

  executeRun(runId: string, runner: TaskRunner): Promise<TaskResult> {
    const run = this.runs.get(runId);
    if (!run) {
      return Promise.reject(new Error(`Run not found: ${runId}`));
    }

    this.updateStatus(runId, 'running');

    return runner()
      .then((result) => {
        this.completeRun(runId, result);
        return result;
      })
      .catch((error: unknown) => {
        const normalizedError = error as { code?: string; message?: string };
        if (normalizedError?.code === 'APPROVAL_REQUIRED') {
          this.updateStatus(runId, 'waiting_user');
          throw error;
        }

        const taskError: TaskResultError = {
          code: 'TASK_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: true,
        };
        this.failRun(runId, taskError);
        throw error;
      });
  }
}

let taskOrchestrator: TaskOrchestrator | null = null;

export function getTaskOrchestrator(): TaskOrchestrator {
  if (!taskOrchestrator) {
    taskOrchestrator = new TaskOrchestrator();
  }
  return taskOrchestrator;
}
