/**
 * SkillToolFactory - 将 Skills 转换为 LangChain Tools
 * 使 Agent 能够通过意图识别和用户指定来执行已安装的 Skills
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { InstalledSkill } from '../../skills/skillManifest';
import { getSkillRunner, SkillRunner } from '../../skills/skillRunner';

export interface SkillToolConfig {
  skillRunner?: SkillRunner;
}

export class SkillToolFactory {
  private skillRunner: SkillRunner;

  constructor(config?: SkillToolConfig) {
    this.skillRunner = config?.skillRunner || getSkillRunner();
  }

  /**
   * 从已安装的 Skills 创建 LangChain Tools
   */
  createToolsFromSkills(skills: InstalledSkill[]): any[] {
    console.log('[SkillToolFactory] Creating tools from', skills.length, 'skills');

    const tools: any[] = [];

    for (const skill of skills) {
      if (!skill.enabled) {
        console.log(`[SkillToolFactory] Skipping disabled skill: ${skill.manifest.name}`);
        continue;
      }

      try {
        const skillTool = this.createSkillTool(skill);
        tools.push(skillTool);
        console.log(`[SkillToolFactory] Created tool for skill: ${skill.manifest.name}`);
      } catch (error) {
        console.error(
          `[SkillToolFactory] Failed to create tool for skill ${skill.manifest.name}:`,
          error
        );
      }
    }

    console.log(`[SkillToolFactory] Created ${tools.length} skill tools`);
    return tools;
  }

  /**
   * 从单个 Skill 创建 LangChain Tool
   */
  private createSkillTool(skill: InstalledSkill) {
    const skillName = this.normalizeSkillName(skill.manifest.name);
    const description = skill.manifest.description || `执行 ${skill.manifest.name} 技能`;

    const SkillArgsSchema = z.object({
      input: z.string().describe('用户输入或任务描述'),
    });

    const skillRunner = this.skillRunner;

    const skillTool = tool(
      async (params: {
        input: string;
      }): Promise<{ success: boolean; output: string; error?: string }> => {
        console.log(`[SkillTool:${skillName}] Executing with input:`, params.input);

        try {
          const result = await skillRunner.executeSkill(skill, [params.input]);

          if (result.success) {
            console.log(`[SkillTool:${skillName}] Success:`, result.output?.substring(0, 100));
            return {
              success: true,
              output: result.output || 'Skill 执行完成',
            };
          } else {
            console.error(`[SkillTool:${skillName}] Failed:`, result.error);
            return {
              success: false,
              output: '',
              error: result.error || 'Skill 执行失败',
            };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[SkillTool:${skillName}] Error:`, errorMessage);
          return {
            success: false,
            output: '',
            error: errorMessage,
          };
        }
      },
      {
        name: skillName,
        description,
        schema: SkillArgsSchema,
      }
    );

    return skillTool;
  }

  /**
   * 规范化 Skill 名称为合法的 tool 名称
   * 移除空格和特殊字符
   */
  private normalizeSkillName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 50);
  }
}

let skillToolFactoryInstance: SkillToolFactory | null = null;

export function getSkillToolFactory(): SkillToolFactory {
  if (!skillToolFactoryInstance) {
    skillToolFactoryInstance = new SkillToolFactory();
  }
  return skillToolFactoryInstance;
}

export function createSkillToolFactory(config?: SkillToolConfig): SkillToolFactory {
  skillToolFactoryInstance = new SkillToolFactory(config);
  return skillToolFactoryInstance;
}
