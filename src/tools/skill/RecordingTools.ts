/**
 * RecordingTools - LangChain Tools 用于录制 Skill
 * 提供 start_skill_recording 和 finish_skill_recording 两个 Tool
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getSkillRecorder } from '../../skills/skillRecorder';
import { loadSkillTools } from '../../agents/mainAgent';

const StartRecordingSchema = z.object({
  skillName: z.string().describe('Skill 名称'),
  description: z.string().optional().describe('Skill 描述（可选）'),
});

const FinishRecordingSchema = z.object({
  triggers: z.array(z.string()).describe('触发关键词数组，用于匹配此 Skill'),
});

export const startRecordingTool = tool(
  async (params: {
    skillName: string;
    description?: string;
  }): Promise<{ success: boolean; output: string }> => {
    const recorder = getSkillRecorder();
    const result = recorder.startRecording(params.skillName, params.description || '');

    return {
      success: result.success,
      output: result.message,
    };
  },
  {
    name: 'start_skill_recording',
    description:
      '开始录制 Skill。当用户想要将当前执行的操作录制成可复用的 Skill 时使用此工具。\n\n参数：\n- skillName: Skill 名称（必填）\n- description: Skill 描述（可选）\n\n使用场景：\n- 用户说"把这个操作录制成 Skill"\n- 用户说"开始录制"\n\n录制开始后，所有后续执行的工具调用都会被记录。',
    schema: StartRecordingSchema,
  }
);

export const finishRecordingTool = tool(
  async (params: { triggers: string[] }): Promise<{ success: boolean; output: string }> => {
    const recorder = getSkillRecorder();

    if (!recorder.isCurrentlyRecording()) {
      return {
        success: false,
        output: '当前没有在录制，请先使用 start_skill_recording 开始录制',
      };
    }

    const result = await recorder.finishRecording(params.triggers);

    if (result.success && result.skillPath) {
      try {
        await loadSkillTools();
        console.log('[RecordingTools] Skills reloaded after recording');
      } catch (error) {
        console.error('[RecordingTools] Failed to reload skills:', error);
      }
    }

    return {
      success: result.success,
      output: result.message,
    };
  },
  {
    name: 'finish_skill_recording',
    description:
      '完成 Skill 录制并生成 Skill 文件。当用户确认操作已执行完毕，想要保存录制的 Skill 时使用。\n\n参数：\n- triggers: 触发关键词数组，用于后续匹配此 Skill\n\n使用场景：\n- 用户说"完成录制"\n- 用户说"保存 Skill"\n- Agent 判断任务执行完毕，自动调用\n\n注意：\n- 必须在 start_skill_recording 之后使用\n- triggers 建议包含 2-5 个关键词，用逗号分隔\n- 录制完成后 Skill 会自动加载，Agent 可以立即使用',
    schema: FinishRecordingSchema,
  }
);

export const recordingTools = [startRecordingTool, finishRecordingTool];
