/**
 * ListSkillsTool - 列出已安装的 Skills
 * 用于让 Agent 查询系统中已安装的 Skills
 */

import { tool } from '@langchain/core/tools';
import { SkillMarket } from '../../skills/skillMarket';

export const listSkillsTool = tool(
  async (): Promise<{ success: boolean; output: string }> => {
    try {
      const market = new SkillMarket();
      const skills = await market.listInstalledSkills();

      if (skills.length === 0) {
        return { success: true, output: '目前没有安装任何 Skill' };
      }

      const list = skills.map((s) => `- ${s.name}: ${s.description || '无描述'}`).join('\n');

      return { success: true, output: `已安装的 Skills:\n${list}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, output: `获取 Skills 失败: ${errorMessage}` };
    }
  },
  {
    name: 'list_skills',
    description:
      '列出所有已安装的 Skills。返回已安装的 Skill 名称和描述列表。使用场景：用户询问有哪些 skill 或列出所有技能。',
  }
);
