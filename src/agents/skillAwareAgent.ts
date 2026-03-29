import { getSkillLoader, SkillLoader } from '../skills/skillLoader';
import { getSkillRunner, SkillRunner } from '../skills/skillRunner';
import { InstalledSkill } from '../skills/skillManifest';

export interface SkillAwareAgentConfig {
  skillsDirs?: string[];
  defaultTimeout?: number;
}

export interface TaskResult {
  success: boolean;
  output?: any;
  error?: string;
}

export class SkillAwareAgent {
  private skillLoader: SkillLoader;
  private skillRunner: SkillRunner;
  private config: SkillAwareAgentConfig;

  constructor(config?: SkillAwareAgentConfig) {
    this.config = config || {};
    this.skillLoader = new SkillLoader(this.config.skillsDirs);
    this.skillRunner = new SkillRunner();
  }

  async executeTask(task: string, args: string[] = []): Promise<TaskResult> {
    const matchedSkill = await this.skillLoader.matchSkill(task);

    if (matchedSkill) {
      console.log(`[SkillAwareAgent] Matched skill: ${matchedSkill.manifest.name}`);
      return this.executeWithSkill(matchedSkill, task, args);
    }

    return {
      success: false,
      error: 'No matching skill found',
    };
  }

  private async executeWithSkill(
    skill: InstalledSkill,
    task: string,
    args: string[]
  ): Promise<TaskResult> {
    try {
      const result = await this.skillRunner.executeSkillWithTimeout(
        skill,
        args,
        this.config.defaultTimeout
      );

      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async listAvailableSkills(): Promise<InstalledSkill[]> {
    return this.skillLoader.loadAllSkills();
  }

  async getSkill(name: string): Promise<InstalledSkill | null> {
    return this.skillLoader.getSkill(name);
  }

  setSkillsDirs(dirs: string[]): void {
    this.skillLoader = new SkillLoader(dirs);
  }
}

let skillAwareAgentInstance: SkillAwareAgent | null = null;

export function getSkillAwareAgent(): SkillAwareAgent {
  if (!skillAwareAgentInstance) {
    skillAwareAgentInstance = new SkillAwareAgent();
  }
  return skillAwareAgentInstance;
}

export function createSkillAwareAgent(config?: SkillAwareAgentConfig): SkillAwareAgent {
  skillAwareAgentInstance = new SkillAwareAgent(config);
  return skillAwareAgentInstance;
}
