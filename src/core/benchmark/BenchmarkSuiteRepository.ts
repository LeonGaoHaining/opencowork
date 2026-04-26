import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { BenchmarkTaskSet } from './types';

const DEFAULT_BENCHMARK_SUITE_DIR = path.join(process.cwd(), 'src', 'benchmark-suites');
const BENCHMARK_SUITE_FILE_PATTERN = /\.(ya?ml|json)$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

function toBenchmarkTaskSet(raw: unknown, sourceFile: string): BenchmarkTaskSet | null {
  if (!isRecord(raw)) {
    console.warn(`[BenchmarkSuiteRepository] Skipping invalid suite file: ${sourceFile}`);
    return null;
  }

  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const benchmarkIds = toStringArray(raw.benchmarkIds) || toStringArray(raw.benchmarks) || [];

  if (!id || !name || benchmarkIds.length === 0) {
    console.warn(`[BenchmarkSuiteRepository] Invalid benchmark suite definition in ${sourceFile}`);
    return null;
  }

  const now = Date.now();
  return {
    id,
    name,
    description: typeof raw.description === 'string' ? raw.description.trim() : undefined,
    benchmarkIds,
    tags: toStringArray(raw.tags),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
  };
}

function loadBenchmarkSuiteFile(filePath: string): BenchmarkTaskSet | null {
  try {
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = filePath.endsWith('.json') ? JSON.parse(rawContent) : yaml.load(rawContent);
    return toBenchmarkTaskSet(parsed, path.basename(filePath));
  } catch (error) {
    console.error(`[BenchmarkSuiteRepository] Failed to load benchmark suite file ${filePath}:`, error);
    return null;
  }
}

export class BenchmarkSuiteRepository {
  private readonly suitesDir: string;
  private suites: Map<string, BenchmarkTaskSet> = new Map();

  constructor(suitesDir: string = DEFAULT_BENCHMARK_SUITE_DIR) {
    this.suitesDir = suitesDir;
    this.reload();
  }

  reload(): BenchmarkTaskSet[] {
    const loadedSuites = new Map<string, BenchmarkTaskSet>();

    if (!fs.existsSync(this.suitesDir)) {
      console.warn(`[BenchmarkSuiteRepository] Benchmark suite directory not found: ${this.suitesDir}`);
      this.suites = loadedSuites;
      return [];
    }

    const entries = fs.readdirSync(this.suitesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !BENCHMARK_SUITE_FILE_PATTERN.test(entry.name)) {
        continue;
      }

      const suite = loadBenchmarkSuiteFile(path.join(this.suitesDir, entry.name));
      if (!suite) {
        continue;
      }

      if (loadedSuites.has(suite.id)) {
        console.warn(`[BenchmarkSuiteRepository] Duplicate benchmark suite id skipped: ${suite.id}`);
        continue;
      }

      loadedSuites.set(suite.id, suite);
    }

    this.suites = loadedSuites;
    return this.list();
  }

  list(): BenchmarkTaskSet[] {
    return Array.from(this.suites.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  getById(id: string): BenchmarkTaskSet | null {
    return this.suites.get(id) || null;
  }
}

let benchmarkSuiteRepository: BenchmarkSuiteRepository | null = null;

export function getBenchmarkSuiteRepository(): BenchmarkSuiteRepository {
  if (!benchmarkSuiteRepository) {
    benchmarkSuiteRepository = new BenchmarkSuiteRepository();
  }

  return benchmarkSuiteRepository;
}
