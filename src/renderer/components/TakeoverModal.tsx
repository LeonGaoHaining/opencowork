import React from 'react';
import { useTaskStore } from '../stores/taskStore';
import { useTranslation } from '../i18n/useTranslation';

export function TakeoverModal() {
  const { task, setTakeover, updateTaskStatus } = useTaskStore();
  const { t } = useTranslation();

  const handleResumeAI = async () => {
    try {
      if (task?.id) {
        await window.electron.invoke('task:resume', { handleId: task.id });
        updateTaskStatus('executing');
      }
    } catch (error) {
      console.error('[TakeoverModal] resume failed:', error);
    } finally {
      setTakeover(false);
    }
  };

  const handleRestart = async () => {
    try {
      if (task?.id) {
        await window.electron.invoke('task:restart', { handleId: task.id });
      }
    } catch (error) {
      console.error('[TakeoverModal] restart failed:', error);
    } finally {
      setTakeover(false);
    }
  };

  const handleManualComplete = async () => {
    try {
      if (task?.id) {
        await window.electron.invoke('task:complete', { handleId: task.id });
        updateTaskStatus('completed');
      }
    } catch (error) {
      console.error('[TakeoverModal] complete failed:', error);
    } finally {
      setTakeover(false);
    }
  };

  const handleCancel = async () => {
    try {
      if (task?.id) {
        await window.electron.invoke('task:stop', { handleId: task.id });
        updateTaskStatus('cancelled');
      }
    } catch (error) {
      console.error('[TakeoverModal] cancel failed:', error);
    } finally {
      setTakeover(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content text-center">
        <div className="mb-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-warning/20 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-warning"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">{t('takeoverModal.title')}</h2>
          <p className="text-text-muted">{t('takeoverModal.message')}</p>
        </div>

        <div className="space-y-3">
          <button onClick={handleResumeAI} className="btn btn-primary w-full">
            {t('takeoverModal.returnToAI')}
          </button>
          <button onClick={handleRestart} className="btn btn-secondary w-full">
            {t('takeoverModal.restart')}
          </button>
          <button onClick={handleManualComplete} className="btn btn-secondary w-full">
            {t('takeoverModal.manualComplete')}
          </button>
          <button onClick={handleCancel} className="btn w-full text-text-muted hover:text-white">
            {t('takeoverModal.cancelTask')}
          </button>
        </div>
      </div>
    </div>
  );
}
