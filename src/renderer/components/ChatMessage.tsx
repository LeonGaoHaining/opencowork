import React from 'react';
import { Message, AgentStep } from '../stores/taskStore';
import { useTranslation } from '../i18n/useTranslation';

interface ChatMessageProps {
  message: Message;
}

const StepIcon = ({ status }: { status: AgentStep['status'] }) => {
  switch (status) {
    case 'pending':
      return <span className="step-icon text-gray-400">⏳</span>;
    case 'running':
      return <span className="step-icon animate-spin">🔄</span>;
    case 'completed':
      return <span className="step-icon text-green-400">✅</span>;
    case 'error':
      return <span className="step-icon text-red-400">❌</span>;
    default:
      return <span className="step-icon text-gray-400">⚪</span>;
  }
};

const formatArgs = (args: any, t: ReturnType<typeof useTranslation>['t']): string => {
  if (!args) return '';
  if (args.url) return args.url;
  if (args.selector) return t('chatMessage.clickSelector', { selector: args.selector });
  if (args.command) return t('chatMessage.executeCommand', { command: args.command });
  return JSON.stringify(args).substring(0, 50);
};

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const { t } = useTranslation();

  return (
    <div className={`flex min-w-0 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`${isUser ? 'message-user' : 'message-ai'} max-w-[80%] min-w-0 overflow-hidden flex flex-col gap-2`}
      >
        <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {message.content}
        </p>

        {message.steps && message.steps.length > 0 && (
          <div className="steps-list mt-2 min-w-0 overflow-hidden border-l-2 border-gray-600 pl-2">
            {message.steps.map((step, index) => (
              <div
                key={step.id || index}
                className="step-item flex min-w-0 items-center gap-2 py-1 text-xs"
              >
                <StepIcon status={step.status} />
                <span className="step-tool shrink-0 text-blue-400 font-medium">
                  {step.toolName}:
                </span>
                <span className="step-args min-w-0 break-all text-gray-300">
                  {formatArgs(step.args, t)}
                </span>
                {step.duration && (
                  <span className="step-duration text-gray-500 ml-2">({step.duration}ms)</span>
                )}
              </div>
            ))}
          </div>
        )}

        <span className="text-xs text-white/50 mt-1 block">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
