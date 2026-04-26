import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
        visualProvider: {
          id: 'responses-computer',
          name: 'Responses Computer',
          score: 92,
          reasons: ['highest completion', 'supports computer tool'],
          adapterMode: 'responses-computer',
        },
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

vi.mock('../RelationBadge', () => ({
  default: ({
    label,
    value,
    onClick,
  }: {
    label: string;
    value: string;
    onClick?: () => void;
  }) =>
    onClick ? (
      <button onClick={onClick}>{`${label}:${value}`}</button>
    ) : (
      <span>{`${label}:${value}`}</span>
    ),
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
    vi.spyOn(window, 'dispatchEvent');
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        invoke: vi.fn(),
      },
    });
  });

  it('renders result overview before execution details and opens run links', () => {
    render(<HistoryPanel />);

    expect(loadTasks).toHaveBeenCalled();
    expect(screen.getByText('Result Overview')).toBeInTheDocument();
    expect(screen.getAllByText('Found 3 vendors and exported a csv.').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText((_, element) => element?.textContent?.includes('Responses Computer') ?? false).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText((_, element) => element?.textContent?.replace(/\s+/g, ' ').includes('score: 92') ?? false).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('highest completion').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /run-1/i })[0]);
    expect(openRunsPanel).toHaveBeenCalledWith('run-1');

    fireEvent.click(screen.getAllByRole('button', { name: 'template:template-1' })[0]);
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
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

  it('refreshes history when a template changes', async () => {
    render(<HistoryPanel />);

    expect(loadTasks).toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new CustomEvent('template:changed', { detail: { templateId: 'template-1' } }));
    });

    await waitFor(() => {
      expect(loadTasks).toHaveBeenCalledTimes(2);
    });
  });
});
