import * as yaml from 'js-yaml';

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  argumentHint?: string;
  useCases?: string[];
  inputSpec?: string;
  outputSpec?: string;
  failureHints?: string[];
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  allowedTools?: string[];
  platforms?: string[];
  tags?: string[];
  usageCount?: number;
  version?: string;
  source?: 'official' | 'agent-created' | 'market';
  context?: 'fork';
  agent?: 'Explore' | 'Plan' | 'general-purpose';
  effort?: 'low' | 'medium' | 'high' | 'max';
  paths?: string[];
  shell?: 'bash' | 'powershell';
  triggers?: SkillTrigger[];
  'openworks-only'?: {
    'max-steps'?: number;
    timeout?: number;
  };
}

export interface SkillTrigger {
  type: 'keyword' | 'pattern' | 'intent';
  value: string[];
  priority: number;
  exclusive?: boolean;
}

export interface OpenCoworkExtension {
  maxSteps?: number;
  timeout?: number;
}

export interface SkillManifest {
  name: string;
  description: string;
  content: string;
  frontmatter: SkillFrontmatter;
  directory: string;
  source?: 'official' | 'agent-created' | 'market';
  files?: {
    path: string;
    content: string;
  }[];
  triggers?: SkillTrigger[];
  opencowork?: OpenCoworkExtension;
}

export interface InstalledSkill {
  manifest: SkillManifest;
  path: string;
  enabled: boolean;
  source?: 'official' | 'agent-created' | 'market';
  version?: string;
  author?: string;
}

export interface SkillExecutionContext {
  sessionId: string;
  skillDir: string;
  arguments: string[];
  userInvoked: boolean;
}

export function parseSkillFrontmatter(content: string): {
  frontmatter: SkillFrontmatter;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return {
      frontmatter: {},
      body: content,
    };
  }

  const [, yamlStr, body] = match;

  let frontmatter: SkillFrontmatter = {};
  try {
    const parsed = yaml.load(yamlStr) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      frontmatter = normalizeFrontmatter(parsed);
    }
  } catch (error) {
    console.warn('[SkillManifest] Failed to parse YAML frontmatter:', error);
    return {
      frontmatter: {},
      body: content,
    };
  }

  return { frontmatter, body };
}

function normalizeFrontmatter(parsed: Record<string, unknown>): SkillFrontmatter {
  const frontmatter: SkillFrontmatter = {};

  for (const [key, value] of Object.entries(parsed)) {
    switch (key) {
      case 'name':
      case 'description':
      case 'argumentHint':
      case 'inputSpec':
      case 'outputSpec':
      case 'version':
        frontmatter[key] = typeof value === 'string' ? value : String(value);
        break;
      case 'shell':
        if (value === 'bash' || value === 'powershell') {
          frontmatter.shell = value;
        }
        break;
      case 'disableModelInvocation':
      case 'userInvocable':
        frontmatter[key] = typeof value === 'boolean' ? value : value === 'true';
        break;
      case 'allowedTools':
      case 'platforms':
      case 'useCases':
      case 'failureHints':
        if (Array.isArray(value)) {
          frontmatter[key] = value.map((v) => String(v));
        }
        break;
      case 'context':
        if (value === 'fork') {
          frontmatter.context = 'fork';
        }
        break;
      case 'source':
        if (value === 'official' || value === 'agent-created' || value === 'market') {
          frontmatter.source = value;
        }
        break;
      case 'agent':
        if (value === 'Explore' || value === 'Plan' || value === 'general-purpose') {
          frontmatter.agent = value;
        }
        break;
      case 'effort':
        if (value === 'low' || value === 'medium' || value === 'high' || value === 'max') {
          frontmatter.effort = value;
        }
        break;
      case 'triggers':
        if (Array.isArray(value)) {
          const triggers: SkillTrigger[] = [];
          for (const trigger of value) {
            if (typeof trigger === 'object' && trigger !== null) {
              const t = trigger as Record<string, unknown>;
              const triggerValue = Array.isArray(t.value) ? t.value.map((v) => String(v)) : [];
              triggers.push({
                type: (t.type as 'keyword' | 'pattern' | 'intent') || 'keyword',
                value: triggerValue,
                priority: typeof t.priority === 'number' ? t.priority : 50,
                exclusive: t.exclusive === true,
              });
            }
          }
          frontmatter.triggers = triggers;
        }
        break;
      case 'openworks-only':
        if (typeof value === 'object' && value !== null) {
          const ext = value as Record<string, unknown>;
          frontmatter['openworks-only'] = {
            'max-steps': typeof ext['max-steps'] === 'number' ? ext['max-steps'] : undefined,
            timeout: typeof ext.timeout === 'number' ? ext.timeout : undefined,
          };
        }
        break;
      default:
        break;
    }
  }

  return frontmatter;
}

export function validateSkillManifest(manifest: SkillManifest): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!manifest.name) {
    errors.push('Skill name is required');
  }

  if (!manifest.description) {
    errors.push('Skill description is recommended');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
