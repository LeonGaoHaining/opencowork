import * as fs from 'fs';
import * as path from 'path';
import {
  SkillManifest,
  InstalledSkill,
  parseSkillFrontmatter,
  validateSkillManifest,
  SkillTrigger,
  SkillFrontmatter,
} from './skillManifest';

type SkillSource = 'official' | 'agent-created' | 'market';

const MAX_MANIFEST_CACHE = 200;

export class SkillLoader {
  private skillsDirs: string[];
  private manifestCache: Map<string, SkillManifest> = new Map();
  private manifestCacheOrder: string[] = [];
  private skillsCache: InstalledSkill[] | null = null;
  private skillsCacheTime: number = 0;
  private readonly CACHE_TTL_MS = 5000;
  private readonly sources: SkillSource[] = ['official', 'agent-created', 'market'];

  constructor(skillsDirs?: string[]) {
    this.skillsDirs = skillsDirs || this.getDefaultSkillDirs();
  }

  private getDefaultSkillDirs(): string[] {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
    const candidateDirs = [
      path.join(homeDir, '.opencowork', 'skills'),
      path.join(process.cwd(), '.opencowork', 'skills'),
    ];
    return candidateDirs.filter((dir, index) => index === 0 || fs.existsSync(dir));
  }

  async loadSkill(skillPath: string): Promise<InstalledSkill> {
    const resolvedPath = path.resolve(skillPath);
    const isPathAllowed = this.skillsDirs.some((dir) => {
      const resolvedDir = path.resolve(dir);
      return resolvedPath.startsWith(resolvedDir + path.sep) || resolvedPath === resolvedDir;
    });

    if (!isPathAllowed) {
      throw new Error(
        `Skill path "${skillPath}" is not within allowed skills directories: ${this.skillsDirs.join(', ')}`
      );
    }

    const manifestPath = path.join(skillPath, 'SKILL.md');
    const stats = await fs.promises.stat(manifestPath).catch(() => null);
    if (!stats || !stats.isFile()) {
      throw new Error(`SKILL.md not found at ${manifestPath}`);
    }

    if (stats.size > 1024 * 1024) {
      throw new Error(`SKILL.md at ${manifestPath} exceeds maximum size of 1MB`);
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
      source: this.inferSourceFromPath(skillPath),
      triggers: this.parseTriggers(frontmatter),
      opencowork: this.parseOpenCoworkExtension(frontmatter),
    };

    const validation = validateSkillManifest(manifest);
    if (!validation.valid) {
      console.warn(`[SkillLoader] Skill ${name} has validation issues:`, validation.errors);
    }

    this.manifestCache.set(name, manifest);

    if (!this.manifestCacheOrder.includes(name)) {
      this.manifestCacheOrder.push(name);
    }
    while (this.manifestCacheOrder.length > MAX_MANIFEST_CACHE) {
      const oldest = this.manifestCacheOrder.shift();
      if (oldest) {
        this.manifestCache.delete(oldest);
      }
    }

    const skill: InstalledSkill = {
      manifest,
      path: skillPath,
      enabled: true,
      source: manifest.source,
    };

    const packageJsonPath = path.join(skillPath, 'package.json');
    try {
      const packageJson = await fs.promises.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(packageJson);
      skill.version = pkg.version;
      skill.author = pkg.author;
    } catch (e) {
      console.debug(`[SkillLoader] No package.json for skill ${name}`);
    }

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
    const now = Date.now();
    if (this.skillsCache && now - this.skillsCacheTime < this.CACHE_TTL_MS) {
      return this.skillsCache;
    }

    const skills: InstalledSkill[] = [];
    const seen = new Set<string>();

    for (const dir of this.skillsDirs) {
      try {
        const legacyEntries = await fs.promises.readdir(dir);
        for (const entry of legacyEntries) {
          const skillPath = path.join(dir, entry);
          const stats = await fs.promises.stat(skillPath).catch(() => null);
          if (!stats?.isDirectory() || seen.has(`legacy:${entry}`)) continue;
          const manifestPath = path.join(skillPath, 'SKILL.md');
          if (!fs.existsSync(manifestPath)) continue;

          seen.add(`legacy:${entry}`);
          try {
            const skill = await this.loadSkill(skillPath);
            skills.push(skill);
          } catch (e) {
            console.warn(`[SkillLoader] Failed to load legacy skill ${entry}:`, e);
          }
        }

        for (const source of this.sources) {
          const sourceDir = path.join(dir, source);
          const sourceStats = await fs.promises.stat(sourceDir).catch(() => null);
          if (!sourceStats?.isDirectory()) {
            continue;
          }

          const entries = await fs.promises.readdir(sourceDir);
          for (const entry of entries) {
            const skillPath = path.join(sourceDir, entry);
            const stats = await fs.promises.stat(skillPath).catch(() => null);

            if (!stats?.isDirectory() || seen.has(`${source}:${entry}`)) continue;
            seen.add(`${source}:${entry}`);

            const manifestPath = path.join(skillPath, 'SKILL.md');
            if (!fs.existsSync(manifestPath)) continue;

            try {
              const skill = await this.loadSkill(skillPath);
              skills.push(skill);
            } catch (e) {
              console.warn(`[SkillLoader] Failed to load skill ${entry}:`, e);
            }
          }
        }
      } catch (e) {
        console.warn(`[SkillLoader] Failed to read skills directory ${dir}:`, e);
      }
    }

    this.skillsCache = skills;
    this.skillsCacheTime = now;
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

    if (matched.length === 0) {
      return null;
    }

    const topMatch = matched[0];
    if (topMatch.manifest.triggers?.[0]?.exclusive) {
      return topMatch;
    }

    const hasExclusiveMatch = matched.some((s) => s.manifest.triggers?.[0]?.exclusive);
    if (hasExclusiveMatch) {
      return null;
    }

    return matched[0];
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
    if (this.skillsCache) {
      return this.skillsCache.find((s) => s.manifest.name === name) || null;
    }

    if (this.manifestCache.has(name)) {
      const manifest = this.manifestCache.get(name)!;
      return {
        manifest,
        path: manifest.directory,
        enabled: true,
      };
    }

    for (const dir of this.skillsDirs) {
      const legacySkillPath = path.join(dir, name);
      try {
        const stats = await fs.promises.stat(legacySkillPath);
        if (stats.isDirectory()) {
          return this.loadSkill(legacySkillPath);
        }
      } catch {}

      for (const source of this.sources) {
        const skillPath = path.join(dir, source, name);
        try {
          const stats = await fs.promises.stat(skillPath);
          if (stats.isDirectory()) {
            return this.loadSkill(skillPath);
          }
        } catch {}
      }
    }

    return null;
  }

  async saveSkill(
    frontmatter: SkillFrontmatter,
    content: string,
    source: SkillSource = 'agent-created'
  ): Promise<InstalledSkill> {
    const name = frontmatter.name?.trim();
    if (!name) {
      throw new Error('Skill name is required');
    }

    const rootDir = await this.getPrimarySkillsRoot();
    const skillDir = path.join(rootDir, source, name);
    await fs.promises.mkdir(skillDir, { recursive: true });

    const normalizedFrontmatter: SkillFrontmatter = {
      ...frontmatter,
      name,
      description: frontmatter.description?.trim() || `${name} skill`,
      source,
      version: frontmatter.version || '1.0.0',
    };

    const serialized = this.serializeSkill(normalizedFrontmatter, content.trim());
    await fs.promises.writeFile(path.join(skillDir, 'SKILL.md'), serialized, 'utf-8');
    this.clearCache();

    const skill = await this.loadSkill(skillDir);
    if (!skill) {
      throw new Error(`Failed to load saved skill: ${name}`);
    }
    return skill;
  }

  async deleteSkill(name: string, source: SkillSource): Promise<void> {
    for (const dir of this.skillsDirs) {
      const skillPath = path.join(dir, source, name);
      const stats = await fs.promises.stat(skillPath).catch(() => null);
      if (stats?.isDirectory()) {
        await fs.promises.rm(skillPath, { recursive: true, force: true });
        this.clearCache();
        return;
      }
    }

    throw new Error(`Skill not found: ${source}/${name}`);
  }

  async patchSkill(
    name: string,
    source: SkillSource,
    patch: { frontmatter?: Partial<SkillFrontmatter>; content?: string }
  ): Promise<InstalledSkill> {
    const skill = await this.getSkill(name);
    if (!skill || skill.source !== source) {
      throw new Error(`Skill not found: ${source}/${name}`);
    }

    const mergedFrontmatter: SkillFrontmatter = {
      ...skill.manifest.frontmatter,
      ...patch.frontmatter,
      name: patch.frontmatter?.name || skill.manifest.name,
      description: patch.frontmatter?.description || skill.manifest.description,
      source,
    };

    return this.saveSkill(mergedFrontmatter, patch.content ?? skill.manifest.content, source);
  }

  async incrementSkillUsage(name: string, source: SkillSource): Promise<InstalledSkill> {
    const skill = await this.getSkill(name);
    if (!skill || skill.source !== source) {
      throw new Error(`Skill not found: ${source}/${name}`);
    }

    const usageCount = (skill.manifest.frontmatter.usageCount || 0) + 1;
    return this.patchSkill(name, source, {
      frontmatter: { usageCount },
    });
  }

  private inferSourceFromPath(skillPath: string): SkillSource | undefined {
    const normalizedPath = path.normalize(skillPath);
    return this.sources.find((source) =>
      normalizedPath.includes(`${path.sep}${source}${path.sep}`)
    );
  }

  private async getPrimarySkillsRoot(): Promise<string> {
    const rootDir = this.skillsDirs[0];
    await fs.promises.mkdir(rootDir, { recursive: true });
    for (const source of this.sources) {
      await fs.promises.mkdir(path.join(rootDir, source), { recursive: true });
    }
    return rootDir;
  }

  private serializeSkill(frontmatter: SkillFrontmatter, content: string): string {
    const lines: string[] = ['---'];
    if (frontmatter.name) lines.push(`name: ${frontmatter.name}`);
    if (frontmatter.description) lines.push(`description: ${frontmatter.description}`);
    if (frontmatter.version) lines.push(`version: ${frontmatter.version}`);
    if (frontmatter.source) lines.push(`source: ${frontmatter.source}`);
    if (frontmatter.argumentHint) lines.push(`argumentHint: ${frontmatter.argumentHint}`);
    if (frontmatter.inputSpec) lines.push(`inputSpec: ${frontmatter.inputSpec}`);
    if (frontmatter.outputSpec) lines.push(`outputSpec: ${frontmatter.outputSpec}`);
    if (typeof frontmatter.userInvocable === 'boolean') {
      lines.push(`userInvocable: ${frontmatter.userInvocable}`);
    }
    if (frontmatter.context) lines.push(`context: ${frontmatter.context}`);
    if (frontmatter.platforms?.length)
      lines.push(`platforms: [${frontmatter.platforms.join(', ')}]`);
    if (frontmatter.tags?.length) lines.push(`tags: [${frontmatter.tags.join(', ')}]`);
    if (frontmatter.useCases?.length) lines.push(`useCases: [${frontmatter.useCases.join(', ')}]`);
    if (frontmatter.failureHints?.length)
      lines.push(`failureHints: [${frontmatter.failureHints.join(', ')}]`);
    if (typeof frontmatter.usageCount === 'number')
      lines.push(`usageCount: ${frontmatter.usageCount}`);
    lines.push('---', '', content);
    return `${lines.join('\n').trim()}\n`;
  }

  getSkillSource(name: string): SkillSource | null {
    if (this.manifestCache.has(name)) {
      return this.manifestCache.get(name)?.source || null;
    }
    return null;
  }

  clearCache(): void {
    this.manifestCache.clear();
    this.skillsCache = null;
    this.skillsCacheTime = 0;
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
