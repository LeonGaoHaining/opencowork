import { createTaskEntityId } from '../task/types';
import { getBenchmarkRunRepository } from './BenchmarkRunRepository';
import { getBenchmarkSuiteRunRepository } from './BenchmarkSuiteRunRepository';
import { BenchmarkRunOutcome, BenchmarkRunService, StartTaskFn } from './BenchmarkRunService';
import { BenchmarkSuiteRunRecord, BenchmarkTask, BenchmarkTaskSet } from './types';
import { getBenchmarkTaskRepository } from './BenchmarkTaskRepository';
import { TaskOrchestrator } from '../task/TaskOrchestrator';
import { TaskResultRepository } from '../task/TaskResultRepository';

export interface BenchmarkSuiteRunOptions {
  suite: BenchmarkTaskSet;
  benchmarkTasks?: BenchmarkTask[];
  startTask: StartTaskFn;
  orchestrator: TaskOrchestrator;
  resultRepository: TaskResultRepository;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface BenchmarkSuiteRunOutcome {
  record: BenchmarkSuiteRunRecord;
  benchmarkOutcomes: BenchmarkRunOutcome[];
}

function createEmptySummary() {
  return { total: 0, passed: 0, failed: 0, timeout: 0 };
}

export class BenchmarkSuiteRunService {
  private readonly benchmarkRunService = new BenchmarkRunService();

  private persist(record: BenchmarkSuiteRunRecord): void {
    try {
      getBenchmarkSuiteRunRepository().upsert(record);
    } catch (error) {
      console.error('[BenchmarkSuiteRunService] Failed to persist suite run:', error);
    }
  }

  async run(options: BenchmarkSuiteRunOptions): Promise<BenchmarkSuiteRunOutcome> {
    const benchmarkRepository = getBenchmarkTaskRepository();
    const benchmarkTaskMap = new Map<string, BenchmarkTask>(
      (options.benchmarkTasks || benchmarkRepository.list()).map((task) => [task.id, task])
    );
    const record: BenchmarkSuiteRunRecord = {
      id: createTaskEntityId('benchmark-suite-run'),
      benchmarkTaskSetId: options.suite.id,
      benchmarkTaskSetName: options.suite.name,
      status: 'running',
      startedAt: Date.now(),
      summary: createEmptySummary(),
      benchmarkRunIds: [],
      benchmarkRuns: [],
    };

    this.persist(record);

    const benchmarkOutcomes: BenchmarkRunOutcome[] = [];
    for (const benchmarkId of options.suite.benchmarkIds) {
      const benchmark = benchmarkTaskMap.get(benchmarkId);
      record.summary.total += 1;

      if (!benchmark) {
        record.summary.failed += 1;
        record.benchmarkRuns.push({
          id: createTaskEntityId('benchmark-run'),
          benchmarkTaskId: benchmarkId,
          benchmarkTaskName: benchmarkId,
          runId: '',
          status: 'failed',
          startedAt: Date.now(),
          completedAt: Date.now(),
          durationMs: 0,
          error: `Benchmark not found: ${benchmarkId}`,
        });
        this.persist(record);
        continue;
      }

      const outcome = await this.benchmarkRunService.run({
        benchmark,
        startTask: options.startTask,
        orchestrator: options.orchestrator,
        resultRepository: options.resultRepository,
        timeoutMs: options.timeoutMs,
        pollIntervalMs: options.pollIntervalMs,
      });

      benchmarkOutcomes.push(outcome);
      record.benchmarkRuns.push(outcome.record);
      record.benchmarkRunIds.push(outcome.record.id);

      if (outcome.record.status === 'completed' && outcome.record.evaluation?.passed) {
        record.summary.passed += 1;
      } else if (outcome.record.status === 'timeout') {
        record.summary.timeout += 1;
      } else {
        record.summary.failed += 1;
      }

      this.persist(record);
    }

    record.status = record.summary.failed === 0 && record.summary.timeout === 0 ? 'completed' : 'failed';
    record.completedAt = Date.now();
    record.durationMs = record.completedAt - record.startedAt;
    this.persist(record);

    return {
      record,
      benchmarkOutcomes,
    };
  }
}
