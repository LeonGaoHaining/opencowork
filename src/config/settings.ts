import * as fs from 'fs';
import * as path from 'path';

export interface SkillSettings {
  autoGenerate: boolean;
  triggerThreshold: number;
}

export interface PreviewSettings {
  fps: number;
  quality: number;
}

export interface Settings {
  skill: SkillSettings;
  preview: PreviewSettings;
}

const DEFAULT_SETTINGS: Settings = {
  skill: {
    autoGenerate: false,
    triggerThreshold: 3,
  },
  preview: {
    fps: 5,
    quality: 80,
  },
};

const DEFAULT_SKILL_SETTINGS: SkillSettings = {
  autoGenerate: false,
  triggerThreshold: 3,
};

const DEFAULT_PREVIEW_SETTINGS: PreviewSettings = {
  fps: 5,
  quality: 80,
};

export class SettingsManager {
  private configPath: string;
  private settings: Settings;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    const configDir = process.env.OPENWORK_CONFIG_DIR || path.join(process.cwd(), 'config');
    this.configPath = path.join(configDir, 'settings.json');
    this.settings = this.load();
  }

  private load(): Settings {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(data) as Partial<Settings>;
        return {
          skill: { ...DEFAULT_SKILL_SETTINGS, ...loaded.skill },
          preview: { ...DEFAULT_PREVIEW_SETTINGS, ...loaded.preview },
        };
      }
    } catch (error) {
      console.error('[SettingsManager] Failed to load settings:', error);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveSync();
    }, 500);
  }

  private saveSync(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (error) {
      console.error('[SettingsManager] Failed to save settings:', error);
    }
  }

  get(): Settings {
    return this.settings;
  }

  getSkillSettings(): SkillSettings {
    return this.settings.skill;
  }

  getPreviewSettings(): PreviewSettings {
    return this.settings.preview;
  }

  setSkillSettings(skill: Partial<SkillSettings>): void {
    this.settings.skill = { ...this.settings.skill, ...skill };
    this.scheduleSave();
  }

  setPreviewSettings(preview: Partial<PreviewSettings>): void {
    this.settings.preview = { ...this.settings.preview, ...preview };
    this.scheduleSave();
  }

  setAutoGenerateSkill(autoGenerate: boolean): void {
    this.settings.skill.autoGenerate = autoGenerate;
    this.scheduleSave();
  }

  resetSkillSettings(): void {
    this.settings.skill = { ...DEFAULT_SKILL_SETTINGS };
    this.scheduleSave();
  }

  close(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveSync();
    }
  }
}

let settingsInstance: SettingsManager | null = null;

export function getSettingsManager(): SettingsManager {
  if (!settingsInstance) {
    settingsInstance = new SettingsManager();
  }
  return settingsInstance;
}

export function resetSettingsManager(): void {
  if (settingsInstance) {
    settingsInstance.close();
    settingsInstance = null;
  }
}

export type { Settings as OpenCoworkSettings };