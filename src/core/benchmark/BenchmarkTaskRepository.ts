import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  BenchmarkTask,
  BenchmarkTaskCategory,
  BenchmarkTaskExecutionConfig,
  BenchmarkTaskExpectedOutcome,
  BenchmarkTaskInitialState,
} from './types';

type RawBenchmarkTask = Partial<BenchmarkTask> & {
  category?: unknown;
  expectedOutcome?: unknown;
  initialState?: unknown;
  executionConfig?: unknown;
  tags?: unknown;
};

const DEFAULT_BENCHMARK_DIR = path.join(process.cwd(), 'src', 'benchmarks');
const BENCHMARK_FILE_PATTERN = /\.(ya?ml|json)$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter((item): item is string => typeof item === 'string');
  return items.length > 0 ? items : undefined;
}

function normalizeExpectedOutcome(value: unknown): BenchmarkTaskExpectedOutcome | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    successKeywords: toStringArray(value.successKeywords),
    minArtifacts: typeof value.minArtifacts === 'number' ? value.minArtifacts : undefined,
    structuredDataSchema: isRecord(value.structuredDataSchema) ? value.structuredDataSchema : undefined,
    targetUrl: typeof value.targetUrl === 'string' ? value.targetUrl : undefined,
  };
}

function normalizeInitialState(value: unknown): BenchmarkTaskInitialState | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const initialState: BenchmarkTaskInitialState = {};
  if (typeof value.initialUrl === 'string') {
    initialState.initialUrl = value.initialUrl;
  }
  if (isRecord(value.localStorage)) {
    initialState.localStorage = Object.fromEntries(
      Object.entries(value.localStorage).filter(([, item]) => typeof item === 'string') as Array<[
        string,
        string
      ]>
    );
  }
  if (isRecord(value.sessionStorage)) {
    initialState.sessionStorage = Object.fromEntries(
      Object.entries(value.sessionStorage).filter(([, item]) => typeof item === 'string') as Array<[
        string,
        string
      ]>
    );
  }
  return Object.keys(initialState).length > 0 ? initialState : undefined;
}

function normalizeExecutionConfig(value: unknown): BenchmarkTaskExecutionConfig | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const executionConfig: BenchmarkTaskExecutionConfig = {};
  const executionMode = value.executionMode;
  if (executionMode === 'dom' || executionMode === 'visual' || executionMode === 'hybrid') {
    executionConfig.executionMode = executionMode;
  }
  if (typeof value.maxTurns === 'number') {
    executionConfig.maxTurns = value.maxTurns;
  }
  if (value.adapterMode === 'chat-structured' || value.adapterMode === 'responses-computer') {
    executionConfig.adapterMode = value.adapterMode;
  }

  return Object.keys(executionConfig).length > 0 ? executionConfig : undefined;
}

function normalizeCategory(value: unknown): BenchmarkTaskCategory | null {
  if (
    value === 'browser-interaction' ||
    value === 'data-extraction' ||
    value === 'form-filling' ||
    value === 'multi-step' ||
    value === 'recovery-scenario' ||
    value === 'approval-scenario'
  ) {
    return value;
  }

  return null;
}

function toBenchmarkTask(raw: unknown, sourceFile: string): BenchmarkTask | null {
  if (!isRecord(raw)) {
    console.warn(`[BenchmarkTaskRepository] Skipping invalid benchmark file: ${sourceFile}`);
    return null;
  }

  const category = normalizeCategory(raw.category);
  const expectedOutcome = normalizeExpectedOutcome(raw.expectedOutcome);
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';

  if (!id || !name || !description || !prompt || !category || !expectedOutcome) {
    console.warn(`[BenchmarkTaskRepository] Invalid benchmark definition in ${sourceFile}`);
    return null;
  }

  const now = Date.now();
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : now;
  const updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : createdAt;

  return {
    id,
    name,
    description,
    category,
    prompt,
    expectedOutcome,
    initialState: normalizeInitialState(raw.initialState),
    executionConfig: normalizeExecutionConfig(raw.executionConfig),
    tags: toStringArray(raw.tags),
    version: typeof raw.version === 'string' ? raw.version : undefined,
    createdAt,
    updatedAt,
  };
}

function loadBenchmarkFile(filePath: string): BenchmarkTask | null {
  try {
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = filePath.endsWith('.json') ? JSON.parse(rawContent) : yaml.load(rawContent);
    const task = toBenchmarkTask(parsed, path.basename(filePath));
    if (!task) {
      return null;
    }

    return task;
  } catch (error) {
    console.error(`[BenchmarkTaskRepository] Failed to load benchmark file ${filePath}:`, error);
    return null;
  }
}

export class BenchmarkTaskRepository {
  private readonly benchmarksDir: string;
  private benchmarkTasks: Map<string, BenchmarkTask> = new Map();

  constructor(benchmarksDir: string = DEFAULT_BENCHMARK_DIR) {
    this.benchmarksDir = benchmarksDir;
    this.reload();
  }

  reload(): BenchmarkTask[] {
    const loadedTasks = new Map<string, BenchmarkTask>();

    if (!fs.existsSync(this.benchmarksDir)) {
      console.warn(`[BenchmarkTaskRepository] Benchmark directory not found: ${this.benchmarksDir}`);
      this.benchmarkTasks = loadedTasks;
      return [];
    }

    const entries = fs.readdirSync(this.benchmarksDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !BENCHMARK_FILE_PATTERN.test(entry.name)) {
        continue;
      }

      const filePath = path.join(this.benchmarksDir, entry.name);
      const task = loadBenchmarkFile(filePath);
      if (!task) {
        continue;
      }

      if (loadedTasks.has(task.id)) {
        console.warn(`[BenchmarkTaskRepository] Duplicate benchmark id skipped: ${task.id}`);
        continue;
      }

      loadedTasks.set(task.id, task);
    }

    this.benchmarkTasks = loadedTasks;
    return this.list();
  }

  list(): BenchmarkTask[] {
    return Array.from(this.benchmarkTasks.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  getById(id: string): BenchmarkTask | null {
    return this.benchmarkTasks.get(id) || null;
  }
}

let benchmarkTaskRepository: BenchmarkTaskRepository | null = null;

export function getBenchmarkTaskRepository(): BenchmarkTaskRepository {
  if (!benchmarkTaskRepository) {
    benchmarkTaskRepository = new BenchmarkTaskRepository();
  }

  return benchmarkTaskRepository;
}
