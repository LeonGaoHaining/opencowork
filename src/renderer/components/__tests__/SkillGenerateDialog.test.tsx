import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
const setAutoGenerateSkill = vi.fn();
const onClose = vi.fn();

vi.mock('../../stores/settingsStore', () => ({
  useSettingsStore: () => ({
    setAutoGenerateSkill,
  }),
}));

vi.mock('../../i18n/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

describe('SkillGenerateDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        invoke,
      },
    });
    invoke.mockResolvedValue({ success: true });
  });

  it('skips generation when skip is selected', async () => {
    const { SkillGenerateDialog } = await import('../SkillGenerateDialog');

    render(<SkillGenerateDialog taskDescription="Review the backlog" actionCount={4} onClose={onClose} />);

    fireEvent.click(screen.getByText('skill.optionSkip').closest('button') as HTMLButtonElement);
    fireEvent.click(screen.getByText('common.confirm').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    expect(invoke).not.toHaveBeenCalled();
    expect(setAutoGenerateSkill).not.toHaveBeenCalled();
  });

  it('generates once for the current task', async () => {
    const { SkillGenerateDialog } = await import('../SkillGenerateDialog');

    render(<SkillGenerateDialog taskDescription="Review the backlog" actionCount={4} onClose={onClose} />);

    fireEvent.click(screen.getByText('common.confirm').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        'skill:generate',
        expect.objectContaining({
          taskDescription: 'Review the backlog',
          actionCount: 4,
          rememberChoice: false,
        })
      );
    });

    expect(setAutoGenerateSkill).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('persists always-generate preference before generating', async () => {
    const { SkillGenerateDialog } = await import('../SkillGenerateDialog');

    render(<SkillGenerateDialog taskDescription="Review the backlog" actionCount={4} onClose={onClose} />);

    fireEvent.click(screen.getByText('skill.optionAlways').closest('button') as HTMLButtonElement);
    fireEvent.click(screen.getByText('common.confirm').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(setAutoGenerateSkill).toHaveBeenCalledWith(true);
      expect(invoke).toHaveBeenCalledWith(
        'skill:generate',
        expect.objectContaining({
          rememberChoice: true,
        })
      );
    });
  });
});
