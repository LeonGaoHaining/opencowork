import { IMAttachment } from './types';

export const MAX_FEISHU_CONVERSATION_TURNS = 12;
export const MAX_FEISHU_CONVERSATION_TURN_CHARS = 900;
export const MAX_FEISHU_CONVERSATION_CONTEXT_CHARS = 6000;

export interface FeishuSelectionContext {
  taskId: string;
  updatedAt: number;
  options: Record<number, string>;
}

const FEISHU_COMMAND_PREFIXES = [
  '任务',
  '模板',
  '状态',
  '列表',
  '绑定设备',
  '接管',
  '交还',
  '取消',
  '帮助',
  '发送文件',
  '文件',
];

export interface FeishuConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  taskId: string;
  createdAt: number;
}

export function normalizeFeishuConversationText(text: unknown): string {
  if (typeof text === 'string') {
    return text.trim();
  }

  if (text == null) {
    return '';
  }

  return String(text).trim();
}

function normalizeFeishuSelectionOption(text: string): string {
  const normalized = normalizeFeishuConversationText(text);
  return normalized.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1');
}

export function truncateFeishuConversationText(text: unknown, limit: number): string {
  const normalized = normalizeFeishuConversationText(text);
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit)}... [truncated ${normalized.length - limit} chars]`;
}

export function parseFeishuSelectionContext(
  content: unknown,
  taskId: string,
  updatedAt: number
): FeishuSelectionContext | null {
  const normalized = normalizeFeishuConversationText(content);
  if (!normalized) {
    return null;
  }

  const options: Record<number, string> = {};
  for (const line of normalized.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)[\.)、]\s*(.+?)\s*$/);
    if (!match) {
      continue;
    }

    const index = Number(match[1]);
    const optionText = normalizeFeishuSelectionOption(match[2]);
    if (optionText) {
      options[index] = optionText;
    }
  }

  if (Object.keys(options).length < 2) {
    return null;
  }

  return {
    taskId,
    updatedAt,
    options,
  };
}

export function resolveFeishuSelectionReply(
  content: unknown,
  selectionContext?: FeishuSelectionContext | null
): {
  content: string;
  matched: boolean;
  rejected: boolean;
  awaitingSelection: boolean;
  shouldClearContext: boolean;
  availableOptions: string[];
} {
  const normalized = normalizeFeishuConversationText(content);
  if (!selectionContext) {
    return {
      content: normalized,
      matched: false,
      rejected: false,
      awaitingSelection: false,
      shouldClearContext: false,
      availableOptions: [],
    };
  }

  if (!/^\d+$/.test(normalized)) {
    const selectedByText = Object.entries(selectionContext.options).find(([, option]) => {
      const optionText = normalizeFeishuConversationText(option);
      return (
        optionText === normalized ||
        optionText.includes(normalized) ||
        normalized.includes(optionText)
      );
    });

    if (selectedByText) {
      const [, selectedOption] = selectedByText;
      return {
        content: `用户选择了：${selectedOption}\n\n请基于该选项继续处理。`,
        matched: true,
        rejected: false,
        awaitingSelection: false,
        shouldClearContext: true,
        availableOptions: [],
      };
    }

    return {
      content: normalized,
      matched: false,
      rejected: false,
      awaitingSelection: true,
      shouldClearContext: false,
      availableOptions: Object.keys(selectionContext.options).sort((a, b) => Number(a) - Number(b)),
    };
  }

  const selectedIndex = Number(normalized);
  const selectedOption = selectionContext.options[selectedIndex];
  if (!selectedOption) {
    return {
      content: normalized,
      matched: false,
      rejected: true,
      awaitingSelection: true,
      shouldClearContext: false,
      availableOptions: Object.keys(selectionContext.options).sort((a, b) => Number(a) - Number(b)),
    };
  }

  return {
    content: `用户选择了第 ${normalized} 项：${selectedOption}\n\n请基于该选项继续处理。`,
    matched: true,
    rejected: false,
    awaitingSelection: false,
    shouldClearContext: true,
    availableOptions: [],
  };
}

export function isExplicitFeishuCommandText(content: unknown): boolean {
  const normalized = normalizeFeishuConversationText(content);
  if (!normalized) {
    return false;
  }

  return FEISHU_COMMAND_PREFIXES.some((prefix) =>
    normalized === prefix || normalized.startsWith(`${prefix} `)
  );
}

export function isFeishuAuthorizationClarification(content: unknown): boolean {
  const normalized = normalizeFeishuConversationText(content);
  if (!normalized) {
    return false;
  }

  return [
    '合规',
    '已授权',
    '授权',
    '允许执行',
    '可以执行',
    '不用考虑合规',
    '不需要考虑合规',
    '这是合规的任务',
    '这是合法的任务',
  ].some((keyword) => normalized.includes(keyword));
}

export interface FeishuSelectionLLMDecision {
  kind: 'select' | 'new_task' | 'uncertain';
  selectedIndex?: number | string;
  rewrittenContent?: string;
  reason?: string;
}

function extractJsonObjectText(text: string): string | null {
  const trimmed = normalizeFeishuConversationText(text);
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  return objectMatch ? objectMatch[0] : null;
}

export async function resolveFeishuSelectionReplyWithLLM(params: {
  content: unknown;
  selectionContext: FeishuSelectionContext;
  conversationTurns?: FeishuConversationTurn[];
  llmClient: { chat: (messages: Array<{ role: 'system' | 'user'; content: string }>) => Promise<{ content: string }> };
}): Promise<{
  content: string;
  matched: boolean;
  rejected: boolean;
  awaitingSelection: boolean;
  shouldClearContext: boolean;
  availableOptions: string[];
}> {
  const deterministic = resolveFeishuSelectionReply(params.content, params.selectionContext);
  if (deterministic.matched || deterministic.rejected || !deterministic.awaitingSelection) {
    return deterministic;
  }

  const normalized = normalizeFeishuConversationText(params.content);
  const optionsText = Object.entries(params.selectionContext.options)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([index, option]) => `${index}. ${option}`)
    .join('\n');
  const historyText = (params.conversationTurns || [])
    .slice(-6)
    .map((turn) => `${turn.role === 'user' ? '用户' : 'AI'}: ${normalizeFeishuConversationText(turn.content)}`)
    .join('\n');

  const messages = [
    {
      role: 'system' as const,
      content:
        '你是一个消息路由器。任务：判断用户当前回复是在选择上一轮列出的选项，还是在提出新任务。仅输出JSON，不要输出解释。JSON格式：{"kind":"select"|"new_task"|"uncertain","selectedIndex":number,"rewrittenContent":string,"reason":string}。',
    },
    {
      role: 'user' as const,
      content: `上一轮可选项：\n${optionsText}\n\n最近会话历史：\n${historyText || '无'}\n\n用户当前回复：${normalized}\n\n判断规则：\n- 如果用户回复明显对应某个选项，kind=\"select\" 并给出 selectedIndex。\n- 如果用户明显在发起新任务或明确切换话题，kind=\"new_task\"。\n- 如果无法判断，kind=\"uncertain\"。`,
    },
  ];

  try {
    const response = await params.llmClient.chat(messages);
    const jsonText = extractJsonObjectText(response.content);
    if (!jsonText) {
      return deterministic;
    }

    const parsed = JSON.parse(jsonText) as FeishuSelectionLLMDecision;
    const selectedIndex = typeof parsed.selectedIndex === 'string' ? Number(parsed.selectedIndex) : parsed.selectedIndex;

    if (parsed.kind === 'select' && typeof selectedIndex === 'number' && Number.isFinite(selectedIndex)) {
      const selectedOption = params.selectionContext.options[selectedIndex];
      if (selectedOption) {
        return {
          content: parsed.rewrittenContent || `用户选择了第 ${selectedIndex} 项：${selectedOption}\n\n请基于该选项继续处理。`,
          matched: true,
          rejected: false,
          awaitingSelection: false,
          shouldClearContext: true,
          availableOptions: [],
        };
      }
    }

    if (parsed.kind === 'new_task') {
      return {
        content: parsed.rewrittenContent || normalized,
        matched: false,
        rejected: false,
        awaitingSelection: false,
        shouldClearContext: true,
        availableOptions: [],
      };
    }
  } catch (error) {
    console.warn('[feishuPrompt] LLM selection resolution failed:', error);
  }

  return deterministic;
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
