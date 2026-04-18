import { MemoryCandidate } from './memoryTypes';
import {
  buildChatMemoryExtractionPrompt,
  buildTaskMemoryExtractionPrompt,
} from './memoryPromptTemplates';

function generateCandidateId(): string {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeContent(content: string): string {
  return content.replace(/\s+/g, ' ').trim();
}

export class MemoryExtractor {
  async extractFromChat(message: string): Promise<MemoryCandidate[]> {
    const _prompt = buildChatMemoryExtractionPrompt(message);
    const candidates: MemoryCandidate[] = [];
    const normalized = normalizeContent(message);

    const languageMatch = normalized.match(/(以后|默认|请|希望).*?(中文|英文)回复/);
    if (languageMatch) {
      const lang = languageMatch[2];
      candidates.push({
        id: generateCandidateId(),
        type: 'preference',
        content: `用户偏好：默认使用${lang}回复。`,
        confidence: 0.95,
        source: 'chat',
        requiresConfirmation: false,
        reason: 'User explicitly stated a language preference.',
        scope: 'user',
      });
    }

    const styleMatch = normalized.match(
      /(偏好|喜欢|默认).{0,8}(科技风|商务风|简洁风|科技感|商务科技风)/
    );
    if (styleMatch) {
      candidates.push({
        id: generateCandidateId(),
        type: 'preference',
        content: `用户偏好：生成内容时优先使用${styleMatch[2]}。`,
        confidence: 0.9,
        source: 'chat',
        requiresConfirmation: false,
        reason: 'User explicitly stated a style preference.',
        scope: 'user',
      });
    }

    const companyMatch = normalized.match(
      /(公司名字是|公司名称是|我的公司是|我们公司叫)([^，。；]+)/
    );
    if (companyMatch) {
      candidates.push({
        id: generateCandidateId(),
        type: 'fact',
        content: `事实：公司名称是${normalizeContent(companyMatch[2])}。`,
        confidence: 0.9,
        source: 'chat',
        requiresConfirmation: !/请记住|记住这个/.test(normalized),
        reason: 'User provided a company identity fact.',
        scope: 'workspace',
      });
    }

    return candidates;
  }

  async extractFromTaskSummary(task: string, summary: string): Promise<MemoryCandidate[]> {
    const _prompt = buildTaskMemoryExtractionPrompt(task, summary);
    const candidates: MemoryCandidate[] = [];
    const normalizedTask = normalizeContent(task);

    if (/默认.*中文|中文回复/.test(normalizedTask)) {
      candidates.push({
        id: generateCandidateId(),
        type: 'preference',
        content: '用户偏好：默认使用中文回复。',
        confidence: 0.85,
        source: 'task_summary',
        requiresConfirmation: false,
        reason: 'Task text repeated a stable language preference.',
        scope: 'user',
      });
    }

    return candidates;
  }
}

let memoryExtractorInstance: MemoryExtractor | null = null;

export function getMemoryExtractor(): MemoryExtractor {
  if (!memoryExtractorInstance) {
    memoryExtractorInstance = new MemoryExtractor();
  }
  return memoryExtractorInstance;
}

export function resetMemoryExtractor(): void {
  memoryExtractorInstance = null;
}
