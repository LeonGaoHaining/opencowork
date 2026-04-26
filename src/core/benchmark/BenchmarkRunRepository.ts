import * as fs from 'fs';
import * as path from 'path';
import { BenchmarkRunRecord } from './types';

const DEFAULT_BENCHMARK_RUN_FILE = path.join(
  process.env.OPENWORK_CONFIG_DIR || path.join(process.cwd(), 'config'),
  'benchmark-runs.json'
);

export class BenchmarkRunRepository {
  private readonly filePath: string;

  constructor(filePath: string = DEFAULT_BENCHMARK_RUN_FILE) {
    this.filePath = filePath;
  }

  private loadAllSync(): BenchmarkRunRecord[] {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }

      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as BenchmarkRunRecord[]) : [];
    } catch (error) {
      console.error('[BenchmarkRunRepository] Failed to load benchmark runs:', error);
      return [];
    }
  }

  private saveAllSync(records: BenchmarkRunRecord[]): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.filePath, JSON.stringify(records, null, 2), 'utf-8');
  }

  list(): BenchmarkRunRecord[] {
    return this.loadAllSync();
  }

  listRecent(limit: number = 20): BenchmarkRunRecord[] {
    return this.loadAllSync()
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
      .slice(0, limit);
  }

  getById(id: string): BenchmarkRunRecord | null {
    return this.loadAllSync().find((record) => record.id === id) || null;
  }

  upsert(record: BenchmarkRunRecord): void {
    const records = this.loadAllSync();
    const index = records.findIndex((item) => item.id === record.id);
    if (index === -1) {
      records.push(record);
    } else {
      records[index] = record;
    }
    this.saveAllSync(records);
  }

  listByBenchmarkId(benchmarkTaskId: string, limit: number = 20): BenchmarkRunRecord[] {
    return this.loadAllSync()
      .filter((record) => record.benchmarkTaskId === benchmarkTaskId)
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
      .slice(0, limit);
  }
}

let benchmarkRunRepository: BenchmarkRunRepository | null = null;

export function getBenchmarkRunRepository(): BenchmarkRunRepository {
  if (!benchmarkRunRepository) {
    benchmarkRunRepository = new BenchmarkRunRepository();
  }

  return benchmarkRunRepository;
}
