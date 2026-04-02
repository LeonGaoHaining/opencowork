import { create } from 'zustand';
const MAX_MESSAGES = 500;
const MAX_LOGS = 1000;
const MAX_ACTIVE_STEPS = 200;
export const useTaskStore = create((set) => ({
    // Session
    sessionId: null,
    setSessionId: (id) => set({ sessionId: id }),
    // Messages
    messages: [],
    addMessage: (message) => set((state) => ({
        messages: [
            ...state.messages.slice(-(MAX_MESSAGES - 1)),
            {
                ...message,
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
            },
        ],
    })),
    clearMessages: () => set({ messages: [] }),
    setMessages: (messages) => set({ messages }),
    // Task
    task: null,
    setTask: (task) => set({ task }),
    updateTaskProgress: (current, total) => set((state) => ({
        task: state.task ? { ...state.task, progress: { current, total } } : null,
    })),
    updateTaskStatus: (status) => set((state) => ({
        task: state.task ? { ...state.task, status } : null,
    })),
    updateCurrentStep: (step) => set((state) => ({
        task: state.task ? { ...state.task, currentStep: step } : null,
    })),
    setTaskError: (error) => set((state) => ({
        task: state.task ? { ...state.task, error } : null,
    })),
    // Active Steps
    activeSteps: [],
    addActiveStep: (step) => set((state) => ({
        activeSteps: [...state.activeSteps.slice(-(MAX_ACTIVE_STEPS - 1)), step],
    })),
    updateActiveStep: (id, updates) => set((state) => ({
        activeSteps: state.activeSteps.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),
    clearActiveSteps: () => set({ activeSteps: [] }),
    // Task Logs
    logs: [],
    addLog: (log) => set((state) => ({
        logs: [
            ...state.logs.slice(-(MAX_LOGS - 1)),
            {
                ...log,
                timestamp: Date.now(),
            },
        ],
    })),
    clearLogs: () => set({ logs: [] }),
    // Takeover
    isTakeover: false,
    setTakeover: (isTakeover) => set({ isTakeover }),
    // Plan viewer
    showPlanViewer: false,
    setShowPlanViewer: (show) => set({ showPlanViewer: show }),
    // Ask User Dialog
    askUserRequest: null,
    setAskUserRequest: (request) => set({ askUserRequest: request }),
    respondToAskUser: (answer) => {
        const request = useTaskStore.getState().askUserRequest;
        try {
            if (request && window.electron) {
                window.electron.invoke('ask:user:response', {
                    requestId: request.requestId,
                    answer,
                    cancelled: false,
                });
            }
        }
        catch (error) {
            console.error('[taskStore] respondToAskUser error:', error);
        }
        set({ askUserRequest: null });
    },
    // Preview Mode
    previewMode: 'sidebar',
    setPreviewMode: (mode) => {
        set({ previewMode: mode });
        try {
            if (window.electron) {
                window.electron.invoke('preview:setMode', { mode });
            }
        }
        catch (error) {
            console.error('[taskStore] setPreviewMode error:', error);
        }
    },
}));
