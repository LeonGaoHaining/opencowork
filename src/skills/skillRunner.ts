import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { InstalledSkill, SkillExecutionContext } from './skillManifest';

export interface SkillExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

export class SkillRunner {
  private sessionId: string;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || this.generateSessionId();
  }

  async executeSkill(skill: InstalledSkill, args: string[] = []): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const context: SkillExecutionContext = {
      sessionId: this.sessionId,
      skillDir: skill.manifest.directory,
      arguments: args,
      userInvoked: true,
    };

    try {
      const processedContent = this.preprocessContent(skill.manifest.content, context);
      const result = await this.executeContent(processedContent, skill, context);
      return {
        success: true,
        output: result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  private preprocessContent(content: string, context: SkillExecutionContext): string {
    let processed = content;

    processed = processed.replace(/\$ARGUMENTS/g, context.arguments.join(' '));
    processed = processed.replace(/\$ARGUMENTS\[(\d+)\]/g, (_, index) => {
      const i = parseInt(index, 10);
      return context.arguments[i] || '';
    });

    processed = processed.replace(/\$(\d+)/g, (_, index) => {
      const i = parseInt(index, 10);
      return context.arguments[i] || '';
    });

    processed = processed.replace(/\$\{CLAUDE_SESSION_ID\}/g, context.sessionId);
    processed = processed.replace(/\$\{CLAUDE_SKILL_DIR\}/g, context.skillDir);

    const shellInjectionRegex = /!`([^`]+)`/g;
    processed = processed.replace(shellInjectionRegex, (_, command) => {
      return `__SHELL_INJECTION_${command}__`;
    });

    return processed;
  }

  private async executeContent(
    content: string,
    skill: InstalledSkill,
    context: SkillExecutionContext
  ): Promise<string> {
    const lines = content.split('\n');
    const outputs: string[] = [];
    const shell = skill.manifest.frontmatter.shell === 'powershell' ? 'powershell' : 'bash';

    for (const line of lines) {
      if (line.startsWith('__SHELL_INJECTION_')) {
        const command = line.replace('__SHELL_INJECTION_', '').replace(/__$/, '');
        const result = await this.executeShellCommand(command.trim(), shell);
        outputs.push(result);
      } else if (line.trim()) {
        outputs.push(line);
      }
    }

    return outputs.join('\n');
  }

  private async executeShellCommand(command: string, shell: string = 'bash'): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, { shell }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Command failed: ${stderr || error.message}`));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  async executeSkillWithTimeout(
    skill: InstalledSkill,
    args: string[] = [],
    timeout?: number
  ): Promise<SkillExecutionResult> {
    const timeoutMs = timeout || skill.manifest.opencowork?.timeout || 300000;

    return Promise.race([
      this.executeSkill(skill, args),
      new Promise<SkillExecutionResult>((_, reject) =>
        setTimeout(() => reject(new Error('Skill execution timed out')), timeoutMs)
      ),
    ]);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getSessionId(): string {
    return this.sessionId;
  }
}

let skillRunnerInstance: SkillRunner | null = null;

export function getSkillRunner(): SkillRunner {
  if (!skillRunnerInstance) {
    skillRunnerInstance = new SkillRunner();
  }
  return skillRunnerInstance;
}

export function createSkillRunner(sessionId?: string): SkillRunner {
  skillRunnerInstance = new SkillRunner(sessionId);
  return skillRunnerInstance;
}
