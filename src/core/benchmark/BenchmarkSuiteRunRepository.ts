import * as fs from 'fs';
import * as path from 'path';
import { BenchmarkSuiteRunRecord } from './types';

const DEFAULT_BENCHMARK_SUITE_RUN_FILE = path.join(
  process.env.OPENWORK_CONFIG_DIR || path.join(process.cwd(), 'config'),
  'benchmark-suite-runs.json'
);

export class BenchmarkSuiteRunRepository {
  private readonly filePath: string;

  constructor(filePath: string = DEFAULT_BENCHMARK_SUITE_RUN_FILE) {
    this.filePath = filePath;
  }

  private loadAllSync(): BenchmarkSuiteRunRecord[] {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }

      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as BenchmarkSuiteRunRecord[]) : [];
    } catch (error) {
      console.error('[BenchmarkSuiteRunRepository] Failed to load suite runs:', error);
      return [];
    }
  }

  private saveAllSync(records: BenchmarkSuiteRunRecord[]): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.filePath, JSON.stringify(records, null, 2), 'utf-8');
  }

  list(): BenchmarkSuiteRunRecord[] {
    return this.loadAllSync();
  }

  listRecent(limit: number = 20): BenchmarkSuiteRunRecord[] {
    return this.loadAllSync()
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
      .slice(0, limit);
  }

  getById(id: string): BenchmarkSuiteRunRecord | null {
    return this.loadAllSync().find((record) => record.id === id) || null;
  }

  upsert(record: BenchmarkSuiteRunRecord): void {
    const records = this.loadAllSync();
    const index = records.findIndex((item) => item.id === record.id);
    if (index === -1) {
      records.push(record);
    } else {
      records[index] = record;
    }
    this.saveAllSync(records);
  }
}

let benchmarkSuiteRunRepository: BenchmarkSuiteRunRepository | null = null;

export function getBenchmarkSuiteRunRepository(): BenchmarkSuiteRunRepository {
  if (!benchmarkSuiteRunRepository) {
    benchmarkSuiteRunRepository = new BenchmarkSuiteRunRepository();
  }

  return benchmarkSuiteRunRepository;
}
