import React, { useEffect, useState } from 'react';
import { useHistoryStore } from '../stores/historyStore';
import { TaskHistoryRecord } from '../../history/taskHistory';
import { useTranslation } from '../i18n/useTranslation';
import { useTaskStore } from '../stores/taskStore';
import RelationBadge from './RelationBadge';
import { extractVisualTraceSummary } from '../utils/visualTrace';

function getResultSummary(task: TaskHistoryRecord): string | undefined {
  return task.result?.summary || (typeof task.result?.output === 'string' ? task.result.output : undefined);
}

function getSourceLabel(task: TaskHistoryRecord): string | undefined {
  const source = task.metadata?.source;
  return typeof source === 'string' ? source : undefined;
}

function getArtifactCount(task: TaskHistoryRecord): number {
  if (Array.isArray(task.result?.artifacts)) {
    return task.result.artifacts.length;
  }
  const count = task.metadata?.artifactsCount;
  return typeof count === 'number' ? count : 0;
}

function hasVisualTrace(task: TaskHistoryRecord): boolean {
  return extractVisualTraceSummary(task.result?.rawOutput).hasVisualTrace;
}

type FilterTab = 'all' | 'completed' | 'failed' | 'cancelled';
type OutcomeFilter = 'all' | 'result' | 'artifacts' | 'run' | 'template' | 'visual';

export function HistoryPanel() {
  const { t } = useTranslation();
  const { openRunsPanel } = useTaskStore();
  const {
    isOpen,
    isLoading,
    tasks,
    selectedTask,
    selectedTaskId,
    filter,
    total,
    searchResults,
    searchSummary,
    setIsOpen,
    setFilter,
    setSelectedTaskId,
    loadTasks,
    deleteTask,
    replayTask,
    saveTaskAsTemplate,
    runTemplate,
    searchTasks,
    summarizeSearch,
    clearSelectedTask,
  } = useHistoryStore();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'chat' | 'scheduler' | 'im' | 'mcp' | 'replay'>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');

  useEffect(() => {
    if (isOpen) {
      loadTasks();
    }
    // loadTasks is stable from Zustand store
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const newFilter: typeof filter = { ...filter };
    if (activeTab !== 'all') {
      newFilter.status = activeTab;
    } else {
      delete newFilter.status;
    }
    setFilter(newFilter);
    // setFilter and filter are stable from Zustand store
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSearch = () => {
    if (searchKeyword.trim()) {
      searchTasks(searchKeyword.trim());
      return;
    }
    setFilter({ ...filter, keyword: undefined });
  };

  const displayedTasks = searchKeyword.trim()
    ? tasks.filter((task) => searchResults.some((result) => result.sessionId === task.id))
    : tasks;

  const sourceFilteredTasks = displayedTasks.filter((task) => {
    const source = getSourceLabel(task);
    const hasResult = Boolean(getResultSummary(task) || task.result?.structuredData || task.result?.output);
    const hasArtifacts = getArtifactCount(task) > 0;
    const hasRun = typeof task.metadata?.runId === 'string';
    const hasTemplate = typeof task.metadata?.templateId === 'string';
    const hasVisual = hasVisualTrace(task);

    const matchesSource = sourceFilter === 'all' || source === sourceFilter;
    const matchesOutcome =
      outcomeFilter === 'all' ||
      (outcomeFilter === 'result' && hasResult) ||
      (outcomeFilter === 'artifacts' && hasArtifacts) ||
      (outcomeFilter === 'run' && hasRun) ||
      (outcomeFilter === 'template' && hasTemplate) ||
      (outcomeFilter === 'visual' && hasVisual);

    return matchesSource && matchesOutcome;
  });

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const lang = localStorage.getItem('language') || 'en';
    return date.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getStatusColor = (status: TaskHistoryRecord['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'cancelled':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={() => setIsOpen(false)} />
      <div className="w-[800px] bg-surface border-l border-border flex flex-col">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white">{t('historyPanel.title')}</h2>
            <span className="text-sm text-text-muted">
              {t('historyPanel.totalRecords', { count: total })}
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
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

        {/* Tabs */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border">
          <div className="flex gap-1">
            {(['all', 'completed', 'failed', 'cancelled'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  activeTab === tab
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:text-white hover:bg-border'
                }`}
              >
                {tab === 'all'
                  ? t('historyPanel.filter.all')
                  : tab === 'completed'
                    ? t('historyPanel.filter.completed')
                    : tab === 'failed'
                      ? t('historyPanel.filter.failed')
                      : t('historyPanel.filter.cancelled')}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <select
              value={sourceFilter}
              onChange={(e) =>
                setSourceFilter(
                  e.target.value as 'all' | 'chat' | 'scheduler' | 'im' | 'mcp' | 'replay'
                )
              }
              className="rounded border border-border bg-background px-2 py-1 text-sm text-white"
            >
              <option value="all">All sources</option>
              <option value="chat">chat</option>
              <option value="scheduler">scheduler</option>
              <option value="im">im</option>
              <option value="mcp">mcp</option>
              <option value="replay">replay</option>
            </select>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as OutcomeFilter)}
              className="rounded border border-border bg-background px-2 py-1 text-sm text-white"
            >
              <option value="all">All outcomes</option>
              <option value="result">has result</option>
              <option value="artifacts">has artifacts</option>
              <option value="run">has run</option>
              <option value="template">has template</option>
              <option value="visual">has visual trace</option>
            </select>
            <input
              type="text"
              placeholder={t('historyPanel.search')}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-48 px-3 py-1 bg-background border border-border rounded text-sm text-white placeholder-text-muted focus:outline-none focus:border-primary"
            />
            <button onClick={handleSearch} className="btn btn-secondary text-sm">
              {t('historyPanel.search')}
            </button>
            <button
              onClick={() => searchKeyword.trim() && summarizeSearch(searchKeyword.trim())}
              className="btn btn-secondary text-sm"
              disabled={!searchKeyword.trim()}
            >
              {t('historyPanel.summarize')}
            </button>
            {(sourceFilter !== 'all' || outcomeFilter !== 'all' || searchKeyword.trim()) && (
              <button
                onClick={() => {
                  setSourceFilter('all');
                  setOutcomeFilter('all');
                  setSearchKeyword('');
                  setActiveTab('all');
                  setFilter({});
                }}
                className="btn btn-secondary text-sm"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {searchSummary && (
          <div className="px-4 py-3 border-b border-border bg-background/40">
            <div className="text-sm font-medium text-white mb-1">
              {t('historyPanel.searchSummary')}
            </div>
            <div className="text-sm text-text-secondary whitespace-pre-wrap">{searchSummary}</div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Task List */}
          <div className="w-96 border-r border-border overflow-y-auto">
            {isLoading && sourceFilteredTasks.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-text-muted">
                {t('historyPanel.loading')}
              </div>
            ) : sourceFilteredTasks.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-text-muted">
                {t('historyPanel.noHistory')}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {sourceFilteredTasks.map((task) => {
                  const searchResult = searchResults.find((result) => result.sessionId === task.id);
                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`p-3 rounded cursor-pointer transition-colors ${
                        selectedTaskId === task.id
                          ? 'bg-primary/20 border border-primary/30'
                          : 'hover:bg-border/50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{task.task}</div>
                          {getResultSummary(task) && (
                            <div className="text-xs text-text-secondary mt-1 line-clamp-2">
                              {getResultSummary(task)}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {typeof task.metadata?.runId === 'string' && (
                              <RelationBadge
                                label="run"
                                value={task.metadata.runId}
                                tone="primary"
                                onClick={() => openRunsPanel(task.metadata?.runId as string)}
                              />
                            )}
                            {typeof task.metadata?.templateId === 'string' && (
                              <RelationBadge label="template" value={task.metadata.templateId} />
                            )}
                            {getSourceLabel(task) && (
                              <RelationBadge
                                label="source"
                                value={getSourceLabel(task) as string}
                                tone="muted"
                              />
                            )}
                          </div>
                          <div className="text-xs text-text-muted mt-1">
                            {formatTime(task.startTime)}
                          </div>
                        </div>
                        <span className={`text-xs ${getStatusColor(task.status)}`}>
                          {task.status === 'completed'
                            ? t('historyPanel.filter.completed')
                            : task.status === 'failed'
                              ? t('historyPanel.filter.failed')
                              : t('historyPanel.filter.cancelled')}
                        </span>
                      </div>
                      {task.duration > 0 && (
                        <div className="text-xs text-text-muted mt-1">
                          {t('historyPanel.duration')}: {formatDuration(task.duration)}
                        </div>
                      )}
                      <div className="text-xs text-text-muted mt-1 flex gap-3">
                        {getSourceLabel(task) && <span>source: {getSourceLabel(task)}</span>}
                        {getArtifactCount(task) > 0 && <span>artifacts: {getArtifactCount(task)}</span>}
                        {hasVisualTrace(task) && <span>visual trace</span>}
                      </div>
                      {searchResult?.match && searchKeyword.trim() && (
                        <div className="text-xs text-text-muted mt-1 line-clamp-2">
                          {searchResult.match}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Task Detail */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedTask ? (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    {(getResultSummary(selectedTask) || getArtifactCount(selectedTask) > 0) && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <div className="text-xs uppercase tracking-wide text-text-muted mb-2">
                          Result Overview
                        </div>
                        {getResultSummary(selectedTask) && (
                          <div className="text-sm text-white whitespace-pre-wrap">
                            {getResultSummary(selectedTask)}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
                          <span>artifacts: {getArtifactCount(selectedTask)}</span>
                          {typeof selectedTask.metadata?.runId === 'string' && (
                            <RelationBadge
                              label="run"
                              value={selectedTask.metadata.runId}
                              tone="primary"
                              onClick={() => openRunsPanel(selectedTask.metadata?.runId as string)}
                            />
                          )}
                          {typeof selectedTask.metadata?.templateId === 'string' && (
                            <RelationBadge label="template" value={selectedTask.metadata.templateId} />
                          )}
                          {getSourceLabel(selectedTask) && (
                            <RelationBadge
                              label="source"
                              value={getSourceLabel(selectedTask) as string}
                              tone="muted"
                            />
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="text-sm font-medium text-text-muted mb-1">
                        {t('historyPanel.taskDescription')}
                      </h3>
                      <p className="text-white">{selectedTask.task}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-text-muted mb-1">
                          {t('historyPanel.status')}
                        </h3>
                        <span className={`text-sm ${getStatusColor(selectedTask.status)}`}>
                          {selectedTask.status === 'completed'
                            ? t('historyPanel.filter.completed')
                            : selectedTask.status === 'failed'
                              ? t('historyPanel.filter.failed')
                              : t('historyPanel.filter.cancelled')}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-text-muted mb-1">
                          {t('historyPanel.duration')}
                        </h3>
                        <span className="text-sm text-white">
                          {formatDuration(selectedTask.duration)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-text-muted mb-1">
                          {t('historyPanel.startTime')}
                        </h3>
                        <span className="text-sm text-white">
                          {formatTime(selectedTask.startTime)}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-text-muted mb-1">
                          {t('historyPanel.endTime')}
                        </h3>
                        <span className="text-sm text-white">
                          {formatTime(selectedTask.endTime)}
                        </span>
                      </div>
                    </div>

                    {(getSourceLabel(selectedTask) || getArtifactCount(selectedTask) > 0) && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-sm font-medium text-text-muted mb-1">Source</h3>
                          <span className="text-sm text-white">
                            {getSourceLabel(selectedTask) || 'unknown'}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-text-muted mb-1">Artifacts</h3>
                          <span className="text-sm text-white">{getArtifactCount(selectedTask)}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {typeof selectedTask.metadata?.runId === 'string' && (
                        <RelationBadge
                          label="run"
                          value={selectedTask.metadata.runId}
                          tone="primary"
                          onClick={() => openRunsPanel(selectedTask.metadata?.runId as string)}
                        />
                      )}
                      {typeof selectedTask.metadata?.templateId === 'string' && (
                        <RelationBadge label="template" value={selectedTask.metadata.templateId} />
                      )}
                      {getSourceLabel(selectedTask) && (
                        <RelationBadge label="source" value={getSourceLabel(selectedTask) as string} tone="muted" />
                      )}
                    </div>

                    {selectedTask.result && (
                      <div>
                        <h3 className="text-sm font-medium text-text-muted mb-1">
                          {t('historyPanel.result')}
                        </h3>
                        {selectedTask.result.success ? (
                          <div className="text-sm text-green-400">
                            {t('historyPanel.executionSuccess')}
                          </div>
                        ) : (
                          <div className="text-sm text-red-400">
                            {selectedTask.result.error || t('historyPanel.executionFailed')}
                          </div>
                        )}
                        {Array.isArray(selectedTask.result.artifacts) &&
                          selectedTask.result.artifacts.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {selectedTask.result.artifacts.map((artifact) => (
                                <div
                                  key={artifact.id}
                                  className="text-xs text-text-secondary bg-background rounded px-2 py-1"
                                >
                                  {artifact.type}: {artifact.name}
                                  {artifact.uri ? ` (${artifact.uri})` : ''}
                                </div>
                              ))}
                            </div>
                          )}
                        {extractVisualTraceSummary(selectedTask.result.rawOutput).hasVisualTrace && (
                          <div className="mt-3 rounded border border-border bg-background px-3 py-3 text-xs text-text-secondary space-y-2">
                            <div className="text-text-muted">{t('taskPanels.visualTrace')}</div>
                            {extractVisualTraceSummary(selectedTask.result.rawOutput).routeReasons.length > 0 && (
                              <div>
                                <span className="text-text-muted">{t('taskPanels.visualRouteReason')}:</span>{' '}
                                <span className="text-white">
                                  {extractVisualTraceSummary(selectedTask.result.rawOutput).routeReasons.join(' | ')}
                                </span>
                              </div>
                            )}
                            {extractVisualTraceSummary(selectedTask.result.rawOutput).fallbackReasons.length > 0 && (
                              <div>
                                <span className="text-text-muted">{t('taskPanels.visualFallbackReason')}:</span>{' '}
                                <span className="text-white">
                                  {extractVisualTraceSummary(selectedTask.result.rawOutput).fallbackReasons.join(' | ')}
                                </span>
                              </div>
                            )}
                            {extractVisualTraceSummary(selectedTask.result.rawOutput).approvedActions.length > 0 && (
                              <div>
                                <span className="text-text-muted">{t('taskPanels.visualApprovedActions')}:</span>{' '}
                                <span className="text-white">
                                  {extractVisualTraceSummary(selectedTask.result.rawOutput).approvedActions
                                    .map((action) => action.type || 'unknown')
                                    .join(', ')}
                                </span>
                              </div>
                            )}
                            {extractVisualTraceSummary(selectedTask.result.rawOutput).turns.length > 0 && (
                              <div>
                                <span className="text-text-muted">{t('taskPanels.visualTurns')}:</span>{' '}
                                <span className="text-white">
                                  {extractVisualTraceSummary(selectedTask.result.rawOutput).turns.length}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedTask.steps && selectedTask.steps.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-text-muted mb-2">
                          {t('historyPanel.executionSteps', { count: selectedTask.steps.length })}
                        </h3>
                        <div className="space-y-2">
                          {selectedTask.steps.map((step, index) => (
                            <div key={step.id} className="bg-background rounded p-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-white font-mono">{step.toolName}</span>
                                <span
                                  className={`text-xs ${
                                    step.status === 'completed'
                                      ? 'text-green-400'
                                      : step.status === 'error'
                                        ? 'text-red-400'
                                        : step.status === 'running'
                                          ? 'text-blue-400'
                                          : 'text-gray-400'
                                  }`}
                                >
                                  {step.status}
                                </span>
                              </div>
                              {step.args && Object.keys(step.args).length > 0 && (
                                <div className="text-xs text-text-muted mt-1 font-mono">
                                  {JSON.stringify(step.args).substring(0, 100)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedTask.metadata && (
                      <div>
                        <h3 className="text-sm font-medium text-text-muted mb-1">
                          {t('historyPanel.metadata')}
                        </h3>
                        <div className="bg-background rounded p-2 text-xs font-mono text-text-muted">
                          {JSON.stringify(selectedTask.metadata, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-border flex justify-between">
                  <button
                    onClick={() => {
                      if (confirm(t('historyPanel.confirmDelete'))) {
                        deleteTask(selectedTask.id);
                      }
                    }}
                    className="btn btn-danger text-sm"
                  >
                    {t('historyPanel.delete')}
                  </button>
                  <div className="flex gap-2">
                    {typeof selectedTask.metadata?.runId === 'string' && (
                      <button
                        onClick={() => openRunsPanel(selectedTask.metadata?.runId as string)}
                        className="btn btn-secondary text-sm"
                      >
                        {t('taskPanels.viewRun')}
                      </button>
                    )}
                    <button
                      onClick={() => saveTaskAsTemplate(selectedTask.id)}
                      className="btn btn-secondary text-sm"
                    >
                      {t('taskPanels.saveAsTemplate')}
                    </button>
                    {typeof selectedTask.metadata?.templateId === 'string' && (
                      <button
                        onClick={() => runTemplate(selectedTask.metadata?.templateId as string)}
                        className="btn btn-secondary text-sm"
                      >
                        {t('taskPanels.runTemplate')}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        clearSelectedTask();
                      }}
                      className="btn btn-secondary text-sm"
                    >
                      {t('historyPanel.close')}
                    </button>
                    <button
                      onClick={() => replayTask(selectedTask.id)}
                      className="btn btn-primary text-sm"
                    >
                      {t('historyPanel.replay')}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-muted">
                {t('historyPanel.selectTask')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HistoryPanel;
