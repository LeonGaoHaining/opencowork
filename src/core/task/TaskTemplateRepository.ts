import * as fs from 'fs';
import * as path from 'path';
import { TaskTemplate, TaskTemplateInputField, TaskWorkflowPack, createTaskEntityId } from './types';
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
}

let taskTemplateRepository: TaskTemplateRepository | null = null;

export function getTaskTemplateRepository(): TaskTemplateRepository {
  if (!taskTemplateRepository) {
    taskTemplateRepository = new TaskTemplateRepository();
  }
  return taskTemplateRepository;
}
