export type IMPlatform = 'feishu' | 'dingtalk' | 'wecom' | 'slack' | 'github';

export interface IMAttachment {
  type: 'image' | 'file';
  fileKey?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  localPath?: string;
  messageId?: string;
}

export interface IMMessage {
  id: string;
  platform: IMPlatform;
  userId: string;
  content: string;
  type: 'text' | 'image' | 'file';
  timestamp: number;
  conversationId: string;
  messageId?: string;
  chatType?: string;
  attachments?: IMAttachment[];
}

export interface IMCard {
  title: string;
  elements: IMElement[];
  actions?: IMAction[];
}

export interface IMElement {
  type: 'text' | 'image' | 'divider';
  content?: string;
  imageUrl?: string;
}

export interface IMAction {
  type: 'button';
  text: string;
  value: string;
  actionType: 'callback' | 'url';
}

export interface IMNotification {
  title: string;
  content: string;
  extra?: Record<string, any>;
}

export interface IMConfig {
  appId: string;
  appSecret: string;
  verificationToken?: string;
  encryptKey?: string;
}

export interface IMBinding {
  imUserId: string;
  desktopUserId: string;
  boundAt: number;
}

export interface IMBot {
  platform: IMPlatform;

  initialize(config: IMConfig): Promise<void>;

  onMessage(handler: (msg: IMMessage) => void): void;

  sendMessage(conversationId: string, message: string | IMCard, chatType?: string): Promise<void>;

  sendAttachment(conversationId: string, attachment: IMAttachment, chatType?: string): Promise<void>;

  pushNotification(userId: string, notification: IMNotification): Promise<void>;

  bindUser(imUserId: string, desktopUserId: string): Promise<void>;

  getBinding(desktopUserId: string): Promise<IMBinding | null>;

  verifySignature(timestamp: string, signature: string): boolean;
}

export interface FeishuMessage extends IMMessage {
  msgType: 'text' | 'image' | 'file' | 'rich_text';
  messageId: string;
  messageType: 'direct' | 'group';
}

export interface FeishuCallbackPayload {
  type: 'url_verification' | 'event_callback';
  token?: string;
  challenge?: string;
  event?: FeishuMessageEvent;
}

export interface FeishuMessageEvent {
  type: 'im.message';
  message: {
    message_id: string;
    chat_id: string;
    msg_type: string;
    create_time: number;
    content: string;
    mentions?: Array<{ sender_id: { user_id: string } }>;
  };
  sender: {
    sender_id: { user_id: string };
  };
}

export interface DispatchTask {
  id: string;
  description: string;
  templateId?: string;
  templateInput?: Record<string, unknown>;
  executionMode?: 'dom' | 'visual' | 'hybrid';
  attachments?: IMAttachment[];
  source: 'feishu' | 'desktop';
  priority: 'low' | 'normal' | 'high';
  userId: string;
  conversationId: string;
  chatType?: string;
  replyTargetId?: string;
  createdAt: number;
}

export interface TaskStatus {
  id: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  result?: any;
  runId?: string;
  templateId?: string;
  resultSummary?: string;
  artifactsCount?: number;
  updatedAt: number;
}

export interface ParsedCommand {
  command: string;
  args: string[];
  raw: string;
}

export interface ProgressEvent {
  taskId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  step?: number;
  total?: number;
  message?: string;
  result?: any;
}

export const ERROR_CODES = {
  FEISHU_AUTH_FAILED: 'FEISHU_AUTH_FAILED',
  FEISHU_TOKEN_EXPIRED: 'FEISHU_TOKEN_EXPIRED',
  COMMAND_NOT_RECOGNIZED: 'COMMAND_NOT_RECOGNIZED',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_ALREADY_COMPLETED: 'TASK_ALREADY_COMPLETED',
  IPC_FORWARD_FAILED: 'IPC_FORWARD_FAILED',
  BINDING_NOT_FOUND: 'BINDING_NOT_FOUND',
} as const;
