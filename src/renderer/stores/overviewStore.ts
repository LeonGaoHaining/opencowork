import { create } from 'zustand';

export interface OverviewSummary {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  successRate: number;
  avgDurationMs: number;
  totalDurationMs: number;
}

export interface DailyStats {
  completed: number;
  failed: number;
  total: number;
}

export interface OverviewMetrics {
  summary: OverviewSummary;
  sourceStats: Record<string, number>;
  dailyStats: Record<string, DailyStats>;
  schedulerStats: {
    totalSchedules: number;
    activeSchedules: number;
  };
  imStats: {
    total: number;
    pending: number;
    completed: number;
    failed: number;
  };
}

const EMPTY_METRICS: OverviewMetrics = {
  summary: {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    runningTasks: 0,
    successRate: 0,
    avgDurationMs: 0,
    totalDurationMs: 0,
  },
  sourceStats: {},
  dailyStats: {},
  schedulerStats: {
    totalSchedules: 0,
    activeSchedules: 0,
  },
  imStats: {
    total: 0,
    pending: 0,
    completed: 0,
    failed: 0,
  },
};

function normalizeOverviewMetrics(payload: any): OverviewMetrics {
  return {
    summary: {
      ...EMPTY_METRICS.summary,
      ...(payload?.summary || {}),
    },
    sourceStats:
      payload?.sourceStats && typeof payload.sourceStats === 'object' ? payload.sourceStats : {},
    dailyStats:
      payload?.dailyStats && typeof payload.dailyStats === 'object' ? payload.dailyStats : {},
    schedulerStats: {
      ...EMPTY_METRICS.schedulerStats,
      ...(payload?.schedulerStats || {}),
    },
    imStats: {
      ...EMPTY_METRICS.imStats,
      ...(payload?.imStats || {}),
    },
  };
}

interface OverviewState {
  metrics: OverviewMetrics | null;
  isLoading: boolean;
  error: string | null;
  dateRange: { start: number; end: number };

  setDateRange: (range: { start: number; end: number }) => void;
  loadMetrics: () => Promise<void>;
}

export const useOverviewStore = create<OverviewState>((set, get) => ({
  metrics: null,
  isLoading: false,
  error: null,
  dateRange: {
    start: Date.now() - 7 * 24 * 60 * 60 * 1000,
    end: Date.now(),
  },

  setDateRange: (range) => {
    set({ dateRange: range });
    get().loadMetrics();
  },

  loadMetrics: async () => {
    set({ isLoading: true, error: null });
    try {
      const { dateRange } = get();
      const response = await window.electron.invoke('overview:getMetrics', { dateRange });
      const payload = response?.data;
      if (response?.success && payload) {
        set({ metrics: normalizeOverviewMetrics(payload) });
      } else {
        throw new Error(response?.error || 'Failed to load metrics');
      }
    } catch (error: any) {
      console.error('[OverviewStore] loadMetrics error:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },
}));
