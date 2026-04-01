import { SkillLoader } from '../skills/skillLoader';
import { SkillRunner } from '../skills/skillRunner';
export class SkillAwareAgent {
    skillLoader;
    skillRunner;
    config;
    constructor(config) {
        this.config = config || {};
        this.skillLoader = new SkillLoader(this.config.skillsDirs);
        this.skillRunner = new SkillRunner();
    }
    async executeTask(task, args = []) {
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
    async executeWithSkill(skill, task, args) {
        try {
            const result = await this.skillRunner.executeSkillWithTimeout(skill, args, this.config.defaultTimeout);
            return {
                success: result.success,
                output: result.output,
                error: result.error,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async listAvailableSkills() {
        return this.skillLoader.loadAllSkills();
    }
    async getSkill(name) {
        return this.skillLoader.getSkill(name);
    }
    setSkillsDirs(dirs) {
        this.skillLoader = new SkillLoader(dirs);
    }
}
let skillAwareAgentInstance = null;
export function getSkillAwareAgent() {
    if (!skillAwareAgentInstance) {
        skillAwareAgentInstance = new SkillAwareAgent();
    }
    return skillAwareAgentInstance;
}
export function createSkillAwareAgent(config) {
    skillAwareAgentInstance = new SkillAwareAgent(config);
    return skillAwareAgentInstance;
}
