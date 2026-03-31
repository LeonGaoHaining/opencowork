import { ParsedCommand } from './types';

export class CommandParser {
  private static readonly COMMANDS = {
    TASK: '任务',
    STATUS: '状态',
    LIST: '列表',
    TAKEOVER: '接管',
    RETURN: '交还',
    CANCEL: '取消',
    HELP: '帮助',
  } as const;

  parse(content: string): ParsedCommand | null {
    const trimmed = content.trim();
    if (!trimmed) {
      return null;
    }

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    if (cmd === CommandParser.COMMANDS.TASK) {
      return { command: 'task', args, raw: content };
    }
    if (cmd === CommandParser.COMMANDS.STATUS) {
      return { command: 'status', args, raw: content };
    }
    if (cmd === CommandParser.COMMANDS.LIST) {
      return { command: 'list', args: [], raw: content };
    }
    if (cmd === CommandParser.COMMANDS.TAKEOVER) {
      return { command: 'takeover', args, raw: content };
    }
    if (cmd === CommandParser.COMMANDS.RETURN) {
      return { command: 'return', args: [], raw: content };
    }
    if (cmd === CommandParser.COMMANDS.CANCEL) {
      return { command: 'cancel', args, raw: content };
    }
    if (cmd === CommandParser.COMMANDS.HELP) {
      return { command: 'help', args: [], raw: content };
    }

    return { command: 'task', args: [trimmed], raw: content };
  }

  getHelp(): string {
    return `
📋 OpenCowork 命令帮助

• 任务 [描述] - 发送新任务
  例: @机器人 任务 帮我查下北京天气

• 状态 [任务ID] - 查询任务状态
  例: @机器人 状态 abc123

• 列表 - 查看最近任务
  例: @机器人 列表

• 接管 [任务ID] - 接管任务
  例: @机器人 接管 abc123

• 交还 - 交还控制给AI
  例: @机器人 交还

• 取消 [任务ID] - 取消任务
  例: @机器人 取消 abc123

• 帮助 - 显示帮助
  例: @机器人 帮助
`.trim();
  }
}
