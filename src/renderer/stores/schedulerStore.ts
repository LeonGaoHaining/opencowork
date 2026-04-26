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
  draftTaskInput: Partial<CreateScheduledTaskInput> | null;

  loadTasks: () => Promise<void>;
  createTask: (input: CreateScheduledTaskInput) => Promise<void>;
  updateTask: (id: string, updates: Partial<ScheduledTask>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  triggerTask: (id: string) => Promise<void>;
  enableTask: (id: string) => Promise<void>;
  disableTask: (id: string) => Promise<void>;
  selectTask: (id: string | null) => void;
  setOpen: (open: boolean) => void;
  prepareDraftFromTemplate: (payload: {
    name: string;
    description: string;
    templateId: string;
    input?: Record<string, unknown>;
    executionMode?: 'dom' | 'visual' | 'hybrid';
  }) => void;
  prepareDraftFromPrompt: (payload: { name: string; description: string; prompt: string }) => void;
  clearDraft: () => void;
}

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,
  selectedTaskId: null,
  isOpen: false,
  draftTaskInput: null,

  loadTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electron.invoke('scheduler:list');
      console.log('[SchedulerStore] loadTasks raw result:', result, 'type:', typeof result);
      let tasks: any[] = [];
      if (result && typeof result === 'object') {
        if (result.success && Array.isArray(result.data)) {
          tasks = result.data;
        } else if (Array.isArray(result)) {
          tasks = result;
        }
      }
      console.log('[SchedulerStore] tasks count:', tasks.length);
      set({ tasks, isLoading: false });
    } catch (error) {
      console.error('[SchedulerStore] loadTasks error:', error);
      set({ tasks: [], error: String(error), isLoading: false });
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
      await window.electron.invoke('scheduler:delete', { id });
      set({ selectedTaskId: null });
      await get().loadTasks();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  triggerTask: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await window.electron.invoke('scheduler:trigger', { id });
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

  prepareDraftFromTemplate: ({ name, description, templateId, input, executionMode }) => {
    set({
      draftTaskInput: {
        name,
        description,
        enabled: true,
        schedule: {
          type: ScheduleType.CRON,
          cron: '0 9 * * *',
        },
        execution: {
          taskDescription: '',
          templateId,
          input,
          executionMode: executionMode || 'dom',
          timeout: 300000,
          maxRetries: 3,
          retryDelayMs: 1000,
        },
      },
      isOpen: true,
    });
  },

  prepareDraftFromPrompt: ({ name, description, prompt }) => {
    set({
      draftTaskInput: {
        name,
        description,
        enabled: true,
        schedule: {
          type: ScheduleType.CRON,
          cron: '0 9 * * *',
        },
        execution: {
          taskDescription: prompt,
          templateId: undefined,
          input: undefined,
          executionMode: 'dom',
          timeout: 300000,
          maxRetries: 3,
          retryDelayMs: 1000,
        },
      },
      isOpen: true,
    });
  },

  clearDraft: () => set({ draftTaskInput: null }),
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
    templateId: undefined,
    input: undefined,
    executionMode: 'dom',
    timeout: 300000,
    maxRetries: 3,
    retryDelayMs: 1000,
  },
};
