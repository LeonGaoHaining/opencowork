import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runTemplate = vi.fn();
const prepareDraftFromTemplate = vi.fn();
const prepareDraftFromPrompt = vi.fn();
const setSelectedRunsPanelRunId = vi.fn();

const invoke = vi.fn(async (channel: string) => {
  if (channel === 'task:run:list') {
    return {
      success: true,
      data: [
        {
          id: 'run-1',
          source: 'chat',
          status: 'completed',
          title: 'Visual fallback task',
          input: { prompt: 'Search the page visually' },
          startedAt: 1710000000000,
          endedAt: 1710000005000,
        },
      ],
    };
  }

  if (channel === 'task:run:details') {
    return {
      success: true,
      data: {
        run: {
          id: 'run-1',
          source: 'chat',
          status: 'completed',
          title: 'Visual fallback task',
          input: { prompt: 'Search the page visually' },
          startedAt: 1710000000000,
          endedAt: 1710000005000,
        },
        result: {
          id: 'result-1',
          summary: 'Visual fallback completed successfully',
          artifacts: [],
          reusable: true,
          completedAt: 1710000005000,
          rawOutput: {
            visualTrace: [
              {
                source: 'step',
                routeReason: 'browser-action-visual-route',
                fallbackReason: 'Recoverable selector failure',
                approvedActions: [{ type: 'click' }],
                turns: [
                  {
                    turnId: 'turn-1',
                    proposedActions: [{ type: 'click' }, { type: 'type' }],
                    executedActions: [{ type: 'click' }, { type: 'type' }],
                    finalMessage: 'Search submitted',
                    duration: 1200,
                  },
                ],
              },
            ],
          },
        },
        template: null,
        history: null,
      },
    };
  }

  return { success: true, data: null };
});

vi.mock('../../stores/historyStore', () => ({
  useHistoryStore: () => ({
    runTemplate,
  }),
}));

vi.mock('../../stores/schedulerStore', () => ({
  useSchedulerStore: () => ({
    prepareDraftFromTemplate,
    prepareDraftFromPrompt,
  }),
}));

vi.mock('../../stores/taskStore', () => ({
  useTaskStore: () => ({
    selectedRunsPanelRunId: 'run-1',
    setSelectedRunsPanelRunId,
  }),
}));

vi.mock('../../i18n/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../RelationBadge', () => ({
  default: ({ label, value }: { label: string; value: string }) => <span>{`${label}:${value}`}</span>,
}));

vi.mock('../ArtifactViewer', () => ({
  default: () => <div>artifact-viewer</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).electron = {
    invoke,
  };
});

import { TaskRunsPanel } from '../TaskRunsPanel';

describe('TaskRunsPanel', () => {
  it('renders persisted visual trace summary in run details', async () => {
    render(<TaskRunsPanel isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Visual fallback task')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Visual fallback task'));

    await waitFor(() => {
      expect(screen.getByText('taskPanels.visualTrace')).toBeInTheDocument();
    });

    expect(screen.getByText('browser-action-visual-route')).toBeInTheDocument();
    expect(screen.getByText('Recoverable selector failure')).toBeInTheDocument();
    expect(screen.getByText('click')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
