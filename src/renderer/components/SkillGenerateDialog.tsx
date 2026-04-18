import React, { useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { useSettingsStore } from '../stores/settingsStore';

interface SkillGenerateDialogProps {
  taskDescription: string;
  actionCount: number;
  onClose: () => void;
}

export function SkillGenerateDialog({
  taskDescription,
  actionCount,
  onClose,
}: SkillGenerateDialogProps) {
  const { t } = useTranslation();
  const { setAutoGenerateSkill } = useSettingsStore();
  const [selectedOption, setSelectedOption] = useState<'current' | 'always' | 'skip'>('current');
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      if (selectedOption === 'always') {
        await setAutoGenerateSkill(true);
      }

      if (window.electron) {
        await window.electron.invoke('skill:generate', {
          taskDescription,
          actionCount,
          rememberChoice: selectedOption === 'always',
        });
      }
      onClose();
    } catch (error) {
      console.error('[SkillGenerateDialog] Generate failed:', error);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!taskDescription) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[420px] rounded-lg bg-[var(--color-surface)] p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
          {t('skill.generateTitle') || '生成 Skill'}
        </h3>

        <div className="mb-4 rounded-md bg-[var(--color-elevated)] p-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t('skill.generateDescription') || '任务已成功完成，是否需要生成 Skill?'}
          </p>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            &quot;{taskDescription}&quot;
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {actionCount} {t('skill.actions') || 'actions'}
          </p>
        </div>

        <div className="mb-6 space-y-2">
          <button
            type="button"
            onClick={() => setSelectedOption('current')}
            className={`w-full rounded-md p-3 text-left transition-colors ${
              selectedOption === 'current'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'
            }`}
          >
            <div className="font-medium">{t('skill.optionCurrent') || '仅本次生成'}</div>
            <div className="text-xs opacity-80">
              {t('skill.optionCurrentDesc') || '只生成一次，后续仍会询问'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedOption('always')}
            className={`w-full rounded-md p-3 text-left transition-colors ${
              selectedOption === 'always'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'
            }`}
          >
            <div className="font-medium">{t('skill.optionAlways') || '后续都默认生成'}</div>
            <div className="text-xs opacity-80">
              {t('skill.optionAlwaysDesc') || '自动保存设置，不再询问'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedOption('skip')}
            className={`w-full rounded-md p-3 text-left transition-colors ${
              selectedOption === 'skip'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'
            }`}
          >
            <div className="font-medium">{t('skill.optionSkip') || '不生成'}</div>
            <div className="text-xs opacity-80">
              {t('skill.optionSkipDesc') || '忽略本次，不生成 Skill'}
            </div>
          </button>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isLoading}
            className="flex-1 rounded-md bg-[var(--color-elevated)] px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('common.cancel') || '取消'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || !selectedOption}
            className="flex-1 rounded-md bg-[var(--color-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? t('common.loading') || '加载中...' : t('common.confirm') || '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SkillGenerateDialog;
