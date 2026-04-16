import React, { useState, useEffect } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { useTranslation } from '../i18n/useTranslation';

export function AskUserDialog() {
  const { t } = useTranslation();
  const { askUserRequest, setAskUserRequest, respondToAskUser } = useTaskStore();
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customAnswer, setCustomAnswer] = useState('');

  useEffect(() => {
    if (!askUserRequest) return;

    setRemainingTime(askUserRequest.timeout);

    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1000) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [askUserRequest]);

  if (!askUserRequest) return null;

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const answer = selectedOption || customAnswer;
    if (answer.trim()) {
      respondToAskUser(answer);
    }
  };

  const handleCancel = () => {
    try {
      if (window.electron) {
        window.electron.invoke('ask:user:response', {
          requestId: askUserRequest.requestId,
          answer: '',
          cancelled: true,
        });
      }
      setAskUserRequest(null);
    } catch (error) {
      console.error('[AskUserDialog] handleCancel error:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[400px] rounded-lg bg-[var(--color-surface)] p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {t('askUser.title')}
          </h3>
          <span className="text-sm text-[var(--color-text-muted)]">
            {t('askUser.timeRemaining')}: {formatTime(remainingTime)}
          </span>
        </div>

        <p className="mb-6 text-[var(--color-text-secondary)]">{askUserRequest.question}</p>

        {askUserRequest.options && askUserRequest.options.length > 0 ? (
          <form onSubmit={handleSubmit}>
            <div className="mb-4 space-y-2">
              {askUserRequest.options.map((option, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedOption(option)}
                  className={`w-full rounded-md p-3 text-left transition-colors ${
                    selectedOption === option
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 rounded-md bg-[var(--color-elevated)] px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]"
              >
                {t('askUser.cancel')}
              </button>
              <button
                type="submit"
                disabled={!selectedOption}
                className="flex-1 rounded-md bg-[var(--color-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('askUser.confirm')}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <textarea
                value={customAnswer}
                onChange={(e) => setCustomAnswer(e.target.value)}
                placeholder={t('askUser.enterAnswer')}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)] p-3 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 rounded-md bg-[var(--color-elevated)] px-4 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]"
              >
                {t('askUser.cancel')}
              </button>
              <button
                type="submit"
                disabled={!customAnswer.trim()}
                className="flex-1 rounded-md bg-[var(--color-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('askUser.confirm')}
              </button>
            </div>
          </form>
        )}

        {remainingTime === 0 && (
          <p className="mt-3 text-center text-sm text-[var(--color-error)]">
            {t('askUser.timeoutMessage')}
          </p>
        )}
      </div>
    </div>
  );
}

export default AskUserDialog;
