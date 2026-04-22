import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskHistoryRecord } from '../../../history/taskHistory';

const openRunsPanel = vi.fn();
const setIsOpen = vi.fn();
const setFilter = vi.fn();
const setSelectedTaskId = vi.fn();
const loadTasks = vi.fn();
const deleteTask = vi.fn();
const replayTask = vi.fn();
const saveTaskAsTemplate = vi.fn();
const runTemplate = vi.fn();
const searchTasks = vi.fn();
const summarizeSearch = vi.fn();
const clearSelectedTask = vi.fn();

const historyTasks: TaskHistoryRecord[] = [
  {
    id: 'hist-1',
    taskId: 'task-1',
    task: 'Collect vendor prices',
    status: 'completed',
    startTime: 1710000000000,
    endTime: 1710000005000,
    duration: 5000,
    steps: [],
    result: {
      success: true,
      summary: 'Found 3 vendors and exported a csv.',
      artifacts: [
        {
          id: 'artifact-1',
          name: 'vendors.csv',
          type: 'file',
          uri: '/tmp/vendors.csv',
        },
      ],
      rawOutput: {
        visualTrace: [
          {
            source: 'step',
            routeReason: 'browser-action-visual-route',
            fallbackReason: 'Recoverable selector failure',
            turns: [{ turnId: 'turn-1', proposedActions: [{ type: 'click' }] }],
          },
        ],
      },
    },
    metadata: {
      source: 'scheduler',
      runId: 'run-1',
      templateId: 'template-1',
      artifactsCount: 1,
    },
  },
  {
    id: 'hist-2',
    taskId: 'task-2',
    task: 'Check company homepage',
    status: 'failed',
    startTime: 1710000010000,
    endTime: 1710000015000,
    duration: 5000,
    steps: [],
    result: {
      success: false,
      error: 'Navigation failed',
    },
    metadata: {
      source: 'chat',
    },
  },
];

vi.mock('../../stores/historyStore', () => ({
  useHistoryStore: () => ({
    isOpen: true,
    isLoading: false,
    tasks: historyTasks,
    selectedTask: historyTasks[0],
    selectedTaskId: 'hist-1',
    filter: {},
    total: historyTasks.length,
    searchResults: [],
    searchSummary: null,
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
  }),
}));

vi.mock('../../stores/taskStore', () => ({
  useTaskStore: () => ({
    openRunsPanel,
  }),
}));

vi.mock('../../i18n/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'historyPanel.totalRecords') {
        return `total: ${params?.count}`;
      }
      return key;
    },
  }),
}));

import { HistoryPanel } from '../HistoryPanel';

describe('HistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders result overview before execution details and opens run links', () => {
    render(<HistoryPanel />);

    expect(loadTasks).toHaveBeenCalled();
    expect(screen.getByText('Result Overview')).toBeInTheDocument();
    expect(screen.getAllByText('Found 3 vendors and exported a csv.').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /run-1/i })[0]);
    expect(openRunsPanel).toHaveBeenCalledWith('run-1');
  });

  it('filters task list by outcome type', () => {
    render(<HistoryPanel />);

    expect(screen.getAllByText('Collect vendor prices').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Check company homepage').length).toBeGreaterThan(0);

    fireEvent.change(screen.getAllByRole('combobox')[1], {
      target: { value: 'artifacts' },
    });

    expect(screen.getAllByText('Collect vendor prices').length).toBeGreaterThan(0);
    expect(screen.queryByText('Check company homepage')).not.toBeInTheDocument();
  });

  it('filters task list by visual trace outcome', () => {
    render(<HistoryPanel />);

    fireEvent.change(screen.getAllByRole('combobox')[1], {
      target: { value: 'visual' },
    });

    expect(screen.getAllByText('Collect vendor prices').length).toBeGreaterThan(0);
    expect(screen.getByText('visual trace')).toBeInTheDocument();
    expect(screen.queryByText('Check company homepage')).not.toBeInTheDocument();
  });
});
