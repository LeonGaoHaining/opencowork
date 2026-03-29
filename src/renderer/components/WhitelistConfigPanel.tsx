import React, { useState, useEffect } from 'react';
import {
  WhitelistConfig,
  CLICommandWhitelist,
  PathWhitelist,
  AgentWhitelist,
  RiskLevel,
  getRiskLevelColor,
  DEFAULT_WHITELIST_CONFIG,
} from '../../config/whitelistConfig';

type TabType = 'cli' | 'paths' | 'agents' | 'network';

interface WhitelistConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WhitelistConfigPanel({ isOpen, onClose }: WhitelistConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('cli');
  const [config, setConfig] = useState<WhitelistConfig>(DEFAULT_WHITELIST_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const loadedConfig = await window.electron.invoke('whitelist:load');
      setConfig(loadedConfig || DEFAULT_WHITELIST_CONFIG);
    } catch (error) {
      console.error('[WhitelistConfigPanel] Failed to load config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const result = await window.electron.invoke('whitelist:save', { config });
      if (result.success) {
        setMessage({ type: 'success', text: '配置保存成功' });
      } else {
        setMessage({ type: 'error', text: result.validation.errors.join(', ') });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `保存失败: ${error}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm('确定重置为默认配置？')) {
      setConfig(DEFAULT_WHITELIST_CONFIG);
      await handleSave();
    }
  };

  const updateCLICommand = (index: number, updates: Partial<CLICommandWhitelist>) => {
    const newCommands = [...config.cli.commands];
    newCommands[index] = { ...newCommands[index], ...updates };
    setConfig({ ...config, cli: { ...config.cli, commands: newCommands } });
  };

  const updatePathEntry = (index: number, updates: Partial<PathWhitelist>) => {
    const newEntries = [...config.paths.entries];
    newEntries[index] = { ...newEntries[index], ...updates };
    setConfig({ ...config, paths: { ...config.paths, entries: newEntries } });
  };

  const updateAgentTool = (index: number, updates: Partial<AgentWhitelist>) => {
    const newTools = [...config.agents.tools];
    newTools[index] = { ...newTools[index], ...updates };
    setConfig({ ...config, agents: { ...config.agents, tools: newTools } });
  };

  const getRiskLevelBadgeClass = (riskLevel: RiskLevel) => {
    switch (riskLevel) {
      case 'low':
        return 'bg-green-400/20 text-green-400';
      case 'medium':
        return 'bg-yellow-400/20 text-yellow-400';
      case 'high':
        return 'bg-orange-400/20 text-orange-400';
      case 'critical':
        return 'bg-red-400/20 text-red-400';
      default:
        return 'bg-gray-400/20 text-gray-400';
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-[900px] bg-surface border-l border-border flex flex-col">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white">白名单配置</h2>
            {message && (
              <span
                className={`text-sm ${
                  message.type === 'success' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {message.text}
              </span>
            )}
          </div>
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

        {/* Tabs */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border">
          <div className="flex gap-1">
            {(['cli', 'paths', 'agents', 'network'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded text-sm transition-colors ${
                  activeTab === tab
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:text-white hover:bg-border'
                }`}
              >
                {tab === 'cli'
                  ? 'CLI 命令'
                  : tab === 'paths'
                    ? '路径访问'
                    : tab === 'agents'
                      ? 'Agent 工具'
                      : '网络访问'}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex gap-2">
            <button onClick={handleReset} className="btn btn-secondary text-sm">
              重置
            </button>
            <button onClick={handleSave} disabled={isSaving} className="btn btn-primary text-sm">
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-text-muted">加载中...</div>
          ) : (
            <>
              {/* CLI Commands Tab */}
              {activeTab === 'cli' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">启用 CLI 白名单</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.cli.enabled}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              cli: { ...config.cli, enabled: e.target.checked },
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                      </label>
                    </div>
                  </div>

                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-elevated">
                        <tr>
                          <th className="text-left px-4 py-2 text-sm font-medium text-text-muted">
                            命令
                          </th>
                          <th className="text-left px-4 py-2 text-sm font-medium text-text-muted">
                            参数
                          </th>
                          <th className="text-left px-4 py-2 text-sm font-medium text-text-muted">
                            风险等级
                          </th>
                          <th className="text-center px-4 py-2 text-sm font-medium text-text-muted">
                            启用
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {config.cli.commands.map((cmd, index) => (
                          <tr key={cmd.command} className="border-t border-border">
                            <td className="px-4 py-2">
                              <span className="text-sm text-white font-mono">{cmd.command}</span>
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={cmd.args?.join(', ') || ''}
                                onChange={(e) =>
                                  updateCLICommand(index, {
                                    args: e.target.value
                                      .split(',')
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  })
                                }
                                className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-white"
                                placeholder="参数列表"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <select
                                value={cmd.riskLevel}
                                onChange={(e) =>
                                  updateCLICommand(index, {
                                    riskLevel: e.target.value as RiskLevel,
                                  })
                                }
                                className={`px-2 py-1 rounded text-sm border ${getRiskLevelBadgeClass(cmd.riskLevel)} border-transparent`}
                              >
                                <option value="low">低</option>
                                <option value="medium">中</option>
                                <option value="high">高</option>
                                <option value="critical">极高</option>
                              </select>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={cmd.allowed}
                                onChange={(e) =>
                                  updateCLICommand(index, { allowed: e.target.checked })
                                }
                                className="w-4 h-4"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Paths Tab */}
              {activeTab === 'paths' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">启用路径白名单</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.paths.enabled}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              paths: { ...config.paths, enabled: e.target.checked },
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                      </label>
                    </div>
                  </div>

                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-elevated">
                        <tr>
                          <th className="text-left px-4 py-2 text-sm font-medium text-text-muted">
                            路径
                          </th>
                          <th className="text-center px-4 py-2 text-sm font-medium text-text-muted">
                            读取
                          </th>
                          <th className="text-center px-4 py-2 text-sm font-medium text-text-muted">
                            写入
                          </th>
                          <th className="text-center px-4 py-2 text-sm font-medium text-text-muted">
                            执行
                          </th>
                          <th className="text-center px-4 py-2 text-sm font-medium text-text-muted">
                            启用
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {config.paths.entries.map((entry, index) => (
                          <tr key={entry.path} className="border-t border-border">
                            <td className="px-4 py-2">
                              <span className="text-sm text-white font-mono">{entry.path}</span>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={entry.permissions.read}
                                onChange={(e) =>
                                  updatePathEntry(index, {
                                    permissions: { ...entry.permissions, read: e.target.checked },
                                  })
                                }
                                className="w-4 h-4"
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={entry.permissions.write}
                                onChange={(e) =>
                                  updatePathEntry(index, {
                                    permissions: { ...entry.permissions, write: e.target.checked },
                                  })
                                }
                                className="w-4 h-4"
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={entry.permissions.execute}
                                onChange={(e) =>
                                  updatePathEntry(index, {
                                    permissions: {
                                      ...entry.permissions,
                                      execute: e.target.checked,
                                    },
                                  })
                                }
                                className="w-4 h-4"
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={entry.allowed}
                                onChange={(e) =>
                                  updatePathEntry(index, { allowed: e.target.checked })
                                }
                                className="w-4 h-4"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Agents Tab */}
              {activeTab === 'agents' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">启用 Agent 工具白名单</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.agents.enabled}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              agents: { ...config.agents, enabled: e.target.checked },
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-muted">最大步数/任务:</span>
                      <input
                        type="number"
                        value={config.agents.maxStepsPerTask || 100}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            agents: {
                              ...config.agents,
                              maxStepsPerTask: parseInt(e.target.value) || 100,
                            },
                          })
                        }
                        className="w-20 bg-background border border-border rounded px-2 py-1 text-sm text-white"
                      />
                    </div>
                  </div>

                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-elevated">
                        <tr>
                          <th className="text-left px-4 py-2 text-sm font-medium text-text-muted">
                            工具名称
                          </th>
                          <th className="text-left px-4 py-2 text-sm font-medium text-text-muted">
                            描述
                          </th>
                          <th className="text-center px-4 py-2 text-sm font-medium text-text-muted">
                            启用
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {config.agents.tools.map((tool, index) => (
                          <tr key={tool.toolName} className="border-t border-border">
                            <td className="px-4 py-2">
                              <span className="text-sm text-white font-mono">{tool.toolName}</span>
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={tool.description || ''}
                                onChange={(e) =>
                                  updateAgentTool(index, { description: e.target.value })
                                }
                                className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-white"
                                placeholder="描述"
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={tool.allowed}
                                onChange={(e) =>
                                  updateAgentTool(index, { allowed: e.target.checked })
                                }
                                className="w-4 h-4"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Network Tab */}
              {activeTab === 'network' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">启用网络白名单</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.network.enabled}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              network: { ...config.network, enabled: e.target.checked },
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-white mb-2">允许的主机</h3>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-elevated">
                          <tr>
                            <th className="text-left px-4 py-2 text-sm font-medium text-text-muted">
                              主机
                            </th>
                            <th className="text-center px-4 py-2 text-sm font-medium text-text-muted">
                              启用
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {config.network.hosts.map((host, index) => (
                            <tr key={host.host} className="border-t border-border">
                              <td className="px-4 py-2">
                                <span className="text-sm text-white font-mono">{host.host}</span>
                              </td>
                              <td className="px-4 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={host.allowed}
                                  onChange={(e) => {
                                    const newHosts = [...config.network.hosts];
                                    newHosts[index] = {
                                      ...newHosts[index],
                                      allowed: e.target.checked,
                                    };
                                    setConfig({
                                      ...config,
                                      network: { ...config.network, hosts: newHosts },
                                    });
                                  }}
                                  className="w-4 h-4"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-white mb-2">阻止的端口</h3>
                    <div className="flex flex-wrap gap-2">
                      {[22, 3389, 3306, 5432, 27017, 6379].map((port) => (
                        <label
                          key={port}
                          className={`px-3 py-1 rounded cursor-pointer ${
                            config.network.blockedPorts.includes(port)
                              ? 'bg-red-400/20 text-red-400 border border-red-400/30'
                              : 'bg-elevated text-text-muted border border-border'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={config.network.blockedPorts.includes(port)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setConfig({
                                  ...config,
                                  network: {
                                    ...config.network,
                                    blockedPorts: [...config.network.blockedPorts, port],
                                  },
                                });
                              } else {
                                setConfig({
                                  ...config,
                                  network: {
                                    ...config.network,
                                    blockedPorts: config.network.blockedPorts.filter(
                                      (p) => p !== port
                                    ),
                                  },
                                });
                              }
                            }}
                            className="sr-only"
                          />
                          {port}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default WhitelistConfigPanel;
