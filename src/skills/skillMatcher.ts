import type { InstalledSkill, SkillManifest } from './skillManifest';
import { getSkillLoader } from './skillLoader';

export type SkillSource = 'official' | 'agent-created' | 'market';

const MAX_MATCHED_SKILLS = 5;

export interface SkillLevel {
  level: 0 | 1 | 2;
  content: string;
  tokens: number;
}

export class SkillMatcher {
  async listSkills(source?: SkillSource): Promise<SkillManifest[]> {
    const skills = await getSkillLoader().loadAllSkills();
    return skills
      .filter((skill) => !source || skill.source === source)
      .map((skill) => skill.manifest);
  }

  async loadSkillLevel(
    source: SkillSource,
    name: string,
    level: 0 | 1 | 2
  ): Promise<SkillLevel | null> {
    const skill = await this.getInstalledSkill(source, name);
    if (!skill) {
      return null;
    }

    const tags = skill.manifest.frontmatter.tags?.join(', ') || '';
    const triggers = (skill.manifest.triggers || [])
      .flatMap((trigger) => (Array.isArray(trigger.value) ? trigger.value : []))
      .join(', ');
    const content = skill.manifest.content.trim();

    switch (level) {
      case 0: {
        const summary = [
          skill.manifest.name,
          skill.manifest.description,
          tags ? `tags: ${tags}` : '',
          triggers ? `triggers: ${triggers}` : '',
        ]
          .filter(Boolean)
          .join(' | ');
        return {
          level: 0,
          content: summary,
          tokens: Math.ceil(summary.length / 4),
        };
      }
      case 1: {
        const summaryLines = content.split('\n').filter(Boolean).slice(0, 12).join('\n');
        return {
          level: 1,
          content: summaryLines,
          tokens: Math.ceil(summaryLines.length / 4),
        };
      }
      case 2:
      default:
        return {
          level: 2,
          content,
          tokens: Math.ceil(content.length / 4),
        };
    }
  }

  async findMatchingSkills(query: string): Promise<SkillManifest[]> {
    const skills = await getSkillLoader().loadAllSkills();
    const lowerQuery = query.toLowerCase();
    const compactQuery = lowerQuery.replace(/\s+/g, '');
    const normalizedTerms = query
      .toLowerCase()
      .split(/[\s,，。.!?]+/)
      .filter(Boolean);

    const scored = skills
      .map((skill) => ({
        skill,
        score: this.scoreSkill(skill, normalizedTerms, lowerQuery, compactQuery),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_MATCHED_SKILLS);

    return scored.map((item) => item.skill.manifest);
  }

  async incrementUsageCount(source: SkillSource, name: string): Promise<void> {
    try {
      await getSkillLoader().incrementSkillUsage(name, source);
    } catch (error) {
      console.error(`[SkillMatcher] Failed to update usage count for ${name}:`, error);
    }
  }

  cleanup(): void {
    getSkillLoader().clearCache();
  }

  private async getInstalledSkill(
    source: SkillSource,
    name: string
  ): Promise<InstalledSkill | null> {
    const skill = await getSkillLoader().getSkill(name);
    if (!skill || skill.source !== source) {
      return null;
    }
    return skill;
  }

  private scoreSkill(
    skill: InstalledSkill,
    terms: string[],
    lowerQuery: string,
    compactQuery: string
  ): number {
    const haystack = [
      skill.manifest.name,
      skill.manifest.description,
      skill.manifest.frontmatter.tags?.join(' ') || '',
      skill.manifest.content.substring(0, 1200),
    ]
      .join(' ')
      .toLowerCase();

    if (terms.length === 0) {
      return 0;
    }

    let score = terms.reduce((score, term) => {
      if (skill.manifest.name.toLowerCase().includes(term)) return score + 5;
      if (skill.manifest.description.toLowerCase().includes(term)) return score + 3;
      if (skill.manifest.frontmatter.tags?.some((tag) => tag.toLowerCase().includes(term))) {
        return score + 2;
      }
      if (haystack.includes(term)) return score + 1;
      return score;
    }, 0);

    for (const trigger of skill.manifest.triggers || []) {
      const triggerValues = Array.isArray(trigger.value) ? trigger.value : [];
      for (const rawValue of triggerValues) {
        const value = rawValue.toLowerCase();
        const compactValue = value.replace(/\s+/g, '');

        if (trigger.type === 'keyword') {
          if (lowerQuery.includes(value) || compactQuery.includes(compactValue)) {
            score += 20 + (trigger.priority || 0);
          }
        }

        if (trigger.type === 'pattern') {
          try {
            if (new RegExp(rawValue, 'i').test(lowerQuery)) {
              score += 15 + (trigger.priority || 0);
            }
          } catch {
            // ignore invalid trigger regex
          }
        }
      }
    }

    return score;
  }
}

let matcherInstance: SkillMatcher | null = null;

export function getSkillMatcher(_skillsDir: string): SkillMatcher {
  if (!matcherInstance) {
    matcherInstance = new SkillMatcher();
  }
  return matcherInstance;
}

export function createSkillMatcher(_skillsDir: string): SkillMatcher {
  matcherInstance = new SkillMatcher();
  return matcherInstance;
}

export type { SkillManifest };
