import React, { useState } from 'react';
import { createTaskEntityId } from '../../core/task/types';
import { useTaskStore } from '../stores/taskStore';
import { useTranslation } from '../i18n/useTranslation';
import { mapVisualTurnsToAgentSteps } from '../utils/visualSteps';

interface VisualRunDialogProps {
  onClose: () => void;
}

export function VisualRunDialog({ onClose }: VisualRunDialogProps) {
  const { t } = useTranslation();
  const {
    addMessage,
    addLog,
    setTask,
    updateTaskStatus,
    setTaskError,
    setCurrentResult,
    setCurrentRun,
    setVisualApprovalRequest,
    setActiveSteps,
  } = useTaskStore();
  const [taskInput, setTaskInput] = useState('If the page has a search box, click it and type penguin');
  const [adapterMode, setAdapterMode] = useState<'chat-structured' | 'responses-computer'>(
    'chat-structured'
  );
  const [maxTurns, setMaxTurns] = useState(6);
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    const taskDescription = taskInput.trim();
    if (!taskDescription || isRunning) {
      return;
    }

    const taskId = `visual-${Date.now()}`;
    setIsRunning(true);
    setCurrentResult(null);
    addMessage({ role: 'user', content: `[Visual Debug] ${taskDescription}` });
    addLog({ type: 'info', message: `Visual debug started with ${adapterMode}` });
    setTask({
      id: taskId,
      status: 'planning',
      description: `[Visual Debug] ${taskDescription}`,
      progress: { current: 0, total: maxTurns },
    });
    setCurrentRun(taskId, 'chat', null);

    try {
      const result = await window.electron.invoke('visual:run', {
        task: taskDescription,
        adapterMode,
        maxTurns,
      });
      const payload = result?.data || result;

      if (payload?.pendingApproval) {
        updateTaskStatus('waiting_confirm');
        setVisualApprovalRequest({
          reason: payload.error?.message || t('visualRun.approvalRequired'),
          actions: payload.pendingApproval.actions || [],
          taskDescription: payload.pendingApproval.taskContext?.task || taskDescription,
          adapterMode,
          maxTurns,
        });
        setActiveSteps(mapVisualTurnsToAgentSteps(payload.turns));
        addLog({ type: 'info', message: payload.error?.message || t('visualRun.approvalRequired') });
        onClose();
        return;
      }

      if (payload?.success) {
        updateTaskStatus('completed');
        const summary = payload.finalMessage || t('visualRun.completed');
        setCurrentResult({
          id: createTaskEntityId('result'),
          summary,
          artifacts: [],
          rawOutput: payload,
          reusable: false,
          completedAt: Date.now(),
        });
        setActiveSteps(mapVisualTurnsToAgentSteps(payload.turns));
        addMessage({ role: 'ai', content: `[Visual Debug] ${summary}` });
        addLog({ type: 'success', message: t('visualRun.completed') });
        onClose();
        return;
      }

      const errorMessage = payload?.error?.message || t('visualRun.failed');
      setActiveSteps(mapVisualTurnsToAgentSteps(payload?.turns));
      setTaskError(errorMessage);
      updateTaskStatus('failed');
      addMessage({ role: 'ai', content: `[Visual Debug] ${errorMessage}` });
      addLog({ type: 'error', message: errorMessage });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('visualRun.failed');
      setTaskError(message);
      updateTaskStatus('failed');
      setActiveSteps([]);
      addLog({ type: 'error', message });
      console.error('[VisualRunDialog] run failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-[560px]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {t('visualRun.title')}
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-border hover:text-white"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleRun} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
              {t('visualRun.task')}
            </label>
            <textarea
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)] p-3 text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
                {t('visualRun.adapter')}
              </label>
              <select
                value={adapterMode}
                onChange={(e) =>
                  setAdapterMode(e.target.value as 'chat-structured' | 'responses-computer')
                }
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)] p-2 text-[var(--color-text-primary)]"
              >
                <option value="chat-structured">chat-structured</option>
                <option value="responses-computer">responses-computer</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
                {t('visualRun.maxTurns')}
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={maxTurns}
                onChange={(e) => setMaxTurns(Number(e.target.value) || 1)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)] p-2 text-[var(--color-text-primary)]"
              />
            </div>
          </div>

          <p className="text-sm text-[var(--color-text-muted)]">{t('visualRun.description')}</p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md bg-[var(--color-elevated)] px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]"
            >
              {t('visualRun.cancel')}
            </button>
            <button
              type="submit"
              disabled={!taskInput.trim() || isRunning}
              className="btn btn-primary flex-1"
            >
              {isRunning ? t('visualRun.running') : t('visualRun.run')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default VisualRunDialog;
