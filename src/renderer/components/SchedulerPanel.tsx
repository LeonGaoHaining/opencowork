// src/renderer/components/SchedulerPanel.tsx

import React, { useState, useEffect } from 'react';
import { useSchedulerStore, defaultTaskInput } from '../stores/schedulerStore';
import { ScheduledTask, ScheduleType } from '../../scheduler/types';
import { CronParser } from '../../scheduler/cronParser';

type TaskTab = 'all' | 'executing' | 'scheduled' | 'completed';

interface CreateTaskFormData {
  name: string;
  description: string;
  scheduleType: ScheduleType;
  cron: string;
  intervalMs: number;
  startTime: string;
  taskDescription: string;
  timeout: number;
}

function SchedulerPanel() {
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
  } = useSchedulerStore();

  const [activeTab, setActiveTab] = useState<TaskTab>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<CreateTaskFormData>({
    name: '',
    description: '',
    scheduleType: ScheduleType.CRON,
    cron: '0 9 * * *',
    intervalMs: 3600000,
    startTime: '',
    taskDescription: '',
    timeout: 300000,
  });

  useEffect(() => {
    if (isOpen) {
      loadTasks();
      // 自动刷新任务列表，每5秒刷新一次
      const interval = setInterval(() => {
        loadTasks();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, loadTasks]);

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
        taskDescription: formData.taskDescription,
        timeout: formData.timeout,
        maxRetries: 3,
        retryDelayMs: 1000,
      },
    };

    await createTask(input);
    setShowCreateModal(false);
    setFormData({
      name: '',
      description: '',
      scheduleType: ScheduleType.CRON,
      cron: '0 9 * * *',
      intervalMs: 3600000,
      startTime: '',
      taskDescription: '',
      timeout: 300000,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定删除此定时任务？')) {
      await deleteTask(id);
    }
  };

  const formatNextRun = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const formatSchedule = (task: ScheduledTask) => {
    switch (task.schedule.type) {
      case ScheduleType.CRON:
        return task.schedule.cron || '-';
      case ScheduleType.INTERVAL:
        return `${Math.floor((task.schedule.intervalMs || 0) / 3600000)}小时`;
      case ScheduleType.ONE_TIME:
        return task.schedule.startTime
          ? new Date(task.schedule.startTime).toLocaleString('zh-CN')
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
            <h2 className="text-lg font-semibold text-white">定时任务</h2>
            <span className="text-sm text-text-muted">共 {tasks.length} 个任务</span>
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
            新建任务
          </button>
          <button onClick={loadTasks} className="btn btn-secondary text-sm" disabled={isLoading}>
            刷新
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
                ? '全部'
                : tab === 'executing'
                  ? '执行中'
                  : tab === 'scheduled'
                    ? '待执行'
                    : '已完成'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && tasks.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-text-muted">加载中...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-text-muted">
              暂无定时任务
            </div>
          ) : (
            <div className="space-y-2">
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
                        {!task.enabled && <span className="text-xs text-text-muted">(已禁用)</span>}
                      </div>
                      <p className="text-xs text-text-muted mt-1">{task.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                        <span>调度: {formatSchedule(task)}</span>
                        <span>下次执行: {formatNextRun(task.nextRun)}</span>
                        <span>运行次数: {task.runCount}</span>
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
                            上次:{' '}
                            {task.lastStatus === 'success'
                              ? '成功'
                              : task.lastStatus === 'failed'
                                ? '失败'
                                : '已取消'}
                          </span>
                          {task.lastError && (
                            <span className="text-red-400 ml-2">- {task.lastError}</span>
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
                          禁用
                        </button>
                      ) : (
                        <button
                          onClick={() => enableTask(task.id)}
                          className="btn btn-primary text-xs"
                        >
                          启用
                        </button>
                      )}
                      <button
                        onClick={() => triggerTask(task.id)}
                        className="btn btn-secondary text-xs"
                      >
                        执行
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
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="flex-1 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="w-[500px] bg-surface border border-border rounded-lg p-6 m-auto max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">新建定时任务</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-text-muted">任务名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1"
                  placeholder="输入任务名称"
                />
              </div>

              <div>
                <label className="text-sm text-text-muted">任务描述</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1"
                  placeholder="输入任务描述"
                />
              </div>

              <div>
                <label className="text-sm text-text-muted">调度类型</label>
                <select
                  value={formData.scheduleType}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduleType: e.target.value as ScheduleType })
                  }
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1"
                >
                  <option value={ScheduleType.CRON}>Cron 表达式</option>
                  <option value={ScheduleType.INTERVAL}>间隔执行</option>
                  <option value={ScheduleType.ONE_TIME}>一次性</option>
                </select>
              </div>

              {formData.scheduleType === ScheduleType.CRON && (
                <>
                  <div>
                    <label className="text-sm text-text-muted">Cron 表达式</label>
                    <input
                      type="text"
                      value={formData.cron}
                      onChange={(e) => setFormData({ ...formData, cron: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1"
                      placeholder="0 9 * * *"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                  <label className="text-sm text-text-muted">间隔 (毫秒)</label>
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
                  <label className="text-sm text-text-muted">执行时间</label>
                  <input
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1"
                  />
                </div>
              )}

              <div>
                <label className="text-sm text-text-muted">任务内容</label>
                <textarea
                  value={formData.taskDescription}
                  onChange={(e) => setFormData({ ...formData, taskDescription: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white mt-1 h-24"
                  placeholder="描述要执行的任务..."
                />
              </div>

              <div>
                <label className="text-sm text-text-muted">超时时间 (毫秒)</label>
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
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                取消
              </button>
              <button
                onClick={handleCreate}
                className="btn btn-primary"
                disabled={!formData.name || !formData.taskDescription}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SchedulerPanel;
