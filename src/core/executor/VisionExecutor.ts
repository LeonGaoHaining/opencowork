import * as fs from 'fs';
import * as path from 'path';
import { getLLMConfig } from '../../llm/config';

export interface VisionExecuteParams {
  action: 'ocr' | 'analyze' | 'screenshot';
  target?: string;
}

export interface VisionExecuteError {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface VisionExecuteResult {
  success: boolean;
  action: 'ocr' | 'analyze' | 'screenshot';
  result?: string;
  error?: VisionExecuteError;
  duration: number;
}

interface VisionChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

export class VisionExecutor {
  async execute(params: VisionExecuteParams): Promise<VisionExecuteResult> {
    const startTime = Date.now();

    try {
      if (params.action === 'screenshot') {
        return this.createErrorResult(
          params.action,
          'SCREENSHOT_NOT_IMPLEMENTED',
          'Screenshot action is not implemented in VisionExecutor',
          false,
          startTime
        );
      }

      const validationError = await this.validateTarget(params.target);
      if (validationError) {
        return this.createErrorResult(
          params.action,
          validationError.code,
          validationError.message,
          validationError.recoverable,
          startTime
        );
      }

      if (params.action === 'ocr') {
        return await this.ocrImage(params.target!, startTime);
      }

      return await this.analyzeImage(params.target!, startTime);
    } catch (error: any) {
      return this.createErrorResult(
        params.action,
        'VISION_REQUEST_FAILED',
        error?.message || String(error),
        true,
        startTime
      );
    }
  }

  private async analyzeImage(target: string, startTime: number): Promise<VisionExecuteResult> {
    const { dataUrl } = await this.readImageAsDataUrl(target);
    const result = await this.requestVision(this.getAnalyzePrompt(), dataUrl);
    return {
      success: true,
      action: 'analyze',
      result,
      duration: Date.now() - startTime,
    };
  }

  private async ocrImage(target: string, startTime: number): Promise<VisionExecuteResult> {
    const { dataUrl } = await this.readImageAsDataUrl(target);
    const result = await this.requestVision(this.getOCRPrompt(), dataUrl);
    return {
      success: true,
      action: 'ocr',
      result,
      duration: Date.now() - startTime,
    };
  }

  private async validateTarget(target?: string): Promise<VisionExecuteError | null> {
    if (!target) {
      return {
        code: 'TARGET_REQUIRED',
        message: 'Vision target is required',
        recoverable: false,
      };
    }

    const resolvedTarget = path.resolve(target);
    const stats = await fs.promises.stat(resolvedTarget).catch(() => null);
    if (!stats) {
      return {
        code: 'FILE_NOT_FOUND',
        message: `Image file not found: ${resolvedTarget}`,
        recoverable: false,
      };
    }

    if (!stats.isFile()) {
      return {
        code: 'NOT_A_FILE',
        message: `Target is not a file: ${resolvedTarget}`,
        recoverable: false,
      };
    }

    if (stats.size === 0) {
      return {
        code: 'EMPTY_FILE',
        message: `Image file is empty: ${resolvedTarget}`,
        recoverable: false,
      };
    }

    if (stats.size > MAX_IMAGE_SIZE_BYTES) {
      return {
        code: 'IMAGE_TOO_LARGE',
        message: `Image exceeds ${MAX_IMAGE_SIZE_BYTES} byte limit: ${resolvedTarget}`,
        recoverable: false,
      };
    }

    if (!this.detectMimeType(resolvedTarget)) {
      return {
        code: 'UNSUPPORTED_IMAGE_TYPE',
        message: `Unsupported image type: ${resolvedTarget}`,
        recoverable: false,
      };
    }

    return null;
  }

  private async readImageAsDataUrl(target: string): Promise<{ dataUrl: string; mimeType: string }> {
    const resolvedTarget = path.resolve(target);
    const mimeType = this.detectMimeType(resolvedTarget);
    if (!mimeType) {
      throw new Error(`Unsupported image type: ${resolvedTarget}`);
    }

    const buffer = await fs.promises.readFile(resolvedTarget);
    const base64 = buffer.toString('base64');
    return {
      dataUrl: `data:${mimeType};base64,${base64}`,
      mimeType,
    };
  }

  private detectMimeType(target: string): string | null {
    const extension = path.extname(target).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
    };
    return mimeMap[extension] || null;
  }

  private async requestVision(prompt: string, dataUrl: string): Promise<string> {
    const config = getLLMConfig();
    const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || 60000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          'api-key': config.apiKey,
        },
        body: JSON.stringify({
          model: config.model,
          reasoning_effort: 'medium',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vision API error: ${response.status} - ${errorText}`);
      }

      const payload = (await response.json()) as VisionChatResponse;
      const content = this.extractContent(payload);
      if (!content) {
        throw new Error('Vision API returned empty content');
      }
      return content;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error?.name === 'AbortError') {
        throw new Error(`Vision request timeout after ${config.timeout || 60000}ms`);
      }
      throw error;
    }
  }

  private extractContent(response: VisionChatResponse): string {
    const content = response.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      return content.trim();
    }
    if (Array.isArray(content)) {
      return content
        .map((item) => (typeof item.text === 'string' ? item.text : ''))
        .join('')
        .trim();
    }
    return '';
  }

  private getOCRPrompt(): string {
    return [
      '请提取这张图片中的所有可见文字，尽量保持原有结构。',
      '如果某些内容看不清，请明确标注“不确定”。',
      '只输出识别结果，不要额外发挥。',
    ].join('\n');
  }

  private getAnalyzePrompt(): string {
    return [
      '请描述这张图片的主要内容，包括：',
      '1. 主体对象',
      '2. 场景或环境',
      '3. 可见文字',
      '4. 你不确定的部分',
      '',
      '输出要简洁、准确，不要编造。',
    ].join('\n');
  }

  private createErrorResult(
    action: 'ocr' | 'analyze' | 'screenshot',
    code: string,
    message: string,
    recoverable: boolean,
    startTime: number
  ): VisionExecuteResult {
    return {
      success: false,
      action,
      error: {
        code,
        message,
        recoverable,
      },
      duration: Date.now() - startTime,
    };
  }
}

export default VisionExecutor;
