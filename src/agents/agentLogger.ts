/**
 * AgentLogger - Agent 日志系统
 * 记录 Agent 运行轨迹，替代 LangSmith 本地可视化
 */

import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type OutputMode = 'console' | 'file' | 'both';

export type EventType =
  | 'agent_start'
  | 'agent_end'
  | 'tool_call'
  | 'tool_result'
  | 'llm_call'
  | 'llm_response'
  | 'error';

export interface AgentLogEvent {
  id: string;
  threadId: string;
  timestamp: string;
  eventType: EventType;
  level: LogLevel;
  toolName?: string;
  task?: string;
  input?: any;
  output?: any;
  duration?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface LoggerConfig {
  enabled?: boolean;
  level?: LogLevel;
  output?: OutputMode;
  logDir?: string;
  maxFiles?: number;
  maxEventsInMemory?: number;
  maxToolDurations?: number;
}

export interface AgentStats {
  totalEvents: number;
  toolCalls: Record<string, number>;
  toolAvgDurations: Record<string, number>;
  errors: number;
  startTime: string;
  endTime?: string;
}

const DEFAULT_MAX_TOOL_DURATIONS = 100;

class AgentLogger {
  private enabled: boolean = true;
  private level: LogLevel = 'info';
  private output: OutputMode = 'both';
  private logDir: string = 'logs';
  private maxFiles: number = 7;
  private maxEventsInMemory: number = 1000;
  private maxToolDurations: number = DEFAULT_MAX_TOOL_DURATIONS;
  private currentDate: string;
  private events: AgentLogEvent[] = [];
  private toolCallCounts: Record<string, number> = {};
  private toolDurations: Record<string, number[]> = {};
  private errorCount: number = 0;
  private startTime: string;

  constructor(config: LoggerConfig = {}) {
    this.enabled = config.enabled ?? true;
    this.level = config.level ?? 'info';
    this.output = config.output ?? 'both';
    this.logDir = config.logDir ?? 'logs';
    this.maxFiles = config.maxFiles ?? 7;
    this.maxEventsInMemory = config.maxEventsInMemory ?? 1000;
    this.maxToolDurations = config.maxToolDurations ?? DEFAULT_MAX_TOOL_DURATIONS;
    this.currentDate = this.getDateString();
    this.startTime = new Date().toISOString();

    if (this.output !== 'console') {
      this.ensureLogDir();
      this.cleanOldLogs();
      this.rotateLogFile();
    }
  }

  private getDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private ensureLogDir(): void {
    const logPath = path.isAbsolute(this.logDir)
      ? this.logDir
      : path.join(process.cwd(), this.logDir);
    this.logDir = logPath;

    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(logPath, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.level);
    const eventLevelIndex = levels.indexOf(level);
    return eventLevelIndex >= currentLevelIndex;
  }

  private formatEvent(event: AgentLogEvent): string {
    const colors = {
      reset: '\x1b[0m',
      green: '\x1b[32m',
      blue: '\x1b[34m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      cyan: '\x1b[36m',
      gray: '\x1b[90m',
    };

    const levelColors: Record<LogLevel, string> = {
      debug: colors.gray,
      info: colors.blue,
      warn: colors.yellow,
      error: colors.red,
    };

    const eventLabels: Record<EventType, string> = {
      agent_start: '🚀 AGENT_START',
      agent_end: '✅ AGENT_END',
      tool_call: '🔧 TOOL_CALL',
      tool_result: '📤 TOOL_RESULT',
      llm_call: '🤖 LLM_CALL',
      llm_response: '💬 LLM_RESPONSE',
      error: '❌ ERROR',
    };

    const label = eventLabels[event.eventType] || event.eventType;
    const color = levelColors[event.level];

    let logLine = `${colors.gray}[${event.timestamp}]${color} ${label}${colors.reset}`;

    if (event.toolName) {
      logLine += ` ${colors.cyan}[${event.toolName}]${colors.reset}`;
    }

    if (event.duration !== undefined) {
      logLine += ` ${colors.green}(${event.duration}ms)${colors.reset}`;
    }

    if (event.input) {
      logLine += `\n  Input: ${JSON.stringify(event.input)}`;
    }

    if (event.output) {
      const outputStr =
        typeof event.output === 'string' ? event.output : JSON.stringify(event.output);
      logLine += `\n  Output: ${outputStr.substring(0, 200)}`;
    }

    if (event.error) {
      logLine += `\n  Error: ${colors.red}${event.error}${colors.reset}`;
    }

    return logLine;
  }

  private writeToFile(event: AgentLogEvent): void {
    if (this.output === 'console') return;

    const filePath = this.getLogFilePath();

    try {
      fs.appendFileSync(filePath, JSON.stringify(event) + '\n', 'utf-8');
    } catch (error) {
      console.error('[AgentLogger] Failed to write to file:', error);
    }
  }

  private cleanOldLogs(): void {
    if (this.maxFiles <= 0) return;

    try {
      const files = fs
        .readdirSync(this.logDir)
        .filter((f) => f.startsWith('agent-') && f.endsWith('.jsonl'))
        .sort()
        .reverse();

      if (files.length > this.maxFiles) {
        files.slice(this.maxFiles).forEach((file) => {
          const filePath = path.join(this.logDir, file);
          fs.unlinkSync(filePath);
          console.log(`[AgentLogger] Cleaned old log: ${file}`);
        });
      }
    } catch (error) {
      console.error('[AgentLogger] Failed to clean old logs:', error);
    }
  }

  private getLogFilePath(): string {
    const logPath = path.isAbsolute(this.logDir)
      ? this.logDir
      : path.join(process.cwd(), this.logDir);
    return path.join(logPath, `agent-${this.currentDate}.jsonl`);
  }

  private rotateLogFile(): void {
    const newDate = this.getDateString();
    if (newDate !== this.currentDate) {
      this.currentDate = newDate;
      this.cleanOldLogs();
    }
  }

  private addEvent(event: AgentLogEvent): void {
    if (!this.enabled || !this.shouldLog(event.level)) return;

    if (this.events.length >= this.maxEventsInMemory) {
      this.events.shift();
    }

    this.events.push(event);
    this.rotateLogFile();

    if (this.output !== 'file') {
      console.log(this.formatEvent(event));
    }

    if (this.output !== 'console') {
      this.writeToFile(event);
    }

    if (event.toolName) {
      this.toolCallCounts[event.toolName] = (this.toolCallCounts[event.toolName] || 0) + 1;

      if (event.duration !== undefined) {
        if (!this.toolDurations[event.toolName]) {
          this.toolDurations[event.toolName] = [];
        }
        this.toolDurations[event.toolName].push(event.duration);
        if (this.toolDurations[event.toolName].length > this.maxToolDurations) {
          this.toolDurations[event.toolName].shift();
        }
      }
    }

    if (event.level === 'error') {
      this.errorCount++;
    }
  }

  logEvent(params: {
    threadId: string;
    eventType: EventType;
    level?: LogLevel;
    task?: string;
    toolName?: string;
    input?: any;
    output?: any;
    duration?: number;
    error?: string;
    metadata?: Record<string, any>;
  }): void {
    const event: AgentLogEvent = {
      id: this.generateId(),
      threadId: params.threadId,
      timestamp: new Date().toISOString(),
      eventType: params.eventType,
      level: params.level || 'info',
      task: params.task,
      toolName: params.toolName,
      input: params.input,
      output: params.output,
      duration: params.duration,
      error: params.error,
      metadata: params.metadata,
    };

    this.addEvent(event);
  }

  logToolCall(toolName: string, input: any, threadId: string, task?: string): void {
    this.logEvent({
      threadId,
      eventType: 'tool_call',
      level: 'debug',
      toolName,
      input,
      task,
    });
  }

  logToolResult(
    toolName: string,
    output: any,
    duration: number,
    threadId: string,
    task?: string,
    error?: string
  ): void {
    this.logEvent({
      threadId,
      eventType: 'tool_result',
      level: error ? 'error' : 'info',
      toolName,
      output,
      duration,
      task,
      error,
    });
  }

  logError(error: string, context: Record<string, any>, threadId: string, task?: string): void {
    this.logEvent({
      threadId,
      eventType: 'error',
      level: 'error',
      task,
      error,
      metadata: context,
    });
  }

  logAgentStart(threadId: string, task: string): void {
    this.logEvent({
      threadId,
      eventType: 'agent_start',
      level: 'info',
      task,
    });
  }

  logAgentEnd(threadId: string, output: any, task?: string): void {
    this.logEvent({
      threadId,
      eventType: 'agent_end',
      level: 'info',
      task,
      output,
    });
  }

  logLlmCall(messages: any[], threadId: string): void {
    this.logEvent({
      threadId,
      eventType: 'llm_call',
      level: 'debug',
      input: { messages: messages.length },
    });
  }

  logLlmResponse(response: any, threadId: string): void {
    this.logEvent({
      threadId,
      eventType: 'llm_response',
      level: 'debug',
      output: response.content?.substring(0, 100),
    });
  }

  getStats(): AgentStats {
    const avgDurations: Record<string, number> = {};

    for (const [tool, durations] of Object.entries(this.toolDurations)) {
      const sum = durations.reduce((a, b) => a + b, 0);
      avgDurations[tool] = Math.round(sum / durations.length);
    }

    return {
      totalEvents: this.events.length,
      toolCalls: this.toolCallCounts,
      toolAvgDurations: avgDurations,
      errors: this.errorCount,
      startTime: this.startTime,
      endTime: new Date().toISOString(),
    };
  }

  exportLogs(): string {
    return JSON.stringify(
      {
        stats: this.getStats(),
        events: this.events,
      },
      null,
      2
    );
  }

  exportToFile(filePath?: string): string {
    const targetPath = filePath || path.join(this.logDir, `agent-export-${Date.now()}.json`);
    try {
      fs.writeFileSync(targetPath, this.exportLogs(), 'utf-8');
    } catch (err) {
      console.error('[AgentLogger] Failed to export to file:', err);
    }
    return targetPath;
  }

  clear(): void {
    this.events = [];
    this.toolCallCounts = {};
    this.toolDurations = {};
    this.errorCount = 0;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

let loggerInstance: AgentLogger | null = null;
let loggerConfig: LoggerConfig | null = null;

export function getLogger(config?: LoggerConfig): AgentLogger {
  if (!loggerInstance || (config && JSON.stringify(config) !== JSON.stringify(loggerConfig))) {
    if (config) {
      loggerConfig = config;
    }
    loggerInstance = new AgentLogger(loggerConfig || undefined);
  }
  return loggerInstance;
}

export function resetLogger(): void {
  loggerInstance = null;
  loggerConfig = null;
}

export function createLogger(config?: LoggerConfig): AgentLogger {
  return new AgentLogger(config);
}

export default AgentLogger;
