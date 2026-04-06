import React, { useState, useEffect } from 'react';
import { useIMStore, IMPlatform, ConnectionStatus, IMPlatformConfig } from '../stores/imStore';
import { FeishuConfig, DingTalkConfig, WeComConfig, SlackConfig } from '../stores/imStore';

interface TabConfig {
  key: IMPlatform;
  label: string;
  disabled: boolean;
  tooltip?: string;
}

const tabs: TabConfig[] = [
  { key: 'feishu', label: '飞书', disabled: false },
  { key: 'dingtalk', label: '钉钉', disabled: true, tooltip: '即将支持' },
  { key: 'wecom', label: '企业微信', disabled: true, tooltip: '即将支持' },
  { key: 'slack', label: 'Slack', disabled: true, tooltip: '即将支持' },
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

const getStatusText = (status: ConnectionStatus, platform: string): string => {
  switch (status) {
    case 'connected':
      return `${platform}已连接`;
    case 'connecting':
      return '连接中...';
    case 'error':
      return '连接错误';
    default:
      return `${platform}未配置`;
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
          启用飞书集成
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
                {showSecret ? '隐藏' : '显示'}
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

  const [localConfigs, setLocalConfigs] = useState<Record<IMPlatform, IMPlatformConfig | null>>({
    feishu: { enabled: false, appId: '', appSecret: '' },
    dingtalk: { enabled: false, appKey: '', appSecret: '' },
    wecom: { enabled: false, corpId: '', agentId: '', corpSecret: '' },
    slack: { enabled: false, botToken: '', signingSecret: '' },
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

  if (!isPanelOpen) {
    return null;
  }

  const handleTabChange = (newTab: IMPlatform) => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('有未保存的变更，确定要切换吗？');
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

  const currentStatus = statuses[activeTab];
  const currentConfig = localConfigs[activeTab];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-xl w-[500px] max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">IM 配置</h2>
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
              title={tab.tooltip}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-white'
              } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {tab.label}
              {tab.disabled && <span className="ml-1 text-xs text-warning">即将支持</span>}
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
                {getStatusText(currentStatus, tabs.find((t) => t.key === activeTab)?.label || '')}
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

            {activeTab !== 'feishu' && (
              <div className="text-center text-text-muted py-8">该平台即将支持，敬请期待</div>
            )}
          </div>
        </div>

        <div className="flex justify-between px-4 py-3 border-t border-border bg-elevated">
          <button
            onClick={handleTest}
            disabled={isLoading || !currentConfig}
            className="px-4 py-2 bg-elevated border border-border rounded-lg text-text-secondary hover:text-white disabled:opacity-50"
          >
            {isLoading ? '测试中...' : '测试连接'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setPanelOpen(false)}
              className="px-4 py-2 bg-elevated border border-border rounded-lg text-text-secondary hover:text-white"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !currentConfig}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
