import { create } from 'zustand';
import { TaskHistoryRecord, HistoryQueryOptions } from '../../history/taskHistory';

interface HistoryState {
  isOpen: boolean;
  isLoading: boolean;
  tasks: TaskHistoryRecord[];
  selectedTaskId: string | null;
  selectedTask: TaskHistoryRecord | null;
  filter: HistoryQueryOptions;
  total: number;

  setIsOpen: (isOpen: boolean) => void;
  setFilter: (filter: HistoryQueryOptions) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  loadTasks: (options?: HistoryQueryOptions) => Promise<void>;
  loadTaskDetail: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  replayTask: (taskId: string) => Promise<void>;
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

  setIsOpen: (isOpen) => set({ isOpen }),

  setFilter: (filter) => {
    set({ filter });
    get().loadTasks(filter);
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
      set({ tasks: response.tasks || [], total: response.total || 0, filter });
    } catch (error) {
      console.error('[HistoryStore] Failed to load tasks:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  loadTaskDetail: async (taskId) => {
    try {
      const task = await window.electron.invoke('history:get', { taskId });
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
      await window.electron.invoke('history:replay', { taskId });
    } catch (error) {
      console.error('[HistoryStore] Failed to replay task:', error);
    }
  },

  clearSelectedTask: () => set({ selectedTaskId: null, selectedTask: null }),
}));
