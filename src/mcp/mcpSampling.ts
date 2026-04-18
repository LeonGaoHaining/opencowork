import { ChatOpenAI } from '@langchain/openai';
import { loadLLMConfig } from '../llm/config';
import { loadMCPConfig } from './mcpConfig';

export interface MCPSamplingRequest {
  method: string;
  messages: Array<{ role: string; content: string }>;
  max_turns?: number;
  model?: string;
  timeout?: number;
}

export interface MCPSamplingResponse {
  content: string;
  model: string;
  stop_reason?: 'end_turn' | 'stop_sequence' | 'max_tokens';
}

interface SamplingWindowEntry {
  timestamp: number;
  estimatedTokens: number;
}

export class MCPSamplingService {
  private requestWindow: SamplingWindowEntry[] = [];

  private estimateTokens(messages: Array<{ role: string; content: string }>): number {
    return Math.ceil(messages.reduce((sum, message) => sum + message.content.length, 0) / 4);
  }

  private enforceRateLimit(estimatedTokens: number): void {
    const config = loadMCPConfig().sampling;
    const now = Date.now();
    const windowStart = now - 60_000;
    this.requestWindow = this.requestWindow.filter((entry) => entry.timestamp >= windowStart);

    if (this.requestWindow.length >= config.rateLimit.requestsPerMinute) {
      throw new Error('MCP sampling rate limit exceeded: requests per minute');
    }

    const currentTokens = this.requestWindow.reduce((sum, entry) => sum + entry.estimatedTokens, 0);
    if (currentTokens + estimatedTokens > config.rateLimit.tokensPerMinute) {
      throw new Error('MCP sampling rate limit exceeded: tokens per minute');
    }

    this.requestWindow.push({ timestamp: now, estimatedTokens });
  }

  async createMessage(request: MCPSamplingRequest): Promise<MCPSamplingResponse> {
    const config = loadMCPConfig().sampling;
    if (!config.enabled) {
      throw new Error('MCP sampling is disabled');
    }

    const effectiveMaxTurns = Math.min(
      request.max_turns || config.maxToolRounds,
      config.maxToolRounds
    );
    if (request.max_turns && request.max_turns > config.maxToolRounds) {
      throw new Error(
        `MCP sampling max_turns exceeds configured maxToolRounds (${config.maxToolRounds})`
      );
    }

    const trimmedMessages = request.messages.slice(-effectiveMaxTurns);

    const estimatedTokens = this.estimateTokens(trimmedMessages);
    this.enforceRateLimit(estimatedTokens);

    const llmConfig = loadLLMConfig();
    const model = new ChatOpenAI({
      model: request.model || config.defaultModel || llmConfig.model || 'gpt-4-turbo',
      temperature: 0,
      apiKey: llmConfig.apiKey,
      configuration: {
        baseURL: llmConfig.baseUrl,
      },
      timeout: (request.timeout || config.timeout) * 1000,
      maxRetries: llmConfig.maxRetries || 3,
    });

    const response = await model.invoke(
      trimmedMessages.map((message) => ({
        role: message.role as 'system' | 'user' | 'assistant',
        content: message.content,
      }))
    );

    const content =
      typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? response.content.map((item: any) => item.text || '').join('')
          : '';

    return {
      content: content.trim(),
      model: request.model || config.defaultModel || llmConfig.model || 'gpt-4-turbo',
      stop_reason: 'end_turn',
    };
  }

  async handleSamplingRequest(request: MCPSamplingRequest): Promise<MCPSamplingResponse> {
    return this.createMessage(request);
  }
}

let samplingServiceInstance: MCPSamplingService | null = null;

export function getMCPSamplingService(): MCPSamplingService {
  if (!samplingServiceInstance) {
    samplingServiceInstance = new MCPSamplingService();
  }
  return samplingServiceInstance;
}

export function resetMCPSamplingService(): void {
  samplingServiceInstance = null;
}
