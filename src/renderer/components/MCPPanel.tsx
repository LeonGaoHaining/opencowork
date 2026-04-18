import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';

type MCPConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface MCPConnectionConfig {
  transport?: 'stdio' | 'streamable-http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  auto_reload?: boolean;
}

interface MCPGlobalConfig {
  sampling: {
    enabled: boolean;
  };
  server: {
    enabled: boolean;
    port: number;
  };
}

interface MCPServerModeStatus {
  running: boolean;
  port: number | null;
}

interface MCPConnectionListItem {
  name: string;
  config: MCPConnectionConfig;
  status: MCPConnectionStatus;
  toolCount: number;
  error?: string;
}

interface MCPToolItem {
  name: string;
  description: string;
}

interface MCPPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type MCPPanelTab = 'clients' | 'server';

interface MCPDraft {
  name: string;
  mode: 'http' | 'stdio';
  url: string;
  command: string;
  argsText: string;
  headersText: string;
  envText: string;
  autoReload: boolean;
}

const EMPTY_DRAFT: MCPDraft = {
  name: '',
  mode: 'http',
  url: '',
  command: '',
  argsText: '',
  headersText: '{}',
  envText: '{}',
  autoReload: false,
};

function formatJson(value?: Record<string, string>): string {
  return JSON.stringify(value || {}, null, 2);
}

function buildDraft(name: string, config?: MCPConnectionConfig): MCPDraft {
  const mode =
    config?.transport === 'stdio'
      ? 'stdio'
      : config?.transport === 'streamable-http'
        ? 'http'
        : config?.command
          ? 'stdio'
          : 'http';

  return {
    name,
    mode,
    url: config?.url || '',
    command: config?.command || '',
    argsText: (config?.args || []).join(' '),
    headersText: formatJson(config?.headers),
    envText: formatJson(config?.env),
    autoReload: config?.auto_reload === true,
  };
}

export function MCPPanel({ isOpen, onClose }: MCPPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<MCPPanelTab>('clients');
  const [connections, setConnections] = useState<MCPConnectionListItem[]>([]);
  const [selectedConnectionName, setSelectedConnectionName] = useState<string | null>(null);
  const [draft, setDraft] = useState<MCPDraft>(EMPTY_DRAFT);
  const [tools, setTools] = useState<MCPToolItem[]>([]);
  const [globalConfig, setGlobalConfig] = useState<MCPGlobalConfig>({
    sampling: { enabled: true },
    server: { enabled: false, port: 3100 },
  });
  const [serverModeStatus, setServerModeStatus] = useState<MCPServerModeStatus>({
    running: false,
    port: null,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.name === selectedConnectionName) || null,
    [connections, selectedConnectionName]
  );

  const loadConnections = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electron.invoke('mcp:listServers');
      const configResult = await window.electron.invoke('mcp:getConfig');
      const serverStatusResult = await window.electron.invoke('mcp:serverStatus');
      const payload = result?.data || result || [];
      const configPayload = configResult?.data || configResult || {};
      const serverStatusPayload =
        serverStatusResult?.data?.data || serverStatusResult?.data || serverStatusResult;
      const list = Array.isArray(payload) ? payload : [];
      setConnections(list);
      if (configPayload?.sampling && configPayload?.server) {
        setGlobalConfig({
          sampling: { enabled: configPayload.sampling.enabled !== false },
          server: {
            enabled: configPayload.server.enabled === true,
            port: configPayload.server.port || 3100,
          },
        });
      }
      if (serverStatusPayload && typeof serverStatusPayload.running === 'boolean') {
        setServerModeStatus(serverStatusPayload);
      }

      if (list.length === 0) {
        setSelectedConnectionName(null);
        setDraft(EMPTY_DRAFT);
        setTools([]);
        return;
      }

      const nextSelectedName =
        list.some((connection) => connection.name === selectedConnectionName) &&
        selectedConnectionName
          ? selectedConnectionName
          : list[0].name;
      setSelectedConnectionName(nextSelectedName);
      const nextConnection = list.find((connection) => connection.name === nextSelectedName);
      if (nextConnection) {
        setDraft(buildDraft(nextConnection.name, nextConnection.config));
        if (nextConnection.status === 'connected') {
          const toolResult = await window.electron.invoke('mcp:listTools', {
            serverName: nextConnection.name,
          });
          const toolPayload = toolResult?.data || toolResult || [];
          setTools(Array.isArray(toolPayload) ? toolPayload : []);
        } else {
          setTools([]);
        }
      }
    } catch (error) {
      console.error('[MCPPanel] Failed to load connections:', error);
      setMessage({ type: 'error', text: t('mcpPanel.loadFailed') });
    } finally {
      setIsLoading(false);
    }
  }, [selectedConnectionName]);

  useEffect(() => {
    if (isOpen) {
      void loadConnections();
    }
  }, [isOpen, loadConnections]);

  const loadTools = useCallback(async (connectionName: string) => {
    try {
      const result = await window.electron.invoke('mcp:listTools', { serverName: connectionName });
      const payload = result?.data || result || [];
      setTools(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error('[MCPPanel] Failed to load tools:', error);
      setTools([]);
    }
  }, []);

  const selectConnection = async (connection: MCPConnectionListItem) => {
    setSelectedConnectionName(connection.name);
    setDraft(buildDraft(connection.name, connection.config));
    setMessage(null);
    if (connection.status === 'connected') {
      await loadTools(connection.name);
    } else {
      setTools([]);
    }
  };

  const updateDraft = (updates: Partial<MCPDraft>) => {
    setDraft((current) => ({ ...current, ...updates }));
  };

  const parseDraftConfig = (): { name: string; config: MCPConnectionConfig } => {
    const name = draft.name.trim();
    if (!name) {
      throw new Error(t('mcpPanel.nameRequired'));
    }

    const headers = draft.headersText.trim() ? JSON.parse(draft.headersText) : {};
    const env = draft.envText.trim() ? JSON.parse(draft.envText) : {};
    const args = draft.argsText
      .split(/\s+/)
      .map((arg) => arg.trim())
      .filter(Boolean);

    if (draft.mode === 'http') {
      if (!draft.url.trim()) {
        throw new Error(t('mcpPanel.httpUrlRequired'));
      }
      return {
        name,
        config: {
          transport: 'streamable-http',
          url: draft.url.trim(),
          headers,
          auto_reload: draft.autoReload,
        },
      };
    }

    if (!draft.command.trim()) {
      throw new Error(t('mcpPanel.stdioCommandRequired'));
    }

    return {
      name,
      config: {
        transport: 'stdio',
        command: draft.command.trim(),
        args,
        env,
        auto_reload: draft.autoReload,
      },
    };
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const { name, config } = parseDraftConfig();
      const result = await window.electron.invoke('mcp:saveConfig', {
        serverName: name,
        config,
      });
      const payload = result?.data || result;
      if (!result?.success || payload?.success === false) {
        throw new Error(payload?.error || result?.error || '保存失败');
      }
      setMessage({ type: 'success', text: t('mcpPanel.saveSuccess') });
      setSelectedConnectionName(name);
      await loadConnections();
    } catch (error: any) {
      console.error('[MCPPanel] Save failed:', error);
      setMessage({ type: 'error', text: error?.message || t('mcpPanel.saveFailed') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      const { name, config } = parseDraftConfig();
      const result = await window.electron.invoke('mcp:connect', {
        serverName: name,
        config,
      });
      const payload = result?.data || result;
      if (!result?.success || payload?.success === false) {
        throw new Error(payload?.error || result?.error || t('mcpPanel.connectFailed'));
      }
      setMessage({ type: 'success', text: t('mcpPanel.connectSuccess', { name }) });
      setSelectedConnectionName(name);
      await loadConnections();
      await loadTools(name);
    } catch (error: any) {
      console.error('[MCPPanel] Connect failed:', error);
      setMessage({ type: 'error', text: error?.message || t('mcpPanel.connectFailed') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!selectedConnectionName) return;
    try {
      setIsLoading(true);
      const result = await window.electron.invoke('mcp:disconnect', {
        serverName: selectedConnectionName,
      });
      const payload = result?.data || result;
      if (!result?.success || payload?.success === false) {
        throw new Error(payload?.error || result?.error || t('mcpPanel.disconnectFailed'));
      }
      setMessage({
        type: 'success',
        text: t('mcpPanel.disconnectSuccess', { name: selectedConnectionName }),
      });
      setTools([]);
      await loadConnections();
    } catch (error: any) {
      console.error('[MCPPanel] Disconnect failed:', error);
      setMessage({ type: 'error', text: error?.message || t('mcpPanel.disconnectFailed') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedConnectionName) return;
    if (!window.confirm(t('mcpPanel.deleteConfirm', { name: selectedConnectionName }))) return;

    try {
      setIsLoading(true);
      const result = await window.electron.invoke('mcp:deleteServer', {
        serverName: selectedConnectionName,
      });
      const payload = result?.data || result;
      if (!result?.success || payload?.success === false) {
        throw new Error(payload?.error || result?.error || t('mcpPanel.deleteFailed'));
      }
      setMessage({
        type: 'success',
        text: t('mcpPanel.deleteSuccess', { name: selectedConnectionName }),
      });
      setSelectedConnectionName(null);
      setDraft(EMPTY_DRAFT);
      setTools([]);
      await loadConnections();
    } catch (error: any) {
      console.error('[MCPPanel] Delete failed:', error);
      setMessage({ type: 'error', text: error?.message || t('mcpPanel.deleteFailed') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedConnectionName(null);
    setDraft(EMPTY_DRAFT);
    setTools([]);
    setMessage(null);
  };

  const handleRefreshTools = async () => {
    if (!selectedConnectionName) return;
    try {
      setIsLoading(true);
      const result = await window.electron.invoke('mcp:refreshTools', {
        serverName: selectedConnectionName,
      });
      const payload = result?.data || result;
      if (!result?.success) {
        throw new Error(payload?.error || result?.error || t('mcpPanel.refreshFailed'));
      }
      await loadTools(selectedConnectionName);
      setMessage({
        type: 'success',
        text: t('mcpPanel.refreshToolsSuccess', { name: selectedConnectionName }),
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || t('mcpPanel.refreshFailed') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateGlobalSettings = async (updates: Partial<MCPGlobalConfig>) => {
    const nextConfig = {
      sampling: {
        ...globalConfig.sampling,
        ...(updates.sampling || {}),
      },
      server: {
        ...globalConfig.server,
        ...(updates.server || {}),
      },
    };
    setGlobalConfig(nextConfig);
    try {
      await window.electron.invoke('mcp:updateSettings', nextConfig);
    } catch (error) {
      console.error('[MCPPanel] Failed to update MCP settings:', error);
    }
  };

  const handleToggleServerMode = async () => {
    try {
      setIsLoading(true);
      const result = serverModeStatus.running
        ? await window.electron.invoke('mcp:serverStop')
        : await window.electron.invoke('mcp:serverStart');
      const payload = result?.data?.data || result?.data || result;
      if (!result?.success) {
        throw new Error(payload?.error || result?.error || t('mcpPanel.toggleServerFailed'));
      }
      setServerModeStatus(payload);
      setMessage({
        type: 'success',
        text: payload.running
          ? t('mcpPanel.serverStarted', { port: payload.port })
          : t('mcpPanel.serverStopped'),
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || t('mcpPanel.toggleServerFailed') });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-[980px] bg-surface border-l border-border flex flex-col">
        <div className="h-14 flex items-center justify-between px-4 border-b border-border gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <h2 className="text-lg font-semibold text-white shrink-0">{t('mcpPanel.title')}</h2>
            {message && (
              <span
                className={`text-sm truncate ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}
              >
                {message.text}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('clients')}
              className={`btn text-sm ${activeTab === 'clients' ? 'btn-primary' : 'btn-secondary'}`}
            >
              {t('mcpPanel.clientsTab')}
            </button>
            <button
              onClick={() => setActiveTab('server')}
              className={`btn text-sm ${activeTab === 'server' ? 'btn-primary' : 'btn-secondary'}`}
            >
              {t('mcpPanel.serverModeTab')}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-border text-text-muted hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {activeTab === 'clients' ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <button
                onClick={handleCreateNew}
                className="btn btn-primary text-sm"
                disabled={isLoading}
              >
                {t('mcpPanel.newConnection')}
              </button>
              <button
                onClick={() => void handleSave()}
                className="btn btn-secondary text-sm"
                disabled={isLoading}
              >
                {t('mcpPanel.save')}
              </button>
              <button
                onClick={() => void handleConnect()}
                className="btn btn-secondary text-sm"
                disabled={isLoading}
              >
                {t('mcpPanel.connect')}
              </button>
              <button
                onClick={() => void handleDisconnect()}
                className="btn btn-secondary text-sm"
                disabled={isLoading || !selectedConnectionName}
              >
                {t('mcpPanel.disconnect')}
              </button>
              <button
                onClick={() => void handleDelete()}
                className="btn btn-danger text-sm"
                disabled={isLoading || !selectedConnectionName}
              >
                {t('mcpPanel.delete')}
              </button>
              <div className="flex-1" />
              <button
                onClick={() => void handleRefreshTools()}
                className="btn btn-secondary text-sm"
                disabled={isLoading || !selectedConnectionName}
              >
                {t('mcpPanel.refreshTools')}
              </button>
              <button
                onClick={() => void loadConnections()}
                className="btn btn-secondary text-sm"
                disabled={isLoading}
              >
                ↻
              </button>
            </div>

            <div className="flex-1 flex min-h-0">
              <div className="w-[320px] border-r border-border overflow-y-auto p-3 space-y-2">
                <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                  {t('mcpPanel.clientsSectionTitle')}
                </div>
                {connections.length === 0 ? (
                  <div className="text-sm text-text-muted px-2 py-3">
                    {t('mcpPanel.noConnections')}
                  </div>
                ) : (
                  connections.map((connection) => (
                    <button
                      key={connection.name}
                      onClick={() => void selectConnection(connection)}
                      className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                        selectedConnectionName === connection.name
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-elevated hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-white truncate">{connection.name}</span>
                        <span
                          className={`text-xs ${
                            connection.status === 'connected'
                              ? 'text-green-400'
                              : connection.status === 'connecting'
                                ? 'text-yellow-400'
                                : connection.status === 'error'
                                  ? 'text-red-400'
                                  : 'text-text-muted'
                          }`}
                        >
                          {connection.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        {connection.config.url ||
                          connection.config.command ||
                          t('mcpPanel.unconfigured')}
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        {t('mcpPanel.toolsCount', { count: connection.toolCount })}
                      </div>
                      {connection.error && (
                        <div className="mt-1 text-xs text-red-400 line-clamp-2">
                          {connection.error}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>

              <div className="flex-1 min-w-0 flex">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="rounded-lg border border-border bg-elevated p-3 space-y-3">
                    <div className="text-sm font-medium text-white">
                      {t('mcpPanel.connectionSettings')}
                    </div>

                    <div>
                      <label className="block text-sm text-text-secondary mb-1">
                        {t('mcpPanel.connectionName')}
                      </label>
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) => updateDraft({ name: e.target.value })}
                        placeholder="langchain-docs"
                        className="w-full px-3 py-2 bg-elevated border border-border rounded-lg text-text-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-text-secondary mb-2">
                        {t('mcpPanel.connectionType')}
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateDraft({ mode: 'http' })}
                          className={`btn text-sm ${draft.mode === 'http' ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          {t('mcpPanel.remoteHttp')}
                        </button>
                        <button
                          onClick={() => updateDraft({ mode: 'stdio' })}
                          className={`btn text-sm ${draft.mode === 'stdio' ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          {t('mcpPanel.localStdio')}
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-text-secondary">
                      <input
                        type="checkbox"
                        checked={draft.autoReload}
                        onChange={(e) => updateDraft({ autoReload: e.target.checked })}
                      />
                      {t('mcpPanel.autoReloadTools')}
                    </label>

                    {draft.mode === 'http' ? (
                      <>
                        <div>
                          <label className="block text-sm text-text-secondary mb-1">
                            {t('mcpPanel.urlLabel')}
                          </label>
                          <input
                            type="text"
                            value={draft.url}
                            onChange={(e) => updateDraft({ url: e.target.value })}
                            placeholder="https://docs.langchain.com/mcp"
                            className="w-full px-3 py-2 bg-elevated border border-border rounded-lg text-text-primary"
                          />
                          <div className="mt-1 text-xs text-text-muted">
                            {t('mcpPanel.remoteHttpHint')}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-text-secondary mb-1">
                            {t('mcpPanel.headersLabel')}
                          </label>
                          <textarea
                            value={draft.headersText}
                            onChange={(e) => updateDraft({ headersText: e.target.value })}
                            rows={6}
                            className="w-full px-3 py-2 bg-elevated border border-border rounded-lg text-text-primary font-mono text-sm"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm text-text-secondary mb-1">
                            {t('mcpPanel.commandLabel')}
                          </label>
                          <input
                            type="text"
                            value={draft.command}
                            onChange={(e) => updateDraft({ command: e.target.value })}
                            placeholder="npx"
                            className="w-full px-3 py-2 bg-elevated border border-border rounded-lg text-text-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-text-secondary mb-1">
                            {t('mcpPanel.argsLabel')}
                          </label>
                          <input
                            type="text"
                            value={draft.argsText}
                            onChange={(e) => updateDraft({ argsText: e.target.value })}
                            placeholder="-y some-mcp-server"
                            className="w-full px-3 py-2 bg-elevated border border-border rounded-lg text-text-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-text-secondary mb-1">
                            {t('mcpPanel.envLabel')}
                          </label>
                          <textarea
                            value={draft.envText}
                            onChange={(e) => updateDraft({ envText: e.target.value })}
                            rows={6}
                            className="w-full px-3 py-2 bg-elevated border border-border rounded-lg text-text-primary font-mono text-sm"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="w-[340px] border-l border-border overflow-y-auto p-4">
                  <div className="text-sm font-medium text-white mb-3">
                    {t('mcpPanel.toolsSectionTitle')}
                  </div>
                  {tools.length === 0 ? (
                    <div className="text-sm text-text-muted">
                      {selectedConnection?.status === 'connected'
                        ? t('mcpPanel.noToolsForConnection')
                        : t('mcpPanel.connectToViewTools')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tools.map((tool) => (
                        <div
                          key={tool.name}
                          className="rounded-lg border border-border bg-elevated px-3 py-2"
                        >
                          <div className="text-sm font-medium text-white">{tool.name}</div>
                          <div className="mt-1 text-xs text-text-muted">
                            {tool.description || t('mcpPanel.noDescription')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated p-4">
              <div>
                <div className="text-sm font-medium text-white">
                  {t('mcpPanel.serverModeTitle')}
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  {t('mcpPanel.serverModeDescription')}
                </div>
              </div>
              <button
                onClick={() => void handleToggleServerMode()}
                className="btn btn-secondary text-sm"
                disabled={isLoading}
              >
                {serverModeStatus.running ? t('mcpPanel.stopServer') : t('mcpPanel.startServer')}
              </button>
            </div>

            <div className="rounded-lg border border-border bg-elevated p-4 space-y-4">
              <div className="text-sm font-medium text-white">{t('mcpPanel.globalSettings')}</div>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={globalConfig.sampling.enabled}
                  onChange={(e) =>
                    void handleUpdateGlobalSettings({
                      sampling: { enabled: e.target.checked },
                    })
                  }
                />
                {t('mcpPanel.enableSampling')}
              </label>
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <span>{t('mcpPanel.serverPort')}</span>
                <input
                  type="number"
                  value={globalConfig.server.port}
                  onChange={(e) =>
                    void handleUpdateGlobalSettings({
                      server: {
                        enabled: globalConfig.server.enabled,
                        port: Number(e.target.value) || 3100,
                      },
                    })
                  }
                  className="w-28 px-2 py-1 bg-background border border-border rounded text-white"
                />
              </div>
              <div className="rounded border border-border bg-background px-3 py-2 text-sm text-text-secondary">
                {serverModeStatus.running
                  ? t('mcpPanel.serverRunning', { port: serverModeStatus.port })
                  : t('mcpPanel.serverStoppedStatus')}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MCPPanel;
