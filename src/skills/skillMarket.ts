import * as fs from 'fs';
import * as path from 'path';
import { SkillLoader, getSkillLoader } from './skillLoader';
import { SkillFrontmatter, InstalledSkill } from './skillManifest';

type SkillSource = 'official' | 'agent-created' | 'market';

export interface SkillListing {
  name: string;
  version?: string;
  description: string;
  path: string;
  installed: boolean;
  updateAvailable?: boolean;
  source?: SkillSource;
  userInvocable?: boolean;
  argumentHint?: string;
  useCases?: string[];
  inputSpec?: string;
  outputSpec?: string;
  failureHints?: string[];
  allowedTools?: string[];
  tags?: string[];
}

function normalizeSectionText(lines: string[]): string | undefined {
  const text = lines.join('\n').trim();
  return text.length > 0 ? text : undefined;
}

function extractMarkdownSection(content: string, headings: string[]): string | undefined {
  const lines = content.split(/\r?\n/);
  let collecting = false;
  const collected: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const normalized = trimmed.replace(/^#+\s*/, '').toLowerCase();
    if (/^#{1,6}\s+/.test(trimmed)) {
      if (collecting) {
        break;
      }
      if (headings.includes(normalized)) {
        collecting = true;
      }
      continue;
    }

    if (collecting) {
      collected.push(line);
    }
  }

  return normalizeSectionText(collected);
}

function extractMarkdownBullets(content: string, headings: string[]): string[] | undefined {
  const section = extractMarkdownSection(content, headings);
  if (!section) {
    return undefined;
  }

  const items = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter((line) => line.length > 0);

  return items.length > 0 ? items : undefined;
}

function buildSkillProductMetadata(skill: InstalledSkill): Pick<
  SkillListing,
  | 'argumentHint'
  | 'useCases'
  | 'inputSpec'
  | 'outputSpec'
  | 'failureHints'
  | 'allowedTools'
  | 'tags'
  | 'userInvocable'
> {
  const frontmatter = skill.manifest.frontmatter;
  return {
    argumentHint: frontmatter.argumentHint,
    useCases:
      frontmatter.useCases ||
      extractMarkdownBullets(skill.manifest.content, ['when to use', 'use cases']) ||
      undefined,
    inputSpec:
      frontmatter.inputSpec ||
      extractMarkdownSection(skill.manifest.content, ['input', 'inputs']) ||
      undefined,
    outputSpec:
      frontmatter.outputSpec ||
      extractMarkdownSection(skill.manifest.content, ['output', 'outputs', 'verification']) ||
      undefined,
    failureHints:
      frontmatter.failureHints ||
      extractMarkdownBullets(skill.manifest.content, ['pitfalls', 'failure hints', 'common failures']) ||
      undefined,
    allowedTools: frontmatter.allowedTools,
    tags: frontmatter.tags,
    userInvocable: frontmatter.userInvocable,
  };
}

export class SkillMarket {
  private skillsDir: string;
  private loader: SkillLoader;

  constructor(skillsDir?: string, loader?: SkillLoader) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
    this.skillsDir = skillsDir || path.join(homeDir, '.opencowork', 'skills');
    this.loader = loader || getSkillLoader();
  }

  async listInstalledSkills(source?: SkillSource): Promise<SkillListing[]> {
    const skills = await this.loader.loadAllSkills();
    return skills
      .map((s) => ({
        name: s.manifest.name,
        version: s.version,
        description: s.manifest.description,
        path: s.path,
        installed: true,
        source: s.source,
        ...buildSkillProductMetadata(s),
      }))
      .filter((skill) => !source || skill.source === source);
  }

  async installSkill(skillPath: string): Promise<{ success: boolean; error?: string }> {
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

      const skillName = path.basename(resolvedPath);
      const targetPath = path.join(await this.getSourceDirectory('market'), skillName);

      if (fs.existsSync(targetPath)) {
        return {
          success: false,
          error: 'Skill with this name already exists. Please uninstall first.',
        };
      }

      await fs.promises.cp(resolvedPath, targetPath, { recursive: true });
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
      const skill = await this.loader.getSkill(skillName);
      if (!skill?.source) {
        return { success: false, error: 'Skill not found' };
      }

      const skillPath = path.join(await this.getSourceDirectory(skill.source), skillName);
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
    try {
      const skill = await this.loader.getSkill(skillName);
      if (!skill) {
        return { success: false, error: 'Skill not found' };
      }
      return { success: false, error: 'Update not implemented - please uninstall and reinstall' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
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
      source: skill.source,
      ...buildSkillProductMetadata(skill),
    };
  }

  async getSkillManifest(skillName: string): Promise<InstalledSkill | null> {
    return this.loader.getSkill(skillName);
  }

  async saveSkill(
    frontmatter: SkillFrontmatter,
    content: string,
    source: SkillSource = 'agent-created'
  ): Promise<InstalledSkill> {
    return this.loader.saveSkill(frontmatter, content, source);
  }

  async patchSkill(
    name: string,
    patch: { frontmatter?: Partial<SkillFrontmatter>; content?: string },
    source: SkillSource
  ): Promise<InstalledSkill> {
    return this.loader.patchSkill(name, source, patch);
  }

  async deleteSkill(name: string, source: SkillSource): Promise<void> {
    await this.loader.deleteSkill(name, source);
  }

  async incrementUsageCount(name: string, source: SkillSource): Promise<InstalledSkill> {
    return this.loader.incrementSkillUsage(name, source);
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

  private async getSourceDirectory(source: SkillSource): Promise<string> {
    const sourceDir = path.join(this.skillsDir, source);
    if (!fs.existsSync(sourceDir)) {
      await fs.promises.mkdir(sourceDir, { recursive: true });
    }
    return sourceDir;
  }

  cleanup(): void {
    console.log('[SkillMarket] Cleaned up');
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
  const oldMarket = skillMarketInstance;
  skillMarketInstance = new SkillMarket(skillsDir);
  if (oldMarket) {
    oldMarket.cleanup();
  }
  return skillMarketInstance;
}

export function resetSkillMarket(): void {
  if (skillMarketInstance) {
    skillMarketInstance.cleanup();
    skillMarketInstance = null;
  }
}
