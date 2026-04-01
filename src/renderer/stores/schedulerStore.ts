// src/renderer/stores/schedulerStore.ts

import { create } from 'zustand';
import { ScheduledTask, CreateScheduledTaskInput, ScheduleType } from '../../scheduler/types';

const MAX_TASKS = 200;

interface SchedulerState {
  tasks: ScheduledTask[];
  isLoading: boolean;
  error: string | null;
  selectedTaskId: string | null;
  isOpen: boolean;

  loadTasks: () => Promise<void>;
  createTask: (input: CreateScheduledTaskInput) => Promise<void>;
  updateTask: (id: string, updates: Partial<ScheduledTask>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  triggerTask: (id: string) => Promise<void>;
  enableTask: (id: string) => Promise<void>;
  disableTask: (id: string) => Promise<void>;
  selectTask: (id: string | null) => void;
  setOpen: (open: boolean) => void;
}

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,
  selectedTaskId: null,
  isOpen: false,

  loadTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await window.electron.invoke('scheduler:list');
      let limitedTasks = tasks;
      if (tasks.length > MAX_TASKS) {
        limitedTasks = tasks.slice(-MAX_TASKS);
      }
      set({ tasks: limitedTasks, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createTask: async (input) => {
    set({ isLoading: true, error: null });
    try {
      await window.electron.invoke('scheduler:create', input);
      await get().loadTasks();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  updateTask: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      await window.electron.invoke('scheduler:update', { id, updates });
      await get().loadTasks();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  deleteTask: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await window.electron.invoke('scheduler:delete', id);
      set({ selectedTaskId: null });
      await get().loadTasks();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  triggerTask: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await window.electron.invoke('scheduler:trigger', id);
      await get().loadTasks();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  enableTask: async (id) => {
    await get().updateTask(id, { enabled: true });
  },

  disableTask: async (id) => {
    await get().updateTask(id, { enabled: false });
  },

  selectTask: (id) => {
    set({ selectedTaskId: id });
  },

  setOpen: (open) => {
    set({ isOpen: open });
    if (open) {
      get()
        .loadTasks()
        .catch((err) => console.error('[schedulerStore] loadTasks failed:', err));
    }
  },
}));

export const defaultTaskInput: CreateScheduledTaskInput = {
  name: '',
  description: '',
  enabled: true,
  schedule: {
    type: ScheduleType.CRON,
    cron: '0 9 * * *',
  },
  execution: {
    taskDescription: '',
    timeout: 300000,
    maxRetries: 3,
    retryDelayMs: 1000,
  },
};
