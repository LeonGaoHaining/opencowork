import React, { useEffect } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { useHistoryStore } from '../stores/historyStore';
import { useSchedulerStore } from '../stores/schedulerStore';
import { useIMStore, ConnectionStatus } from '../stores/imStore';
import { useTranslation } from '../i18n/useTranslation';

interface ControlBarProps {
  onSkillClick: () => void;
}

export function ControlBar({ onSkillClick }: ControlBarProps) {
  const { task, setTakeover, showPlanViewer, setShowPlanViewer, previewMode, setPreviewMode } =
    useTaskStore();
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

  const handleCheckLogin = async () => {
    console.log('Checking login popup...');
    try {
      // 通过IPC调用主进程的checkAndHandleLoginPopup
      const result = await window.electron.invoke('task:checkLoginPopup', {});
      console.log('Check login result:', result);

      if (!result.handled) {
        alert(result.message || '未检测到登录弹窗');
      }
    } catch (error) {
      console.error('Check login error:', error);
    }
  };

  return (
    <div className="h-14 flex items-center justify-between px-4 border-t border-border bg-surface">
      {/* Left: Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCheckLogin}
          className="btn btn-secondary"
          disabled={!task || task.status === 'idle'}
          title={t('controlBar.detectLogin')}
        >
          {t('controlBar.detectLogin')}
        </button>
        <button
          onClick={handleTakeover}
          className="btn btn-secondary"
          disabled={!task || task.status === 'idle'}
        >
          {t('controlBar.takeover')}
        </button>
        {task?.status === 'paused' ? (
          <button onClick={handleResume} className="btn btn-primary">
            {t('controlBar.resume')}
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="btn btn-secondary"
            disabled={!task || task.status !== 'executing'}
          >
            {t('controlBar.pause')}
          </button>
        )}
        <button
          onClick={handleStop}
          className="btn btn-danger"
          disabled={
            !task ||
            task.status === 'idle' ||
            task.status === 'completed' ||
            task.status === 'cancelled'
          }
        >
          {t('controlBar.stop')}
        </button>
      </div>

      {/* Center: Status */}
      <div className="text-sm text-text-secondary">
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
      <div className="flex items-center gap-2">
        {/* Preview Mode Switcher - Icon buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPreviewMode('sidebar')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
              previewMode === 'sidebar'
                ? 'bg-primary text-white'
                : 'bg-elevated text-text-secondary hover:text-white hover:bg-border'
            }`}
            title={t('controlBar.sidebarPreview')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
          </button>
          <button
            onClick={() => setPreviewMode('detached')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
              previewMode === 'detached'
                ? 'bg-primary text-white'
                : 'bg-elevated text-text-secondary hover:text-white hover:bg-border'
            }`}
            title={t('controlBar.independentWindow')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          className="btn btn-secondary"
          title={t('controlBar.history')}
        >
          {t('controlBar.history')}
        </button>

        <button
          onClick={() => setSchedulerOpen(true)}
          className="btn btn-secondary"
          title={t('controlBar.scheduler')}
        >
          {t('controlBar.scheduler')}
        </button>

        <button
          onClick={() => {
            console.log('技能按钮被点击');
            onSkillClick();
          }}
          className="btn btn-secondary"
          title={t('controlBar.skills')}
        >
          {t('controlBar.skills')}
        </button>

        <button
          onClick={() => setShowPlanViewer(!showPlanViewer)}
          className={`btn ${showPlanViewer ? 'btn-primary' : 'btn-secondary'}`}
        >
          {t('controlBar.plan')}
        </button>

        {(() => {
          const imStatus = getIMStatus();
          return (
            <button
              onClick={() => setImPanelOpen(true)}
              className={`btn ${
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

        {/* Language Switcher */}
        <select
          onChange={handleLanguageChange}
          className="btn btn-secondary text-xs"
          defaultValue={
            localStorage.getItem('language') || (navigator.language.startsWith('zh') ? 'zh' : 'en')
          }
        >
          <option value="en">EN</option>
          <option value="zh">中文</option>
        </select>
      </div>
    </div>
  );
}
