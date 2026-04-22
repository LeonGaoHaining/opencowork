import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setCurrentResult = vi.fn();
const openRunsPanel = vi.fn();
const prepareDraftFromTemplate = vi.fn();
const prepareDraftFromPrompt = vi.fn();

vi.mock('../../stores/taskStore', () => ({
  useTaskStore: () => ({
    currentResult: {
      id: 'result-1',
      summary: 'Visual fallback completed successfully',
      artifacts: [],
      rawOutput: {
        visualTrace: [
          {
            source: 'step',
            routeReason: 'The action and selector hint suggest a visually ambiguous interaction',
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
      reusable: true,
      completedAt: 1710000000000,
    },
    currentRunId: 'run-1',
    currentTemplateId: null,
    task: {
      description: 'Search the page visually',
    },
    setCurrentResult,
    openRunsPanel,
  }),
}));

vi.mock('../../stores/schedulerStore', () => ({
  useSchedulerStore: () => ({
    prepareDraftFromTemplate,
    prepareDraftFromPrompt,
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

import { ResultPanel } from '../ResultPanel';

describe('ResultPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders visual trace summary details from rawOutput', () => {
    render(<ResultPanel />);

    expect(screen.getByText('taskPanels.visualTrace')).toBeInTheDocument();
    expect(
      screen.getByText('The action and selector hint suggest a visually ambiguous interaction')
    ).toBeInTheDocument();
    expect(screen.getByText('Recoverable selector failure')).toBeInTheDocument();
    expect(screen.getByText('click')).toBeInTheDocument();
    expect(screen.getAllByText('click, type').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Search submitted')).toBeInTheDocument();
    expect(screen.getByText('1200ms')).toBeInTheDocument();
  });
});
