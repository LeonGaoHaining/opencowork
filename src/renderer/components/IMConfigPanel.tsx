import React, { useState, useEffect } from 'react';
import { useIMStore, IMPlatform, ConnectionStatus, IMPlatformConfig } from '../stores/imStore';
import { FeishuConfig, DingTalkConfig, WeComConfig, SlackConfig } from '../stores/imStore';
import { useTranslation } from '../i18n/useTranslation';
import { useTaskStore } from '../stores/taskStore';
import RelationBadge from './RelationBadge';

interface RecentIMTask {
  id: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  message?: string;
  resultSummary?: string;
  runId?: string;
  templateId?: string;
  artifactsCount?: number;
  updatedAt: number;
}

interface TabConfig {
  key: IMPlatform;
  disabled: boolean;
}

const tabs: TabConfig[] = [
  { key: 'feishu', disabled: false },
  { key: 'dingtalk', disabled: true },
  { key: 'wecom', disabled: true },
  { key: 'slack', disabled: true },
];

const getStatusIcon = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return '●';
    case 'connecting':
      return '◐';
    case 'error':
      return '✕';
    default:
      return '○';
  }
};

const getStatusText = (
  status: ConnectionStatus,
  platform: string,
  t: ReturnType<typeof useTranslation>['t']
): string => {
  switch (status) {
    case 'connected':
      return t('imConfig.status.connected', { platform });
    case 'connecting':
      return t('imConfig.status.connecting');
    case 'error':
      return t('imConfig.status.error');
    default:
      return t('imConfig.status.notConfigured', { platform });
  }
};

function FeishuForm({
  config,
  onChange,
  onTest,
  onSave,
  isTesting,
  isSaving,
}: {
  config: FeishuConfig;
  onChange: (config: FeishuConfig) => void;
  onTest: () => void;
  onSave: () => void;
  isTesting: boolean;
  isSaving: boolean;
}) {
  const [showSecret, setShowSecret] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="feishu-enabled"
          checked={config.enabled}
          onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
          className="w-4 h-4"
        />
        <label htmlFor="feishu-enabled" className="text-sm">
          {t('imConfig.enableFeishu')}
        </label>
      </div>

      {config.enabled && (
        <>
          <div>
            <label className="block text-sm text-text-secondary mb-1">App ID</label>
            <input
              type="text"
              value={config.appId}
              onChange={(e) => onChange({ ...config, appId: e.target.value })}
              placeholder="cli_xxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 bg-elevated border border-border rounded-lg text-text-primary placeholder-text-muted"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">App Secret</label>
            <div className="flex gap-2">
              <input
                type={showSecret ? 'text' : 'password'}
                value={config.appSecret}
                onChange={(e) => onChange({ ...config, appSecret: e.target.value })}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="flex-1 px-3 py-2 bg-elevated border border-border rounded-lg text-text-primary placeholder-text-muted"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="px-3 py-2 bg-elevated border border-border rounded-lg text-text-secondary hover:text-white"
              >
                {showSecret ? t('imConfig.hide') : t('imConfig.show')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function IMConfigPanel() {
  const {
    configs,
    statuses,
    activeTab,
    isPanelOpen,
    isLoading,
    isSaving,
    message,
    setActiveTab,
    setPanelOpen,
    loadAll,
    save,
    test,
    setMessage,
  } = useIMStore();
  const { t } = useTranslation();
  const { openRunsPanel } = useTaskStore();

  const [localConfigs, setLocalConfigs] = useState<Record<IMPlatform, IMPlatformConfig | null>>({
    feishu: { enabled: false, appId: '', appSecret: '' },
    dingtalk: { enabled: false, appKey: '', appSecret: '' },
    wecom: { enabled: false, corpId: '', agentId: '', corpSecret: '' },
    slack: { enabled: false, botToken: '', signingSecret: '' },
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [recentTasks, setRecentTasks] = useState<RecentIMTask[]>([]);

  useEffect(() => {
    if (isPanelOpen) {
      loadAll();
    }
  }, [isPanelOpen]);

  useEffect(() => {
    if (configs[activeTab]) {
      setLocalConfigs((prev) => ({ ...prev, [activeTab]: configs[activeTab] }));
    }
  }, [configs, activeTab]);

  useEffect(() => {
    if (!isPanelOpen || activeTab !== 'feishu') {
      return;
    }

    let cancelled = false;
    const loadRecentTasks = async () => {
      try {
        const result = await window.electron.invoke('im:recentTasks', { limit: 10 });
        const payload = result?.data || result;
        if (!cancelled) {
          setRecentTasks(Array.isArray(payload) ? payload : []);
        }
      } catch (error) {
        console.error('[IMConfigPanel] Failed to load recent IM tasks:', error);
        if (!cancelled) {
          setRecentTasks([]);
        }
      }
    };

    void loadRecentTasks();
    const interval = setInterval(() => {
      void loadRecentTasks();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isPanelOpen, activeTab]);

  if (!isPanelOpen) {
    return null;
  }

  const handleTabChange = (newTab: IMPlatform) => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(t('imConfig.unsavedChanges'));
      if (!confirmed) return;
    }
    setMessage(null);
    setActiveTab(newTab);
    setHasUnsavedChanges(false);
  };

  const handleConfigChange = (platform: IMPlatform, config: IMPlatformConfig) => {
    setLocalConfigs((prev) => ({ ...prev, [platform]: config }));
    setHasUnsavedChanges(true);
  };

  const handleTest = async () => {
    const config = localConfigs[activeTab];
    if (!config) return;
    await test(activeTab, config);
  };

  const handleSave = async () => {
    const config = localConfigs[activeTab];
    if (!config) return;
    const success = await save(activeTab, config);
    if (success) {
      setHasUnsavedChanges(false);
    }
  };

  const handleRunTemplate = async (templateId: string) => {
    try {
      const result = await window.electron.invoke('template:run', { templateId });
      const payload = result?.data || result;
      if (!result?.success || payload?.success === false) {
        throw new Error(payload?.error || result?.error || t('imConfig.templateRunFailed'));
      }
      setMessage({ type: 'success', text: t('imConfig.templateRerunSuccess') });
    } catch (error) {
      console.error('[IMConfigPanel] Failed to run template:', error);
      setMessage({ type: 'error', text: t('imConfig.templateRerunFailed', { message: String(error) }) });
    }
  };

  const handleOpenTemplate = (templateId: string): void => {
    window.dispatchEvent(new CustomEvent('template:open', { detail: { templateId } }));
  };

  const currentStatus = statuses[activeTab];
  const currentConfig = localConfigs[activeTab];
  const getPlatformLabel = (platform: IMPlatform): string => t(`imConfig.platform.${platform}`);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-xl w-[500px] max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">{t('imConfig.title')}</h2>
          <button
            onClick={() => setPanelOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-elevated text-text-secondary"
          >
            ×
          </button>
        </div>

        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              disabled={tab.disabled}
              title={tab.disabled ? t('imConfig.comingSoon') : undefined}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-white'
              } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {getPlatformLabel(tab.key)}
              {tab.disabled && (
                <span className="ml-1 text-xs text-warning">{t('imConfig.comingSoon')}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {message && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm ${
                message.type === 'success' ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-text-secondary">{getStatusIcon(currentStatus)}</span>
              <span className="text-sm text-text-secondary">
                {getStatusText(
                  currentStatus,
                  getPlatformLabel(activeTab),
                  t
                )}
              </span>
            </div>

            {activeTab === 'feishu' && currentConfig && (
              <FeishuForm
                config={currentConfig as FeishuConfig}
                onChange={(config) => handleConfigChange('feishu', config)}
                onTest={handleTest}
                onSave={handleSave}
                isTesting={isLoading}
                isSaving={isSaving}
              />
            )}

            {activeTab === 'feishu' && (
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="mb-3 text-sm font-medium text-white">{t('imConfig.recentTasks')}</div>
                {recentTasks.length === 0 ? (
                  <div className="text-sm text-text-muted">{t('imConfig.noRecentTasks')}</div>
                ) : (
                  <div className="space-y-2">
                    {recentTasks.map((task) => (
                      <div key={task.id} className="rounded border border-border bg-surface p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-text-secondary break-all">{task.id}</div>
                          <RelationBadge label="status" value={task.status} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {task.runId && <RelationBadge label="run" value={task.runId} tone="primary" />}
                          {task.templateId && (
                            <button
                              type="button"
                              onClick={() => handleOpenTemplate(task.templateId as string)}
                              className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
                            >
                              {t('taskPanels.template')}
                            </button>
                          )}
                        </div>
                        {task.message && (
                          <div className="mt-2 text-xs text-text-muted whitespace-pre-wrap">
                            {task.message}
                          </div>
                        )}
                        {task.resultSummary && (
                          <div className="mt-2 text-xs text-white whitespace-pre-wrap">
                            {task.resultSummary}
                          </div>
                        )}
                        {typeof task.artifactsCount === 'number' && (
                          <div className="mt-1 text-[11px] text-text-muted">
                            {t('taskPanels.artifacts')}: {task.artifactsCount}
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          {task.runId && (
                            <button
                              type="button"
                              onClick={() => openRunsPanel(task.runId as string)}
                              className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
                            >
                              {t('taskPanels.viewRun')}
                            </button>
                          )}
                          {task.templateId && (
                            <button
                              type="button"
                              onClick={() => void handleRunTemplate(task.templateId as string)}
                              className="rounded px-2 py-1 text-xs text-white bg-primary/20 hover:bg-primary/30"
                            >
                              {t('imConfig.rerunTemplate')}
                            </button>
                          )}
                        </div>
                        <div className="mt-2 text-[11px] text-text-muted">
                          {new Date(task.updatedAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab !== 'feishu' && (
              <div className="text-center text-text-muted py-8">{t('imConfig.platformComingSoon')}</div>
            )}
          </div>
        </div>

        <div className="flex justify-between px-4 py-3 border-t border-border bg-elevated">
          <button
            onClick={handleTest}
            disabled={isLoading || !currentConfig}
            className="px-4 py-2 bg-elevated border border-border rounded-lg text-text-secondary hover:text-white disabled:opacity-50"
          >
            {isLoading ? t('imConfig.testing') : t('imConfig.testConnection')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setPanelOpen(false)}
              className="px-4 py-2 bg-elevated border border-border rounded-lg text-text-secondary hover:text-white"
            >
              {t('imConfig.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !currentConfig}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? t('imConfig.saving') : t('imConfig.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
