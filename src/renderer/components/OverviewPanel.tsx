import React, { useEffect, useState } from 'react';
import { useOverviewStore, OverviewMetrics } from '../stores/overviewStore';
import { useTranslation } from '../i18n/useTranslation';

interface OverviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type DateRangeOption = '7d' | '14d' | '30d';

export function OverviewPanel({ isOpen, onClose }: OverviewPanelProps) {
  const { t } = useTranslation();
  const { metrics, isLoading, error, dateRange, setDateRange, loadMetrics } = useOverviewStore();
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('7d');

  useEffect(() => {
    if (isOpen) {
      void loadMetrics();
    }
  }, [isOpen, dateRange]);

  const handleDateRangeChange = (option: DateRangeOption) => {
    setDateRangeOption(option);
    const now = Date.now();
    let start: number;
    switch (option) {
      case '7d':
        start = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '14d':
        start = now - 14 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        start = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }
    setDateRange({ start, end: now });
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  const summary = metrics?.summary || {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    runningTasks: 0,
    successRate: 0,
    avgDurationMs: 0,
    totalDurationMs: 0,
  };
  const schedulerStats = metrics?.schedulerStats || { totalSchedules: 0, activeSchedules: 0 };
  const imStats = metrics?.imStats || { total: 0, pending: 0, completed: 0, failed: 0 };
  const sourceStats = metrics?.sourceStats || {};
  const dailyStatsArray = metrics
    ? Object.entries(metrics?.dailyStats || {}).map(([date, stats]) => ({
        date,
        ...stats,
      }))
    : [];

  const maxDailyTotal = Math.max(...dailyStatsArray.map((d) => d.total), 1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-[900px] max-h-[85vh] overflow-hidden rounded-xl border border-border bg-surface shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-white">{t('overview.title', '概览')}</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-elevated rounded-lg p-1">
              {(['7d', '14d', '30d'] as DateRangeOption[]).map((option) => (
                <button
                  key={option}
                  onClick={() => handleDateRangeChange(option)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    dateRangeOption === option
                      ? 'bg-primary text-white'
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  {option === '7d' ? '7天' : option === '14d' ? '14天' : '30天'}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-text-muted hover:bg-border hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && !metrics && (
            <div className="flex items-center justify-center h-64">
              <div className="text-text-muted">{t('common.loading', '加载中...')}</div>
            </div>
          )}

          {error && !metrics && (
            <div className="flex items-center justify-center h-64">
              <div className="text-error">{error}</div>
            </div>
          )}

          {metrics && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  label={t('overview.totalTasks', '总任务数')}
                  value={summary.totalTasks}
                  color="info"
                />
                <MetricCard
                  label={t('overview.completed', '已完成')}
                  value={summary.completedTasks}
                  color="success"
                />
                <MetricCard
                  label={t('overview.failed', '已失败')}
                  value={summary.failedTasks}
                  color="error"
                />
                <MetricCard
                  label={t('overview.successRate', '成功率')}
                  value={`${summary.successRate}%`}
                  color={summary.successRate >= 80 ? 'success' : summary.successRate >= 50 ? 'warning' : 'error'}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <MetricCard
                  label={t('overview.avgDuration', '平均耗时')}
                  value={formatDuration(summary.avgDurationMs)}
                  color="info"
                />
                <MetricCard
                  label={t('overview.totalDuration', '总耗时')}
                  value={formatDuration(summary.totalDurationMs)}
                  color="info"
                />
                <MetricCard
                  label={t('overview.running', '进行中')}
                  value={summary.runningTasks}
                  color="warning"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-elevated rounded-xl p-4">
                  <h3 className="text-sm font-medium text-text-secondary mb-3">
                    {t('overview.scheduler', '调度任务')}
                  </h3>
                  <div className="flex gap-6">
                    <div>
                        <div className="text-2xl font-bold text-white">
                         {schedulerStats.totalSchedules}
                        </div>
                      <div className="text-xs text-text-muted">{t('overview.total', '总数')}</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-success">
                         {schedulerStats.activeSchedules}
                        </div>
                      <div className="text-xs text-text-muted">{t('overview.active', '活跃')}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-elevated rounded-xl p-4">
                  <h3 className="text-sm font-medium text-text-secondary mb-3">
                    {t('overview.imTasks', 'IM 任务')}
                  </h3>
                  <div className="flex gap-4">
                    <div>
                       <div className="text-2xl font-bold text-white">{imStats.total}</div>
                      <div className="text-xs text-text-muted">{t('overview.total', '总数')}</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-success">
                         {imStats.completed}
                      </div>
                      <div className="text-xs text-text-muted">{t('overview.completed', '完成')}</div>
                    </div>
                    <div>
                       <div className="text-2xl font-bold text-error">{imStats.failed}</div>
                      <div className="text-xs text-text-muted">{t('overview.failed', '失败')}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-elevated rounded-xl p-4">
                <h3 className="text-sm font-medium text-text-secondary mb-3">
                  {t('overview.sourceDistribution', '来源分布')}
                </h3>
                <div className="flex flex-wrap gap-2">
                   {Object.entries(sourceStats)
                    .sort(([, a], [, b]) => b - a)
                    .map(([source, count]) => (
                      <div
                        key={source}
                        className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-lg"
                      >
                        <span className="text-xs text-text-muted">{source}</span>
                        <span className="text-sm font-medium text-white">{count}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-elevated rounded-xl p-4">
                <h3 className="text-sm font-medium text-text-secondary mb-3">
                  {t('overview.dailyTrend', '每日趋势')}
                </h3>
                {dailyStatsArray.length === 0 ? (
                  <div className="text-sm text-text-muted text-center py-4">
                    {t('overview.noData', '暂无数据')}
                  </div>
                ) : (
                  <div className="flex items-end gap-1 h-32">
                    {dailyStatsArray.map(({ date, completed, failed, total }) => {
                      const heightPct = (total / maxDailyTotal) * 100;
                      const completedPct = total > 0 ? (completed / total) * 100 : 0;
                      return (
                        <div key={date} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full flex flex-col-reverse rounded-t relative" style={{ height: `${heightPct}%` }}>
                            <div
                              className="bg-success rounded-t"
                              style={{ height: `${completedPct}%` }}
                            />
                            <div
                              className="bg-error rounded-t"
                              style={{ height: `${100 - completedPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-muted mt-1">
                            {date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-success" />
                    <span className="text-xs text-text-muted">{t('overview.completed', '完成')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-error" />
                    <span className="text-xs text-text-muted">{t('overview.failed', '失败')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  color: 'success' | 'error' | 'warning' | 'info';
}

function MetricCard({ label, value, color }: MetricCardProps) {
  const colorClasses = {
    success: 'text-success',
    error: 'text-error',
    warning: 'text-warning',
    info: 'text-info',
  };

  return (
    <div className="bg-elevated rounded-xl p-4">
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</div>
      <div className="text-sm text-text-muted mt-1">{label}</div>
    </div>
  );
}

export default OverviewPanel;
