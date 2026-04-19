import React, { useEffect, useState } from 'react';
import { TaskTemplate } from '../../core/task/types';
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

interface TemplatePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TemplatePanel({ isOpen, onClose }: TemplatePanelProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [profileFilter, setProfileFilter] = useState<'all' | TaskTemplate['executionProfile']>('all');
  const [runPrompt, setRunPrompt] = useState('');
  const [runInputValues, setRunInputValues] = useState<Record<string, string>>({});
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftFields, setDraftFields] = useState<EditableTemplateField[]>([]);
  const [isSaving, setIsSaving] = useState(false);
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

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const response = await window.electron.invoke('template:list');
      const payload = response?.data || response;
      const nextTemplates = Array.isArray(payload) ? payload : [];
      setTemplates(nextTemplates);
      if (!selectedTemplateId && nextTemplates.length > 0) {
        setSelectedTemplateId(nextTemplates[0].id);
      }
      if (selectedTemplateId && !nextTemplates.some((item) => item.id === selectedTemplateId)) {
        setSelectedTemplateId(nextTemplates[0]?.id || null);
      }
    } catch (error) {
      console.error('[TemplatePanel] Failed to load templates:', error);
      setTemplates([]);
      setSelectedTemplateId(null);
    } finally {
      setIsLoading(false);
    }
  };

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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    void (async () => {
      if (!cancelled) {
        await loadTemplates();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!selectedTemplate) {
      setRunPrompt('');
      setRunInputValues({});
      setDraftName('');
      setDraftDescription('');
      setDraftPrompt('');
      setDraftFields([]);
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
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-[280px] overflow-y-auto border-r border-border p-4">
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
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <div className="text-xs text-text-muted">{t('taskPanels.templateId')}</div>
                    <div className="mt-1 break-all text-white">{selectedTemplate.id}</div>
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
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      runTemplate(selectedTemplate.id, {
                        prompt: runPrompt,
                        ...runInputValues,
                      })
                    }
                    className="btn btn-primary text-sm"
                    disabled={!runValidation.valid}
                  >
                    {t('taskPanels.runTemplate')}
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
