import React from 'react';
import RelationBadge from './RelationBadge';
import { Task, useTaskStore } from '../stores/taskStore';

interface TaskStatusProps {
  task: Task;
}

export function TaskStatus({ task }: TaskStatusProps) {
  const { currentRunId, currentTemplateId, currentVisualProvider } = useTaskStore();

  const progressPercent = task.progress.total > 0
    ? Math.round((task.progress.current / task.progress.total) * 100)
    : 0;

  const openTemplateFromTaskStatus = (templateId: string): void => {
    window.dispatchEvent(new CustomEvent('template:open', { detail: { templateId } }));
  };

  const visualProviderLabel = currentVisualProvider?.name || currentVisualProvider?.id || null;

  return (
    <div className="min-w-0 border-b border-border bg-surface px-4 py-3">
      <div className="mb-2 flex min-w-0 items-start justify-between gap-3">
        <span className="max-h-10 min-w-0 overflow-y-auto break-words text-sm font-medium [overflow-wrap:anywhere]">
          {task.description}
        </span>
        <span className="shrink-0 text-sm text-text-muted">
          {task.progress.current} / {task.progress.total}
        </span>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {currentRunId && <RelationBadge label="run" value={currentRunId} tone="primary" />}
        {currentTemplateId && (
          <RelationBadge
            label="template"
            value={currentTemplateId}
            tone="primary"
            onClick={() => openTemplateFromTaskStatus(currentTemplateId)}
          />
        )}
        {visualProviderLabel && <RelationBadge label="provider" value={visualProviderLabel} tone="muted" />}
      </div>

      {/* Progress bar */}
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Current step */}
      {task.currentStep && (
        <p className="mt-2 max-h-12 overflow-y-auto break-words text-xs text-text-muted [overflow-wrap:anywhere]">
          当前: {task.currentStep}
        </p>
      )}
    </div>
  );
}
