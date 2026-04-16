import { useTaskStore } from '../stores/taskStore';
import type { PlanNode } from '../../core/action/ActionSchema';
import { useTranslation } from '../i18n/useTranslation';

export function PlanViewer() {
  const { t } = useTranslation();
  const { task, showPlanViewer } = useTaskStore();

  if (!showPlanViewer || !task?.plan) {
    return null;
  }

  const { plan } = task;

  return (
    <div className="h-full flex flex-col border-l border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-surface">
        <h3 className="font-medium">{t('planViewer.title')}</h3>
        <p className="text-xs text-text-muted">
          {t('planViewer.totalSteps', { count: plan.nodes.length })}
        </p>
      </div>

      {/* Plan nodes */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {plan.nodes.map((node: PlanNode, index: number) => (
            <div
              key={node.id}
              className={`flex items-start gap-3 p-3 rounded-lg ${
                node.type === 'action'
                  ? 'bg-elevated'
                  : node.type === 'condition'
                    ? 'bg-warning/10 border border-warning/30'
                    : 'bg-accent/10 border border-accent/30'
              }`}
            >
              {/* Node number */}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0
                ${node.type === 'action' ? 'bg-primary text-white' : 'bg-surface'}
              `}
              >
                {index + 1}
              </div>

              {/* Node content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {node.metadata?.description ||
                    node.action?.description ||
                    t('planViewer.unknownStep')}
                </p>
                {node.action && (
                  <p className="text-xs text-text-muted font-mono mt-1">{node.action.type}</p>
                )}
              </div>

              {/* Node type badge */}
              {node.type !== 'action' && (
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    node.type === 'condition'
                      ? 'bg-warning/20 text-warning'
                      : 'bg-accent/20 text-accent'
                  }`}
                >
                  {node.type === 'condition' ? t('planViewer.condition') : t('planViewer.loop')}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
