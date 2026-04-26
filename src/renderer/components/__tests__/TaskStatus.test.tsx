import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const taskStoreState = {
  currentRunId: 'run-1',
  currentTemplateId: 'template-1',
  currentVisualProvider: {
    id: 'provider-1',
    name: 'Provider One',
  },
};

vi.mock('../../stores/taskStore', () => ({
  useTaskStore: () => taskStoreState,
}));

import { TaskStatus } from '../TaskStatus';

describe('TaskStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the template panel from the current template badge', () => {
    const handler = vi.fn();
    window.addEventListener('template:open', handler as EventListener);

    render(
      <TaskStatus
        task={{
          id: 'task-1',
          status: 'executing',
          description: 'Open the weekly report',
          progress: { current: 1, total: 4 },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /template.*template-1/i }));

    expect(screen.getByText('Provider One')).toBeInTheDocument();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
      type: 'template:open',
      detail: { templateId: 'template-1' },
    });

    window.removeEventListener('template:open', handler as EventListener);
  });
});
