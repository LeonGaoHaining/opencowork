import * as fs from 'fs';
import * as path from 'path';
import { InstalledSkill } from './skillManifest';
import { SkillLoader, getSkillLoader } from './skillLoader';

export interface SkillListing {
  name: string;
  version?: string;
  description: string;
  path: string;
  installed: boolean;
  updateAvailable?: boolean;
}

export class SkillMarket {
  private skillsDir: string;
  private loader: SkillLoader;

  constructor(skillsDir?: string, loader?: SkillLoader) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
    this.skillsDir = skillsDir || path.join(homeDir, '.opencowork', 'skills');
    this.loader = loader || getSkillLoader();
  }

  async listInstalledSkills(): Promise<SkillListing[]> {
    const skills = await this.loader.loadAllSkills();
    return skills.map((s) => ({
      name: s.manifest.name,
      version: s.version,
      description: s.manifest.description,
      path: s.path,
      installed: true,
    }));
  }

  async installSkill(skillPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const skillName = path.basename(skillPath);
      const targetPath = path.join(this.skillsDir, skillName);

      if (!fs.existsSync(this.skillsDir)) {
        await fs.promises.mkdir(this.skillsDir, { recursive: true });
      }

      const stats = await fs.promises.stat(skillPath);
      if (!stats.isDirectory()) {
        return { success: false, error: 'Source must be a directory' };
      }

      await fs.promises.cp(skillPath, targetPath, { recursive: true });
      this.loader.clearCache();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async uninstallSkill(skillName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const skillPath = path.join(this.skillsDir, skillName);
      const stats = await fs.promises.stat(skillPath);

      if (!stats.isDirectory()) {
        return { success: false, error: 'Skill not found' };
      }

      await fs.promises.rm(skillPath, { recursive: true });
      this.loader.clearCache();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async updateSkill(skillName: string): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'Update not implemented' };
  }

  async getSkillInfo(skillName: string): Promise<SkillListing | null> {
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

  async getSkillsDirectory(): Promise<string> {
    if (!fs.existsSync(this.skillsDir)) {
      await fs.promises.mkdir(this.skillsDir, { recursive: true });
    }
    return this.skillsDir;
  }

  async createSkillDirectory(): Promise<string> {
    if (!fs.existsSync(this.skillsDir)) {
      await fs.promises.mkdir(this.skillsDir, { recursive: true });
    }
    return this.skillsDir;
  }
}

let skillMarketInstance: SkillMarket | null = null;

export function getSkillMarket(): SkillMarket {
  if (!skillMarketInstance) {
    skillMarketInstance = new SkillMarket();
  }
  return skillMarketInstance;
}

export function createSkillMarket(skillsDir?: string): SkillMarket {
  skillMarketInstance = new SkillMarket(skillsDir);
  return skillMarketInstance;
}
