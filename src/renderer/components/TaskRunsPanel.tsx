import React, { useEffect, useState } from 'react';
import { TaskResult, TaskRun, TaskTemplate } from '../../core/task/types';
import { TaskHistoryRecord } from '../../history/taskHistory';
import { useHistoryStore } from '../stores/historyStore';
import { useSchedulerStore } from '../stores/schedulerStore';
import { useTaskStore } from '../stores/taskStore';
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

interface TaskRunDetails {
  run: TaskRun;
  result: TaskResult | null;
  template: TaskTemplate | null;
  history: TaskHistoryRecord | null;
}

interface LifecycleDetails {
  approval: null | {
    pending?: boolean;
    approved?: boolean;
    requestedAt?: number;
    approvedAt?: number;
    reason?: string;
  };
  takeover: null | {
    active?: boolean;
    interrupted?: boolean;
    interruptReason?: string;
    interruptedAt?: number;
    resumedAt?: number;
    restoredAt?: number;
  };
}

function parseLifecycleDetails(metadata: Record<string, unknown> | undefined): LifecycleDetails {
  const approval = metadata?.approval;
  const takeover = metadata?.takeover;

  return {
    approval: approval && typeof approval === 'object' ? (approval as LifecycleDetails['approval']) : null,
    takeover: takeover && typeof takeover === 'object' ? (takeover as LifecycleDetails['takeover']) : null,
  };
}

interface TaskRunsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TaskRunsPanel({ isOpen, onClose }: TaskRunsPanelProps) {
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<TaskRunDetails | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | TaskRun['source']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskRun['status']>('all');
  const { t } = useTranslation();
  const { runTemplate } = useHistoryStore();
  const { prepareDraftFromTemplate, prepareDraftFromPrompt } = useSchedulerStore();
  const { selectedRunsPanelRunId, setSelectedRunsPanelRunId } = useTaskStore();

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error('[TaskRunsPanel] Failed to copy value:', error);
    }
  };

  const handleOpenArtifact = async (uri: string) => {
    try {
      await window.electron.invoke('artifact:open', { uri });
    } catch (error) {
      console.error('[TaskRunsPanel] Failed to open artifact:', error);
    }
  };

  const loadRuns = async () => {
    setIsLoading(true);
    try {
      const response = await window.electron.invoke('task:run:list', { limit: 100 });
      const payload = response?.data || response;
      const nextRuns = Array.isArray(payload) ? payload : [];
      setRuns(nextRuns);
      if (selectedRunsPanelRunId && nextRuns.some((run) => run.id === selectedRunsPanelRunId)) {
        setSelectedRunId(selectedRunsPanelRunId);
      } else if (!selectedRunId && nextRuns.length > 0) {
        setSelectedRunId(nextRuns[0].id);
      }
      if (selectedRunId && !nextRuns.some((run) => run.id === selectedRunId)) {
        setSelectedRunId(nextRuns[0]?.id || null);
      }
    } catch (error) {
      console.error('[TaskRunsPanel] Failed to load runs:', error);
      setRuns([]);
      setSelectedRunId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRunDetails = async (runId: string) => {
    try {
      const response = await window.electron.invoke('task:run:details', { runId });
      const payload = response?.data || response;
      setSelectedDetails(payload || null);
    } catch (error) {
      console.error('[TaskRunsPanel] Failed to load run details:', error);
      setSelectedDetails(null);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void loadRuns();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedRunId) {
      setSelectedDetails(null);
      return;
    }
    setSelectedRunsPanelRunId(selectedRunId);
    void loadRunDetails(selectedRunId);
  }, [isOpen, selectedRunId, setSelectedRunsPanelRunId]);

  useEffect(() => {
    const handleTemplateChanged = (event: Event): void => {
      if (!isOpen || !selectedRunId) {
        return;
      }

      if (event instanceof CustomEvent) {
        void loadRunDetails(selectedRunId);
      }
    };

    window.addEventListener('template:changed', handleTemplateChanged as EventListener);
    return () => {
      window.removeEventListener('template:changed', handleTemplateChanged as EventListener);
    };
  }, [isOpen, selectedRunId, selectedDetails]);

  const handleRerun = async () => {
    if (!selectedDetails) {
      return;
    }

    if (selectedDetails.template) {
      await runTemplate(
        selectedDetails.template.id,
        (selectedDetails.run.input?.params as Record<string, unknown>) || undefined
      );
      return;
    }

    try {
      await window.electron.invoke('task:start', {
        task: selectedDetails.run.input?.prompt || selectedDetails.run.title,
        source: 'replay',
      });
    } catch (error) {
      console.error('[TaskRunsPanel] Failed to rerun task:', error);
    }
  };

  const handleAddToScheduler = () => {
    if (!selectedDetails) {
      return;
    }

    if (selectedDetails.template) {
      prepareDraftFromTemplate({
        name: selectedDetails.run.title,
        description: selectedDetails.history?.result?.summary || selectedDetails.run.title,
        templateId: selectedDetails.template.id,
        input: (selectedDetails.run.input?.params as Record<string, unknown>) || undefined,
      });
      return;
    }

    prepareDraftFromPrompt({
      name: selectedDetails.run.title,
      description: selectedDetails.history?.result?.summary || selectedDetails.run.title,
      prompt: selectedDetails.run.input?.prompt || selectedDetails.run.title,
    });
  };

  const openTemplateFromRun = (templateId: string): void => {
    window.dispatchEvent(new CustomEvent('template:open', { detail: { templateId } }));
  };

  if (!isOpen) {
    return null;
  }

  const selectedResult = selectedDetails?.result || null;
  const historyResult = selectedDetails?.history?.result || null;
  const lifecycleDetails = parseLifecycleDetails(
    (selectedDetails?.run.metadata as Record<string, unknown> | undefined) || undefined
  );
  const resultSummary = selectedResult?.summary || historyResult?.summary || '';
  const resultError = selectedResult?.error?.message || historyResult?.taskError?.message || '';
  const resultStructuredData = selectedResult?.structuredData ?? historyResult?.structuredData;
  const resultArtifacts = selectedResult?.artifacts || historyResult?.artifacts || [];
  const resultRawOutput = selectedResult?.rawOutput ?? historyResult?.rawOutput;
  const visualTrace = extractVisualTraceSummary(resultRawOutput);
  const selectedVisualProviderLabel = resolveVisualProviderLabel(selectedDetails?.run.metadata);
  const selectedVisualProviderSelection = resolveVisualProviderSelection(selectedDetails?.run.metadata);
  const selectedVisualProviderCapabilities = listVisualProviderCapabilities(selectedDetails?.run.metadata);
  const skillCandidate =
    resultRawOutput && typeof resultRawOutput === 'object' && !Array.isArray(resultRawOutput)
      ? ((resultRawOutput as Record<string, unknown>).skillCandidate as SkillCandidateViewModel | undefined)
      : undefined;

  const filteredRuns = runs.filter((run) => {
    const matchesKeyword =
      !searchKeyword.trim() ||
      run.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      run.id.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      run.templateId?.toLowerCase().includes(searchKeyword.toLowerCase());
    const matchesSource = sourceFilter === 'all' || run.source === sourceFilter;
    const matchesStatus = statusFilter === 'all' || run.status === statusFilter;
    return matchesKeyword && matchesSource && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-[880px] border-l border-border bg-surface flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
            <div>
            <div className="text-lg font-semibold text-white">{t('taskPanels.recentTaskRuns')}</div>
            <div className="text-sm text-text-muted">{t('taskPanels.persistedRunHistory')}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadRuns()}
              className="rounded px-2 py-1 text-xs text-text-muted hover:bg-border hover:text-white"
            >
              {t('taskPanels.refresh')}
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 text-text-muted hover:bg-border hover:text-white"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder={t('taskPanels.searchRuns')}
            className="w-56 rounded border border-border bg-background px-3 py-1 text-sm text-white"
          />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as 'all' | TaskRun['source'])}
            className="rounded border border-border bg-background px-2 py-1 text-sm text-white"
          >
            <option value="all">{t('taskPanels.allSources')}</option>
            <option value="chat">chat</option>
            <option value="scheduler">scheduler</option>
            <option value="im">im</option>
            <option value="mcp">mcp</option>
            <option value="replay">replay</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | TaskRun['status'])}
            className="rounded border border-border bg-background px-2 py-1 text-sm text-white"
          >
            <option value="all">{t('taskPanels.allStatus')}</option>
            <option value="pending">pending</option>
            <option value="planning">planning</option>
            <option value="running">running</option>
            <option value="waiting_user">waiting_user</option>
            <option value="paused">paused</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-[320px] overflow-y-auto border-r border-border p-4">
            {isLoading ? (
              <div className="text-sm text-text-muted">{t('taskPanels.loadingRuns')}</div>
            ) : filteredRuns.length === 0 ? (
              <div className="text-sm text-text-muted">{t('taskPanels.noRuns')}</div>
            ) : (
              <div className="space-y-3">
                {filteredRuns.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      selectedRunId === run.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background hover:bg-border/40'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{run.title}</div>
                    <div className="mt-1 text-xs text-text-secondary break-all">{run.id}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-muted">
                      <span>source: {run.source}</span>
                      <span>status: {run.status}</span>
                      {run.templateId && <span>template: {run.templateId}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {selectedDetails ? (
              <div className="space-y-4">
                <div>
                  <div className="text-lg font-semibold text-white">{selectedDetails.run.title}</div>
                  <div className="mt-1 text-xs text-text-secondary break-all">
                    {selectedDetails.run.id}
                  </div>
                </div>

                    <div className="flex flex-wrap gap-2">
                      <RelationBadge label="source" value={selectedDetails.run.source} tone="muted" />
                      <RelationBadge label="status" value={selectedDetails.run.status} />
                      {selectedDetails.run.templateId && (
                    <RelationBadge
                      label="template"
                      value={selectedDetails.run.templateId}
                      tone="primary"
                      onClick={() => openTemplateFromRun(selectedDetails.run.templateId as string)}
                    />
                  )}
                  {selectedDetails.history?.id && (
                    <RelationBadge label="history" value={selectedDetails.history.id} />
                  )}
                      {typeof selectedDetails.run.metadata?.scheduledTaskId === 'string' && (
                        <RelationBadge
                          label="scheduler"
                          value={selectedDetails.run.metadata.scheduledTaskId}
                        />
                      )}
                    {selectedVisualProviderLabel && (
                      <RelationBadge label="provider" value={selectedVisualProviderLabel} tone="muted" />
                    )}
                  </div>

                  {selectedVisualProviderSelection && (
                    <div className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-text-secondary">
                      <div className="text-xs uppercase tracking-wide text-text-muted">
                        {t('taskPanels.visualProvider', 'Visual provider')}
                      </div>
                      <div className="mt-1 text-white">{selectedVisualProviderSelection.name}</div>
                      <div className="mt-2 text-xs text-text-muted">
                        <div className="text-white">
                          score:{' '}
                          <span className="text-text-secondary">
                            {Math.round(selectedVisualProviderSelection.score)}
                          </span>
                        </div>
                        {selectedVisualProviderSelection.reasons.length > 0 && (
                          <div className="mt-1">
                            <div className="mb-1">reasons</div>
                            <ul className="list-disc pl-4 text-text-secondary">
                              {selectedVisualProviderSelection.reasons.map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm text-text-secondary">
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                          <div className="text-xs text-text-muted">{t('taskPanels.source')}</div>
                    <div className="mt-1 text-white">{selectedDetails.run.source}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                          <div className="text-xs text-text-muted">{t('taskPanels.status')}</div>
                    <div className="mt-1 text-white">{selectedDetails.run.status}</div>
                  </div>
                  {selectedVisualProviderLabel && (
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <div className="text-xs text-text-muted">{t('taskPanels.visualProvider', 'Visual provider')}</div>
                      <div className="mt-1 text-white">{selectedVisualProviderLabel}</div>
                      {selectedVisualProviderSelection && (
                        <div className="mt-2 text-xs text-text-secondary">
                          <div>adapter: {selectedVisualProviderSelection.adapterMode}</div>
                          {selectedVisualProviderCapabilities.length > 0 && (
                            <div>capabilities: {selectedVisualProviderCapabilities.join(', ')}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                          <div className="text-xs text-text-muted">{t('taskPanels.started')}</div>
                    <div className="mt-1 text-white">
                      {new Date(selectedDetails.run.startedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                          <div className="text-xs text-text-muted">{t('taskPanels.ended')}</div>
                    <div className="mt-1 text-white">
                      {selectedDetails.run.endedAt
                        ? new Date(selectedDetails.run.endedAt).toLocaleString()
                        : t('taskPanels.running')}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background px-3 py-3">
                    <div className="text-xs uppercase tracking-wide text-text-muted mb-2">{t('taskPanels.input')}</div>
                    <div className="text-sm text-white whitespace-pre-wrap break-words">
                      {selectedDetails.run.input?.prompt || t('taskPanels.noPromptRecorded')}
                    </div>
                  {selectedDetails.run.input?.params && (
                    <pre className="mt-3 whitespace-pre-wrap break-all text-xs text-text-secondary">
                      {JSON.stringify(selectedDetails.run.input.params, null, 2)}
                    </pre>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-background px-3 py-3">
                    <div className="text-xs uppercase tracking-wide text-text-muted mb-2">{t('taskPanels.template')}</div>
                    {selectedDetails.template ? (
                      <div>
                        <div className="text-sm font-medium text-white">{selectedDetails.template.name}</div>
                        <div className="mt-1 text-xs text-text-secondary break-all">
                          {selectedDetails.template.id}
                        </div>
                        <div className="mt-2 text-xs text-text-muted whitespace-pre-wrap">
                          {selectedDetails.template.description}
                        </div>
                      </div>
                    ) : (
                        <div className="text-sm text-text-muted">{t('taskPanels.notLinkedToTemplate')}</div>
                    )}
                  </div>

                  <div className="rounded-lg border border-border bg-background px-3 py-3">
                    <div className="text-xs uppercase tracking-wide text-text-muted mb-2">{t('historyPanel.title')}</div>
                    {selectedDetails.history ? (
                      <div>
                        <div className="text-sm font-medium text-white">{selectedDetails.history.task}</div>
                        <div className="mt-1 text-xs text-text-secondary break-all">
                          {selectedDetails.history.id}
                        </div>
                        {selectedDetails.history.result?.summary && (
                          <div className="mt-2 text-xs text-text-muted whitespace-pre-wrap">
                            {selectedDetails.history.result.summary}
                          </div>
                        )}
                      </div>
                    ) : (
                        <div className="text-sm text-text-muted">{t('taskPanels.noHistoryLinked')}</div>
                    )}
                  </div>
                </div>

                {(lifecycleDetails.approval || lifecycleDetails.takeover) && (
                  <div className="rounded-lg border border-border bg-background px-3 py-3">
                    <div className="text-xs uppercase tracking-wide text-text-muted mb-2">Lifecycle</div>
                    <div className="space-y-3 text-sm text-text-secondary">
                      {lifecycleDetails.approval && (
                        <div>
                          <div className="text-white font-medium">{t('visualApproval.title')}</div>
                          <div className="mt-1 space-y-1">
                            {typeof lifecycleDetails.approval.pending === 'boolean' && (
                              <div>
                                <span className="text-text-muted">pending:</span>{' '}
                                <span className="text-white">
                                  {lifecycleDetails.approval.pending ? 'yes' : 'no'}
                                </span>
                              </div>
                            )}
                            {typeof lifecycleDetails.approval.approved === 'boolean' && (
                              <div>
                                <span className="text-text-muted">approved:</span>{' '}
                                <span className="text-white">
                                  {lifecycleDetails.approval.approved ? 'yes' : 'no'}
                                </span>
                              </div>
                            )}
                            {typeof lifecycleDetails.approval.requestedAt === 'number' && (
                              <div>
                                <span className="text-text-muted">requested:</span>{' '}
                                <span className="text-white">
                                  {new Date(lifecycleDetails.approval.requestedAt).toLocaleString()}
                                </span>
                              </div>
                            )}
                            {typeof lifecycleDetails.approval.approvedAt === 'number' && (
                              <div>
                                <span className="text-text-muted">approved at:</span>{' '}
                                <span className="text-white">
                                  {new Date(lifecycleDetails.approval.approvedAt).toLocaleString()}
                                </span>
                              </div>
                            )}
                            {lifecycleDetails.approval.reason && (
                              <div>
                                <span className="text-text-muted">reason:</span>{' '}
                                <span className="text-white whitespace-pre-wrap">
                                  {lifecycleDetails.approval.reason}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {lifecycleDetails.takeover && (
                        <div>
                          <div className="text-white font-medium">{t('controlBar.takeover')}</div>
                          <div className="mt-1 space-y-1">
                            {typeof lifecycleDetails.takeover.active === 'boolean' && (
                              <div>
                                <span className="text-text-muted">active:</span>{' '}
                                <span className="text-white">
                                  {lifecycleDetails.takeover.active ? 'yes' : 'no'}
                                </span>
                              </div>
                            )}
                            {typeof lifecycleDetails.takeover.interrupted === 'boolean' && (
                              <div>
                                <span className="text-text-muted">interrupted:</span>{' '}
                                <span className="text-white">
                                  {lifecycleDetails.takeover.interrupted ? 'yes' : 'no'}
                                </span>
                              </div>
                            )}
                            {lifecycleDetails.takeover.interruptReason && (
                              <div>
                                <span className="text-text-muted">reason:</span>{' '}
                                <span className="text-white">{lifecycleDetails.takeover.interruptReason}</span>
                              </div>
                            )}
                            {typeof lifecycleDetails.takeover.interruptedAt === 'number' && (
                              <div>
                                <span className="text-text-muted">interrupted at:</span>{' '}
                                <span className="text-white">
                                  {new Date(lifecycleDetails.takeover.interruptedAt).toLocaleString()}
                                </span>
                              </div>
                            )}
                            {typeof lifecycleDetails.takeover.resumedAt === 'number' && (
                              <div>
                                <span className="text-text-muted">resumed at:</span>{' '}
                                <span className="text-white">
                                  {new Date(lifecycleDetails.takeover.resumedAt).toLocaleString()}
                                </span>
                              </div>
                            )}
                            {typeof lifecycleDetails.takeover.restoredAt === 'number' && (
                              <div>
                                <span className="text-text-muted">restored at:</span>{' '}
                                <span className="text-white">
                                  {new Date(lifecycleDetails.takeover.restoredAt).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(selectedResult || historyResult) && (
                  <div className="rounded-lg border border-border bg-background px-3 py-3">
                    <div className="text-xs uppercase tracking-wide text-text-muted mb-2">{t('historyPanel.result')}</div>

                    {resultSummary && (
                      <div className="mb-3">
                        <div className="text-xs text-text-muted mb-1">{t('taskPanels.summary')}</div>
                        <div className="text-sm text-white whitespace-pre-wrap">{resultSummary}</div>
                      </div>
                    )}

                    {resultError && (
                      <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                        {resultError}
                      </div>
                    )}

                    {resultStructuredData !== undefined && (
                      <div className="mb-3">
                        <div className="text-xs text-text-muted mb-1">{t('taskPanels.structuredData')}</div>
                        <pre className="whitespace-pre-wrap break-all text-xs text-text-secondary">
                          {JSON.stringify(resultStructuredData, null, 2)}
                        </pre>
                      </div>
                    )}

                    {Array.isArray(resultArtifacts) && resultArtifacts.length > 0 && (
                      <div>
                        <div className="text-xs text-text-muted mb-2">{t('taskPanels.artifacts')}</div>
                        <div className="space-y-2">
                          {resultArtifacts.map((artifact) => (
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

                    {visualTrace.hasVisualTrace && (
                      <div className="mt-3 rounded border border-border px-3 py-3 text-xs text-text-secondary space-y-2">
                        <div className="text-xs text-text-muted mb-1">{t('taskPanels.visualTrace')}</div>
                        {visualTrace.routeReasons.length > 0 && (
                          <div>
                            <span className="text-text-muted">{t('taskPanels.visualRouteReason')}:</span>{' '}
                            <span className="text-white">{visualTrace.routeReasons.join(' | ')}</span>
                          </div>
                        )}
                        {visualTrace.fallbackReasons.length > 0 && (
                          <div>
                            <span className="text-text-muted">{t('taskPanels.visualFallbackReason')}:</span>{' '}
                            <span className="text-white">{visualTrace.fallbackReasons.join(' | ')}</span>
                          </div>
                        )}
                        {visualTrace.approvedActions.length > 0 && (
                          <div>
                            <span className="text-text-muted">{t('taskPanels.visualApprovedActions')}:</span>{' '}
                            <span className="text-white">
                              {visualTrace.approvedActions.map((action) => action.type || 'unknown').join(', ')}
                            </span>
                          </div>
                        )}
                        {(visualTrace.metrics.totalTurns !== undefined ||
                          visualTrace.metrics.actionBatches !== undefined ||
                          visualTrace.metrics.approvalInterruptions !== undefined ||
                          visualTrace.metrics.recoveryAttempts !== undefined ||
                          visualTrace.metrics.totalDurationMs !== undefined) && (
                          <div className="space-y-1">
                            <div className="text-text-muted">{t('taskPanels.visualMetrics')}</div>
                            {visualTrace.metrics.totalTurns !== undefined && <div><span className="text-text-muted">{t('taskPanels.visualTurns')}:</span> <span className="text-white">{visualTrace.metrics.totalTurns}</span></div>}
                            {visualTrace.metrics.actionBatches !== undefined && <div><span className="text-text-muted">{t('taskPanels.visualActionBatches')}:</span> <span className="text-white">{visualTrace.metrics.actionBatches}</span></div>}
                            {visualTrace.metrics.approvalInterruptions !== undefined && <div><span className="text-text-muted">{t('taskPanels.visualApprovalInterruptions')}:</span> <span className="text-white">{visualTrace.metrics.approvalInterruptions}</span></div>}
                            {visualTrace.metrics.recoveryAttempts !== undefined && <div><span className="text-text-muted">{t('taskPanels.visualRecoveryAttempts')}:</span> <span className="text-white">{visualTrace.metrics.recoveryAttempts}</span></div>}
                            {visualTrace.metrics.verificationFailures !== undefined && <div><span className="text-text-muted">Verification failures:</span> <span className="text-white">{visualTrace.metrics.verificationFailures}</span></div>}
                            {visualTrace.metrics.recoveryStrategies && visualTrace.metrics.recoveryStrategies.length > 0 && <div><span className="text-text-muted">{t('taskPanels.visualRecoveryStrategies')}:</span> <span className="text-white">{visualTrace.metrics.recoveryStrategies.join(', ')}</span></div>}
                            {visualTrace.metrics.recoveryDetails && visualTrace.metrics.recoveryDetails.length > 0 && (
                              <div>
                                <div className="text-text-muted">Recovery details:</div>
                                <div className="space-y-1 mt-1">
                                  {visualTrace.metrics.recoveryDetails.map((detail, index) => (
                                    <div key={`${detail.strategy || 'recovery'}-${index}`} className="text-white">
                                      #{detail.attempt || index + 1} {detail.strategy || 'unknown'}
                                      {detail.category ? ` [${detail.category}]` : ''}
                                      {detail.trigger ? ` <${detail.trigger}>` : ''}
                                      {detail.failedActions && detail.failedActions.length > 0 ? ` - ${detail.failedActions.join(', ')}` : ''}
                                      {detail.errorMessage ? ` - ${detail.errorMessage}` : ''}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {visualTrace.metrics.totalDurationMs !== undefined && <div><span className="text-text-muted">{t('taskPanels.visualTotalDuration')}:</span> <span className="text-white">{visualTrace.metrics.totalDurationMs}ms</span></div>}
                          </div>
                        )}
                        {visualTrace.turns.length > 0 && (
                          <div>
                            <span className="text-text-muted">{t('taskPanels.visualTurns')}:</span>{' '}
                            <span className="text-white">{visualTrace.turns.length}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {skillCandidate && <SkillCandidateCard candidate={skillCandidate} />}
                  </div>
                )}

                {selectedDetails.run.metadata && (
                  <div className="rounded-lg border border-border bg-background px-3 py-3">
                    <div className="text-xs uppercase tracking-wide text-text-muted mb-2">{t('historyPanel.metadata')}</div>
                    <pre className="whitespace-pre-wrap break-all text-xs text-text-secondary">
                      {JSON.stringify(selectedDetails.run.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => void handleRerun()} className="btn btn-primary text-sm">
                    {t('taskPanels.rerun')}
                  </button>
                  <button onClick={handleAddToScheduler} className="btn btn-secondary text-sm">
                    {t('taskPanels.addToScheduler')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-text-muted">{t('taskPanels.selectRun')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskRunsPanel;
