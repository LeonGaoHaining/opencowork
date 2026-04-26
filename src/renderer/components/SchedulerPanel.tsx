// src/renderer/components/SchedulerPanel.tsx

import React, { useState, useEffect } from 'react';
import { useSchedulerStore, defaultTaskInput } from '../stores/schedulerStore';
import { ScheduledTask, ScheduleType } from '../../scheduler/types';
import { CronParser } from '../../scheduler/cronParser';
import { useTranslation } from '../i18n/useTranslation';
import { TaskTemplate } from '../../core/task/types';
import { getTemplateInputFields } from '../../core/task/templateUtils';
import { useTaskStore } from '../stores/taskStore';
import RelationBadge from './RelationBadge';

type TaskTab = 'all' | 'executing' | 'scheduled' | 'completed';

interface CreateTaskFormData {
  name: string;
  description: string;
  scheduleType: ScheduleType;
  cron: string;
  intervalMs: number;
  startTime: string;
  taskDescription: string;
  templateId: string;
  templateInputs: Record<string, string>;
  executionMode: 'dom' | 'visual' | 'hybrid';
  timeout: number;
}

function SchedulerPanel() {
  const { t } = useTranslation();
  const {
    tasks,
    isLoading,
    error,
    selectedTaskId,
    isOpen,
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    triggerTask,
    enableTask,
    disableTask,
    selectTask,
    setOpen,
    draftTaskInput,
    clearDraft,
  } = useSchedulerStore();

  const [activeTab, setActiveTab] = useState<TaskTab>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [formData, setFormData] = useState<CreateTaskFormData>({
    name: '',
    description: '',
    scheduleType: ScheduleType.CRON,
    cron: '0 9 * * *',
    intervalMs: 3600000,
    startTime: '',
    taskDescription: '',
    templateId: '',
    templateInputs: {},
    executionMode: 'dom',
    timeout: 300000,
  });

  const selectedTemplate = templates.find((template) => template.id === formData.templateId) || null;
  const selectedTemplateFields = selectedTemplate ? getTemplateInputFields(selectedTemplate) : [];
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || null;
  const { openRunsPanel } = useTaskStore();

  const openTemplateFromScheduler = (templateId: string): void => {
    window.dispatchEvent(new CustomEvent('template:open', { detail: { templateId } }));
  };

  useEffect(() => {
    if (isOpen) {
      loadTasks();
      void (async () => {
        try {
          const result = await window.electron.invoke('template:list');
          const payload = result?.data || result;
          setTemplates(Array.isArray(payload) ? payload : []);
        } catch (error) {
          console.error('[SchedulerPanel] Failed to load templates:', error);
          setTemplates([]);
        }
      })();
      const interval = setInterval(() => {
        loadTasks();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, loadTasks]);

  useEffect(() => {
    const handleTemplateChanged = (): void => {
      if (!isOpen) {
        return;
      }

      void (async () => {
        try {
          const result = await window.electron.invoke('template:list');
          const payload = result?.data || result;
          setTemplates(Array.isArray(payload) ? payload : []);
        } catch (error) {
          console.error('[SchedulerPanel] Failed to refresh templates:', error);
        }
      })();
    };

    window.addEventListener('template:changed', handleTemplateChanged as EventListener);
    return () => {
      window.removeEventListener('template:changed', handleTemplateChanged as EventListener);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !draftTaskInput) {
      return;
    }

    setShowCreateModal(true);
    setFormData({
      name: draftTaskInput.name || '',
      description: draftTaskInput.description || '',
      scheduleType: (draftTaskInput.schedule?.type as ScheduleType) || ScheduleType.CRON,
      cron: draftTaskInput.schedule?.cron || '0 9 * * *',
      intervalMs: draftTaskInput.schedule?.intervalMs || 3600000,
      startTime: draftTaskInput.schedule?.startTime
        ? new Date(draftTaskInput.schedule.startTime).toISOString().slice(0, 16)
        : '',
      taskDescription: draftTaskInput.execution?.taskDescription || '',
      templateId: draftTaskInput.execution?.templateId || '',
      templateInputs: (draftTaskInput.execution?.input as Record<string, string>) || {},
      executionMode: draftTaskInput.execution?.executionMode || 'dom',
      timeout: draftTaskInput.execution?.timeout || 300000,
    });
    clearDraft();
  }, [isOpen, draftTaskInput, clearDraft]);

  if (!isOpen) return null;

  const filteredTasks = tasks.filter((task) => {
    switch (activeTab) {
      case 'executing':
        return task.lastStatus === undefined && task.enabled;
      case 'scheduled':
        return task.enabled && task.lastStatus !== 'success';
      case 'completed':
        return task.lastStatus === 'success';
      default:
        return true;
    }
  });

  const handleCreate = async () => {
    const input = {
      name: formData.name,
      description: formData.description,
      enabled: true,
      schedule: {
        type: formData.scheduleType,
        cron: formData.scheduleType === ScheduleType.CRON ? formData.cron : undefined,
        intervalMs:
          formData.scheduleType === ScheduleType.INTERVAL ? formData.intervalMs : undefined,
        startTime:
          formData.scheduleType === ScheduleType.ONE_TIME
            ? new Date(formData.startTime).getTime()
            : undefined,
      },
      execution: {
        taskDescription: formData.templateId ? '' : formData.taskDescription,
        templateId: formData.templateId || undefined,
        input: formData.templateId ? formData.templateInputs : undefined,
        executionMode: formData.executionMode,
        timeout: formData.timeout,
        maxRetries: 3,
        retryDelayMs: 1000,
      },
    };

    await createTask(input);
    setShowCreateModal(false);
    clearDraft();
    setFormData({
      name: '',
      description: '',
      scheduleType: ScheduleType.CRON,
      cron: '0 9 * * *',
      intervalMs: 3600000,
      startTime: '',
      taskDescription: '',
      templateId: '',
      templateInputs: {},
      executionMode: 'dom',
      timeout: 300000,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('schedulerPanel.confirmDelete'))) {
      await deleteTask(id);
    }
  };

  const formatNextRun = (timestamp?: number) => {
    if (!timestamp) return '-';
    const lang = localStorage.getItem('language') || 'en';
    return new Date(timestamp).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US');
  };

  const formatSchedule = (task: ScheduledTask) => {
    const lang = localStorage.getItem('language') || 'en';
    switch (task.schedule.type) {
      case ScheduleType.CRON:
        return task.schedule.cron || '-';
      case ScheduleType.INTERVAL:
        return `${Math.floor((task.schedule.intervalMs || 0) / 3600000)}${t('schedulerPanel.hours')}`;
      case ScheduleType.ONE_TIME:
        return task.schedule.startTime
          ? new Date(task.schedule.startTime).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')
          : '-';
    }
  };

  const cronPresets = CronParser.getPresets();

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
      <div className="w-[800px] bg-surface border-l border-border flex flex-col">
        <div className="h-14 flex items-center justify-between px-4 border-b border-border">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white">{t('schedulerPanel.title')}</h2>
            <span className="text-sm text-text-muted">
              {t('schedulerPanel.totalTasks', { count: tasks.length })}
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
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

        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary text-sm"
            disabled={isLoading}
          >
            {t('schedulerPanel.addTask')}
          </button>
          <button onClick={loadTasks} className="btn btn-secondary text-sm" disabled={isLoading}>
            {t('schedulerPanel.refresh')}
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          {(['all', 'executing', 'scheduled', 'completed'] as TaskTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded text-sm ${
                activeTab === tab ? 'bg-primary text-white' : 'text-text-muted hover:text-white'
              }`}
            >
              {tab === 'all'
                ? t('schedulerPanel.filter.all')
                : tab === 'executing'
                  ? t('schedulerPanel.filter.executing')
                  : tab === 'scheduled'
                    ? t('schedulerPanel.filter.scheduled')
                    : t('schedulerPanel.filter.completed')}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && tasks.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-text-muted">
              {t('schedulerPanel.loading')}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-text-muted">
              {t('schedulerPanel.noTasks')}
            </div>
          ) : (
            <div className="flex gap-4 h-full">
              <div className="flex-1 space-y-2 overflow-y-auto">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`bg-elevated border rounded-lg p-4 hover:border-primary/50 transition-colors ${
                      selectedTaskId === task.id ? 'border-primary/30' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1" onClick={() => selectTask(task.id)}>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-white">{task.name}</h3>
                          {!task.enabled && (
                            <span className="text-xs text-text-muted">
                              {t('schedulerPanel.disabled')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted mt-1">{task.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                          <span>
                            {t('schedulerPanel.schedule')}: {formatSchedule(task)}
                          </span>
                          <span>
                            {t('schedulerPanel.nextRun')}: {formatNextRun(task.nextRun)}
                          </span>
                          <span>
                            {t('schedulerPanel.runCount')}: {task.runCount}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <RelationBadge label="task" value={task.id} tone="muted" />
                          {task.execution.templateId && (
                            <RelationBadge
                              label="template"
                              value={task.execution.templateId}
                              tone="primary"
                              onClick={() => openTemplateFromScheduler(task.execution.templateId as string)}
                            />
                          )}
                          {task.lastStatus && <RelationBadge label="last" value={task.lastStatus} />}
                        </div>
                        {task.lastStatus && (
                          <div className="mt-2 text-xs">
                            <span
                              className={`${
                                task.lastStatus === 'success'
                                  ? 'text-green-400'
                                  : task.lastStatus === 'failed'
                                    ? 'text-red-400'
                                    : 'text-yellow-400'
                              }`}
                            >
                              {t('schedulerPanel.lastRun')}:{' '}
                              {task.lastStatus === 'success'
                                ? t('schedulerPanel.lastSuccess')
                                : task.lastStatus === 'failed'
                                  ? t('schedulerPanel.lastFailed')
                                  : t('schedulerPanel.lastCancelled')}
                            </span>
                            {task.lastError && (
                              <span className="text-red-400 ml-2">- {task.lastError}</span>
                            )}
                            {task.lastResultSummary && (
                              <div className="mt-1 line-clamp-2 text-text-secondary">
                                Result: {task.lastResultSummary}
                              </div>
                            )}
                            {(typeof task.lastArtifactsCount === 'number' || task.lastRunId) && (
                              <div className="mt-1 flex flex-wrap gap-2 text-text-muted">
                                {typeof task.lastArtifactsCount === 'number' && (
                                  <span>artifacts: {task.lastArtifactsCount}</span>
                                )}
                                {task.lastRunId && <span>run: {task.lastRunId}</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {task.enabled ? (
                          <button
                            onClick={() => disableTask(task.id)}
                            className="btn btn-secondary text-xs"
                          >
                            {t('schedulerPanel.disable')}
                          </button>
                        ) : (
                          <button
                            onClick={() => enableTask(task.id)}
                            className="btn btn-primary text-xs"
                          >
                            {t('schedulerPanel.enable')}
                          </button>
                        )}
                        <button
                          onClick={() => triggerTask(task.id)}
                          className="btn btn-secondary text-xs"
                        >
                          {t('schedulerPanel.runNow')}
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="p-1 text-text-muted hover:text-red-400"
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
                  </div>
                ))}
              </div>

              <div className="w-[280px] overflow-y-auto rounded-lg border border-border bg-background p-4">
                {selectedTask ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-base font-semibold text-white">{selectedTask.name}</div>
                      <div className="mt-1 text-xs text-text-muted whitespace-pre-wrap">
                        {selectedTask.description}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <RelationBadge label="task" value={selectedTask.id} tone="muted" />
                      {selectedTask.execution.templateId && (
                        <RelationBadge
                          label="template"
                          value={selectedTask.execution.templateId}
                          tone="primary"
                          onClick={() => openTemplateFromScheduler(selectedTask.execution.templateId as string)}
                        />
                      )}
                    </div>
                    <div className="rounded border border-border bg-surface px-3 py-2">
                      <div className="text-xs text-text-muted">Schedule</div>
                      <div className="mt-1 text-sm text-white">{formatSchedule(selectedTask)}</div>
                    </div>
                    <div className="rounded border border-border bg-surface px-3 py-2">
                      <div className="text-xs text-text-muted">Execution</div>
                      <div className="mt-1 text-xs text-text-secondary whitespace-pre-wrap break-words">
                        {selectedTask.execution.templateId
                          ? `template: ${selectedTask.execution.templateId}`
                          : selectedTask.execution.taskDescription || 'No task content'}
                      </div>
                      <div className="mt-2 text-xs text-text-muted">
                        {t('taskPanels.executionMode')}: {selectedTask.execution.executionMode || 'dom'}
                      </div>
                      {selectedTask.execution.input && (
                        <pre className="mt-2 whitespace-pre-wrap break-all text-[11px] text-text-muted">
                          {JSON.stringify(selectedTask.execution.input, null, 2)}
                        </pre>
                      )}
                    </div>
                    <div className="rounded border border-border bg-surface px-3 py-2">
                      <div className="text-xs text-text-muted">Run Context</div>
                      <div className="mt-1 text-xs text-text-secondary">
                        next: {formatNextRun(selectedTask.nextRun)}
                      </div>
                      <div className="mt-1 text-xs text-text-secondary">
                        runs: {selectedTask.runCount}
                      </div>
                    </div>
                    {selectedTask.lastStatus && (
                      <div className="rounded border border-border bg-surface px-3 py-2">
                        <div className="text-xs text-text-muted">Last Result</div>
                        <div className="mt-1 text-sm text-white">{selectedTask.lastStatus}</div>
                        {selectedTask.lastError && (
                          <div className="mt-1 text-xs text-red-300 whitespace-pre-wrap">
                            {selectedTask.lastError}
                          </div>
                        )}
                        {selectedTask.lastResultSummary && (
                          <div className="mt-2 text-xs text-text-secondary whitespace-pre-wrap">
                            {selectedTask.lastResultSummary}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
                          {typeof selectedTask.lastArtifactsCount === 'number' && (
                            <span>artifacts: {selectedTask.lastArtifactsCount}</span>
                          )}
                          {selectedTask.lastRunId && (
                            <button
                              type="button"
                              onClick={() => openRunsPanel(selectedTask.lastRunId as string)}
                              className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
                            >
                              run: {selectedTask.lastRunId}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-text-muted">Select a scheduler task to inspect details.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="flex-1 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="w-[500px] bg-surface border border-border rounded-lg p-6 m-auto max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">
              {t('schedulerPanel.createTask')}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-text-muted">{t('schedulerPanel.taskName')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1"
                  placeholder={t('schedulerPanel.placeholder.taskName')}
                />
              </div>

              <div>
                <label className="text-sm text-text-muted">
                  {t('schedulerPanel.taskDescription')}
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1"
                  placeholder={t('schedulerPanel.placeholder.taskDescription')}
                />
              </div>

              <div>
                <label className="text-sm text-text-muted">
                  {t('schedulerPanel.scheduleType')}
                </label>
                <select
                  value={formData.scheduleType}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduleType: e.target.value as ScheduleType })
                  }
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1"
                >
                  <option value={ScheduleType.CRON}>{t('schedulerPanel.cron')}</option>
                  <option value={ScheduleType.INTERVAL}>{t('schedulerPanel.interval')}</option>
                  <option value={ScheduleType.ONE_TIME}>{t('schedulerPanel.oneTime')}</option>
                </select>
              </div>

              {formData.scheduleType === ScheduleType.CRON && (
                <>
                  <div>
                    <label className="text-sm text-text-muted">{t('schedulerPanel.cron')}</label>
                    <input
                      type="text"
                      value={formData.cron}
                      onChange={(e) => setFormData({ ...formData, cron: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1"
                      placeholder="0 9 * * *"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm text-text-muted">{t('schedulerPanel.presets')}:</span>
                    {cronPresets.map((preset) => (
                      <button
                        key={preset.expression}
                        onClick={() => setFormData({ ...formData, cron: preset.expression })}
                        className="px-2 py-1 text-xs bg-background border border-border rounded hover:border-primary text-text-muted hover:text-white"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {formData.scheduleType === ScheduleType.INTERVAL && (
                <div>
                  <label className="text-sm text-text-muted">
                    {t('schedulerPanel.intervalMs')}
                  </label>
                  <input
                    type="number"
                    value={formData.intervalMs}
                    onChange={(e) =>
                      setFormData({ ...formData, intervalMs: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1"
                    placeholder="3600000 (1小时)"
                  />
                  <p className="text-xs text-text-muted mt-1">3600000 = 1小时, 86400000 = 1天</p>
                </div>
              )}

              {formData.scheduleType === ScheduleType.ONE_TIME && (
                <div>
                  <label className="text-sm text-text-muted">{t('schedulerPanel.startTime')}</label>
                  <input
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1"
                  />
                </div>
              )}

              <div>
                <label className="text-sm text-text-muted">{t('schedulerPanel.taskContent')}</label>
                <select
                  value={formData.templateId}
                  onChange={(e) => {
                    const nextTemplateId = e.target.value;
                    const template = templates.find((item) => item.id === nextTemplateId) || null;
                    const nextInputs: Record<string, string> = {};
                    if (template) {
                      for (const field of getTemplateInputFields(template)) {
                        nextInputs[field.key] = field.defaultValue;
                      }
                    }
                    setFormData({
                      ...formData,
                      templateId: nextTemplateId,
                      templateInputs: nextInputs,
                    });
                  }}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1 mb-2"
                >
                  <option value="">Free text task</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <textarea
                  value={formData.taskDescription}
                  onChange={(e) => setFormData({ ...formData, taskDescription: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1 h-24"
                  placeholder={t('schedulerPanel.placeholder.taskContent')}
                  disabled={!!formData.templateId}
                />
                {formData.templateId && (
                  <p className="text-xs text-text-muted mt-1">
                    Selected template will be used for execution.
                  </p>
                )}
              </div>

              {selectedTemplateFields.length > 0 && (
                <div>
                  <label className="text-sm text-text-muted">Template Parameters</label>
                  <div className="mt-2 space-y-3">
                    {selectedTemplateFields.map((field) => (
                      <div key={field.key}>
                        <label className="text-xs text-text-muted">{field.label}</label>
                        <input
                          type="text"
                          value={formData.templateInputs[field.key] || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              templateInputs: {
                                ...formData.templateInputs,
                                [field.key]: e.target.value,
                              },
                            })
                          }
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm text-text-muted">{t('schedulerPanel.timeout')}</label>
                <input
                  type="number"
                  value={formData.timeout}
                  onChange={(e) =>
                    setFormData({ ...formData, timeout: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1"
                  placeholder="300000"
                />
              </div>

              <div>
                <label className="text-sm text-text-muted">{t('taskPanels.executionMode')}</label>
                <select
                  value={formData.executionMode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      executionMode: e.target.value as 'dom' | 'visual' | 'hybrid',
                    })
                  }
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1"
                >
                  <option value="dom">dom</option>
                  <option value="visual">visual</option>
                  <option value="hybrid">hybrid</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                {t('schedulerPanel.cancel')}
              </button>
              <button
                onClick={handleCreate}
                className="btn btn-primary"
                disabled={!formData.name || (!formData.taskDescription && !formData.templateId)}
              >
                {t('schedulerPanel.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SchedulerPanel;
