import { create } from 'zustand';
import {
  TaskHistoryRecord,
  HistoryQueryOptions,
  HistorySearchResult,
} from '../../history/taskHistory';
import { useTaskStore } from './taskStore';

interface HistoryState {
  isOpen: boolean;
  isLoading: boolean;
  tasks: TaskHistoryRecord[];
  selectedTaskId: string | null;
  selectedTask: TaskHistoryRecord | null;
  filter: HistoryQueryOptions;
  total: number;
  searchResults: HistorySearchResult[];
  searchSummary: string | null;

  setIsOpen: (isOpen: boolean) => void;
  setFilter: (filter: HistoryQueryOptions) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  loadTasks: (options?: HistoryQueryOptions) => Promise<void>;
  loadTaskDetail: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  replayTask: (taskId: string) => Promise<void>;
  searchTasks: (query: string) => Promise<void>;
  summarizeSearch: (query: string) => Promise<void>;
  clearSelectedTask: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  isOpen: false,
  isLoading: false,
  tasks: [],
  selectedTaskId: null,
  selectedTask: null,
  filter: {},
  total: 0,
  searchResults: [],
  searchSummary: null,

  setIsOpen: (isOpen) => set({ isOpen }),

  setFilter: (filter) => {
    set({ filter });
    get()
      .loadTasks(filter)
      .catch((err) => console.error('[historyStore] loadTasks failed:', err));
  },

  setSelectedTaskId: (taskId) => {
    set({ selectedTaskId: taskId });
    if (taskId) {
      get().loadTaskDetail(taskId);
    } else {
      set({ selectedTask: null });
    }
  },

  loadTasks: async (options = {}) => {
    set({ isLoading: true });
    try {
      const filter = { ...get().filter, ...options };
      const response = await window.electron.invoke('history:list', { options: filter });
      const payload = response?.data || response || {};
      const tasks = Array.isArray(payload?.data) ? payload.data : [];
      const total = typeof payload?.total === 'number' ? payload.total : tasks.length;
      set({ tasks, total, filter, searchResults: [], searchSummary: null });
    } catch (error) {
      console.error('[HistoryStore] Failed to load tasks:', error);
      set({ tasks: [], total: 0 });
    } finally {
      set({ isLoading: false });
    }
  },

  loadTaskDetail: async (taskId) => {
    try {
      const response = await window.electron.invoke('history:get', { taskId });
      const task = response?.data?.data || response?.data || null;
      set({ selectedTask: task });
    } catch (error) {
      console.error('[HistoryStore] Failed to load task detail:', error);
    }
  },

  deleteTask: async (taskId) => {
    try {
      await window.electron.invoke('history:delete', { taskId });
      const { tasks } = get();
      set({
        tasks: tasks.filter((t) => t.id !== taskId),
        selectedTaskId: null,
        selectedTask: null,
      });
    } catch (error) {
      console.error('[HistoryStore] Failed to delete task:', error);
    }
  },

  replayTask: async (taskId) => {
    try {
      const result = await window.electron.invoke('history:replay', { taskId });
      const payload = result?.data?.data || result?.data || result;
      if (!result?.success || payload?.success === false) {
        throw new Error(payload?.error || result?.error || '重放失败');
      }

      const taskRecord =
        get().selectedTask?.id === taskId
          ? get().selectedTask
          : get().tasks.find((task) => task.id === taskId) || null;

      useTaskStore.getState().setTask({
        id: payload?.handle || `task-${Date.now()}`,
        status: 'executing',
        description: taskRecord?.task || '重放任务',
        progress: { current: 0, total: 0 },
      });
    } catch (error) {
      console.error('[HistoryStore] Failed to replay task:', error);
    }
  },

  searchTasks: async (query) => {
    set({ isLoading: true });
    try {
      const { filter } = get();
      const response = await window.electron.invoke('history:search', {
        query,
        options: {
          limit: 20,
          status: filter.status,
          dateRange:
            filter.startDate || filter.endDate
              ? {
                  start: filter.startDate || 0,
                  end: filter.endDate || Date.now(),
                }
              : undefined,
        },
      });
      const results: HistorySearchResult[] = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
          ? response.data
          : [];
      const tasks = await Promise.all(
        results.map(async (result: HistorySearchResult) => {
          const detailResponse = await window.electron.invoke('history:get', {
            taskId: result.sessionId,
          });
          return detailResponse?.data?.data || detailResponse?.data || null;
        })
      );
      set({
        searchResults: results,
        tasks: tasks.filter((task): task is TaskHistoryRecord => task !== null),
        total: results.length,
        searchSummary: null,
      });
    } catch (error) {
      console.error('[HistoryStore] Failed to search tasks:', error);
      set({ searchResults: [], tasks: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  summarizeSearch: async (query) => {
    set({ isLoading: true });
    try {
      const { filter } = get();
      const response = await window.electron.invoke('history:summarizeSearch', {
        query,
        options: {
          limit: 20,
          status: filter.status,
          dateRange:
            filter.startDate || filter.endDate
              ? {
                  start: filter.startDate || 0,
                  end: filter.endDate || Date.now(),
                }
              : undefined,
        },
      });
      const payload = response?.data?.data || response?.data || null;
      const results = Array.isArray(payload?.results) ? payload.results : [];
      const tasks = await Promise.all(
        results.map(async (result: HistorySearchResult) => {
          const detailResponse = await window.electron.invoke('history:get', {
            taskId: result.sessionId,
          });
          return detailResponse?.data?.data || detailResponse?.data || null;
        })
      );
      set({
        searchSummary: typeof payload?.summary === 'string' ? payload.summary : null,
        searchResults: results,
        tasks: tasks.filter((task): task is TaskHistoryRecord => task !== null),
        total: results.length,
      });
    } catch (error) {
      console.error('[HistoryStore] Failed to summarize tasks:', error);
      set({ searchSummary: null });
    } finally {
      set({ isLoading: false });
    }
  },

  clearSelectedTask: () => set({ selectedTaskId: null, selectedTask: null }),
}));
