import * as fs from 'fs';
import * as path from 'path';
import {
  SkillManifest,
  InstalledSkill,
  parseSkillFrontmatter,
  validateSkillManifest,
  SkillTrigger,
} from './skillManifest';

export class SkillLoader {
  private skillsDirs: string[];
  private manifestCache: Map<string, SkillManifest> = new Map();

  constructor(skillsDirs?: string[]) {
    this.skillsDirs = skillsDirs || this.getDefaultSkillDirs();
  }

  private getDefaultSkillDirs(): string[] {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
    return [
      path.join(homeDir, '.opencowork', 'skills'),
      path.join(process.cwd(), '.opencowork', 'skills'),
    ];
  }

  async loadSkill(skillPath: string): Promise<InstalledSkill> {
    const manifestPath = path.join(skillPath, 'SKILL.md');
    const stats = await fs.promises.stat(manifestPath).catch(() => null);
    if (!stats || !stats.isFile()) {
      throw new Error(`SKILL.md not found at ${manifestPath}`);
    }

    const content = await fs.promises.readFile(manifestPath, 'utf-8');
    const { frontmatter, body } = parseSkillFrontmatter(content);

    const name = frontmatter.name || path.basename(skillPath);
    const manifest: SkillManifest = {
      name,
      description: frontmatter.description || '',
      content: body.trim(),
      frontmatter,
      directory: skillPath,
      triggers: this.parseTriggers(frontmatter),
      opencowork: this.parseOpenCoworkExtension(frontmatter),
    };

    const validation = validateSkillManifest(manifest);
    if (!validation.valid) {
      console.warn(`[SkillLoader] Skill ${name} has validation issues:`, validation.errors);
    }

    this.manifestCache.set(name, manifest);

    const skill: InstalledSkill = {
      manifest,
      path: skillPath,
      enabled: true,
    };

    const packageJsonPath = path.join(skillPath, 'package.json');
    try {
      const packageJson = await fs.promises.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(packageJson);
      skill.version = pkg.version;
      skill.author = pkg.author;
    } catch {}

    return skill;
  }

  private parseTriggers(frontmatter: any): SkillTrigger[] {
    if (frontmatter.triggers) {
      return frontmatter.triggers;
    }

    if (frontmatter.description) {
      return [
        {
          type: 'keyword',
          value: [frontmatter.description.split(' ')[0].toLowerCase()],
          priority: 50,
        },
      ];
    }

    return [];
  }

  private parseOpenCoworkExtension(frontmatter: any) {
    if (frontmatter['openworks-only']) {
      const ext = frontmatter['openworks-only'];
      return {
        maxSteps: ext['max-steps'],
        timeout: ext.timeout,
      };
    }
    return undefined;
  }

  async loadAllSkills(): Promise<InstalledSkill[]> {
    const skills: InstalledSkill[] = [];
    const seen = new Set<string>();

    for (const dir of this.skillsDirs) {
      try {
        const entries = await fs.promises.readdir(dir);
        for (const entry of entries) {
          const skillPath = path.join(dir, entry);
          const stats = await fs.promises.stat(skillPath);
          if (stats.isDirectory() && !seen.has(entry)) {
            seen.add(entry);
            try {
              const skill = await this.loadSkill(skillPath);
              skills.push(skill);
            } catch (e) {
              console.warn(`[SkillLoader] Failed to load skill ${entry}:`, e);
            }
          }
        }
      } catch (e) {}
    }

    return skills;
  }

  async matchSkill(userInput: string): Promise<InstalledSkill | null> {
    const skills = await this.loadAllSkills();
    const matched = skills
      .filter((s) => s.enabled)
      .filter((s) => this.matchesTrigger(s, userInput))
      .sort((a, b) => {
        const aPriority = a.manifest.triggers?.[0]?.priority || 50;
        const bPriority = b.manifest.triggers?.[0]?.priority || 50;
        return bPriority - aPriority;
      });

    if (matched.length > 0) {
      const topMatch = matched[0];
      if (topMatch.manifest.triggers?.[0]?.exclusive) {
        return topMatch;
      }
      return matched[0];
    }

    return null;
  }

  private matchesTrigger(skill: InstalledSkill, input: string): boolean {
    const triggers = skill.manifest.triggers;
    if (!triggers || triggers.length === 0) {
      return false;
    }

    const lowerInput = input.toLowerCase();

    for (const trigger of triggers) {
      switch (trigger.type) {
        case 'keyword':
          if (trigger.value.some((kw: string) => lowerInput.includes(kw.toLowerCase()))) {
            return true;
          }
          break;
        case 'pattern':
          if (trigger.value.some((re: string) => new RegExp(re, 'i').test(input))) {
            return true;
          }
          break;
        case 'intent':
          break;
      }
    }

    return false;
  }

  async getSkill(name: string): Promise<InstalledSkill | null> {
    if (this.manifestCache.has(name)) {
      const manifest = this.manifestCache.get(name)!;
      return {
        manifest,
        path: manifest.directory,
        enabled: true,
      };
    }

    for (const dir of this.skillsDirs) {
      const skillPath = path.join(dir, name);
      try {
        const stats = await fs.promises.stat(skillPath);
        if (stats.isDirectory()) {
          return this.loadSkill(skillPath);
        }
      } catch {}
    }

    return null;
  }

  clearCache(): void {
    this.manifestCache.clear();
  }
}

let skillLoaderInstance: SkillLoader | null = null;

export function getSkillLoader(): SkillLoader {
  if (!skillLoaderInstance) {
    skillLoaderInstance = new SkillLoader();
  }
  return skillLoaderInstance;
}

export function createSkillLoader(skillsDirs?: string[]): SkillLoader {
  skillLoaderInstance = new SkillLoader(skillsDirs);
  return skillLoaderInstance;
}
