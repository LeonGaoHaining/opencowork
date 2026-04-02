import * as fs from 'fs';
import * as path from 'path';
import { getSkillLoader } from './skillLoader';
export class SkillMarket {
    skillsDir;
    loader;
    constructor(skillsDir, loader) {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
        this.skillsDir = skillsDir || path.join(homeDir, '.opencowork', 'skills');
        this.loader = loader || getSkillLoader();
    }
    async listInstalledSkills() {
        const skills = await this.loader.loadAllSkills();
        return skills.map((s) => ({
            name: s.manifest.name,
            version: s.version,
            description: s.manifest.description,
            path: s.path,
            installed: true,
        }));
    }
    async installSkill(skillPath) {
        try {
            const resolvedPath = path.resolve(skillPath);
            const manifestPath = path.join(resolvedPath, 'SKILL.md');
            const stats = await fs.promises.stat(resolvedPath);
            if (!stats.isDirectory()) {
                return { success: false, error: 'Source must be a directory' };
            }
            const manifestStats = await fs.promises.stat(manifestPath).catch(() => null);
            if (!manifestStats || !manifestStats.isFile()) {
                return { success: false, error: 'Source directory must contain SKILL.md' };
            }
            if (!fs.existsSync(this.skillsDir)) {
                await fs.promises.mkdir(this.skillsDir, { recursive: true });
            }
            const skillName = path.basename(resolvedPath);
            const targetPath = path.join(this.skillsDir, skillName);
            if (fs.existsSync(targetPath)) {
                return {
                    success: false,
                    error: 'Skill with this name already exists. Please uninstall first.',
                };
            }
            await fs.promises.cp(resolvedPath, targetPath, { recursive: true });
            this.loader.clearCache();
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async uninstallSkill(skillName) {
        try {
            const skillPath = path.join(this.skillsDir, skillName);
            const stats = await fs.promises.stat(skillPath);
            if (!stats.isDirectory()) {
                return { success: false, error: 'Skill not found' };
            }
            await fs.promises.rm(skillPath, { recursive: true });
            this.loader.clearCache();
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async updateSkill(skillName) {
        try {
            const skill = await this.loader.getSkill(skillName);
            if (!skill) {
                return { success: false, error: 'Skill not found' };
            }
            return { success: false, error: 'Update not implemented - please uninstall and reinstall' };
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }
    async getSkillInfo(skillName) {
        const skill = await this.loader.getSkill(skillName);
        if (!skill) {
            return null;
        }
        return {
            name: skill.manifest.name,
            version: skill.version,
            description: skill.manifest.description,
            path: skill.path,
            installed: true,
        };
    }
    async getSkillsDirectory() {
        if (!fs.existsSync(this.skillsDir)) {
            await fs.promises.mkdir(this.skillsDir, { recursive: true });
        }
        return this.skillsDir;
    }
    async createSkillDirectory() {
        if (!fs.existsSync(this.skillsDir)) {
            await fs.promises.mkdir(this.skillsDir, { recursive: true });
        }
        return this.skillsDir;
    }
    cleanup() {
        console.log('[SkillMarket] Cleaned up');
    }
}
let skillMarketInstance = null;
export function getSkillMarket() {
    if (!skillMarketInstance) {
        skillMarketInstance = new SkillMarket();
    }
    return skillMarketInstance;
}
export function createSkillMarket(skillsDir) {
    const oldMarket = skillMarketInstance;
    skillMarketInstance = new SkillMarket(skillsDir);
    if (oldMarket) {
        oldMarket.cleanup();
    }
    return skillMarketInstance;
}
export function resetSkillMarket() {
    if (skillMarketInstance) {
        skillMarketInstance.cleanup();
        skillMarketInstance = null;
    }
}
