import { create } from 'zustand';
export const useTaskStore = create((set) => ({
    // Session
    sessionId: null,
    setSessionId: (id) => set({ sessionId: id }),
    // Messages
    messages: [],
    addMessage: (message) => set((state) => ({
        messages: [
            ...state.messages,
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
        activeSteps: [...state.activeSteps, step],
    })),
    updateActiveStep: (id, updates) => set((state) => ({
        activeSteps: state.activeSteps.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),
    clearActiveSteps: () => set({ activeSteps: [] }),
    // Task Logs
    logs: [],
    addLog: (log) => set((state) => ({
        logs: [
            ...state.logs,
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
        if (request && window.electron) {
            window.electron.invoke('ask:user:response', {
                requestId: request.requestId,
                answer,
                cancelled: false,
            });
        }
        set({ askUserRequest: null });
    },
    // Preview Mode
    previewMode: 'sidebar',
    setPreviewMode: (mode) => {
        set({ previewMode: mode });
        if (window.electron) {
            window.electron.invoke('preview:setMode', { mode });
        }
    },
}));
