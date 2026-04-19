/**
 * SkillToolFactory - 将 Skills 转换为 LangChain Tools
 * 使 Agent 能够通过意图识别和用户指定来执行已安装的 Skills
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { InstalledSkill } from '../../skills/skillManifest';
import { getSkillLoader } from '../../skills/skillLoader';
import { getSkillRunner, SkillRunner } from '../../skills/skillRunner';

export interface ScriptInfo {
  scriptPath: string;
  baseDir: string;
  commandTemplate?: string;
}

export interface SkillToolConfig {
  skillRunner?: SkillRunner;
}

export interface SkillToolLevelConfig {
  level?: 0 | 1 | 2;
  summaryContent?: string;
}

export class SkillToolFactory {
  private skillRunner: SkillRunner;

  constructor(config?: SkillToolConfig) {
    this.skillRunner = config?.skillRunner || getSkillRunner();
  }

  /**
   * 从已安装的 Skills 创建 LangChain Tools
   */
  createToolsFromSkills(skills: InstalledSkill[], levelConfig?: SkillToolLevelConfig): any[] {
    console.log('[SkillToolFactory] Creating tools from', skills.length, 'skills');

    const tools: any[] = [];

    for (const skill of skills) {
      if (!skill.enabled) {
        console.log(`[SkillToolFactory] Skipping disabled skill: ${skill.manifest.name}`);
        continue;
      }

      try {
        const skillTool = this.createSkillTool(skill, levelConfig);
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
  private createSkillTool(skill: InstalledSkill, levelConfig?: SkillToolLevelConfig) {
    const skillName = this.normalizeSkillName(skill.manifest.name);
    const description = this.buildToolDescription(skill, levelConfig);

    // 检测是否有 scripts 目录
    const scriptInfo = this.getScriptInfo(skill);

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
          const fullSkill = await this.loadFullSkill(skill);

          // 先执行 skillRunner 获取 SKILL.md 内容
          const result = await skillRunner.executeSkill(fullSkill, [params.input]);

          if (result.success) {
            console.log(`[SkillTool:${skillName}] Success:`, result.output?.substring(0, 100));

            let output = result.output || 'Skill 执行完成';

            // 如果有 scripts 目录，追加脚本信息
            if (scriptInfo) {
              output += this.buildScriptInfoOutput(scriptInfo);
              console.log(`[SkillTool:${skillName}] Script detected:`, scriptInfo.scriptPath);
            }

            return {
              success: true,
              output,
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

  private buildToolDescription(skill: InstalledSkill, levelConfig?: SkillToolLevelConfig): string {
    const summaryContent = levelConfig?.summaryContent?.trim();

    if (levelConfig?.level === 0 && summaryContent) {
      return `${skill.manifest.name}: ${summaryContent}`;
    }

    if (levelConfig?.level === 1 && summaryContent) {
      return `${skill.manifest.description || `执行 ${skill.manifest.name} 技能`}\n${summaryContent}`;
    }

    return skill.manifest.description || `执行 ${skill.manifest.name} 技能`;
  }

  private async loadFullSkill(skill: InstalledSkill): Promise<InstalledSkill> {
    const loader = getSkillLoader();
    const fullSkill = await loader.getSkill(skill.manifest.name);
    if (!fullSkill) {
      return skill;
    }
    return fullSkill;
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

  /**
   * 检测 skill 是否有 scripts 目录
   */
  public getScriptInfo(skill: InstalledSkill): ScriptInfo | null {
    const scriptsDir = path.join(skill.manifest.directory, 'scripts');

    if (!fs.existsSync(scriptsDir)) {
      return null;
    }

    try {
      const files = fs.readdirSync(scriptsDir);
      const pythonScripts = files.filter((f) => f.endsWith('.py'));

      if (pythonScripts.length === 0) {
        return null;
      }

      // 优先查找 create_*.py, main.py, 或第一个 .py 文件
      const mainScript =
        pythonScripts.find((f) => f.startsWith('create_')) ||
        pythonScripts.find((f) => f === 'main.py') ||
        pythonScripts[0];

      const scriptPath = path.join(scriptsDir, mainScript);

      // 提取命令模板
      const commandTemplate = this.extractCommandTemplate(
        skill.manifest.content,
        skill.manifest.directory
      );

      return {
        scriptPath,
        baseDir: skill.manifest.directory,
        commandTemplate: commandTemplate || undefined,
      };
    } catch (error) {
      console.warn(`[SkillToolFactory] Failed to read scripts dir:`, error);
      return null;
    }
  }

  /**
   * 从 SKILL.md 内容中提取 bash 命令模板
   */
  private extractCommandTemplate(content: string, baseDir: string): string | null {
    const bashBlockRegex = /```bash\n([\s\S]*?)```/g;
    let match;

    while ((match = bashBlockRegex.exec(content)) !== null) {
      const codeBlock = match[1];
      // 查找包含 python3 的命令
      const pythonCmdMatch = codeBlock.match(/python3\s+([^\n]+)/);
      if (pythonCmdMatch) {
        // 替换 {baseDir} 为实际路径
        let cmd = pythonCmdMatch[1].trim();
        cmd = cmd.replace(/\{baseDir\}/g, baseDir);
        return cmd;
      }
    }

    return null;
  }

  /**
   * 构建脚本信息输出
   */
  public buildScriptInfoOutput(scriptInfo: ScriptInfo): string {
    return `
---
【可执行脚本】
脚本路径: ${scriptInfo.scriptPath}
${scriptInfo.commandTemplate ? `命令模板: ${scriptInfo.commandTemplate}` : '用法: 请参考上方 bash 示例'}
提示:
- 请使用 cli 工具执行上述命令
- 当输入内容较长、包含 JSON、引号或多行文本时，不要直接拼接到 --content 参数
- 优先先写入临时文件，再通过 --content-file 或脚本支持的文件参数传入`;
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
