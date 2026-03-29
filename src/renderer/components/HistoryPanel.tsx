import React, { useEffect, useState } from 'react';
import { useHistoryStore } from '../stores/historyStore';
import { TaskHistoryRecord } from '../../history/taskHistory';

type FilterTab = 'all' | 'completed' | 'failed' | 'cancelled';

export function HistoryPanel() {
  const {
    isOpen,
    isLoading,
    tasks,
    selectedTask,
    filter,
    total,
    setIsOpen,
    setFilter,
    setSelectedTaskId,
    loadTasks,
    deleteTask,
    replayTask,
    clearSelectedTask,
  } = useHistoryStore();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTasks();
    }
  }, [isOpen]);

  useEffect(() => {
    const newFilter: typeof filter = { ...filter };
    if (activeTab !== 'all') {
      newFilter.status = activeTab;
    } else {
      delete newFilter.status;
    }
    setFilter(newFilter);
  }, [activeTab]);

  const handleSearch = () => {
    setFilter({ ...filter, keyword: searchKeyword || undefined });
  };

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
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
            <h2 className="text-lg font-semibold text-white">任务历史</h2>
            <span className="text-sm text-text-muted">共 {total} 条记录</span>
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
                  ? '全部'
                  : tab === 'completed'
                    ? '成功'
                    : tab === 'failed'
                      ? '失败'
                      : '已取消'}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="搜索任务..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-48 px-3 py-1 bg-background border border-border rounded text-sm text-white placeholder-text-muted focus:outline-none focus:border-primary"
            />
            <button onClick={handleSearch} className="btn btn-secondary text-sm">
              搜索
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Task List */}
          <div className="w-96 border-r border-border overflow-y-auto">
            {isLoading && tasks.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-text-muted">加载中...</div>
            ) : tasks.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-text-muted">
                暂无任务记录
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`p-3 rounded cursor-pointer transition-colors ${
                      useHistoryStore.getState().selectedTaskId === task.id
                        ? 'bg-primary/20 border border-primary/30'
                        : 'hover:bg-border/50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{task.task}</div>
                        <div className="text-xs text-text-muted mt-1">
                          {formatTime(task.startTime)}
                        </div>
                      </div>
                      <span className={`text-xs ${getStatusColor(task.status)}`}>
                        {task.status === 'completed'
                          ? '成功'
                          : task.status === 'failed'
                            ? '失败'
                            : '已取消'}
                      </span>
                    </div>
                    {task.duration > 0 && (
                      <div className="text-xs text-text-muted mt-1">
                        耗时: {formatDuration(task.duration)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Task Detail */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedTask ? (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-text-muted mb-1">任务描述</h3>
                      <p className="text-white">{selectedTask.task}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-text-muted mb-1">状态</h3>
                        <span className={`text-sm ${getStatusColor(selectedTask.status)}`}>
                          {selectedTask.status === 'completed'
                            ? '成功'
                            : selectedTask.status === 'failed'
                              ? '失败'
                              : '已取消'}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-text-muted mb-1">耗时</h3>
                        <span className="text-sm text-white">
                          {formatDuration(selectedTask.duration)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-text-muted mb-1">开始时间</h3>
                        <span className="text-sm text-white">
                          {formatTime(selectedTask.startTime)}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-text-muted mb-1">结束时间</h3>
                        <span className="text-sm text-white">
                          {formatTime(selectedTask.endTime)}
                        </span>
                      </div>
                    </div>

                    {selectedTask.result && (
                      <div>
                        <h3 className="text-sm font-medium text-text-muted mb-1">结果</h3>
                        {selectedTask.result.success ? (
                          <div className="text-sm text-green-400">执行成功</div>
                        ) : (
                          <div className="text-sm text-red-400">
                            {selectedTask.result.error || '执行失败'}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedTask.steps && selectedTask.steps.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-text-muted mb-2">
                          执行步骤 ({selectedTask.steps.length})
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
                        <h3 className="text-sm font-medium text-text-muted mb-1">元数据</h3>
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
                      if (confirm('确定删除此任务记录？')) {
                        deleteTask(selectedTask.id);
                      }
                    }}
                    className="btn btn-danger text-sm"
                  >
                    删除
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        clearSelectedTask();
                      }}
                      className="btn btn-secondary text-sm"
                    >
                      关闭
                    </button>
                    <button
                      onClick={() => replayTask(selectedTask.id)}
                      className="btn btn-primary text-sm"
                    >
                      回放
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-muted">
                选择一个任务查看详情
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HistoryPanel;
