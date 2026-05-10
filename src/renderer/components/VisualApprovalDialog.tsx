import React, { useState } from 'react';
import { createTaskEntityId } from '../../core/task/types';
import { useTaskStore } from '../stores/taskStore';
import { useTranslation } from '../i18n/useTranslation';
import { mapVisualTurnsToAgentSteps } from '../utils/visualSteps';

export function VisualApprovalDialog() {
  const { t } = useTranslation();
  const {
    visualApprovalRequest,
    setVisualApprovalRequest,
    setTakeover,
    task,
    updateTaskStatus,
    addLog,
    addMessage,
    setCurrentResult,
    setTaskError,
    setActiveSteps,
  } = useTaskStore();
  const [isApproving, setIsApproving] = useState(false);

  if (!visualApprovalRequest) {
    return null;
  }

  const handleTakeover = () => {
    setVisualApprovalRequest(null);
    setTakeover(true);
    updateTaskStatus('paused');
  };

  const handleDismiss = () => {
    setVisualApprovalRequest(null);
  };

  const handleApproveAndContinue = async () => {
    if (!visualApprovalRequest?.taskDescription || isApproving) {
      return;
    }

    setIsApproving(true);
    try {
      updateTaskStatus('executing');
      addLog({ type: 'info', message: t('visualApproval.approving') });

      const result = await window.electron.invoke('visual:approve', {
        task: visualApprovalRequest.taskDescription,
        actions: visualApprovalRequest.actions,
        adapterMode: visualApprovalRequest.adapterMode || 'chat-structured',
        maxTurns: visualApprovalRequest.maxTurns || 6,
        runId: visualApprovalRequest.runId,
      });
      const payload = result?.data || result;

      if (payload?.success) {
        const summary = payload.finalMessage || t('visualRun.completed');
        setActiveSteps(mapVisualTurnsToAgentSteps(payload.turns));
        if (!visualApprovalRequest.runId) {
          setCurrentResult({
            id: createTaskEntityId('result'),
            summary,
            artifacts: [],
            rawOutput: payload,
            actionContract: payload.actionContract,
            reusable: false,
            completedAt: Date.now(),
          });
          addMessage({ role: 'ai', content: `[Visual Approval] ${summary}` });
        }
        addLog({ type: 'success', message: t('visualApproval.approvedAndContinued') });
        updateTaskStatus('completed');
        setVisualApprovalRequest(null);
        return;
      }

      if (payload?.pendingApproval) {
        setVisualApprovalRequest({
          runId: visualApprovalRequest.runId,
          reason: payload.error?.message || t('visualRun.approvalRequired'),
          actionRiskReasons: payload.pendingApproval?.audit?.actionRiskReasons || visualApprovalRequest.actionRiskReasons || [],
          matchedIntentKeywords: payload.pendingApproval?.audit?.matchedIntentKeywords || visualApprovalRequest.matchedIntentKeywords || [],
          executionTarget: payload.pendingApproval?.taskContext?.executionTarget || visualApprovalRequest.executionTarget,
          actions: payload.pendingApproval.actions || [],
          taskDescription: payload.pendingApproval.taskContext?.task || visualApprovalRequest.taskDescription,
          adapterMode: visualApprovalRequest.adapterMode,
          maxTurns: visualApprovalRequest.maxTurns,
        });
        setActiveSteps(mapVisualTurnsToAgentSteps(payload.turns));
        updateTaskStatus('waiting_confirm');
        return;
      }

      const errorMessage = payload?.error?.message || t('visualRun.failed');
      setActiveSteps(mapVisualTurnsToAgentSteps(payload?.turns));
      setTaskError(errorMessage);
      addLog({ type: 'error', message: errorMessage });
      updateTaskStatus('failed');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('visualRun.failed');
      console.error('[VisualApprovalDialog] approve and continue failed:', error);
      setTaskError(message);
      addLog({ type: 'error', message });
      updateTaskStatus('failed');
    } finally {
      setIsApproving(false);
    }
  };

  const handleCancelTask = async () => {
    try {
      if (task?.id) {
        await window.electron.invoke('task:stop', { handleId: task.id });
        updateTaskStatus('cancelled');
      }
    } catch (error) {
      console.error('[VisualApprovalDialog] cancel task failed:', error);
    } finally {
      setVisualApprovalRequest(null);
    }
  };

  const executionTargetLabel = visualApprovalRequest.executionTarget
    ? `${visualApprovalRequest.executionTarget.kind} / ${visualApprovalRequest.executionTarget.environment}`
    : null;

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-[520px]">
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
          <h2 className="text-xl font-semibold mb-2 text-center">{t('visualApproval.title')}</h2>
          <p className="text-text-muted text-center">{visualApprovalRequest.reason}</p>
        </div>

        {visualApprovalRequest.taskDescription && (
          <div className="mb-4 rounded-md bg-[var(--color-elevated)] p-3 text-sm text-[var(--color-text-secondary)]">
            <div className="font-medium text-[var(--color-text-primary)] mb-1">
              {t('visualApproval.task')}
            </div>
            <div>{visualApprovalRequest.taskDescription}</div>
          </div>
        )}

        {executionTargetLabel && (
          <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)] p-3 text-sm text-[var(--color-text-secondary)]">
            <div className="font-medium text-[var(--color-text-primary)] mb-1">
              {t('visualApprovalDetails.executionTarget')}
            </div>
            <div>{executionTargetLabel}</div>
          </div>
        )}

        {((visualApprovalRequest.actionRiskReasons && visualApprovalRequest.actionRiskReasons.length > 0) ||
          (visualApprovalRequest.matchedIntentKeywords && visualApprovalRequest.matchedIntentKeywords.length > 0)) && (
          <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-[var(--color-text-secondary)]">
            <div className="font-medium text-warning mb-2">{t('visualApprovalDetails.pauseReason')}</div>
            {visualApprovalRequest.matchedIntentKeywords && visualApprovalRequest.matchedIntentKeywords.length > 0 && (
              <div className="mb-2">
                <div className="text-xs uppercase text-text-muted mb-1">
                  {t('visualApprovalDetails.matchedIntentKeywords')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {visualApprovalRequest.matchedIntentKeywords.map((keyword) => (
                    <span key={keyword} className="rounded bg-surface px-2 py-0.5 text-xs text-white">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {visualApprovalRequest.actionRiskReasons && visualApprovalRequest.actionRiskReasons.length > 0 && (
              <div>
                <div className="text-xs uppercase text-text-muted mb-1">
                  {t('visualApprovalDetails.actionRiskReasons')}
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {visualApprovalRequest.actionRiskReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mb-6 rounded-md bg-[var(--color-elevated)] p-3">
          <div className="mb-2 font-medium text-[var(--color-text-primary)]">
            {t('visualApproval.actions')}
          </div>
          <div className="space-y-2 max-h-48 overflow-auto">
            {visualApprovalRequest.actions.map((action, index) => (
              <div
                key={`${action.type}-${index}`}
                className="rounded border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)]"
              >
                <div className="font-medium text-[var(--color-text-primary)]">{action.type}</div>
                {action.text && <div>{t('visualApproval.text')}: {action.text}</div>}
                {action.keys && action.keys.length > 0 && (
                  <div>{t('visualApproval.keys')}: {action.keys.join(', ')}</div>
                )}
                {(typeof action.x === 'number' || typeof action.y === 'number') && (
                  <div>
                    {t('visualApproval.position')}: ({action.x ?? '-'}, {action.y ?? '-'})
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <button onClick={handleApproveAndContinue} className="btn btn-primary w-full" disabled={isApproving}>
            {isApproving ? t('visualApproval.approving') : t('visualApproval.approveAndContinue')}
          </button>
          <button onClick={handleTakeover} className="btn btn-primary w-full">
            {t('visualApproval.takeover')}
          </button>
          <button onClick={handleDismiss} className="btn btn-secondary w-full">
            {t('visualApproval.dismiss')}
          </button>
          <button onClick={handleCancelTask} className="btn w-full text-text-muted hover:text-white">
            {t('visualApproval.cancelTask')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VisualApprovalDialog;
