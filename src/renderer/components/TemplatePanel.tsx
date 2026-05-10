import React, { useCallback, useEffect, useState } from 'react';
import { TaskTemplate, TaskWorkflowPack } from '../../core/task/types';
import { useHistoryStore } from '../stores/historyStore';
import { getTemplateInputFields, validateTemplateInput } from '../../core/task/templateUtils';
import { useSchedulerStore } from '../stores/schedulerStore';
import { useTranslation } from '../i18n/useTranslation';

interface EditableTemplateField {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  defaultValue: string;
}

interface TemplateChangeEventDetail {
  templateId?: string;
  source: 'run' | 'manual';
}

interface TemplatePanelProps {
  isOpen: boolean;
  onClose: () => void;
  preferredTemplateId?: string | null;
}

export function TemplatePanel({ isOpen, onClose, preferredTemplateId = null }: TemplatePanelProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [workflowPacks, setWorkflowPacks] = useState<TaskWorkflowPack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInstallingPackId, setIsInstallingPackId] = useState<string | null>(null);
  const [workflowPackMessage, setWorkflowPackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showInstalledWorkflowPacksOnly, setShowInstalledWorkflowPacksOnly] = useState(false);
  const [profileFilter, setProfileFilter] = useState<'all' | TaskTemplate['executionProfile']>('all');
  const [runPrompt, setRunPrompt] = useState('');
  const [runInputValues, setRunInputValues] = useState<Record<string, string>>({});
  const [runExecutionMode, setRunExecutionMode] = useState<'dom' | 'visual' | 'hybrid'>('dom');
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftFields, setDraftFields] = useState<EditableTemplateField[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunningTemplate, setIsRunningTemplate] = useState(false);
  const { t } = useTranslation();
  const { runTemplate } = useHistoryStore();
  const { prepareDraftFromTemplate } = useSchedulerStore();

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || null;
  const selectedFields = selectedTemplate ? getTemplateInputFields(selectedTemplate) : [];
  const runValidation = selectedTemplate
    ? validateTemplateInput(selectedTemplate, {
        prompt: runPrompt,
        ...runInputValues,
      })
    : { valid: false, missingFields: [], params: {} };

  const loadTemplates = useCallback(async (preferredTemplateId?: string) => {
    setIsLoading(true);
    try {
      const response = await window.electron.invoke('template:list');
      const payload = response?.data || response;
      const nextTemplates = Array.isArray(payload) ? payload : [];
      setTemplates(nextTemplates);
      const nextSelectedId = preferredTemplateId || selectedTemplateId;
      if (nextSelectedId && nextTemplates.some((item) => item.id === nextSelectedId)) {
        setSelectedTemplateId(nextSelectedId);
      } else if (nextTemplates.length > 0) {
        setSelectedTemplateId(nextTemplates[0].id);
      } else {
        setSelectedTemplateId(null);
      }
    } catch (error) {
      console.error('[TemplatePanel] Failed to load templates:', error);
      setTemplates([]);
      setSelectedTemplateId(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTemplateId]);

  const loadWorkflowPacks = useCallback(async () => {
    try {
      const response = await window.electron.invoke('workflow-pack:list');
      const payload = response?.data || response;
      setWorkflowPacks(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error('[TemplatePanel] Failed to load workflow packs:', error);
      setWorkflowPacks([]);
    }
  }, []);

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const result = await window.electron.invoke('template:delete', { templateId });
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to delete template');
      }
      await loadTemplates();
    } catch (error) {
      console.error('[TemplatePanel] Failed to delete template:', error);
    }
  };

  const handleRunTemplate = async (): Promise<void> => {
    if (!selectedTemplate || !runValidation.valid || isRunningTemplate) {
      return;
    }

    setIsRunningTemplate(true);
    try {
      await runTemplate(
        selectedTemplate.id,
        {
          prompt: runPrompt,
          ...runInputValues,
        },
        runExecutionMode,
        selectedTemplate.name
      );
    } finally {
      setIsRunningTemplate(false);
    }
  };

  const handleInstallWorkflowPack = async (pack: TaskWorkflowPack) => {
    try {
      setIsInstallingPackId(pack.id);
      setWorkflowPackMessage(null);
      const result = await window.electron.invoke('workflow-pack:install', { packId: pack.id });
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to install workflow pack');
      }

      const payload = result?.data || result;
      await loadTemplates(payload?.selectedTemplateId || undefined);
      await loadWorkflowPacks();
      setWorkflowPackMessage({
        type: 'success',
        text: `${pack.name}: installed ${payload?.installedCount || 0} templates`,
      });
    } catch (error) {
      setWorkflowPackMessage({
        type: 'error',
        text: `${pack.name}: ${error instanceof Error ? error.message : String(error)}`,
      });
      console.error('[TemplatePanel] Failed to install workflow pack:', error);
    } finally {
      setIsInstallingPackId(null);
    }
  };

  const handleCopyTemplateId = async (templateId: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(templateId);
    } catch (error) {
      console.error('[TemplatePanel] Failed to copy template id:', error);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    void (async () => {
      if (!cancelled) {
        await loadTemplates(preferredTemplateId || undefined);
        await loadWorkflowPacks();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, preferredTemplateId, loadTemplates, loadWorkflowPacks]);

  useEffect(() => {
    const handleTemplateChanged = (event: Event): void => {
      const detail = (event as CustomEvent<TemplateChangeEventDetail>).detail;
      if (isOpen) {
        void loadTemplates(detail?.templateId);
      }
    };

    window.addEventListener('template:changed', handleTemplateChanged as EventListener);
    return () => {
      window.removeEventListener('template:changed', handleTemplateChanged as EventListener);
    };
  }, [isOpen, loadTemplates]);

  useEffect(() => {
    if (!selectedTemplate) {
      setRunPrompt('');
      setRunInputValues({});
      setDraftName('');
      setDraftDescription('');
      setDraftPrompt('');
      setDraftFields([]);
      setRunExecutionMode('dom');
      return;
    }

    const nextValues: Record<string, string> = {};
    const fields = getTemplateInputFields(selectedTemplate);
    for (const field of fields) {
      nextValues[field.key] = field.defaultValue;
    }
    setRunInputValues(nextValues);
    setRunPrompt(
      typeof selectedTemplate.defaultInput?.prompt === 'string' &&
        selectedTemplate.defaultInput.prompt.trim().length > 0
        ? selectedTemplate.defaultInput.prompt
        : selectedTemplate.description
    );
    setDraftName(selectedTemplate.name);
    setDraftDescription(selectedTemplate.description);
    setDraftPrompt(
      typeof selectedTemplate.defaultInput?.prompt === 'string'
        ? selectedTemplate.defaultInput.prompt
        : ''
    );
    setDraftFields(
      fields.map((field) => ({
        key: field.key,
        label: field.label,
        placeholder: field.placeholder || '',
        required: field.required,
        defaultValue: field.defaultValue,
      }))
    );
    setRunExecutionMode(selectedTemplate.executionProfile === 'mixed' ? 'hybrid' : 'dom');
  }, [selectedTemplateId, templates]);

  const handleRunInputChange = (key: string, value: string) => {
    setRunInputValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) {
      return;
    }

    try {
      setIsSaving(true);
      const inputSchema: Record<string, unknown> = {
        prompt: 'Prompt',
      };
      const defaultInput: Record<string, unknown> = {
        prompt: draftPrompt,
      };

      for (const field of draftFields) {
        if (!field.key.trim()) {
          continue;
        }
        inputSchema[field.key] = {
          type: 'string',
          label: field.label || field.key,
          placeholder: field.placeholder || undefined,
          required: field.required,
        };
        defaultInput[field.key] = field.defaultValue;
      }

      const result = await window.electron.invoke('template:update', {
        id: selectedTemplate.id,
        name: draftName,
        description: draftDescription,
        inputSchema,
        defaultInput,
        executionProfile: selectedTemplate.executionProfile,
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to update template');
      }

      await loadTemplates();
    } catch (error) {
      console.error('[TemplatePanel] Failed to save template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddField = () => {
    setDraftFields((current) => [
      ...current,
      {
        key: `param_${current.length + 1}`,
          label: `${t('taskPanels.parameter')} ${current.length + 1}`,
        placeholder: '',
        required: true,
        defaultValue: '',
      },
    ]);
  };

  const handleUpdateField = (
    index: number,
    patch: Partial<EditableTemplateField>
  ) => {
    setDraftFields((current) =>
      current.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field))
    );
  };

  const handleRemoveField = (index: number) => {
    setDraftFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index));
  };

  const handleAddToScheduler = () => {
    if (!selectedTemplate) {
      return;
    }

    prepareDraftFromTemplate({
      name: selectedTemplate.name,
      description: draftDescription || selectedTemplate.description,
      templateId: selectedTemplate.id,
      input: {
        prompt: runPrompt,
        ...runInputValues,
      },
      executionMode: runExecutionMode,
    });
  };

  if (!isOpen) {
    return null;
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesKeyword =
      !searchKeyword.trim() ||
      template.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      template.description.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      template.id.toLowerCase().includes(searchKeyword.toLowerCase());
    const matchesProfile = profileFilter === 'all' || template.executionProfile === profileFilter;
    return matchesKeyword && matchesProfile;
  });

  const filteredWorkflowPacks = workflowPacks.filter((pack) => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    return [
      pack.name,
      pack.category,
      pack.description,
      pack.summary,
      ...(pack.outcomes || []),
      ...(pack.recommendedSkills || []),
      ...pack.templates.map((template) => template.name),
    ].some((value) => value.toLowerCase().includes(keyword));
  });

  const installedWorkflowPackIds = workflowPacks
    .filter((pack) =>
      pack.templates.every((template) =>
        templates.some((installedTemplate) => installedTemplate.id === `workflow-pack-${pack.id}-${template.id}`)
      )
    )
    .map((pack) => pack.id);

  const visibleWorkflowPacks = [...filteredWorkflowPacks]
    .filter((pack) => !showInstalledWorkflowPacksOnly || installedWorkflowPackIds.includes(pack.id))
    .sort((left, right) => {
      const leftInstalled = installedWorkflowPackIds.includes(left.id) ? 1 : 0;
      const rightInstalled = installedWorkflowPackIds.includes(right.id) ? 1 : 0;
      return rightInstalled - leftInstalled;
    });

  const installedPacksOnlyLabel = t('taskPanels.installedPacksOnly');
  const installedPacksOnlyText =
    installedPacksOnlyLabel === 'taskPanels.installedPacksOnly'
      ? 'Installed only'
      : installedPacksOnlyLabel;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-[520px] border-l border-border bg-surface flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <div>
            <div className="text-lg font-semibold text-white">{t('controlBar.templates')}</div>
            <div className="text-sm text-text-muted">{t('taskPanels.reusableTaskDefinitions')}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadTemplates()}
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
            placeholder={t('taskPanels.searchTemplates')}
            className="w-56 rounded border border-border bg-background px-3 py-1 text-sm text-white"
          />
          <select
            value={profileFilter}
            onChange={(e) =>
              setProfileFilter(e.target.value as 'all' | TaskTemplate['executionProfile'])
            }
            className="rounded border border-border bg-background px-2 py-1 text-sm text-white"
          >
            <option value="all">{t('taskPanels.allProfiles')}</option>
            <option value="browser-first">browser-first</option>
            <option value="mixed">mixed</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={showInstalledWorkflowPacksOnly}
              onChange={(e) => setShowInstalledWorkflowPacksOnly(e.target.checked)}
              aria-label={installedPacksOnlyText}
              className="rounded border-border bg-background"
            />
            {installedPacksOnlyText}
          </label>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-[280px] overflow-y-auto border-r border-border p-4">
            {workflowPacks.length > 0 && (
              <div className="mb-4 space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-text-muted">
                    {t('taskPanels.officialWorkflowPacks')}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {t('taskPanels.workflowPackCatalog')}
                  </div>
                </div>
                {visibleWorkflowPacks.map((pack) => (
                  <div key={pack.id} className="rounded-xl border border-border bg-background p-3">
                    {(() => {
                      const isInstalled =
                        installedWorkflowPackIds.includes(pack.id) ||
                        (workflowPackMessage?.type === 'success' &&
                          workflowPackMessage.text.startsWith(`${pack.name}: installed`));

                      return (
                        <>
                          <div className="text-sm font-semibold text-white">{pack.name}</div>
                          <div className="mt-1 text-[11px] text-text-muted">{pack.category}</div>
                          <div className="mt-2 text-xs text-text-secondary">{pack.summary}</div>
                          {pack.outcomes && pack.outcomes.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {pack.outcomes.map((outcome) => (
                                <span
                                  key={outcome}
                                  className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-text-secondary"
                                >
                                  {outcome}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                            <span className="rounded-full border border-border bg-surface px-2 py-0.5">
                              {pack.templates.length} {t('taskPanels.packTemplates')}
                            </span>
                            <span className="rounded-full border border-border bg-surface px-2 py-0.5">
                              {pack.recommendedSkills?.length || 0} {t('taskPanels.skills')}
                            </span>
                            {isInstalled && (
                              <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-success">
                                {t('taskPanels.installedPack') || 'Installed'}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleInstallWorkflowPack(pack)}
                            className="mt-3 btn btn-secondary text-sm"
                            disabled={isInstallingPackId === pack.id}
                          >
                            {isInstallingPackId === pack.id
                              ? t('taskPanels.installingPack')
                              : isInstalled
                                ? t('taskPanels.reinstallPack') || 'Reinstall'
                                : t('taskPanels.installPack')}
                          </button>
                        </>
                      );
                    })()}
                  </div>
                ))}
                {visibleWorkflowPacks.length === 0 && (
                  <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-muted">
                    {showInstalledWorkflowPacksOnly
                      ? (t('taskPanels.noInstalledWorkflowPacks') === 'taskPanels.noInstalledWorkflowPacks'
                          ? 'No installed workflow packs yet'
                          : t('taskPanels.noInstalledWorkflowPacks'))
                      : t('taskPanels.noWorkflowPacksMatch') || 'No workflow packs match the current search'}
                  </div>
                )}
                {workflowPackMessage && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      workflowPackMessage.type === 'success'
                        ? 'border-success/40 bg-success/10 text-success'
                        : 'border-danger/40 bg-danger/10 text-danger'
                    }`}
                  >
                    {workflowPackMessage.text}
                  </div>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="text-sm text-text-muted">{t('taskPanels.loadingTemplates')}</div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-sm text-text-muted">
                {t('taskPanels.noTemplates')}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selectedTemplateId === template.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background hover:bg-border/40'
                    }`}
                    >
                      <div className="text-sm font-semibold text-white">{template.name}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-text-secondary">
                        {template.description}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                        <span className="rounded-full border border-border bg-surface px-2 py-0.5">
                          {template.executionProfile}
                        </span>
                        <span className="rounded-full border border-border bg-surface px-2 py-0.5">
                          {template.recommendedSkills?.length || 0} {t('taskPanels.skills')}
                        </span>
                        <span className="rounded-full border border-border bg-surface px-2 py-0.5">
                          {new Date(template.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {selectedTemplate ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-text-muted mb-1">{t('taskPanels.name')}</div>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-white"
                  />
                  <div className="text-xs uppercase tracking-wide text-text-muted mb-1 mt-3">
                    {t('taskPanels.description')}
                  </div>
                  <textarea
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-white min-h-[88px]"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm text-text-secondary">
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <div className="text-xs text-text-muted">{t('taskPanels.executionProfile')}</div>
                    <div className="mt-1 text-white">{selectedTemplate.executionProfile}</div>
                  </div>
                  {selectedTemplate.origin && (
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <div className="text-xs text-text-muted">{t('taskPanels.templateOrigin')}</div>
                      <div className="mt-1 text-white break-all">{selectedTemplate.origin.runId || 'manual'}</div>
                      <div className="mt-1 text-xs text-text-muted">
                        {t('taskPanels.sourceLabel')}:{' '}
                        <span className="text-text-secondary">{selectedTemplate.origin.source || 'n/a'}</span>
                        {selectedTemplate.origin.executionMode && (
                          <>
                            {' '}
                            · {t('taskPanels.modeLabel')}:{' '}
                            <span className="text-text-secondary">{selectedTemplate.origin.executionMode}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-text-muted">{t('taskPanels.templateId')}</div>
                      <button
                        type="button"
                        onClick={() => void handleCopyTemplateId(selectedTemplate.id)}
                        className="rounded px-2 py-1 text-[11px] text-primary hover:bg-primary/10"
                      >
                        {t('taskPanels.copyId')}
                      </button>
                    </div>
                    <div className="mt-1 break-all text-white">{selectedTemplate.id}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <div className="text-xs text-text-muted">{t('taskPanels.updatedAt')}</div>
                    <div className="mt-1 text-white">
                      {new Date(selectedTemplate.updatedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm text-text-secondary md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <div className="text-xs text-text-muted">{t('taskPanels.createdAt')}</div>
                    <div className="mt-1 text-white">
                      {new Date(selectedTemplate.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <div className="text-xs text-text-muted">{t('taskPanels.recommendedSkills')}</div>
                    <div className="mt-1 text-white">
                      {selectedTemplate.recommendedSkills && selectedTemplate.recommendedSkills.length > 0
                        ? selectedTemplate.recommendedSkills.join(', ')
                        : t('taskPanels.notLinked')}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs uppercase tracking-wide text-text-muted">
                    {t('taskPanels.defaultPrompt')}
                  </div>
                  <textarea
                    value={draftPrompt}
                    onChange={(e) => setDraftPrompt(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-3 text-xs text-text-secondary whitespace-pre-wrap min-h-[120px]"
                  />
                </div>

                {selectedTemplate && (
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-wide text-text-muted">
                      {t('taskPanels.parameters')}
                    </div>
                    <div className="space-y-3">
                      {draftFields.map((field, index) => (
                        <div key={`${field.key}-${index}`} className="rounded border border-border bg-background p-3">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={field.key}
                              onChange={(e) => handleUpdateField(index, { key: e.target.value })}
                               placeholder={t('taskPanels.key')}
                              className="rounded border border-border bg-surface px-2 py-2 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => handleUpdateField(index, { label: e.target.value })}
                               placeholder={t('taskPanels.label')}
                              className="rounded border border-border bg-surface px-2 py-2 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={field.defaultValue}
                              onChange={(e) => handleUpdateField(index, { defaultValue: e.target.value })}
                               placeholder={t('taskPanels.defaultValue')}
                              className="rounded border border-border bg-surface px-2 py-2 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={field.placeholder}
                              onChange={(e) => handleUpdateField(index, { placeholder: e.target.value })}
                               placeholder={t('taskPanels.placeholder')}
                              className="rounded border border-border bg-surface px-2 py-2 text-xs text-white"
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <label className="flex items-center gap-2 text-xs text-text-muted">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) =>
                                  handleUpdateField(index, { required: e.target.checked })
                                }
                              />
                               {t('taskPanels.required')}
                            </label>
                            <button
                              onClick={() => handleRemoveField(index)}
                              className="rounded px-2 py-1 text-xs text-text-muted hover:bg-border hover:text-white"
                            >
                              {t('taskPanels.remove')}
                            </button>
                          </div>
                        </div>
                      ))}
                      <button onClick={handleAddField} className="btn btn-secondary text-sm">
                        {t('taskPanels.addParameter')}
                      </button>
                    </div>
                  </div>
                )}

                {selectedTemplate && (
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-wide text-text-muted">
                      {t('taskPanels.runParameters')}
                    </div>
                    <div className="space-y-3 rounded-lg border border-border bg-background p-3">
                      <div>
                        <div className="mb-1 text-xs text-text-muted">{t('taskPanels.prompt')}</div>
                        <textarea
                          value={runPrompt}
                          onChange={(e) => setRunPrompt(e.target.value)}
                          className="w-full rounded border border-border bg-surface px-3 py-2 text-xs text-white min-h-[88px]"
                        />
                      </div>

                      {selectedFields.length > 0 && (
                        <div className="space-y-2">
                          {selectedFields.map((field) => (
                            <div key={field.key}>
                              <div className="mb-1 text-xs text-text-muted">
                                {field.label}
                                {field.required && <span className="text-red-400"> *</span>}
                              </div>
                              <input
                                type="text"
                                value={runInputValues[field.key] || ''}
                                onChange={(e) => handleRunInputChange(field.key, e.target.value)}
                                placeholder={field.placeholder || field.label}
                                className="w-full rounded border border-border bg-surface px-3 py-2 text-xs text-white"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {!runValidation.valid && runValidation.missingFields.length > 0 && (
                        <div className="rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                          {t('taskPanels.missingRequiredInputs')}: {runValidation.missingFields.join(', ')}
                        </div>
                      )}

                      <div>
                        <div className="mb-1 text-xs text-text-muted">{t('taskPanels.executionMode')}</div>
                        <select
                          value={runExecutionMode}
                          onChange={(e) =>
                            setRunExecutionMode(e.target.value as 'dom' | 'visual' | 'hybrid')
                          }
                          className="w-full rounded border border-border bg-surface px-3 py-2 text-xs text-white"
                        >
                          <option value="dom">dom</option>
                          <option value="visual">visual</option>
                          <option value="hybrid">hybrid</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-border bg-background px-3 py-3 text-xs text-text-secondary">
                  <div className="text-xs uppercase tracking-wide text-text-muted">
                    {t('taskPanels.parameterPreview')}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedFields.length > 0 ? (
                      selectedFields.map((field) => (
                        <span
                          key={field.key}
                          className="rounded-full border border-border bg-surface px-2 py-1 text-[11px] text-text-secondary"
                        >
                          {field.label || field.key}
                          {field.required ? ' *' : ''}
                        </span>
                      ))
                    ) : (
                      <span className="text-text-muted">{t('taskPanels.noParameters')}</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => void handleRunTemplate()}
                    className="btn btn-primary text-sm"
                    disabled={!runValidation.valid || isRunningTemplate}
                  >
                    {isRunningTemplate ? t('taskPanels.runningTemplate') : t('taskPanels.runTemplate')}
                  </button>
                  <button onClick={handleAddToScheduler} className="btn btn-secondary text-sm">
                    {t('taskPanels.addToScheduler')}
                  </button>
                  <button
                    onClick={() => void handleSaveTemplate()}
                    className="btn btn-secondary text-sm"
                    disabled={isSaving || !draftName.trim()}
                  >
                    {isSaving ? t('taskPanels.saving') : t('taskPanels.saveChanges')}
                  </button>
                  <button
                    onClick={() => void handleDeleteTemplate(selectedTemplate.id)}
                    className="btn btn-danger text-sm"
                  >
                    {t('taskPanels.deleteTemplate')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-text-muted">{t('taskPanels.selectTemplate')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplatePanel;
