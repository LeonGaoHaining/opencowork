export interface SkillFrontmatter {
  name?: string;
  description?: string;
  argumentHint?: string;
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  allowedTools?: string[];
  context?: 'fork';
  agent?: 'Explore' | 'Plan' | 'general-purpose';
  effort?: 'low' | 'medium' | 'high' | 'max';
  paths?: string[];
  shell?: 'bash' | 'powershell';
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
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return {
      frontmatter: {},
      body: content,
    };
  }

  const [, yamlStr, body] = match;
  const frontmatter: SkillFrontmatter = {};

  yamlStr.split('\n').forEach((line) => {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/['"]/g, ''));
      (frontmatter as any)[key] = items;
    } else if (value === 'true') {
      (frontmatter as any)[key] = true;
    } else if (value === 'false') {
      (frontmatter as any)[key] = false;
    } else {
      (frontmatter as any)[key] = value.replace(/['"]/g, '');
    }
  });

  return { frontmatter, body };
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
