import React, { useEffect, useState } from 'react';
import { TaskResult, TaskRun, TaskTemplate } from '../../core/task/types';
import { TaskHistoryRecord } from '../../history/taskHistory';
import { useHistoryStore } from '../stores/historyStore';
import { useSchedulerStore } from '../stores/schedulerStore';
import { useTaskStore } from '../stores/taskStore';
import { useTranslation } from '../i18n/useTranslation';
import RelationBadge from './RelationBadge';
import ArtifactViewer from './ArtifactViewer';

interface TaskRunDetails {
  run: TaskRun;
  result: TaskResult | null;
  template: TaskTemplate | null;
  history: TaskHistoryRecord | null;
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

  if (!isOpen) {
    return null;
  }

  const selectedResult = selectedDetails?.result || null;
  const historyResult = selectedDetails?.history?.result || null;
  const resultSummary = selectedResult?.summary || historyResult?.summary || '';
  const resultError = selectedResult?.error?.message || historyResult?.taskError?.message || '';
  const resultStructuredData = selectedResult?.structuredData ?? historyResult?.structuredData;
  const resultArtifacts = selectedResult?.artifacts || historyResult?.artifacts || [];

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
                    <RelationBadge label="template" value={selectedDetails.run.templateId} tone="primary" />
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
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm text-text-secondary">
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                          <div className="text-xs text-text-muted">{t('taskPanels.source')}</div>
                    <div className="mt-1 text-white">{selectedDetails.run.source}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                          <div className="text-xs text-text-muted">{t('taskPanels.status')}</div>
                    <div className="mt-1 text-white">{selectedDetails.run.status}</div>
                  </div>
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
