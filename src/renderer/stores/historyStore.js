import { create } from 'zustand';
export const useHistoryStore = create((set, get) => ({
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
        get()
            .loadTasks(filter)
            .catch((err) => console.error('[historyStore] loadTasks failed:', err));
    },
    setSelectedTaskId: (taskId) => {
        set({ selectedTaskId: taskId });
        if (taskId) {
            get().loadTaskDetail(taskId);
        }
        else {
            set({ selectedTask: null });
        }
    },
    loadTasks: async (options = {}) => {
        set({ isLoading: true });
        try {
            const filter = { ...get().filter, ...options };
            const response = await window.electron.invoke('history:list', { options: filter });
            set({ tasks: response.tasks || [], total: response.total || 0, filter });
        }
        catch (error) {
            console.error('[HistoryStore] Failed to load tasks:', error);
        }
        finally {
            set({ isLoading: false });
        }
    },
    loadTaskDetail: async (taskId) => {
        try {
            const task = await window.electron.invoke('history:get', { taskId });
            set({ selectedTask: task });
        }
        catch (error) {
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
        }
        catch (error) {
            console.error('[HistoryStore] Failed to delete task:', error);
        }
    },
    replayTask: async (taskId) => {
        try {
            await window.electron.invoke('history:replay', { taskId });
        }
        catch (error) {
            console.error('[HistoryStore] Failed to replay task:', error);
        }
    },
    clearSelectedTask: () => set({ selectedTaskId: null, selectedTask: null }),
}));
