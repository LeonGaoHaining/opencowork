import React from 'react';
import { useTaskStore } from '../stores/taskStore';
import { useSchedulerStore } from '../stores/schedulerStore';
import { useTranslation } from '../i18n/useTranslation';
import RelationBadge from './RelationBadge';
import ArtifactViewer from './ArtifactViewer';
import { SkillCandidateCard, SkillCandidateViewModel } from './SkillCandidateCard';
import { extractVisualTraceSummary } from '../utils/visualTrace';
import {
  listVisualProviderCapabilities,
  resolveVisualProviderLabel,
  resolveVisualProviderSelection,
} from '../../core/visual/visualProviderMetadata';

interface ResultPanelProps {
  embedded?: boolean;
}

interface TemplateChangeEventDetail {
  templateId?: string;
  source: 'run' | 'manual';
}

function emitTemplateChanged(detail: TemplateChangeEventDetail): void {
  window.dispatchEvent(new CustomEvent<TemplateChangeEventDetail>('template:changed', { detail }));
}

export function ResultPanel({ embedded = false }: ResultPanelProps) {
  const { currentResult, currentRunId, currentTemplateId, task, setCurrentResult, openRunsPanel } =
    useTaskStore();
  const { prepareDraftFromTemplate, prepareDraftFromPrompt } = useSchedulerStore();
  const { t } = useTranslation();

  const rawOutputRecord =
    currentResult && currentResult.rawOutput && typeof currentResult.rawOutput === 'object' && !Array.isArray(currentResult.rawOutput)
      ? (currentResult.rawOutput as Record<string, unknown>)
      : null;
  const visualProviderLabel = resolveVisualProviderLabel(rawOutputRecord);
  const visualProviderSelection = resolveVisualProviderSelection(rawOutputRecord);
  const visualProviderCapabilities = listVisualProviderCapabilities(rawOutputRecord);
  const taskRouting = rawOutputRecord?.taskRouting as
    | {
        routeMode?: string;
        executionMode?: string;
        reason?: string;
        explicit?: boolean;
        source?: string;
      }
    | undefined;
  const skillCandidate = rawOutputRecord?.skillCandidate as SkillCandidateViewModel | undefined;

  if (!currentResult) {
    return null;
  }

  const result = currentResult;
  const visualTrace = extractVisualTraceSummary(result.rawOutput);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error('[ResultPanel] Failed to copy value:', error);
    }
  };

  const handleOpenArtifact = async (uri: string) => {
    try {
      await window.electron.invoke('artifact:open', { uri });
    } catch (error) {
      console.error('[ResultPanel] Failed to open artifact:', error);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      if (currentRunId) {
        const result = await window.electron.invoke('template:createFromRun', { runId: currentRunId });
        const payload = result?.data || result;
        if (result?.success && payload?.success !== false) {
          emitTemplateChanged({ templateId: payload?.id, source: 'run' });
        }
        return;
      }

      const prompt = task?.description || result.summary;
      const createResult = await window.electron.invoke('template:create', {
        name: task?.description?.slice(0, 60) || t('taskPanels.taskTemplate'),
        description: result.summary,
        prompt,
        executionProfile: 'browser-first',
      });
      const payload = createResult?.data || createResult;
      if (createResult?.success && payload?.success !== false) {
        emitTemplateChanged({ templateId: payload?.id, source: 'manual' });
      }
    } catch (error) {
      console.error('[ResultPanel] Failed to save template:', error);
    }
  };

  const handleAddToScheduler = () => {
    if (currentTemplateId) {
      prepareDraftFromTemplate({
        name: task?.description?.slice(0, 60) || t('taskPanels.scheduledTemplateTask'),
        description: result.summary,
        templateId: currentTemplateId,
      });
      return;
    }

    prepareDraftFromPrompt({
      name: task?.description?.slice(0, 60) || t('taskPanels.scheduledTask'),
      description: result.summary,
      prompt: task?.description || result.summary,
    });
  };

  return (
    <div
      className={`${embedded ? 'border-b border-border bg-surface px-4 py-4' : 'bg-surface/80 px-4 py-4'}`}
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-text-muted">
            {t('taskPanels.resultDelivery')}
          </div>
          <div className="mt-1 text-base font-semibold text-white">{result.summary}</div>
        </div>
        <button
          onClick={() => setCurrentResult(null)}
          className="rounded px-2 py-1 text-xs text-text-muted hover:bg-border hover:text-white"
        >
          {t('taskPanels.hide')}
        </button>
      </div>

      <div className="mb-3 flex gap-2">
        <button onClick={handleSaveTemplate} className="btn btn-secondary text-sm">
          {t('taskPanels.saveAsTemplate')}
        </button>
        <button onClick={handleAddToScheduler} className="btn btn-secondary text-sm">
          {t('taskPanels.addToScheduler')}
        </button>
        {currentRunId && (
          <button onClick={() => openRunsPanel(currentRunId)} className="btn btn-secondary text-sm">
            {t('taskPanels.viewRun')}
          </button>
        )}
      </div>

      {taskRouting && (
        <div className="mb-3 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-secondary">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            {t('taskPanels.executionMode')}
          </div>
          <div className="mt-1 text-white">
            {taskRouting.executionMode || taskRouting.routeMode || 'dom'}
            {taskRouting.explicit ? ' · explicit' : ''}
          </div>
          {taskRouting.reason && <div className="mt-1 text-text-muted">{taskRouting.reason}</div>}
        </div>
      )}

      {visualProviderLabel && (
        <div className="mb-3 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-secondary">
          <div className="text-xs uppercase tracking-wide text-text-muted">{t('taskPanels.visualProvider', 'Visual provider')}</div>
          <div className="mt-1 text-white">{visualProviderLabel}</div>
          {visualProviderSelection && (
            <div className="mt-2 space-y-1 text-xs text-text-muted">
              <div className="text-white">
                score: <span className="text-text-secondary">{Math.round(visualProviderSelection.score)}</span>
              </div>
              <div>
                adapter: <span className="text-text-secondary">{visualProviderSelection.adapterMode}</span>
              </div>
              {visualProviderCapabilities.length > 0 && (
                <div>
                  capabilities: <span className="text-text-secondary">{visualProviderCapabilities.join(', ')}</span>
                </div>
              )}
              {visualProviderSelection.reasons.length > 0 && (
                <div>
                  <div className="mb-1">reasons</div>
                  <ul className="list-disc pl-4 text-text-secondary">
                    {visualProviderSelection.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {currentRunId && (
          <RelationBadge
            label="run"
            value={currentRunId}
            tone="primary"
            onClick={() => openRunsPanel(currentRunId)}
          />
        )}
        {currentTemplateId && (
          <RelationBadge
            label="template"
            value={currentTemplateId}
            tone="primary"
            onClick={() => window.dispatchEvent(new CustomEvent('template:open', { detail: { templateId: currentTemplateId } }))}
          />
        )}
        {task?.description && <RelationBadge label="task" value={task.description} tone="muted" />}
      </div>

      <div className="grid grid-cols-1 gap-3 text-sm text-text-secondary md:grid-cols-3">
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <div className="text-xs text-text-muted">{t('taskPanels.run')}</div>
          <div className="mt-1 break-all text-white">{currentRunId || result.id}</div>
        </div>
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <div className="text-xs text-text-muted">{t('taskPanels.artifacts')}</div>
          <div className="mt-1 text-white">{result.artifacts.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <div className="text-xs text-text-muted">{t('taskPanels.template')}</div>
          <div className="mt-1 text-white">{currentTemplateId || t('taskPanels.notLinked')}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-text-secondary md:grid-cols-2">
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <div className="text-xs text-text-muted">{t('taskPanels.completed')}</div>
          <div className="mt-1 text-white">{new Date(result.completedAt).toLocaleString()}</div>
        </div>
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <div className="text-xs text-text-muted">{t('taskPanels.reusable')}</div>
          <div className="mt-1 text-white">{result.reusable ? t('taskPanels.yes') : t('taskPanels.no')}</div>
        </div>
      </div>

      {result.structuredData !== undefined && (
        <div className="mt-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-text-muted">
            {t('taskPanels.structuredData')}
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-3 text-xs text-text-secondary">
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(result.structuredData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {visualTrace.hasVisualTrace && (
        <div className="mt-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-text-muted">
            {t('taskPanels.visualTrace')}
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-3 text-xs text-text-secondary space-y-3">
            {visualTrace.routeReasons.length > 0 && (
              <div>
                <span className="text-text-muted">{t('taskPanels.visualRouteReason')}:</span>{' '}
                <span className="text-white break-all">{visualTrace.routeReasons.join(' | ')}</span>
              </div>
            )}
            {visualTrace.fallbackReasons.length > 0 && (
              <div>
                <span className="text-text-muted">{t('taskPanels.visualFallbackReason')}:</span>{' '}
                <span className="text-white break-all">{visualTrace.fallbackReasons.join(' | ')}</span>
              </div>
            )}
            {visualTrace.approvedActions.length > 0 && (
              <div>
                <div className="text-text-muted mb-1">{t('taskPanels.visualApprovedActions')}</div>
                <div className="text-white">{visualTrace.approvedActions.map((action) => action.type || 'unknown').join(', ')}</div>
              </div>
            )}
            {(visualTrace.metrics.totalTurns !== undefined ||
              visualTrace.metrics.actionBatches !== undefined ||
              visualTrace.metrics.approvalInterruptions !== undefined ||
              visualTrace.metrics.recoveryAttempts !== undefined ||
              visualTrace.metrics.totalDurationMs !== undefined) && (
              <div>
                <div className="text-text-muted mb-1">{t('taskPanels.visualMetrics')}</div>
                <div className="grid grid-cols-2 gap-2 text-white">
                  {visualTrace.metrics.totalTurns !== undefined && <div>{t('taskPanels.visualTurns')}: {visualTrace.metrics.totalTurns}</div>}
                  {visualTrace.metrics.actionBatches !== undefined && <div>{t('taskPanels.visualActionBatches')}: {visualTrace.metrics.actionBatches}</div>}
                  {visualTrace.metrics.approvalInterruptions !== undefined && <div>{t('taskPanels.visualApprovalInterruptions')}: {visualTrace.metrics.approvalInterruptions}</div>}
                  {visualTrace.metrics.recoveryAttempts !== undefined && <div>{t('taskPanels.visualRecoveryAttempts')}: {visualTrace.metrics.recoveryAttempts}</div>}
                  {visualTrace.metrics.verificationFailures !== undefined && <div>Verification failures: {visualTrace.metrics.verificationFailures}</div>}
                  {visualTrace.metrics.recoveryStrategies && visualTrace.metrics.recoveryStrategies.length > 0 && (
                    <div>{t('taskPanels.visualRecoveryStrategies')}: {visualTrace.metrics.recoveryStrategies.join(', ')}</div>
                  )}
                  {visualTrace.metrics.recoveryDetails && visualTrace.metrics.recoveryDetails.length > 0 && (
                    <div className="col-span-2">
                      <div className="text-text-muted mb-1">Recovery details</div>
                      <div className="space-y-1 text-white">
                        {visualTrace.metrics.recoveryDetails.map((detail, index) => (
                          <div key={`${detail.strategy || 'recovery'}-${index}`}>
                            #{detail.attempt || index + 1} {detail.strategy || 'unknown'}
                            {detail.category ? ` [${detail.category}]` : ''}
                            {detail.trigger ? ` <${detail.trigger}>` : ''}
                            {detail.failedActions && detail.failedActions.length > 0
                              ? ` - ${detail.failedActions.join(', ')}`
                              : ''}
                            {detail.errorMessage ? ` - ${detail.errorMessage}` : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {visualTrace.metrics.totalDurationMs !== undefined && <div>{t('taskPanels.visualTotalDuration')}: {visualTrace.metrics.totalDurationMs}ms</div>}
                </div>
              </div>
            )}
            {visualTrace.turns.length > 0 && (
              <div>
                <div className="text-text-muted mb-2">{t('taskPanels.visualTurns')}</div>
                <div className="space-y-2">
                  {visualTrace.turns.map((turn, index) => {
                    const proposed = Array.isArray(turn.proposedActions)
                      ? turn.proposedActions.map((action) => action.type || 'unknown').join(', ')
                      : '';
                    const executed = Array.isArray(turn.executedActions)
                      ? turn.executedActions.map((action) => action.type || 'unknown').join(', ')
                      : '';
                    return (
                      <div key={turn.turnId || index} className="rounded border border-border px-3 py-2">
                        <div className="font-medium text-white">
                          {t('taskPanels.visualTurn')} {index + 1}
                        </div>
                        {proposed && (
                          <div>
                            <span className="text-text-muted">{t('taskPanels.visualProposedActions')}:</span>{' '}
                            <span>{proposed}</span>
                          </div>
                        )}
                        {executed && (
                          <div>
                            <span className="text-text-muted">{t('taskPanels.visualExecutedActions')}:</span>{' '}
                            <span>{executed}</span>
                          </div>
                        )}
                        {turn.finalMessage && (
                          <div>
                            <span className="text-text-muted">{t('taskPanels.summary')}:</span>{' '}
                            <span>{turn.finalMessage}</span>
                          </div>
                        )}
                        {typeof turn.duration === 'number' && (
                          <div>
                            <span className="text-text-muted">{t('taskPanels.visualTurnDuration')}:</span>{' '}
                            <span>{turn.duration}ms</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {skillCandidate && <SkillCandidateCard candidate={skillCandidate} />}

      {result.artifacts.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-text-muted">
            {t('taskPanels.artifacts')}
          </div>
          <div className="space-y-2">
            {result.artifacts.map((artifact) => (
              <ArtifactViewer
                key={artifact.id}
                artifact={artifact}
                onOpenArtifact={handleOpenArtifact}
                onCopy={handleCopy}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ResultPanel;
