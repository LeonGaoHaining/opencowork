import { generateId } from '../../core/action/ActionSchema';
import { getLLMConfig } from '../../llm/config';
import {
  VisualAdapterCapabilities,
  VisualAdapterSessionConfig,
  VisualSessionHandle,
  VisualTurnRequest,
  VisualTurnResponse,
} from '../types/visualProtocol';
import { VisualModelAdapter } from './VisualModelAdapter';

interface ResponsesApiOutputItem {
  type?: string;
  call_id?: string;
  actions?: Array<Record<string, unknown>>;
  status?: string;
  content?: Array<{ type?: string; text?: string }>;
}

interface ResponsesApiResponse {
  id?: string;
  output?: ResponsesApiOutputItem[];
}

export class ResponsesVisualAdapter implements VisualModelAdapter {
  private readonly capabilities: VisualAdapterCapabilities = {
    builtInComputerTool: true,
    batchedActions: true,
    nativeScreenshotRequest: true,
    structuredOutput: false,
    toolCalling: true,
    supportsReasoningControl: true,
  };

  getName(): string {
    return 'responses-visual';
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
      adapterMode: 'responses-computer',
      model: config.model,
      capabilities: this.capabilities,
      providerState: {
        systemPrompt: config.systemPrompt,
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
    const endpoint = `${baseUrl}/responses`;
    const previousResponseId =
      typeof session.providerState?.previousResponseId === 'string'
        ? session.providerState.previousResponseId
        : undefined;

    const input = this.buildInput(request);
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
          previous_response_id: previousResponseId,
          tools: [{ type: 'computer' }],
          input,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: 'failed',
          error: {
            code: 'RESPONSES_REQUEST_FAILED',
            message: `Responses API request failed: ${response.status} - ${errorText}`,
            recoverable: true,
          },
        };
      }

      const payload = (await response.json()) as ResponsesApiResponse;
      if (payload.id) {
        session.providerState = {
          ...session.providerState,
          previousResponseId: payload.id,
        };
      }
      return this.parseResponse(payload);
    } catch (error: any) {
      clearTimeout(timeoutId);
      return {
        status: 'failed',
        error: {
          code: error?.name === 'AbortError' ? 'RESPONSES_TIMEOUT' : 'RESPONSES_ERROR',
          message: error?.message || String(error),
          recoverable: true,
        },
      };
    }
  }

  async destroySession(_session: VisualSessionHandle): Promise<void> {}

  private buildInput(request: VisualTurnRequest): Array<Record<string, unknown>> {
    const text = [
      request.taskContext.task,
      request.taskContext.instruction,
      request.observation.textualHints,
    ]
      .filter(Boolean)
      .join('\n\n');

    const input: Array<Record<string, unknown>> = [
      {
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    ];

    if (request.observation.screenshotBase64) {
      const mimeType = request.observation.screenshotMimeType || 'image/png';
      input[0].content = [
        ...(input[0].content as Array<Record<string, unknown>>),
        {
          type: 'input_image',
          image_url: `data:${mimeType};base64,${request.observation.screenshotBase64}`,
        },
      ];
    }

    return input;
  }

  private parseResponse(payload: ResponsesApiResponse): VisualTurnResponse {
    const computerCall = payload.output?.find((item) => item.type === 'computer_call');
    if (computerCall?.actions && computerCall.actions.length > 0) {
      return {
        status: 'actions_proposed',
        actions: computerCall.actions as any,
        rawProviderResponse: payload,
      };
    }

    const outputText = payload.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text)
      .filter((value): value is string => typeof value === 'string')
      .join('\n')
      .trim();

    if (outputText) {
      return {
        status: 'completed',
        finalMessage: outputText,
        rawProviderResponse: payload,
      };
    }

    return {
      status: 'failed',
      error: {
        code: 'RESPONSES_UNHANDLED_OUTPUT',
        message: 'Responses API returned no actionable computer_call or final text',
        recoverable: true,
      },
      rawProviderResponse: payload,
    };
  }
}
