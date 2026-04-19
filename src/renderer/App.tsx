import React, { useEffect, useRef, useState, Component, ReactNode } from 'react';
import { ChatUI } from './components/ChatUI';
import { ControlBar } from './components/ControlBar';
import { TaskStatus } from './components/TaskStatus';
import { TakeoverModal } from './components/TakeoverModal';
import { AskUserDialog } from './components/AskUserDialog';
import { SkillGenerateDialog } from './components/SkillGenerateDialog';
import { SessionPanel } from './components/SessionPanel';
import { HistoryPanel } from './components/HistoryPanel';
import SchedulerPanel from './components/SchedulerPanel';
import { SkillPanel } from './components/SkillPanel';
import MCPPanel from './components/MCPPanel';
import TemplatePanel from './components/TemplatePanel';
import TaskRunsPanel from './components/TaskRunsPanel';
import { PlanViewer } from './components/PlanViewer';
import { IMConfigPanel } from './components/IMConfigPanel';
import { ExecutionStepsPanel } from './components/ExecutionStepsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import OverviewPanel from './components/OverviewPanel';
import ResultPanel from './components/ResultPanel';
import { useTaskStore } from './stores/taskStore';
import { useSessionStore } from './stores/sessionStore';
import { useTranslation } from './i18n/useTranslation';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8">
            <div className="text-red-400 text-xl mb-4">Something went wrong</div>
            <div className="text-text-muted text-sm mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </div>
            <button onClick={() => window.location.reload()} className="btn btn-primary">
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const {
    isTakeover,
    task,
    addMessage,
    setCurrentResult,
    updateTaskStatus,
    updateTaskProgress,
    updateCurrentStep,
    setTaskError,
    addLog,
    setAskUserRequest,
    previewMode,
    setPreviewMode,
    messages,
    addActiveStep,
    updateActiveStep,
    clearActiveSteps,
    isRunsPanelOpen,
    openRunsPanel,
    closeRunsPanel,
  } = useTaskStore();
  const { saveMessages } = useSessionStore();
  const [isSkillOpen, setSkillOpen] = useState(false);
  const [isMCPOpen, setMCPOpen] = useState(false);
  const [isTemplateOpen, setTemplateOpen] = useState(false);
  const [skillPrompt, setSkillPrompt] = useState<{
    taskId: string;
    taskDescription: string;
    actionCount: number;
  } | null>(null);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isOverviewOpen, setOverviewOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState(0);
  const interruptingRef = useRef(false);
  const handledFailureRunIdsRef = useRef(new Set<string>());
  const { t } = useTranslation();

  const interruptCurrentTask = async (reason: 'shortcut_escape' | 'user_activity') => {
    const currentTask = useTaskStore.getState().task;
    if (!currentTask?.id || currentTask.status !== 'executing' || interruptingRef.current) {
      return;
    }

    interruptingRef.current = true;
    try {
      const result = await window.electron.invoke('task:interrupt', {
        handleId: currentTask.id,
        reason,
      });
      const payload = result?.data || result;
      if (result?.success && payload?.handleId) {
        const taskStore = useTaskStore.getState();
        taskStore.setTaskInterrupted(true, reason, payload.handleId);
        taskStore.addLog({
          type: 'info',
          message: t('restoreTask.logs.interruptedByEsc', { handleId: payload.handleId }),
        });
      }
    } catch (error) {
      console.error('[Renderer] interruptCurrentTask error:', error);
    } finally {
      setTimeout(() => {
        interruptingRef.current = false;
      }, 500);
    }
  };

  const handleTaskFailure = (event: any): void => {
    const runId = event?.runId || event?.handleId || event?.data?.runId;
    if (runId && handledFailureRunIdsRef.current.has(runId)) {
      return;
    }
    if (runId) {
      handledFailureRunIdsRef.current.add(runId);
    }

    const errorMsg = event?.error?.message || event?.error || '未知错误';
    setTaskError(errorMsg);
    updateTaskStatus('failed');
    setCurrentResult(null);
    clearActiveSteps();
    addMessage({
      role: 'ai',
      content: `任务执行失败: ${errorMsg}`,
    });
    addLog({ type: 'error', message: `错误: ${errorMsg}` });
    saveMessages(useTaskStore.getState().messages);
  };

  useEffect(() => {
    console.log('[Renderer] App useEffect running, window.electron:', !!window.electron);
    if (!window.electron) {
      console.error('[Renderer] window.electron not available!');
      return;
    }

    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(
      window.electron.on('shortcut:interrupt', () => {
        void interruptCurrentTask('shortcut_escape');
      })
    );

    unsubscribers.push(
      window.electron.on('task:nodeStart', (event: any) => {
        try {
          console.log('[Renderer] Received task:nodeStart', event);
          const node = event.node;
          if (node?.action) {
            const stepId = node.id || `step-${Date.now()}`;
            const action = node.action;
            addActiveStep({
              id: stepId,
              toolName: action.type || 'unknown',
              args: action.params || {},
              status: 'running',
            });
            updateCurrentStep(
              `${action.type}: ${action.params ? JSON.stringify(action.params).substring(0, 50) : ''}`
            );
            addLog({ type: 'step', message: `执行步骤: ${action.type}` });
          }
        } catch (error) {
          console.error('[Renderer] task:nodeStart handler error:', error);
        }
      })
    );

    unsubscribers.push(
      window.electron.on('task:nodeComplete', (event: any) => {
        try {
          console.log('[Renderer] Received task:nodeComplete', event);
          const node = event.node;
          if (node?.id) {
            const isError = node.result?.error || node.result?.success === false;
            updateActiveStep(node.id, {
              status: isError ? 'error' : 'completed',
              result: node.result,
              duration: node.duration,
            });
            addLog({ type: 'success', message: `完成: ${node.action?.type || '步骤'}` });
          }
        } catch (error) {
          console.error('[Renderer] task:nodeComplete handler error:', error);
        }
      })
    );

    unsubscribers.push(
      window.electron.on('task:completed', (event: any) => {
        try {
          console.log('[Renderer] Received task:completed', event);
          const completedRunId = event?.runId || event?.handleId || event?.data?.runId;
          if (completedRunId) {
            handledFailureRunIdsRef.current.delete(completedRunId);
          }
          updateTaskStatus('completed');

          const { activeSteps } = useTaskStore.getState();
          const taskResult = event.result || event.data?.result || null;
          const resultText = taskResult?.summary || '任务已完成';
          const steps = Array.isArray(event.legacyResult?.steps) ? event.legacyResult.steps : [];

          const finalSteps =
            activeSteps.length > 0 ? activeSteps : steps.length > 0 ? steps : undefined;
          if (taskResult) {
            setCurrentResult(taskResult);
          }
          addMessage({
            role: 'ai',
            content: resultText,
            steps: finalSteps,
          });
          clearActiveSteps();
          addLog({ type: 'success', message: '任务执行完成' });
          saveMessages(useTaskStore.getState().messages);
        } catch (error) {
          console.error('[Renderer] task:completed handler error:', error);
        }
      })
    );

    unsubscribers.push(
      window.electron.on('task:error', (event: any) => {
        try {
          console.log('[Renderer] Received task:error', event);
          handleTaskFailure(event);
        } catch (error) {
          console.error('[Renderer] task:error handler error:', error);
        }
      })
    );

    unsubscribers.push(
      window.electron.on('task:failed', (event: any) => {
        try {
          console.log('[Renderer] Received task:failed', event);
          handleTaskFailure(event);
        } catch (error) {
          console.error('[Renderer] task:failed handler error:', error);
        }
      })
    );

    unsubscribers.push(
      window.electron.on('ask:user:request', (event: any) => {
        try {
          console.log('[Renderer] Received ask:user:request', event);
          setAskUserRequest({
            requestId: event.requestId,
            question: event.question,
            options: event.options,
            defaultResponse: event.defaultResponse,
            timeout: event.timeout,
          });
          updateTaskStatus('waiting_confirm');
          addLog({ type: 'info', message: `等待用户确认: ${event.question}` });
        } catch (error) {
          console.error('[Renderer] ask:user:request handler error:', error);
        }
      })
    );

    unsubscribers.push(
      window.electron.on('task:statusUpdate', (event: any) => {
        try {
          console.log('[Renderer] Received task:statusUpdate', event);
          const { updateTaskStatus, addLog } = useTaskStore.getState();
          if (event.status === 'replanning') {
            addLog({ type: 'info', message: event.message || '正在重新规划' });
          } else if (event.status === 'paused') {
            updateTaskStatus('paused');
            addLog({ type: 'info', message: '任务已暂停' });
          } else if (event.status === 'executing') {
            updateTaskStatus('executing');
            addLog({ type: 'info', message: '任务已恢复' });
          } else if (event.status === 'cancelled') {
            updateTaskStatus('cancelled');
            addLog({ type: 'info', message: '任务已取消' });
          }
        } catch (error) {
          console.error('[Renderer] task:statusUpdate handler error:', error);
        }
      })
    );

    unsubscribers.push(
      window.electron.on('task:waiting_login', (event: any) => {
        try {
          console.log('[Renderer] Received task:waiting_login', event);
          updateTaskStatus('waiting_confirm');
          addLog({ type: 'info', message: event.message || '等待处理登录弹窗' });
        } catch (error) {
          console.error('[Renderer] task:waiting_login handler error:', error);
        }
      })
    );

    unsubscribers.push(
      window.electron.on('skill:prompt-generate', (event: any) => {
        try {
          console.log('[Renderer] Received skill:prompt-generate', event);
          setSkillPrompt({
            taskId: event.taskId,
            taskDescription: event.taskDescription,
            actionCount: event.actionCount,
          });
        } catch (error) {
          console.error('[Renderer] skill:prompt-generate handler error:', error);
        }
      })
    );

    unsubscribers.push(
      window.electron.on('preview:screenshot', (data: any) => {
        try {
          const screenshot = data?.screenshot || data;
          console.log('[Renderer] Received preview:screenshot, length:', screenshot?.length);
          setScreenshot(screenshot);
          setImageKey((k) => k + 1);
        } catch (error) {
          console.error('[Renderer] preview:screenshot handler error:', error);
        }
      })
    );

    console.log('[Renderer] Registered event listeners, count:', unsubscribers.length);

    return () => {
      console.log('[Renderer] Cleaning up event listeners');
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [t]);

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-surface">
          <h1 className="text-lg font-semibold text-white">OpenCowork</h1>
          <div className="text-sm text-text-muted">
            v{(window as any).__APP_VERSION__ || '0.0.0'}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 flex overflow-hidden">
          {/* Session Panel */}
          <SessionPanel />

          {/* Chat area */}
          <div
            className={`flex flex-col overflow-hidden ${previewMode === 'sidebar' ? 'flex-1' : 'w-full'}`}
          >
            {/* Task status */}
            {task && <TaskStatus task={task} />}
            <div className="flex-1 overflow-hidden">
              <ChatUI />
            </div>
          </div>

          {/* Sidebar - Result and Execution Panels */}
          {previewMode === 'sidebar' && (
            <div className="w-[40%] border-l border-border bg-surface flex flex-col overflow-hidden">
              <ResultPanel embedded />
              <ExecutionStepsPanel embedded />
            </div>
          )}
        </main>

        {/* Control bar */}
        <ControlBar
          onSkillClick={() => setSkillOpen(true)}
          onMCPClick={() => setMCPOpen(true)}
          onTemplateClick={() => setTemplateOpen(true)}
          onRunsClick={() => openRunsPanel()}
          onSettingsClick={() => setSettingsOpen(true)}
          onOverviewClick={() => setOverviewOpen(true)}
        />

        {/* Takeover modal */}
        {isTakeover && <TakeoverModal />}

        {/* Ask User Dialog */}
        <AskUserDialog />

        {/* Skill Generate Dialog */}
        {skillPrompt && (
          <SkillGenerateDialog
            taskDescription={skillPrompt.taskDescription}
            actionCount={skillPrompt.actionCount}
            onClose={() => setSkillPrompt(null)}
          />
        )}

        {/* History Panel */}
        <HistoryPanel />

        {/* Plan Viewer */}
        <PlanViewer />

        {/* IM Config Panel */}
        <IMConfigPanel />

        {/* Scheduler Panel */}
        <SchedulerPanel />

        {/* Skill Panel */}
        <SkillPanel isOpen={isSkillOpen} onClose={() => setSkillOpen(false)} />

        {/* MCP Panel */}
        <MCPPanel isOpen={isMCPOpen} onClose={() => setMCPOpen(false)} />

        {/* Template Panel */}
        <TemplatePanel isOpen={isTemplateOpen} onClose={() => setTemplateOpen(false)} />

        {/* Task Runs Panel */}
        <TaskRunsPanel isOpen={isRunsPanelOpen} onClose={() => closeRunsPanel()} />

        {/* Settings Panel */}
        <SettingsPanel isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />

        {/* Overview Panel */}
        <OverviewPanel isOpen={isOverviewOpen} onClose={() => setOverviewOpen(false)} />
      </div>
    </ErrorBoundary>
  );
}

export default App;
