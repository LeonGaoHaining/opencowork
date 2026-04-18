import * as fs from 'fs';
import * as path from 'path';
import type { SkillManifest, SkillFrontmatter } from './skillManifest';

export interface GeneratedSkillSource {
  taskId: string;
  createdAt: number;
  usageCount: number;
  actions: ActionInfo[];
}

interface ActionInfo {
  tool: string;
  args: unknown;
  result?: unknown;
  success: boolean;
}

export interface SkillGenerationResult {
  success: boolean;
  skill?: SkillManifest;
  error?: string;
}

const DEFAULT_SKILL_CONTENT = `# {name}

## When to Use
{description}

## Procedure
1. 

## Pitfalls
- 

## Verification

`;

export class SkillGenerator {
  private skillsDir: string;
  private agentCreatedDir: string;

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir;
    this.agentCreatedDir = path.join(skillsDir, 'agent-created');
    this.ensureDirectoryExists(this.agentCreatedDir);
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  shouldGenerate(actions: ActionInfo[]): boolean {
    const successfulActions = actions.filter((a) => a.success);

    if (successfulActions.length >= 5) {
      return true;
    }

    const hasErrorRecovery = actions.some((a) => !a.success) && actions.some((a) => a.success);
    if (hasErrorRecovery) {
      return true;
    }

    return false;
  }

  validate(skill: SkillManifest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!skill.name) {
      errors.push('Skill name is required');
    }

    if (!skill.description) {
      errors.push('Skill description is required');
    }

    if (!skill.frontmatter) {
      errors.push('Skill frontmatter is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async generateFromHistory(
    taskId: string,
    taskDescription: string,
    actions: ActionInfo[]
  ): Promise<SkillGenerationResult> {
    try {
      const skillName = this.generateSkillName(taskDescription);
      const skillDescription = this.generateSkillDescription(taskDescription, actions);

      const content = this.generateSkillContent(skillName, skillDescription, actions);

      const frontmatter: SkillFrontmatter = {
        name: skillName,
        description: skillDescription,
        version: '1.0.0',
        source: 'agent-created',
        userInvocable: true,
        context: 'fork',
      };

      const source: GeneratedSkillSource = {
        taskId,
        createdAt: Date.now(),
        usageCount: 0,
        actions: actions.slice(0, 10),
      };

      const skill: SkillManifest = {
        name: skillName,
        description: skillDescription,
        content,
        frontmatter,
        directory: this.agentCreatedDir,
      };

      const validation = this.validate(skill);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', '),
        };
      }

      const saved = await this.saveSkill(skill, source);
      if (!saved) {
        return {
          success: false,
          error: 'Failed to save skill',
        };
      }

      return {
        success: true,
        skill,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private generateSkillName(description: string): string {
    const cleanName = description
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);

    return cleanName || `generated-skill-${Date.now()}`;
  }

  private generateSkillDescription(description: string, actions: ActionInfo[]): string {
    const tools = [...new Set(actions.map((a) => a.tool))];

    if (tools.length <= 3) {
      return `${description} (using ${tools.join(', ')})`;
    }

    return `${description} (using ${tools.slice(0, 3).join(', ')} and ${tools.length - 3} more tools)`;
  }

  private generateSkillContent(name: string, description: string, actions: ActionInfo[]): string {
    const procedure = actions
      .filter((a) => a.success)
      .slice(0, 10)
      .map((action, index) => `${index + 1}. Use ${action.tool}`)
      .join('\n');

    const pitfalls = this.generatePitfalls(actions);

    const content = DEFAULT_SKILL_CONTENT.replace('{name}', name)
      .replace('{description}', description)
      .replace('1. \n', procedure || '1. Execute the required operations')
      .replace('- \n', pitfalls || '- None identified');

    return content;
  }

  private generatePitfalls(actions: ActionInfo[]): string {
    const pitfalls: string[] = [];
    const failedActions = actions.filter((a) => !a.success);

    if (failedActions.length > 0) {
      pitfalls.push(`Previous attempts failed with ${failedActions.length} errors`);
    }

    const uniqueTools = [...new Set(actions.map((a) => a.tool))];
    if (uniqueTools.length > 5) {
      pitfalls.push('Complex workflow with multiple tools');
    }

    return pitfalls.length > 0 ? pitfalls.join('\n- ') : '';
  }

  private async saveSkill(skill: SkillManifest, source: GeneratedSkillSource): Promise<boolean> {
    try {
      const yamlHeader = this.generateYamlHeader(skill.frontmatter, source);
      const fullContent = `---\n${yamlHeader}---\n\n${skill.content}`;

      const skillDir = path.join(this.agentCreatedDir, skill.name);
      if (!fs.existsSync(skillDir)) {
        fs.mkdirSync(skillDir, { recursive: true });
      }
      const filePath = path.join(skillDir, 'SKILL.md');

      try {
        fs.writeFileSync(filePath, fullContent, 'utf-8');
      } catch (writeError) {
        console.error('[SkillGenerator] Failed to write skill file:', writeError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[SkillGenerator] Failed to save skill:', error);
      return false;
    }
  }

  private generateYamlHeader(frontmatter: SkillFrontmatter, source: GeneratedSkillSource): string {
    const lines: string[] = [];

    if (frontmatter.name) {
      lines.push(`name: ${frontmatter.name}`);
    }
    if (frontmatter.description) {
      lines.push(`description: ${frontmatter.description}`);
    }
    if (frontmatter.version) {
      lines.push(`version: ${frontmatter.version}`);
    }
    if (frontmatter.source) {
      lines.push(`source: ${frontmatter.source}`);
    }
    if (frontmatter.platforms && frontmatter.platforms.length > 0) {
      lines.push(`platforms: [${frontmatter.platforms.join(', ')}]`);
    }
    lines.push(`usageCount: ${source.usageCount}`);
    lines.push('metadata:');
    lines.push(`  taskId: ${source.taskId}`);
    lines.push(`  createdAt: ${source.createdAt}`);

    return lines.join('\n');
  }
}

export function createSkillGenerator(skillsDir: string): SkillGenerator {
  return new SkillGenerator(skillsDir);
}
