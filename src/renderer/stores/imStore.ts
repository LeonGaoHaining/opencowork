import { create } from 'zustand';

export type IMPlatform = 'feishu' | 'dingtalk' | 'wecom' | 'slack';
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface FeishuConfig {
  enabled: boolean;
  appId: string;
  appSecret: string;
}

export interface DingTalkConfig {
  enabled: boolean;
  appKey: string;
  appSecret: string;
}

export interface WeComConfig {
  enabled: boolean;
  corpId: string;
  agentId: string;
  corpSecret: string;
}

export interface SlackConfig {
  enabled: boolean;
  botToken: string;
  signingSecret: string;
}

export type IMPlatformConfig = FeishuConfig | DingTalkConfig | WeComConfig | SlackConfig;

interface IMStore {
  configs: Record<IMPlatform, IMPlatformConfig | null>;
  statuses: Record<IMPlatform, ConnectionStatus>;
  activeTab: IMPlatform;
  isPanelOpen: boolean;
  isLoading: boolean;
  isSaving: boolean;
  message: { type: 'success' | 'error'; text: string } | null;

  setActiveTab: (tab: IMPlatform) => void;
  setPanelOpen: (open: boolean) => void;
  updateConfig: (platform: IMPlatform, config: IMPlatformConfig) => void;
  setStatus: (platform: IMPlatform, status: ConnectionStatus) => void;
  setMessage: (message: { type: 'success' | 'error'; text: string } | null) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  loadAll: () => Promise<void>;
  save: (platform: IMPlatform, config: IMPlatformConfig) => Promise<boolean>;
  test: (platform: IMPlatform, config: IMPlatformConfig) => Promise<boolean>;
}

const getDefaultConfigs = (): Record<IMPlatform, IMPlatformConfig | null> => ({
  feishu: { enabled: false, appId: '', appSecret: '' },
  dingtalk: { enabled: false, appKey: '', appSecret: '' },
  wecom: { enabled: false, corpId: '', agentId: '', corpSecret: '' },
  slack: { enabled: false, botToken: '', signingSecret: '' },
});

const getDefaultStatuses = (): Record<IMPlatform, ConnectionStatus> => ({
  feishu: 'disconnected',
  dingtalk: 'disconnected',
  wecom: 'disconnected',
  slack: 'disconnected',
});

export const useIMStore = create<IMStore>((set, get) => ({
  configs: getDefaultConfigs(),
  statuses: getDefaultStatuses(),
  activeTab: 'feishu',
  isPanelOpen: false,
  isLoading: false,
  isSaving: false,
  message: null,

  setActiveTab: (tab) => set({ activeTab: tab }),

  setPanelOpen: (open) => set({ isPanelOpen: open }),

  updateConfig: (platform, config) =>
    set((state) => ({
      configs: { ...state.configs, [platform]: config },
    })),

  setStatus: (platform, status) =>
    set((state) => ({
      statuses: { ...state.statuses, [platform]: status },
    })),

  setMessage: (message) => set({ message }),

  setLoading: (loading) => set({ isLoading: loading }),

  setSaving: (saving) => set({ isSaving: saving }),

  loadAll: async () => {
    set({ isLoading: true, message: null });
    try {
      const configs = await window.electron.invoke('im:load');
      const statuses = await window.electron.invoke('im:statusAll');
      set({ configs, statuses });
    } catch (error: any) {
      console.error('[IMStore] Load failed:', error);
      set({ message: { type: 'error', text: `加载失败: ${error.message}` } });
    } finally {
      set({ isLoading: false });
    }
  },

  save: async (platform, config) => {
    set({ isSaving: true, message: null });
    try {
      const result = await window.electron.invoke('im:save', { platform, config });
      if (result.success) {
        set((state) => ({
          configs: { ...state.configs, [platform]: config },
          message: { type: 'success', text: '配置保存成功' },
        }));
        const status = await window.electron.invoke('im:status', { platform });
        set((state) => ({
          statuses: { ...state.statuses, [platform]: status as ConnectionStatus },
        }));
        return true;
      } else {
        set({ message: { type: 'error', text: result.error || '保存失败' } });
        return false;
      }
    } catch (error: any) {
      console.error('[IMStore] Save failed:', error);
      set({ message: { type: 'error', text: `保存失败: ${error.message}` } });
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  test: async (platform, config) => {
    set({ isLoading: true, message: null });
    try {
      const result = await Promise.race([
        window.electron.invoke('im:test', { platform, config }),
        new Promise<{ success: false; error: string }>((_, reject) =>
          setTimeout(() => reject(new Error('连接超时(5s)')), 5000)
        ),
      ]);

      if (result.success) {
        set({ message: { type: 'success', text: '连接成功' } });
        return true;
      } else {
        set({ message: { type: 'error', text: result.error || '连接失败' } });
        return false;
      }
    } catch (error: any) {
      console.error('[IMStore] Test failed:', error);
      set({ message: { type: 'error', text: error.message || '测试失败' } });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
}));
