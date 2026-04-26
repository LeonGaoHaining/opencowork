import { generateId } from '../../core/action/ActionSchema';
import { getLLMConfig } from '../../llm/config';
import {
  UIAction,
  VisualAdapterCapabilities,
  VisualAdapterSessionConfig,
  VisualSessionHandle,
  VisualTurnRequest,
  VisualTurnResponse,
} from '../types/visualProtocol';
import { VisualModelAdapter } from './VisualModelAdapter';

interface ChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export class ChatCompletionsVisualAdapter implements VisualModelAdapter {
  private readonly capabilities: VisualAdapterCapabilities = {
    builtInComputerTool: false,
    batchedActions: true,
    nativeScreenshotRequest: false,
    structuredOutput: true,
    toolCalling: true,
    supportsReasoningControl: true,
    maxImageInputBytes: 20 * 1024 * 1024,
  };

  getName(): string {
    return 'chat-completions-visual';
  }

  getCapabilities(): VisualAdapterCapabilities {
    return this.capabilities;
  }

  async createSession(config: VisualAdapterSessionConfig): Promise<VisualSessionHandle> {
    const visualProvider =
      config.metadata && typeof config.metadata === 'object'
        ? (config.metadata as Record<string, unknown>).visualProvider
        : null;

    return {
      sessionId: generateId(),
      adapterMode: 'chat-structured',
      model: config.model,
      capabilities: this.capabilities,
      providerState: {
        systemPrompt: config.systemPrompt,
        temperature: config.temperature ?? 0,
        timeoutMs: config.timeoutMs ?? 60000,
        visualProvider,
      },
    };
  }

  async runTurn(
    session: VisualSessionHandle,
    request: VisualTurnRequest
  ): Promise<VisualTurnResponse> {
    const config = getLLMConfig();
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const endpoint = `${baseUrl}/chat/completions`;
    const systemPrompt = String(session.providerState?.systemPrompt || '');

    const messages = this.buildMessages(systemPrompt, request);

    const controller = new AbortController();
    const timeoutMs = Number(session.providerState?.timeoutMs || 60000);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          'api-key': config.apiKey,
        },
        body: JSON.stringify({
          model: session.model,
          temperature: session.providerState?.temperature ?? 0,
          reasoning_effort: 'medium',
          messages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: 'failed',
          error: {
            code: 'CHAT_COMPLETIONS_REQUEST_FAILED',
            message: `Chat completions request failed: ${response.status} - ${errorText}`,
            recoverable: true,
          },
        };
      }

      const payload = (await response.json()) as ChatCompletionsResponse;
      return this.parseResponse(payload);
    } catch (error: any) {
      clearTimeout(timeoutId);
      return {
        status: 'failed',
        error: {
          code: error?.name === 'AbortError' ? 'CHAT_COMPLETIONS_TIMEOUT' : 'CHAT_COMPLETIONS_ERROR',
          message: error?.message || String(error),
          recoverable: true,
        },
      };
    }
  }

  async destroySession(_session: VisualSessionHandle): Promise<void> {}

  private buildMessages(systemPrompt: string, request: VisualTurnRequest): Array<Record<string, unknown>> {
    const prompt = [
      'You are a visual browser agent.',
      'Return JSON only.',
      'If visual context is missing or insufficient, request a screenshot.',
      'Keep the action batch minimal and safe.',
      'Use one of: needs_observation, actions_proposed, completed, failed.',
      systemPrompt,
    ]
      .filter(Boolean)
      .join('\n');

    const structuredRequest = {
      task: request.taskContext.task,
      instruction: request.taskContext.instruction,
      page: request.taskContext.page,
      previousActions: request.taskContext.previousActions || [],
      previousObservation: request.taskContext.previousObservation,
      allowedActions: request.allowedActions,
      responseSchema: {
        status: ['needs_observation', 'actions_proposed', 'completed', 'failed'],
        actions: 'UIAction[]',
        finalMessage: 'string?',
        modelMessage: 'string?',
        error: '{ code, message, recoverable }?',
      },
    };

    const userContent: Array<Record<string, unknown>> = [
      {
        type: 'text',
        text: `Request:\n${JSON.stringify(structuredRequest, null, 2)}`,
      },
    ];

    if (request.observation.screenshotBase64) {
      const mimeType = request.observation.screenshotMimeType || 'image/png';
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${request.observation.screenshotBase64}`,
        },
      });
    }

    if (request.observation.textualHints) {
      userContent.push({
        type: 'text',
        text: `Observation hints:\n${request.observation.textualHints}`,
      });
    }

    return [
      { role: 'system', content: prompt },
      { role: 'user', content: userContent },
    ];
  }

  private parseResponse(payload: ChatCompletionsResponse): VisualTurnResponse {
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return {
        status: 'failed',
        error: {
          code: 'CHAT_COMPLETIONS_EMPTY_CONTENT',
          message: 'Chat completions returned empty content',
          recoverable: true,
        },
        rawProviderResponse: payload,
      };
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        status: 'failed',
        error: {
          code: 'CHAT_COMPLETIONS_INVALID_JSON',
          message: 'Chat completions response did not contain a JSON object',
          recoverable: true,
        },
        rawProviderResponse: payload,
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        status?: VisualTurnResponse['status'];
        actions?: UIAction[];
        finalMessage?: string;
        modelMessage?: string;
        error?: VisualTurnResponse['error'];
      };

      if (!parsed.status) {
        throw new Error('Missing status');
      }

      return {
        status: parsed.status,
        actions: parsed.actions,
        finalMessage: parsed.finalMessage,
        modelMessage: parsed.modelMessage,
        error: parsed.error,
        rawProviderResponse: payload,
      };
    } catch (error: any) {
      return {
        status: 'failed',
        error: {
          code: 'CHAT_COMPLETIONS_PARSE_FAILED',
          message: error?.message || 'Failed to parse adapter JSON response',
          recoverable: true,
        },
        rawProviderResponse: payload,
      };
    }
  }
}
