import React, { useState, useEffect, useCallback } from 'react';
import { SkillListing } from '../../skills/skillMarket';
import { useTranslation } from '../i18n/useTranslation';

interface SkillPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: (path: string) => void;
  isLoading: boolean;
}

interface SkillPreview {
  name?: string;
  description?: string;
}

function renderSkillDetailList(items?: string[]): React.ReactNode {
  if (!items || items.length === 0) {
    return <span className="text-text-muted">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded bg-border px-2 py-0.5 text-[11px] text-text-secondary">
          {item}
        </span>
      ))}
    </div>
  );
}

function getRefreshMessage(t: ReturnType<typeof useTranslation>['t']): string {
  const translated = t('skillPanel.refreshSuccess');
  return translated === 'skillPanel.refreshSuccess' ? 'Skill library refreshed' : translated;
}

function getFallbackTranslation(
  t: ReturnType<typeof useTranslation>['t'],
  key: string,
  fallback: string
): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function getSkillDirectoryValidationMessage(
  code: string | undefined,
  fallback: string | undefined,
  t: ReturnType<typeof useTranslation>['t']
): string {
  switch (code) {
    case 'PATH_REQUIRED':
      return t('skillPanel.pathRequired');
    case 'NOT_DIRECTORY':
      return t('skillPanel.notDirectory');
    case 'MISSING_SKILL_MD':
      return t('skillPanel.missingSkillFile');
    default:
      return fallback || t('skillPanel.invalidDirectory');
  }
}

function InstallModal({ isOpen, onClose, onInstall, isLoading }: InstallModalProps) {
  const { t } = useTranslation();
  const [path, setPath] = useState('');
  const [validationMessage, setValidationMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);
  const [skillPreview, setSkillPreview] = useState<SkillPreview | null>(null);

  const validatePath = async (skillPath: string): Promise<boolean> => {
    const trimmedPath = skillPath.trim();
    if (!trimmedPath) {
      setValidationMessage(null);
      setSkillPreview(null);
      return false;
    }

    try {
      const result = await window.electron.invoke('skill:validateDirectory', { path: trimmedPath });
      const payload = result?.data || result;
      if (result?.success && payload?.valid) {
        setValidationMessage({ type: 'success', text: t('skillPanel.validDirectory') });
        setSkillPreview(payload?.preview || null);
        return true;
      }

      setSkillPreview(null);
      setValidationMessage({
        type: 'error',
        text: getSkillDirectoryValidationMessage(payload?.code, payload?.error || result?.error, t),
      });
      return false;
    } catch (error) {
      console.error('[SkillPanel] Failed to validate skill directory:', error);
      setSkillPreview(null);
      setValidationMessage({
        type: 'error',
        text: `${t('skillPanel.selectDirectoryFailed')}: ${error}`,
      });
      return false;
    }
  };

  const handleBrowse = async () => {
    try {
      const result = await window.electron.invoke('skill:selectDirectory');
      const payload = result?.data || result;
      if (result?.success && payload?.path) {
        setPath(payload.path);
        await validatePath(payload.path);
      }
    } catch (error) {
      console.error('[SkillPanel] Failed to select skill directory:', error);
      alert(`${t('skillPanel.selectDirectoryFailed')}: ${error}`);
    }
  };

  const handleInstallClick = async () => {
    const isValid = await validatePath(path);
    if (isValid) {
      onInstall(path.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-[400px] bg-surface border border-border rounded-lg p-6 m-auto">
        <h3 className="text-lg font-semibold text-white mb-4">{t('skillPanel.title')}</h3>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={path}
            onChange={(e) => {
              setPath(e.target.value);
              setValidationMessage(null);
              setSkillPreview(null);
            }}
            placeholder={t('skillPanel.skillPath')}
            className="flex-1 px-3 py-2 bg-background border border-border rounded text-sm text-white placeholder-text-muted focus:outline-none focus:border-primary"
            onBlur={() => {
              if (path.trim()) {
                void validatePath(path);
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && path.trim() && void handleInstallClick()}
            disabled={isLoading}
          />
          <button onClick={handleBrowse} className="btn btn-secondary" disabled={isLoading}>
            {t('skillPanel.browse')}
          </button>
        </div>
        {validationMessage && (
          <div
            className={`text-sm mb-4 ${
              validationMessage.type === 'success' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {validationMessage.text}
          </div>
        )}
        {skillPreview && (
          <div className="mb-4 rounded border border-border bg-background/60 p-3 text-sm">
            <div className="text-text-secondary mb-1">{t('skillPanel.previewTitle')}</div>
            <div className="text-white font-medium">
              {t('skillPanel.previewName')}: {skillPreview.name || '-'}
            </div>
            <div className="text-text-muted mt-1 whitespace-pre-wrap">
              {t('skillPanel.previewDescription')}: {skillPreview.description || '-'}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary" disabled={isLoading}>
            {t('skillPanel.cancel')}
          </button>
          <button
            onClick={() => void handleInstallClick()}
            className="btn btn-primary"
            disabled={!path.trim() || isLoading}
          >
            {isLoading ? t('skillPanel.installing') : t('skillPanel.install')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SkillPanel({ isOpen, onClose }: SkillPanelProps) {
  const { t } = useTranslation();
  const searchSkillsLabel = getFallbackTranslation(t, 'skillPanel.searchSkills', 'Search skills');
  const sourceFilterLabel = getFallbackTranslation(t, 'skillPanel.sourceFilter', 'Skill source filter');
  const invocableFilterLabel = getFallbackTranslation(
    t,
    'skillPanel.invocableFilter',
    'Skill invocation filter'
  );
  const updateFilterLabel = getFallbackTranslation(t, 'skillPanel.updateFilter', 'Update filter');
  const [skills, setSkills] = useState<SkillListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'official' | 'agent-created' | 'market'>('all');
  const [invocableFilter, setInvocableFilter] = useState<'all' | 'user' | 'model'>('all');
  const [updateFilter, setUpdateFilter] = useState<'all' | 'update-available'>('all');

  const filteredSkills = skills.filter((skill) => {
    const matchesKeyword =
      !searchKeyword.trim() ||
      skill.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      skill.path.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      (skill.tags || []).some((tag) => tag.toLowerCase().includes(searchKeyword.toLowerCase()));
    const matchesSource = sourceFilter === 'all' || skill.source === sourceFilter;
    const matchesInvocable =
      invocableFilter === 'all' ||
      (invocableFilter === 'user' && skill.userInvocable !== false) ||
      (invocableFilter === 'model' && skill.userInvocable === false);
    const matchesUpdate = updateFilter === 'all' || !!skill.updateAvailable;
    return matchesKeyword && matchesSource && matchesInvocable && matchesUpdate;
  });

  const visibleSkills = [...filteredSkills].sort((left, right) => {
    const leftUpdate = left.updateAvailable ? 1 : 0;
    const rightUpdate = right.updateAvailable ? 1 : 0;
    if (leftUpdate !== rightUpdate) {
      return rightUpdate - leftUpdate;
    }

    const leftSource = left.source || '';
    const rightSource = right.source || '';
    if (leftSource !== rightSource) {
      return leftSource.localeCompare(rightSource);
    }

    return left.name.localeCompare(right.name);
  });

  const loadSkills = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electron.invoke('skill:list');
      const skills = result?.data || result || [];
      setSkills(Array.isArray(skills) ? skills : []);
    } catch (error) {
      console.error('[SkillPanel] Failed to load skills:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSkills();
    }
  }, [isOpen, loadSkills]);

  useEffect(() => {
    const handleSkillChanged = (): void => {
      if (isOpen) {
        void loadSkills();
        setMessage({ type: 'success', text: getRefreshMessage(t) });
      }
    };

    window.addEventListener('skill:changed', handleSkillChanged as EventListener);
    return () => {
      window.removeEventListener('skill:changed', handleSkillChanged as EventListener);
    };
  }, [isOpen, loadSkills, t]);

  const handleInstall = async (skillPath: string) => {
    if (!skillPath) return;
    setShowInstallModal(false);
    setMessage(null);
    setIsLoading(true);

    try {
      const result = await window.electron.invoke('skill:install', { path: skillPath });
      const payload = result?.data || result;
      if (result?.success && payload?.success !== false) {
        setMessage({ type: 'success', text: t('skillPanel.installSuccess') });
        loadSkills();
      } else {
        setMessage({
          type: 'error',
          text: payload?.error || result?.error || t('skillPanel.installFailed'),
        });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `${t('skillPanel.installFailed')}: ${error}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUninstall = async (skillName: string) => {
    if (!confirm(t('skillPanel.confirmUninstall', { name: skillName }))) return;

    setIsLoading(true);
    try {
      const result = await window.electron.invoke('skill:uninstall', { name: skillName });
      const payload = result?.data || result;
      if (result?.success && payload?.success !== false) {
        setMessage({ type: 'success', text: t('skillPanel.uninstallSuccess') });
        loadSkills();
      } else {
        setMessage({
          type: 'error',
          text: payload?.error || result?.error || t('skillPanel.uninstallFailed'),
        });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `${t('skillPanel.uninstallFailed')}: ${error}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (skillName: string) => {
    setIsLoading(true);
    try {
      const result = await window.electron.invoke('skill:update', { name: skillName });
      const payload = result?.data || result;
      if (result?.success && payload?.success !== false) {
        setMessage({ type: 'success', text: getFallbackTranslation(t, 'skillPanel.updateSuccess', 'Skill refreshed') });
        await loadSkills();
      } else {
        setMessage({
          type: 'error',
          text:
            payload?.error ||
            result?.error ||
            getFallbackTranslation(t, 'skillPanel.updateFailed', 'Skill refresh failed'),
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `${getFallbackTranslation(t, 'skillPanel.updateFailed', 'Skill refresh failed')}: ${error}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSkillsDir = async () => {
    try {
      const result = await window.electron.invoke('skill:openDirectory');
      const payload = result?.data || result;
      if (!result?.success || payload?.success === false) {
        const pathDetails = payload?.attemptedPaths?.length
          ? ` (${payload.attemptedPaths.join(' -> ')})`
          : payload?.path
            ? ` (${payload.path})`
            : '';
        setMessage({
          type: 'error',
          text: `${payload?.error || result?.error || t('skillPanel.openFolderFailed')}${pathDetails}`,
        });
      }
    } catch (error) {
      console.error('[SkillPanel] Failed to open skills directory:', error);
      setMessage({ type: 'error', text: `${t('skillPanel.openFolderFailed')}: ${error}` });
    }
  };

  const handleResetFilters = () => {
    setSearchKeyword('');
    setSourceFilter('all');
    setInvocableFilter('all');
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/50" onClick={onClose} />
        <div className="w-[800px] bg-surface border-l border-border flex flex-col">
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-border">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-white">
                {t('skillPanel.skillManagement')}
              </h2>
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
            <div className="text-xs text-text-muted">
              {skills.length} {t('skillPanel.skills') || 'skills'} · {filteredSkills.length}{' '}
              {t('skillPanel.visible') || 'visible'}
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
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder={searchSkillsLabel}
              aria-label={searchSkillsLabel}
              className="w-56 min-w-0 rounded border border-border bg-background px-3 py-1 text-sm text-white"
            />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
              aria-label={sourceFilterLabel}
              className="rounded border border-border bg-background px-2 py-1 text-sm text-white"
            >
              <option value="all">{t('skillPanel.allSources') || 'All sources'}</option>
              <option value="official">official</option>
              <option value="agent-created">agent-created</option>
              <option value="market">market</option>
            </select>
          <select
            value={invocableFilter}
            onChange={(e) => setInvocableFilter(e.target.value as typeof invocableFilter)}
            aria-label={invocableFilterLabel}
            className="rounded border border-border bg-background px-2 py-1 text-sm text-white"
            >
              <option value="all">{t('skillPanel.allCapabilities') || 'All capabilities'}</option>
              <option value="user">{t('skillPanel.userInvocable') || 'User invocable'}</option>
              <option value="model">{t('skillPanel.modelOnly') || 'Model only'}</option>
            </select>
            <select
              value={updateFilter}
              onChange={(e) => setUpdateFilter(e.target.value as typeof updateFilter)}
              aria-label={updateFilterLabel}
              className="rounded border border-border bg-background px-2 py-1 text-sm text-white"
            >
              <option value="all">{t('skillPanel.allUpdates') || 'All updates'}</option>
              <option value="update-available">
                {t('skillPanel.updateAvailableOnly') || 'Updates available'}
              </option>
            </select>
            <button onClick={handleResetFilters} className="btn btn-secondary text-sm">
              {t('skillPanel.resetFilters') || 'Reset filters'}
            </button>
            <button
              onClick={() => setShowInstallModal(true)}
              className="btn btn-primary text-sm"
              disabled={isLoading}
            >
              {t('skillPanel.addSkill')}
            </button>
            <button onClick={handleOpenSkillsDir} className="btn btn-secondary text-sm">
              {t('skillPanel.openFolder')}
            </button>
            <div className="flex-1" />
            <button onClick={loadSkills} className="btn btn-secondary text-sm" disabled={isLoading}>
              ↻
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading && skills.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-text-muted">...</div>
            ) : skills.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-text-muted">
                <p>{t('skillPanel.noSkills')}</p>
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-text-muted">
                <p>{t('skillPanel.noFilteredSkills') || 'No skills match the current filters'}</p>
                <button onClick={handleResetFilters} className="mt-3 btn btn-secondary text-sm">
                  {t('skillPanel.resetFilters') || 'Reset filters'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {visibleSkills.map((skill, index) => (
                  <div
                    key={skill.name || index}
                    className="bg-elevated border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-white">{skill.name}</h3>
                        {skill.version && (
                          <span className="text-xs text-text-muted">v{skill.version}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => void handleUpdate(skill.name)}
                          className="p-1 rounded hover:bg-border text-text-muted hover:text-primary"
                          title={skill.updateAvailable ? 'Update skill' : 'Refresh skill'}
                          aria-label={skill.updateAvailable ? 'Update skill' : 'Refresh skill'}
                          disabled={isLoading}
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
                              d="M4 4v6h6M20 20v-6h-6M20 8a8 8 0 00-14.5-3M4 16a8 8 0 0014.5 3"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleUninstall(skill.name)}
                          className="p-1 rounded hover:bg-border text-text-muted hover:text-red-400"
                          title="卸载"
                          disabled={isLoading}
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
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text-muted">
                      <span className="rounded bg-border px-2 py-0.5">
                        来源: {skill.source || 'unknown'}
                      </span>
                      {skill.updateAvailable && (
                        <span className="rounded bg-warning/15 px-2 py-0.5 text-warning">
                          {getFallbackTranslation(t, 'skillPanel.updateAvailable', 'Update available')}
                        </span>
                      )}
                      <span className="rounded bg-border px-2 py-0.5">
                        {skill.userInvocable ? '可用户调用' : '仅模型调用'}
                      </span>
                    </div>
                    <p className="text-sm text-text-muted mt-2 line-clamp-2">
                      {skill.description || '无描述'}
                    </p>
                    <div className="mt-3 space-y-2 text-xs">
                      <div>
                        <div className="text-text-muted mb-1">用途</div>
                        {renderSkillDetailList(skill.useCases)}
                      </div>
                      <div>
                        <div className="text-text-muted mb-1">输入</div>
                        <div className="text-text-secondary whitespace-pre-wrap break-words">
                          {skill.inputSpec || skill.argumentHint || '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-text-muted mb-1">输出</div>
                        <div className="text-text-secondary whitespace-pre-wrap break-words">
                          {skill.outputSpec || '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-text-muted mb-1">失败提示</div>
                        {renderSkillDetailList(skill.failureHints)}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-text-muted mb-1">标签</div>
                          {renderSkillDetailList(skill.tags)}
                        </div>
                        <div>
                          <div className="text-text-muted mb-1">允许工具</div>
                          {renderSkillDetailList(skill.allowedTools)}
                        </div>
                      </div>
                    </div>
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

      <InstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        onInstall={handleInstall}
        isLoading={isLoading}
      />
    </>
  );
}

export default SkillPanel;
