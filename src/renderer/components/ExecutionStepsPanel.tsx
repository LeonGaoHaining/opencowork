import React, { useEffect, useRef } from 'react';
import { useTaskStore, AgentStep } from '../stores/taskStore';
import { useTranslation } from '../i18n/useTranslation';

export function ExecutionStepsPanel() {
  const { activeSteps, task } = useTaskStore();
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeSteps]);

  const getStatusIcon = (status: AgentStep['status']) => {
    switch (status) {
      case 'pending':
        return (
          <div className="w-5 h-5 rounded-full border-2 border-gray-500 flex items-center justify-center">
            <span className="text-xs text-gray-500">○</span>
          </div>
        );
      case 'running':
        return (
          <div className="w-5 h-5 rounded-full border-2 border-yellow-500 flex items-center justify-center animate-pulse">
            <span className="text-xs text-yellow-500">●</span>
          </div>
        );
      case 'completed':
        return (
          <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        );
    }
  };

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'browser':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
          </svg>
        );
      case 'cli':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        );
    }
  };

  const getStepDescription = (step: AgentStep): string => {
    const { toolName, args } = step;
    switch (toolName) {
      case 'browser':
        if (args.action === 'goto' || args.action === 'navigate') {
          return `${t('executionStepsPanel.open')}: ${args.url}`;
        }
        if (args.action === 'click') {
          return `${t('executionStepsPanel.click')}: ${args.selector}`;
        }
        if (args.action === 'input') {
          return `${t('executionStepsPanel.input')}: ${args.text}`;
        }
        if (args.action === 'extract') {
          return t('executionStepsPanel.extract');
        }
        if (args.action === 'screenshot') {
          return t('executionStepsPanel.screenshot');
        }
        return t('executionStepsPanel.browserAction');
      case 'cli':
        return `${t('executionStepsPanel.cliAction')}: ${args.command}`;
      default:
        return `${t('executionStepsPanel.toolAction')}: ${toolName}`;
    }
  };

  const formatDuration = (ms?: number): string => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="w-[40%] border-l border-border bg-surface flex flex-col">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-border bg-elevated">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
          <span className="text-sm font-medium text-white">{t('executionSteps.title')}</span>
        </div>
        {task && (
          <div className="text-xs text-text-muted">
            {task.status === 'executing' ? (
              <span className="text-yellow-500">{t('executionSteps.inProgress')}</span>
            ) : task.status === 'completed' ? (
              <span className="text-green-500">{t('executionSteps.completed')}</span>
            ) : task.status === 'failed' ? (
              <span className="text-red-500">{t('executionSteps.failed')}</span>
            ) : (
              <span>{task.status}</span>
            )}
          </div>
        )}
      </div>

      {/* Steps List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeSteps.length === 0 ? (
          <div className="text-center text-sm text-text-muted py-8">
            {t('executionSteps.noSteps')}
          </div>
        ) : (
          activeSteps.map((step, index) => (
            <div
              key={step.id}
              className={`p-3 rounded-lg border ${
                step.status === 'running'
                  ? 'bg-yellow-500/10 border-yellow-500/30'
                  : step.status === 'completed'
                    ? 'bg-green-500/5 border-green-500/20'
                    : step.status === 'error'
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-surface border-border'
              }`}
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(step.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs">{index + 1}.</span>
                    <span
                      className={`text-sm ${
                        step.status === 'completed'
                          ? 'text-green-400'
                          : step.status === 'running'
                            ? 'text-yellow-400'
                            : step.status === 'error'
                              ? 'text-red-400'
                              : 'text-gray-300'
                      }`}
                    >
                      {getStepDescription(step)}
                    </span>
                  </div>
                  {step.duration && step.status === 'completed' && (
                    <div className="text-xs text-text-muted mt-1 ml-7">
                      {t('executionSteps.duration')}: {formatDuration(step.duration)}
                    </div>
                  )}
                  {step.status === 'running' && (
                    <div className="flex items-center gap-1 mt-1 ml-7">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" />
                      <span className="text-xs text-yellow-500/70">
                        {t('executionSteps.inProgress')}...
                      </span>
                    </div>
                  )}
                  {step.result && step.status === 'completed' && (
                    <div className="text-xs text-text-muted mt-1 ml-7 truncate">
                      {t('executionSteps.result')}:{' '}
                      {typeof step.result === 'string' ? step.result.slice(0, 50) : 'OK'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Current Task Info */}
      {task && (
        <div className="border-t border-border p-3 bg-elevated">
          <div className="text-xs text-text-muted">
            <div className="truncate">
              {t('executionSteps.task')}: {task.description || t('executionSteps.noTask')}
            </div>
            {task.currentStep && (
              <div className="truncate mt-1 text-yellow-500/70">
                {t('executionSteps.currentStep')}: {task.currentStep}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ExecutionStepsPanel;
