import React, { useEffect, useState } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { useHistoryStore } from '../stores/historyStore';
import { useSchedulerStore } from '../stores/schedulerStore';
import { useIMStore, ConnectionStatus } from '../stores/imStore';
import { useTranslation } from '../i18n/useTranslation';
import { PersistedTaskStateSummary } from '../../core/runtime/taskState';
import { VisualRunDialog } from './VisualRunDialog';

interface ControlBarProps {
  onSkillClick: () => void;
  onMCPClick: () => void;
  onTemplateClick: () => void;
  onRunsClick: () => void;
  onSettingsClick: () => void;
  onOverviewClick: () => void;
}

export function ControlBar({ onSkillClick, onMCPClick, onTemplateClick, onRunsClick, onSettingsClick, onOverviewClick }: ControlBarProps) {
  const [savedStates, setSavedStates] = useState<PersistedTaskStateSummary[]>([]);
  const [isRestoreOpen, setRestoreOpen] = useState(false);
  const [isVisualRunOpen, setVisualRunOpen] = useState(false);
  const {
    task,
    setTask,
    setTaskInterrupted,
    setTakeover,
    showPlanViewer,
    setShowPlanViewer,
    previewMode,
    setPreviewMode,
    addLog,
  } = useTaskStore();
  const { setIsOpen: setHistoryOpen } = useHistoryStore();
  const { setOpen: setSchedulerOpen } = useSchedulerStore();
  const { statuses, setPanelOpen: setImPanelOpen, loadAll: loadIMStatus } = useIMStore();
  const { t, switchLanguage } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    switchLanguage(e.target.value as 'zh' | 'en');
  };

  useEffect(() => {
    loadIMStatus();
  }, []);

  const getIMStatus = (): ConnectionStatus => {
    return statuses.feishu;
  };

  const getIMStatusText = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return t('imConfig.status.connected', { platform: 'Feishu' });
      case 'connecting':
        return t('imConfig.status.connecting');
      case 'error':
        return t('imConfig.status.error');
      default:
        return t('imConfig.status.notConfigured', { platform: 'Feishu' });
    }
  };

  const handleTakeover = () => {
    setTakeover(true);
  };

  const handlePause = async () => {
    console.log('Pause task');
    if (task?.id) {
      try {
        await window.electron.invoke('task:pause', { handleId: task.id });
      } catch (error) {
        console.error('Pause error:', error);
      }
    }
  };

  const handleResume = async () => {
    console.log('Resume task');
    if (task?.id) {
      try {
        await window.electron.invoke('task:resume', { handleId: task.id });
      } catch (error) {
        console.error('Resume error:', error);
      }
    }
  };

  const handleStop = async () => {
    console.log('Stop task');
    if (task?.id) {
      try {
        await window.electron.invoke('task:stop', { handleId: task.id });
      } catch (error) {
        console.error('Stop error:', error);
      }
    }
  };

  const handleInterruptAndSave = async () => {
    if (!task?.id) return;

    try {
      const result = await window.electron.invoke('task:interrupt', {
        handleId: task.id,
        reason: 'user_interrupt',
      });
      const payload = result?.data || result;

      if (result?.success && payload?.handleId) {
        setTaskInterrupted(true, 'user_interrupt', payload.handleId);
        addLog({ type: 'info', message: t('restoreTask.saved', { handleId: payload.handleId }) });
        await loadSavedStates();
        alert(t('restoreTask.savedAlert', { handleId: payload.handleId }));
      } else {
        throw new Error(payload?.error || result?.error || t('restoreTask.saveFailed'));
      }
    } catch (error: any) {
      console.error('Interrupt/save error:', error);
      alert(error?.message || t('restoreTask.saveFailed'));
    }
  };

  const loadSavedStates = async () => {
    try {
      const result = await window.electron.invoke('task:listSavedStates');
      const payload = result?.data || result;
      setSavedStates(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error('Load saved states error:', error);
      setSavedStates([]);
    }
  };

  const handleRestoreTask = async (handleId?: string) => {
    const targetHandle = handleId || task?.id || '';
    if (!targetHandle) return;

    try {
      const result = await window.electron.invoke('task:restoreState', { handleId: targetHandle });
      const payload = result?.data || result;

      if (result?.success && payload?.handle) {
        const matchedState = savedStates.find((state) => state.handleId === targetHandle);
        setTask({
          id: payload.handle,
          status: payload.status || 'executing',
          description:
            matchedState?.taskDescription ||
            task?.description ||
            t('restoreTask.fallbackDescription', { handleId: payload.handle }),
          progress: task?.progress || { current: 0, total: 0 },
          interrupted: false,
          interruptReason: undefined,
          savedStateHandleId: targetHandle,
        });
        setTaskInterrupted(false, undefined, targetHandle);
        addLog({ type: 'info', message: t('restoreTask.restored', { handleId: payload.handle }) });
        setRestoreOpen(false);
      } else {
        throw new Error(payload?.error || result?.error || t('restoreTask.restoreFailed'));
      }
    } catch (error: any) {
      console.error('Restore task error:', error);
      alert(error?.message || t('restoreTask.restoreFailed'));
    }
  };

  const handleOpenRestoreList = async () => {
    await loadSavedStates();
    setRestoreOpen(true);
  };

  const handleDeleteSavedState = async (handleId: string) => {
    try {
      const result = await window.electron.invoke('task:deleteSavedState', { handleId });
      const payload = result?.data || result;
      if (!result?.success || payload?.success === false) {
        throw new Error(payload?.error || result?.error || t('restoreTask.deleteFailed'));
      }
      setSavedStates((states) => states.filter((state) => state.handleId !== handleId));
      addLog({ type: 'info', message: t('restoreTask.deleted', { handleId }) });
    } catch (error) {
      console.error('Delete saved state error:', error);
    }
  };

  const handleCheckLogin = async () => {
    console.log('Checking login popup...');
    try {
      const result = await window.electron.invoke('task:checkLoginPopup', {});
      console.log('Check login result:', result);
      const payload = result?.data || result;

      if (!payload?.handled) {
        alert(payload?.message || t('controlBar.loginPopupNotDetected'));
      }
    } catch (error) {
      console.error('Check login error:', error);
    }
  };

  const handlePreviewModeChange = async (mode: 'sidebar' | 'detached') => {
    try {
      const result = await window.electron.invoke('preview:setMode', { mode });
      const payload = result?.data || result;
      if (result?.success && payload?.success !== false) {
        setPreviewMode(mode);
      }
    } catch (error) {
      console.error('Preview mode change error:', error);
    }
  };

  return (
    <div className="h-14 flex items-center justify-between gap-3 px-3 border-t border-border bg-surface">
      {/* Left: Action buttons */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={handleCheckLogin}
          className="btn btn-secondary btn-compact"
          disabled={!task || task.status === 'idle'}
          title={t('controlBar.detectLogin')}
        >
          {t('controlBar.detectLogin')}
        </button>
        <button
          onClick={handleTakeover}
          className="btn btn-secondary btn-compact"
          disabled={!task || task.status === 'idle'}
        >
          {t('controlBar.takeover')}
        </button>
        {task?.status === 'paused' ? (
          <button onClick={handleResume} className="btn btn-primary btn-compact">
            {t('controlBar.resume')}
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="btn btn-secondary btn-compact"
            disabled={!task || task.status !== 'executing'}
          >
            {t('controlBar.pause')}
          </button>
        )}
        <button
          onClick={handleStop}
          className="btn btn-danger btn-compact"
          disabled={
            !task ||
            task.status === 'idle' ||
            task.status === 'completed' ||
            task.status === 'cancelled'
          }
        >
          {t('controlBar.stop')}
        </button>
        <button
          onClick={handleInterruptAndSave}
          className="btn btn-secondary btn-compact"
          disabled={!task || task.status !== 'executing'}
          title={t('controlBar.interruptSaveTitle')}
        >
          {t('controlBar.interruptSave')}
        </button>
        <button
          onClick={handleOpenRestoreList}
          className="btn btn-secondary btn-compact"
          title={t('controlBar.restoreTaskTitle')}
        >
          {t('controlBar.restoreTask')}
        </button>
        <button
          onClick={() => setVisualRunOpen(true)}
          className="btn btn-secondary btn-compact"
          title={t('controlBar.visualRunTitle')}
        >
          {t('controlBar.visualRun')}
        </button>
      </div>

      {/* Center: Status */}
      <div className="min-w-0 flex-1 truncate px-2 text-center text-xs text-text-secondary">
        {task ? (
          <span>
            {task.status === 'idle' && t('taskStatus.idle')}
            {task.status === 'planning' && t('taskStatus.planning')}
            {task.status === 'executing' && task.currentStep
              ? `${t('taskStatus.executing')}: ${task.currentStep}`
              : t('taskStatus.executing')}
            {task.status === 'paused' && t('taskStatus.paused')}
            {task.status === 'waiting_confirm' && t('taskStatus.waitingConfirm')}
            {task.status === 'completed' && t('taskStatus.completed')}
            {task.status === 'failed' &&
              `${t('taskStatus.failed')}: ${task.error || t('errors.unknownError')}`}
            {task.status === 'cancelled' && t('taskStatus.cancelled')}
          </span>
        ) : (
          t('app.noActiveTask')
        )}
      </div>

      {/* Right: View options */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Preview Mode Switcher - Icon buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePreviewModeChange('sidebar')}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
              previewMode === 'sidebar'
                ? 'bg-primary text-white'
                : 'bg-elevated text-text-secondary hover:text-white hover:bg-border'
            }`}
            title={t('controlBar.sidebarPreview')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
          </button>
          <button
            onClick={() => handlePreviewModeChange('detached')}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
              previewMode === 'detached'
                ? 'bg-primary text-white'
                : 'bg-elevated text-text-secondary hover:text-white hover:bg-border'
            }`}
            title={t('controlBar.independentWindow')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </button>
        </div>

        <button
          onClick={() => setHistoryOpen(true)}
          className="btn btn-secondary btn-compact"
          title={t('controlBar.history')}
        >
          {t('controlBar.history')}
        </button>

        <button
          onClick={() => setSchedulerOpen(true)}
          className="btn btn-secondary btn-compact"
          title={t('controlBar.scheduler')}
        >
          {t('controlBar.scheduler')}
        </button>

        <button
          onClick={onTemplateClick}
          className="btn btn-secondary btn-compact"
          title={t('controlBar.templates')}
        >
          {t('controlBar.templates')}
        </button>

        <button onClick={onRunsClick} className="btn btn-secondary btn-compact" title={t('controlBar.runs')}>
          {t('controlBar.runs')}
        </button>

        <button onClick={onMCPClick} className="btn btn-secondary btn-compact" title="MCP">
          MCP
        </button>

        <button
          onClick={() => {
            onSkillClick();
          }}
          className="btn btn-secondary btn-compact"
          title={t('controlBar.skills')}
        >
          {t('controlBar.skills')}
        </button>

        <button
          onClick={() => setShowPlanViewer(!showPlanViewer)}
          className={`btn btn-compact ${showPlanViewer ? 'btn-primary' : 'btn-secondary'}`}
        >
          {t('controlBar.plan')}
        </button>

        {(() => {
          const imStatus = getIMStatus();
          return (
            <button
              onClick={() => setImPanelOpen(true)}
              className={`btn btn-compact ${
                imStatus === 'connected' ? 'bg-success text-white' : 'btn-secondary'
              }`}
              title={getIMStatusText(imStatus)}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full mr-1 ${
                  imStatus === 'connected'
                    ? 'bg-success'
                    : imStatus === 'connecting'
                      ? 'bg-warning animate-pulse'
                      : imStatus === 'error'
                        ? 'bg-error'
                        : 'bg-text-muted'
                }`}
              />
              IM
            </button>
          );
        })()}

        <button
          onClick={onSettingsClick}
          className="btn btn-secondary btn-compact"
          title={t('settings.title')}
        >
          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c1.86-1.28 4.827-1.28 6.687 0M19 12h-2M12 19v-2m0-9V5m0 7h-2m9 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {t('settings.title')}
        </button>

        <button
          onClick={onOverviewClick}
          className="btn btn-secondary btn-compact"
          title={t('overview.title')}
        >
          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          {t('overview.title')}
        </button>

        {/* Language Switcher */}
        <select
          onChange={handleLanguageChange}
          className="btn btn-secondary btn-compact"
          defaultValue={
            localStorage.getItem('language') || (navigator.language.startsWith('zh') ? 'zh' : 'en')
          }
        >
          <option value="en">EN</option>
          <option value="zh">{t('language.zh')}</option>
        </select>
      </div>

      {isRestoreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[680px] max-h-[80vh] overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-base font-semibold text-white">{t('restoreTask.modalTitle')}</h3>
              <button
                onClick={() => setRestoreOpen(false)}
                className="rounded p-1 text-text-muted hover:bg-border hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {savedStates.length === 0 ? (
                <div className="text-sm text-text-muted">{t('restoreTask.empty')}</div>
              ) : (
                <div className="space-y-3">
                  {savedStates.map((state) => (
                    <div
                      key={state.handleId}
                      className="rounded-lg border border-border bg-background px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-white">
                            {state.taskDescription || state.handleId}
                          </div>
                          <div className="mt-1 text-xs text-text-muted">
                            {state.handleId} ·{' '}
                            {state.runtimeType || t('restoreTask.unknownRuntime')} ·{' '}
                            {new Date(state.savedAt).toLocaleString()}
                          </div>
                          {state.restoreHints.length > 0 && (
                            <div className="mt-2 text-xs text-text-muted">
                              {state.restoreHints.join(' | ')}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRestoreTask(state.handleId)}
                            className="btn btn-primary text-sm"
                          >
                            {t('restoreTask.restore')}
                          </button>
                          <button
                            onClick={() => handleDeleteSavedState(state.handleId)}
                            className="btn btn-danger text-sm"
                          >
                            {t('restoreTask.delete')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isVisualRunOpen && <VisualRunDialog onClose={() => setVisualRunOpen(false)} />}
    </div>
  );
}
