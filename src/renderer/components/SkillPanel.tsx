import React, { useState, useEffect } from 'react';
import { SkillListing } from '../../skills/skillMarket';

interface SkillPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SkillPanel({ isOpen, onClose }: SkillPanelProps) {
  const [skills, setSkills] = useState<SkillListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillListing | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSkills();
    }
  }, [isOpen]);

  const loadSkills = async () => {
    setIsLoading(true);
    try {
      const skillList = await window.electron.invoke('skill:list');
      setSkills(skillList || []);
    } catch (error) {
      console.error('[SkillPanel] Failed to load skills:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstall = async () => {
    setMessage(null);
    const skillUrl = prompt('输入 Skill 路径或 URL:');
    if (!skillUrl) return;

    setIsLoading(true);
    try {
      const result = await window.electron.invoke('skill:install', { path: skillUrl });
      if (result.success) {
        setMessage({ type: 'success', text: '安装成功' });
        loadSkills();
      } else {
        setMessage({ type: 'error', text: result.error || '安装失败' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `安装失败: ${error}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUninstall = async (skillName: string) => {
    if (!confirm(`确定卸载 "${skillName}"？`)) return;

    setIsLoading(true);
    try {
      const result = await window.electron.invoke('skill:uninstall', { name: skillName });
      if (result.success) {
        setMessage({ type: 'success', text: '卸载成功' });
        loadSkills();
      } else {
        setMessage({ type: 'error', text: result.error || '卸载失败' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `卸载失败: ${error}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSkillsDir = async () => {
    try {
      await window.electron.invoke('skill:openDirectory');
    } catch (error) {
      console.error('[SkillPanel] Failed to open skills directory:', error);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-[800px] bg-surface border-l border-border flex flex-col">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white">Skill 管理</h2>
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

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <button onClick={handleInstall} className="btn btn-primary text-sm">
            安装 Skill
          </button>
          <button onClick={handleOpenSkillsDir} className="btn btn-secondary text-sm">
            打开目录
          </button>
          <div className="flex-1" />
          <button onClick={loadSkills} className="btn btn-secondary text-sm">
            刷新
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && skills.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-text-muted">加载中...</div>
          ) : skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-text-muted">
              <p>暂无已安装的 Skill</p>
              <p className="text-sm mt-2">点击"安装 Skill"开始使用</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {skills.map((skill) => (
                <div
                  key={skill.name}
                  className="bg-elevated border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-white">{skill.name}</h3>
                      {skill.version && (
                        <span className="text-xs text-text-muted">v{skill.version}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleUninstall(skill.name)}
                      className="p-1 rounded hover:bg-border text-text-muted hover:text-red-400"
                      title="卸载"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-text-muted mt-2 line-clamp-2">
                    {skill.description || '无描述'}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs text-text-muted truncate">{skill.path}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="text-xs text-text-muted">
            <p>Skill 目录: ~/.opencowork/skills</p>
            <p className="mt-1">支持 Claude 官方 SKILL.md 规范</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SkillPanel;
