/**
 * SchedulerTool - 定时任务管理工具
 * 通过聊天对话框创建、查询、修改、删除和触发定时任务
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';

function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>
): void {
  const prefix = '[SchedulerTool]';
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} ${prefix} ${message}`;
  if (level === 'error') {
    console.error(logMessage, meta || '');
  } else if (level === 'warn') {
    console.warn(logMessage, meta || '');
  } else {
    console.log(logMessage, meta || '');
  }
}

// 单一对象 Schema - 避免 union 类型导致的 JSON Schema 转换问题
const SchedulerTaskSchema = z.object({
  name: z.string().describe('任务名称'),
  description: z.string().optional().describe('任务描述'),
  scheduleType: z
    .enum(['cron', 'interval', 'one-time'])
    .default('cron')
    .describe('调度类型: cron/interval/one-time'),
  cron: z.string().optional().describe('Cron 表达式 (当 scheduleType=cron 时)'),
  intervalMs: z.number().optional().describe('间隔毫秒 (当 scheduleType=interval 时)'),
  startTime: z.number().optional().describe('开始时间戳 (当 scheduleType=one-time 时)'),
  taskDescription: z.string().describe('任务执行描述'),
  timeout: z.number().default(300000).describe('任务超时时间(毫秒)'),
  maxRetries: z.number().default(0).describe('最大重试次数'),
  retryDelayMs: z.number().default(1000).describe('重试延迟(毫秒)'),
  enabled: z.boolean().default(true).describe('是否启用'),
});

const SchedulerUpdatesSchema = z.object({
  name: z.string().optional().describe('任务名称'),
  description: z.string().optional().describe('任务描述'),
  scheduleType: z.enum(['cron', 'interval', 'one-time']).optional().describe('调度类型'),
  cron: z.string().optional().describe('Cron 表达式'),
  intervalMs: z.number().optional().describe('间隔毫秒'),
  startTime: z.number().optional().describe('开始时间戳'),
  taskDescription: z.string().optional().describe('任务执行描述'),
  timeout: z.number().optional().describe('任务超时时间(毫秒)'),
  maxRetries: z.number().optional().describe('最大重试次数'),
  retryDelayMs: z.number().optional().describe('重试延迟(毫秒)'),
  enabled: z.boolean().optional().describe('是否启用'),
});

const SchedulerActionSchema = z.object({
  action: z
    .enum(['list', 'create', 'update', 'delete', 'trigger'])
    .describe('操作类型: list=列出, create=创建, update=更新, delete=删除, trigger=触发'),
  id: z.string().optional().describe('任务ID (用于 update/delete/trigger)'),
  task: SchedulerTaskSchema.optional().describe('任务内容 (仅 create 时需要)'),
  updates: SchedulerUpdatesSchema.optional().describe('更新字段 (仅 update 时需要)'),
});

export type SchedulerAction = z.infer<typeof SchedulerActionSchema>;

export interface SchedulerToolResult {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}

async function invokeScheduler(action: string, params?: unknown): Promise<unknown> {
  const { getScheduler } = await import('../../scheduler/scheduler.js');
  const scheduler = getScheduler();

  switch (action) {
    case 'list':
      return await scheduler.getAllTasks();
    case 'create':
      return await scheduler.addTask(params as any);
    case 'update': {
      const p = params as { id: string; updates: Record<string, unknown> };
      return await scheduler.updateTask(p.id, p.updates);
    }
    case 'delete':
      return await scheduler.deleteTask(params as string);
    case 'trigger':
      return await scheduler.triggerTask(params as string);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

function formatTaskList(tasks: unknown[]): string {
  if (!tasks || tasks.length === 0) {
    return '目前没有任何定时任务。';
  }

  let output = `共有 ${tasks.length} 个定时任务：\n\n`;

  for (const task of tasks as any[]) {
    const status = task.enabled ? '✅ 已启用' : '❌ 已禁用';
    const scheduleType = task.schedule?.type || 'unknown';
    let schedule = '';

    if (scheduleType === 'cron') {
      schedule = `Cron: ${task.schedule?.cron || '-'}`;
    } else if (scheduleType === 'interval') {
      schedule = `间隔: ${task.schedule?.intervalMs}ms`;
    } else if (scheduleType === 'one-time') {
      schedule = `执行时间: ${task.schedule?.startTime ? new Date(task.schedule.startTime).toLocaleString() : '-'}`;
    }

    output += `【${task.name}】${status}\n`;
    output += `  ID: ${task.id}\n`;
    output += `  描述: ${task.description || '-'}\n`;
    output += `  调度: ${schedule}\n`;
    output += `  执行: ${task.execution?.taskDescription || '-'}\n`;
    if (task.nextRun) {
      output += `  下次执行: ${new Date(task.nextRun).toLocaleString()}\n`;
    }
    output += '\n';
  }

  return output;
}

export const schedulerTool = tool(
  async (params: SchedulerAction): Promise<SchedulerToolResult> => {
    const startTime = Date.now();
    const { action, id, task, updates } = params;

    log('info', `Starting scheduler action: ${action}`);

    // 参数验证
    if (action === 'create' && !task) {
      return { success: false, output: '创建任务需要提供 task 参数' };
    }
    if ((action === 'update' || action === 'delete' || action === 'trigger') && !id) {
      return { success: false, output: `${action} 操作需要提供任务 ID` };
    }

    try {
      let result: unknown;
      let output: string;

      switch (action) {
        case 'list': {
          result = await invokeScheduler('list');
          output = formatTaskList(result as unknown[]);
          break;
        }

        case 'create': {
          const taskInput = task!;
          const transformedTask = {
            name: taskInput.name,
            description: taskInput.description || '',
            enabled: taskInput.enabled !== false,
            schedule: {
              type: taskInput.scheduleType as 'cron' | 'interval' | 'one-time',
              cron: taskInput.cron,
              intervalMs: taskInput.intervalMs,
              startTime: taskInput.startTime,
            },
            execution: {
              taskDescription: taskInput.taskDescription || taskInput.name,
              timeout: taskInput.timeout || 300000,
              maxRetries: taskInput.maxRetries || 0,
              retryDelayMs: taskInput.retryDelayMs || 1000,
            },
          };
          result = await invokeScheduler('create', transformedTask);
          output = `✅ 定时任务 "${taskInput.name}" 创建成功！\n\n任务详情：\n- 调度类型: ${taskInput.scheduleType}\n${
            taskInput.scheduleType === 'cron'
              ? `- Cron: ${taskInput.cron}`
              : taskInput.scheduleType === 'interval'
                ? `- 间隔: ${taskInput.intervalMs}ms`
                : `- 执行时间: ${taskInput.startTime ? new Date(taskInput.startTime).toLocaleString() : '-'}`
          }\n- 任务描述: ${taskInput.taskDescription}\n- 状态: ${taskInput.enabled !== false ? '已启用' : '已禁用'}`;
          break;
        }

        case 'update': {
          result = await invokeScheduler('update', { id, updates });
          output = `✅ 定时任务更新成功！\n\n任务ID: ${id}\n更新的字段: ${Object.keys(updates || {}).join(', ')}`;
          break;
        }

        case 'delete': {
          result = await invokeScheduler('delete', id);
          output = `✅ 定时任务删除成功！\n\n任务ID: ${id}`;
          break;
        }

        case 'trigger': {
          result = await invokeScheduler('trigger', id);
          output = `✅ 定时任务触发成功！\n\n任务ID: ${id}\n任务已开始执行。`;
          break;
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      const duration = Date.now() - startTime;
      log('info', `Scheduler action completed: ${action}`, { duration });

      return {
        success: true,
        output,
        metadata: { action, duration, result },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || String(error);
      log('error', `Scheduler action failed: ${action}`, { error: errorMessage, duration });

      return {
        success: false,
        output: `❌ 操作失败: ${errorMessage}`,
        metadata: { action, duration, error: errorMessage },
      };
    }
  },
  {
    name: 'scheduler',
    description: `管理定时任务（Cron任务）。可以：
- list: 列出所有定时任务
- create: 创建新的定时任务（需要提供任务名称、调度类型等参数）
- update: 更新现有定时任务（需要提供任务ID和要更新的字段）
- delete: 删除定时任务（需要提供任务ID）
- trigger: 手动触发定时任务执行（需要提供任务ID）

使用示例：
- 列出所有定时任务
- 创建一个每天上午9点执行的定时任务，任务名称是"每日报告"
- 删除任务ID为 xxx 的定时任务
- 手动触发任务xxx执行`,
    schema: SchedulerActionSchema,
  }
);

export default schedulerTool;
