import { IMAttachment } from './types';

export const MAX_FEISHU_CONVERSATION_TURNS = 12;
export const MAX_FEISHU_CONVERSATION_TURN_CHARS = 900;
export const MAX_FEISHU_CONVERSATION_CONTEXT_CHARS = 6000;

export interface FeishuConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  taskId: string;
  createdAt: number;
}

export function truncateFeishuConversationText(text: string, limit: number): string {
  const normalized = text.trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit)}... [truncated ${normalized.length - limit} chars]`;
}

function formatConversationTurns(turns: FeishuConversationTurn[]): string {
  if (turns.length === 0) {
    return '';
  }

  const lines: string[] = [];
  let totalLength = 0;

  for (const turn of turns.slice(-MAX_FEISHU_CONVERSATION_TURNS)) {
    const roleLabel = turn.role === 'user' ? '用户' : 'AI';
    const content = truncateFeishuConversationText(turn.content, MAX_FEISHU_CONVERSATION_TURN_CHARS);
    const line = `${roleLabel}: ${content}`;

    if (totalLength + line.length > MAX_FEISHU_CONVERSATION_CONTEXT_CHARS) {
      lines.push('... [更早的上下文已截断]');
      break;
    }

    lines.push(line);
    totalLength += line.length;
  }

  return lines.join('\n');
}

export function buildFeishuTaskPrompt(options: {
  description: string;
  attachments?: IMAttachment[];
  conversationTurns?: FeishuConversationTurn[];
}): string {
  const sections: string[] = [];
  const conversationContext = formatConversationTurns(options.conversationTurns || []);

  if (conversationContext) {
    sections.push(`飞书会话上下文（仅用于理解追问、省略和延续同一任务，不要机械复述）\n${conversationContext}`);
  }

  sections.push(`当前用户请求\n${truncateFeishuConversationText(options.description, 4000)}`);

  if (options.attachments && options.attachments.length > 0) {
    const attachmentLines = options.attachments.map((attachment, index) => {
      const fields = [
        `类型: ${attachment.type}`,
        attachment.fileName ? `文件名: ${attachment.fileName}` : undefined,
        attachment.mimeType ? `MIME: ${attachment.mimeType}` : undefined,
        attachment.localPath ? `本地路径: ${attachment.localPath}` : undefined,
      ].filter(Boolean);

      return `${index + 1}. ${fields.join(' | ')}`;
    });

    sections.push(`附加文件（可直接读取本地路径）\n${attachmentLines.join('\n')}`);
  }

  return sections.join('\n\n');
}
