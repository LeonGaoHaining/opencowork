import * as fs from 'fs';
import * as path from 'path';
import {
  TaskResult,
  TaskRun,
  TaskTemplate,
  TaskTemplateInputField,
  TaskWorkflowPack,
  createTaskEntityId,
} from './types';
import { getTaskRunRepository } from './TaskRunRepository';
import { getTaskResultRepository } from './TaskResultRepository';
import { buildTemplatesFromWorkflowPack } from './workflowPacks';

function inferExecutionProfileFromRun(run: { metadata?: Record<string, unknown> }): 'browser-first' | 'mixed' {
  const metadata = run.metadata && typeof run.metadata === 'object' ? run.metadata : null;
  const executionMode = metadata?.executionMode;
  if (executionMode === 'visual' || executionMode === 'hybrid') {
    return 'mixed';
  }

  const taskRouting = metadata?.taskRouting && typeof metadata.taskRouting === 'object'
    ? (metadata.taskRouting as Record<string, unknown>)
    : null;
  const routedExecutionMode = taskRouting?.executionMode;
  if (routedExecutionMode === 'visual' || routedExecutionMode === 'hybrid') {
    return 'mixed';
  }

  return 'browser-first';
}

function inferExecutionModeFromRun(run: { metadata?: Record<string, unknown> }): 'dom' | 'visual' | 'hybrid' | undefined {
  const metadata = run.metadata && typeof run.metadata === 'object' ? run.metadata : null;
  const executionMode = metadata?.executionMode;
  if (executionMode === 'dom' || executionMode === 'visual' || executionMode === 'hybrid') {
    return executionMode;
  }

  const taskRouting = metadata?.taskRouting && typeof metadata.taskRouting === 'object'
    ? (metadata.taskRouting as Record<string, unknown>)
    : null;
  const routedExecutionMode = taskRouting?.executionMode;
  if (routedExecutionMode === 'dom' || routedExecutionMode === 'visual' || routedExecutionMode === 'hybrid') {
    return routedExecutionMode;
  }

  return undefined;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3).trim()}...`;
}

function formatSessionRunStep(index: number, run: TaskRun, result: TaskResult | null): string {
  const executionMode = inferExecutionModeFromRun(run) || 'dom';
  const summary = result?.summary || run.title;
  return [
    `成功轮次 ${index}:`,
    `目标: ${run.input.prompt || run.title}`,
    `执行方式: ${executionMode}`,
    `成功结果: ${summary}`,
    `来源 Run: ${run.id}`,
  ].join('\n');
}

export class TaskTemplateRepository {
  private filePath: string;

  constructor(filePath?: string) {
    const configDir = process.env.OPENWORK_CONFIG_DIR || path.join(process.cwd(), 'config');
    this.filePath = filePath || path.join(configDir, 'task-templates.json');
  }

  private loadAllSync(): TaskTemplate[] {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as TaskTemplate[]) : [];
    } catch (error) {
      console.error('[TaskTemplateRepository] Failed to load templates:', error);
      return [];
    }
  }

  private saveAllSync(templates: TaskTemplate[]): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(templates, null, 2), 'utf-8');
  }

  async list(): Promise<TaskTemplate[]> {
    return this.loadAllSync();
  }

  async getById(id: string): Promise<TaskTemplate | null> {
    return this.loadAllSync().find((template) => template.id === id) || null;
  }

  async create(template: TaskTemplate): Promise<void> {
    const templates = this.loadAllSync();
    templates.push(template);
    this.saveAllSync(templates);
  }

  async installWorkflowPack(pack: TaskWorkflowPack): Promise<TaskTemplate[]> {
    const templates = this.loadAllSync();
    const packTemplates = buildTemplatesFromWorkflowPack(pack);

    for (const packTemplate of packTemplates) {
      const existingIndex = templates.findIndex((item) => item.id === packTemplate.id);
      if (existingIndex === -1) {
        templates.push(packTemplate);
        continue;
      }

      templates[existingIndex] = {
        ...templates[existingIndex],
        ...packTemplate,
        createdAt: templates[existingIndex].createdAt,
        updatedAt: Date.now(),
      };
    }

    this.saveAllSync(templates);
    return packTemplates.map((packTemplate) =>
      templates.find((item) => item.id === packTemplate.id) || packTemplate
    );
  }

  async update(template: TaskTemplate): Promise<void> {
    const templates = this.loadAllSync();
    const index = templates.findIndex((item) => item.id === template.id);
    if (index === -1) {
      throw new Error(`Template not found: ${template.id}`);
    }
    templates[index] = {
      ...template,
      updatedAt: Date.now(),
    };
    this.saveAllSync(templates);
  }

  async delete(id: string): Promise<void> {
    const templates = this.loadAllSync();
    this.saveAllSync(templates.filter((template) => template.id !== id));
  }

  async createFromHistory(params: {
    name: string;
    description: string;
    prompt: string;
    origin?: {
      runId?: string;
      source?: 'chat' | 'scheduler' | 'im' | 'mcp' | 'replay';
      executionMode?: 'dom' | 'visual' | 'hybrid';
    };
    inputSchema?: Record<string, TaskTemplateInputField | string>;
    defaultInput?: Record<string, unknown>;
    executionProfile?: 'browser-first' | 'mixed';
    recommendedSkills?: string[];
  }): Promise<TaskTemplate> {
    const now = Date.now();
    const template: TaskTemplate = {
      id: createTaskEntityId('template'),
      name: params.name,
      description: params.description,
      origin: params.origin,
      inputSchema: params.inputSchema || {
        prompt: 'Prompt',
      },
      defaultInput: {
        prompt: params.prompt,
        ...(params.defaultInput || {}),
      },
      executionProfile: params.executionProfile || 'browser-first',
      recommendedSkills: params.recommendedSkills,
      createdAt: now,
      updatedAt: now,
    };
    await this.create(template);
    return template;
  }

  async createFromRun(runId: string): Promise<TaskTemplate> {
    const run = getTaskRunRepository().getById(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const result = run.resultId ? getTaskResultRepository().getById(run.resultId) : null;
    const now = Date.now();
    const defaultPrompt = run.input.prompt || run.title || 'Reusable task';
    const description = result?.summary || defaultPrompt;
    const inputSchema: Record<string, TaskTemplateInputField | string> = {
      prompt: 'Prompt',
    };

    if (run.input.params && Object.keys(run.input.params).length > 0) {
      for (const key of Object.keys(run.input.params)) {
        inputSchema[key] = {
          label: key,
          required: false,
        };
      }
    }

    const template: TaskTemplate = {
      id: createTaskEntityId('template'),
      name: run.title || 'Reusable task',
      description,
      origin: {
        runId: run.id,
        source: run.source,
        executionMode: inferExecutionModeFromRun(run),
      },
      inputSchema,
      defaultInput: {
        prompt: defaultPrompt,
        ...(run.input.params || {}),
      },
      executionProfile: inferExecutionProfileFromRun(run),
      recommendedSkills: Array.isArray(run.metadata?.recommendedSkills)
        ? (run.metadata?.recommendedSkills as string[])
        : undefined,
      createdAt: now,
      updatedAt: now,
    };

    await this.create(template);
    return template;
  }

  async createFromSession(params: {
    sessionId: string;
    sessionName?: string;
    currentRunId?: string;
  }): Promise<TaskTemplate> {
    const runRepository = getTaskRunRepository();
    let runs = runRepository
      .list()
      .filter(
        (run) =>
          run.sessionId === params.sessionId &&
          run.source === 'chat' &&
          run.status === 'completed' &&
          !!run.input.prompt
      )
      .sort((left, right) => (left.startedAt || 0) - (right.startedAt || 0));

    if (runs.length === 0 && params.currentRunId) {
      const currentRun = runRepository.getById(params.currentRunId);
      const threadId =
        currentRun?.metadata && typeof currentRun.metadata.threadId === 'string'
          ? currentRun.metadata.threadId
          : undefined;
      if (threadId) {
        runs = runRepository
          .list()
          .filter(
            (run) =>
              run.source === 'chat' &&
              run.status === 'completed' &&
              !!run.input.prompt &&
              run.metadata?.threadId === threadId
          )
          .sort((left, right) => (left.startedAt || 0) - (right.startedAt || 0));
      }
    }

    if (runs.length === 0) {
      throw new Error('No successful chat runs found for this session');
    }

    const resultRepository = getTaskResultRepository();
    const steps = runs.map((run, index) =>
      formatSessionRunStep(index + 1, run, run.resultId ? resultRepository.getById(run.resultId) : null)
    );
    const recommendedSkills = Array.from(
      new Set(
        runs.flatMap((run) =>
          Array.isArray(run.metadata?.recommendedSkills)
            ? (run.metadata.recommendedSkills as string[])
            : []
        )
      )
    );
    const hasMixedExecution = runs.some((run) => inferExecutionProfileFromRun(run) === 'mixed');
    const prompt = truncateText(
      [
        '这是从一次多轮成功会话沉淀出的流程模板。只复用成功完成的轮次，忽略失败、取消或等待确认的尝试。',
        '',
        ...steps,
        '',
        '请按上述成功流程完成同类任务。',
      ].join('\n\n'),
      12000
    );
    const now = Date.now();
    const template: TaskTemplate = {
      id: createTaskEntityId('template'),
      name: truncateText(params.sessionName || runs[runs.length - 1].title || 'Session success workflow', 60),
      description: `Reusable workflow from ${runs.length} successful chat run${runs.length === 1 ? '' : 's'}`,
      origin: {
        sessionId: params.sessionId,
        runIds: runs.map((run) => run.id),
        source: 'chat',
      },
      inputSchema: {
        prompt: 'Prompt',
      },
      defaultInput: {
        prompt,
      },
      executionProfile: hasMixedExecution ? 'mixed' : 'browser-first',
      recommendedSkills: recommendedSkills.length > 0 ? recommendedSkills : undefined,
      createdAt: now,
      updatedAt: now,
    };

    await this.create(template);
    return template;
  }
}

let taskTemplateRepository: TaskTemplateRepository | null = null;

export function getTaskTemplateRepository(): TaskTemplateRepository {
  if (!taskTemplateRepository) {
    taskTemplateRepository = new TaskTemplateRepository();
  }
  return taskTemplateRepository;
}
