import React, { useState } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { useSessionStore } from '../stores/sessionStore';
import { useTranslation } from '../i18n/useTranslation';

export function ChatInput() {
  const [input, setInput] = useState('');
  const { addMessage, setTask, task, updateTaskStatus, setCurrentRun, setCurrentResult } =
    useTaskStore();
  const { activeSessionId } = useSessionStore();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    const taskDescription = input.trim();
    const continuationThreadId = task?.id || undefined;
    const taskId = continuationThreadId || `task-${Date.now()}`;

    setCurrentResult(null);

    // Add user message
    addMessage({ role: 'user', content: taskDescription });

    // Create a new task
    setTask({
      id: taskId,
      status: 'planning',
      description: taskDescription,
      progress: { current: 0, total: 0 },
    });

    // Add AI response
    addMessage({
      role: 'ai',
      content: t('chatUI.taskCreated'),
    });

    setInput('');

    // Debug: check if electron API exists
    console.log('[Renderer] window.electron:', window.electron);

    // Send to main process via IPC
    try {
      if (!window.electron) {
        throw new Error('window.electron not defined');
      }
      const result = await window.electron.invoke('task:start', {
        task: taskDescription,
        threadId: continuationThreadId,
        sessionId: activeSessionId,
      });
      console.log('[Renderer] IPC result:', result);
      const payload = result?.data || result;
      if (result?.success && payload?.accepted) {
        const runId = payload?.run?.id || payload?.handle || taskId;
        const handleId = payload?.handle || runId;
        const visualProvider =
          payload?.run?.metadata?.visualProvider ||
          payload?.route?.visualProvider ||
          null;
        setCurrentRun(
          runId,
          payload?.run?.source || 'chat',
          payload?.run?.templateId || null,
          visualProvider
        );
        setTask({
          id: handleId,
          status: 'executing',
          description: taskDescription,
          progress: { current: 0, total: 0 },
        });
      } else {
        throw new Error(payload?.error || result?.error || t('chatUI.taskStartFailed'));
      }
    } catch (error) {
      console.error('[Renderer] Failed to start task:', error);
      updateTaskStatus('failed');
      addMessage({
        role: 'ai',
        content: `${t('chatUI.errorPrefix')}: ${error instanceof Error ? error.message : t('chatUI.taskStartFailed')}`,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t('chatUI.placeholder')}
        className="input flex-1"
      />
      <button type="submit" className="btn btn-primary px-6" disabled={!input.trim()}>
        {t('chatUI.send')}
      </button>
    </form>
  );
}
