import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IMAttachment, IMBot, IMMessage, IMNotification } from '../types';

const mockAgentRun = vi.fn();
const mockStartRun = vi.fn();
const mockExecuteRun = vi.fn();
const mockSetUserBinding = vi.fn();

vi.mock('../../main/ipcHandlers', () => ({
  getSharedMainAgent: () => ({
    run: mockAgentRun,
  }),
}));

vi.mock('../ProgressEmitter', () => ({
  getProgressEmitter: () => ({
    setUserBinding: mockSetUserBinding,
  }),
}));

vi.mock('../../core/task/TaskOrchestrator', () => ({
  getTaskOrchestrator: () => ({
    startRun: mockStartRun,
    executeRun: mockExecuteRun,
  }),
}));

import { createDispatchService } from '../DispatchService';

class MockBot implements IMBot {
  platform = 'feishu' as const;
  sendMessage = vi.fn(async (_conversationId: string, _message: string) => undefined);
  sendAttachment = vi.fn(async (_conversationId: string, _attachment: IMAttachment) => undefined);
  pushNotification = vi.fn(async (_userId: string, _notification: IMNotification) => undefined);
  initialize = vi.fn(async () => undefined);
  onMessage = vi.fn();
  bindUser = vi.fn(async () => undefined);
  getBinding = vi.fn(async () => null);
  verifySignature = vi.fn(() => true);
}

describe('DispatchService', () => {
  let bot: MockBot;
  let tempDir: string | null = null;

  beforeEach(() => {
    bot = new MockBot();
    mockAgentRun.mockReset();
    mockStartRun.mockReset();
    mockExecuteRun.mockReset();
    mockSetUserBinding.mockReset();
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = null;
    vi.clearAllMocks();
  });

  it('creates a default task from attachment-only messages and passes local paths to the agent', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencowork-im-'));
    const attachmentPath = path.join(tempDir, 'input.txt');
    fs.writeFileSync(attachmentPath, 'hello');

    mockAgentRun.mockResolvedValue({
      success: true,
      output: 'done',
      finalMessage: 'done',
    });
    mockExecuteRun.mockImplementation(async (_runId: string, runner: () => Promise<unknown>) => runner());

    const service = createDispatchService(bot);
    const message: IMMessage = {
      id: 'm1',
      platform: 'feishu',
      userId: 'user-1',
      content: '',
      type: 'file',
      timestamp: Date.now(),
      conversationId: 'chat-1',
      chatType: 'p2p',
      messageId: 'msg-1',
      attachments: [
        {
          type: 'file',
          fileName: 'input.txt',
          localPath: attachmentPath,
          mimeType: 'text/plain',
        },
      ],
    };

    await service.handleMessage(message);

    expect(mockAgentRun).toHaveBeenCalledTimes(1);
    const prompt = mockAgentRun.mock.calls[0][0] as string;
    expect(prompt).toContain('处理我刚发送的文件：input.txt');
    expect(prompt).toContain(`本地路径: ${attachmentPath}`);
    expect(bot.sendMessage).toHaveBeenCalledWith(
      'chat-1',
      expect.stringContaining('任务已接收'),
      'p2p'
    );
  });

  it('sends file and link artifacts back to Feishu after task completion', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencowork-im-'));
    const outputPath = path.join(tempDir, 'report.pdf');
    fs.writeFileSync(outputPath, 'pdf-content');

    mockExecuteRun.mockResolvedValue({
      id: 'result-1',
      summary: 'completed',
      artifacts: [
        {
          id: 'artifact-1',
          type: 'file',
          name: 'Report',
          uri: outputPath,
        },
        {
          id: 'artifact-2',
          type: 'link',
          name: 'Dashboard',
          uri: 'https://example.com/result',
        },
      ],
      reusable: true,
      completedAt: Date.now(),
    });

    const service = createDispatchService(bot);
    const message: IMMessage = {
      id: 'm2',
      platform: 'feishu',
      userId: 'user-2',
      content: '生成报告',
      type: 'text',
      timestamp: Date.now(),
      conversationId: 'chat-2',
      chatType: 'p2p',
      messageId: 'msg-2',
    };

    await service.handleMessage(message);

    expect(bot.sendAttachment).toHaveBeenCalledWith(
      'chat-2',
      expect.objectContaining({
        type: 'file',
        localPath: outputPath,
        fileName: 'report.pdf',
      }),
      'p2p'
    );
    expect(bot.sendMessage).toHaveBeenCalledWith(
      'chat-2',
      expect.stringContaining('https://example.com/result'),
      'p2p'
    );
  });
});
