import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../llm/config', () => ({
  getLLMConfig: () => ({
    provider: 'openai',
    model: 'vision-test-model',
    apiKey: 'test-key',
    baseUrl: 'https://example.test/openai/v1/',
    timeout: 5000,
  }),
}));

import { VisionExecutor } from '../VisionExecutor';

describe('VisionExecutor', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = null;
  });

  it('returns FILE_NOT_FOUND when target does not exist', async () => {
    const executor = new VisionExecutor();

    const result = await executor.execute({
      action: 'analyze',
      target: '/tmp/does-not-exist.png',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FILE_NOT_FOUND');
  });

  it('returns UNSUPPORTED_IMAGE_TYPE for non-image files', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vision-executor-'));
    const target = path.join(tempDir, 'input.txt');
    fs.writeFileSync(target, 'hello');

    const executor = new VisionExecutor();
    const result = await executor.execute({ action: 'ocr', target });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('UNSUPPORTED_IMAGE_TYPE');
  });

  it('sends image_url payload and returns analyzed content', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vision-executor-'));
    const target = path.join(tempDir, 'sample.png');
    fs.writeFileSync(target, Buffer.from('fake-image-data'));

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('vision-test-model');
      expect(body.messages[0].content[0].type).toBe('text');
      expect(body.messages[0].content[1].type).toBe('image_url');
      expect(body.messages[0].content[1].image_url.url).toContain('data:image/png;base64,');

      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '图片里是一只猫' } }],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const executor = new VisionExecutor();
    const result = await executor.execute({ action: 'analyze', target });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.result).toBe('图片里是一只猫');
  });

  it('returns VISION_REQUEST_FAILED when API call fails', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vision-executor-'));
    const target = path.join(tempDir, 'sample.jpg');
    fs.writeFileSync(target, Buffer.from('fake-image-data'));

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        text: async () => 'bad request',
      }))
    );

    const executor = new VisionExecutor();
    const result = await executor.execute({ action: 'ocr', target });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VISION_REQUEST_FAILED');
    expect(result.error?.message).toContain('Vision API error: 400');
  });
});
