import { create } from 'zustand';

interface SkillSettings {
  autoGenerate: boolean;
  triggerThreshold: number;
}

interface PreviewSettings {
  fps: number;
  quality: number;
}

interface SettingsState {
  skillSettings: SkillSettings;
  previewSettings: PreviewSettings;
  isSettingsOpen: boolean;
  isLoading: boolean;

  loadSettings: () => Promise<void>;
  setAutoGenerateSkill: (autoGenerate: boolean) => Promise<void>;
  setTriggerThreshold: (threshold: number) => Promise<void>;
  setPreviewFps: (fps: number) => Promise<void>;
  setPreviewQuality: (quality: number) => Promise<void>;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  skillSettings: {
    autoGenerate: false,
    triggerThreshold: 3,
  },
  previewSettings: {
    fps: 5,
    quality: 80,
  },
  isSettingsOpen: false,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      if (window.electron) {
        const { data } = await window.electron.invoke('settings:get');
        if (data) {
          set({
            skillSettings: data.skill || get().skillSettings,
            previewSettings: data.preview || get().previewSettings,
          });
        }
      }
    } catch (error) {
      console.error('[settingsStore] Load settings failed:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  setAutoGenerateSkill: async (autoGenerate: boolean) => {
    try {
      if (window.electron) {
        await window.electron.invoke('settings:set', {
          skill: { autoGenerate },
        });
      }
      set((state) => ({
        skillSettings: { ...state.skillSettings, autoGenerate },
      }));
    } catch (error) {
      console.error('[settingsStore] Set autoGenerateSkill failed:', error);
    }
  },

  setTriggerThreshold: async (threshold: number) => {
    try {
      if (window.electron) {
        await window.electron.invoke('settings:set', {
          skill: { triggerThreshold: threshold },
        });
      }
      set((state) => ({
        skillSettings: { ...state.skillSettings, triggerThreshold: threshold },
      }));
    } catch (error) {
      console.error('[settingsStore] Set triggerThreshold failed:', error);
    }
  },

  setPreviewFps: async (fps: number) => {
    try {
      if (window.electron) {
        await window.electron.invoke('settings:set', {
          preview: { fps },
        });
      }
      set((state) => ({
        previewSettings: { ...state.previewSettings, fps },
      }));
    } catch (error) {
      console.error('[settingsStore] Set previewFps failed:', error);
    }
  },

  setPreviewQuality: async (quality: number) => {
    try {
      if (window.electron) {
        await window.electron.invoke('settings:set', {
          preview: { quality },
        });
      }
      set((state) => ({
        previewSettings: { ...state.previewSettings, quality },
      }));
    } catch (error) {
      console.error('[settingsStore] Set previewQuality failed:', error);
    }
  },

  openSettings: () => {
    set({ isSettingsOpen: true });
    get().loadSettings();
  },

  closeSettings: () => {
    set({ isSettingsOpen: false });
  },
}));
