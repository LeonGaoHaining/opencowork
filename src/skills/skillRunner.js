import { execFile } from 'child_process';
const DEFAULT_CONFIG = {
    allowedCommands: ['git', 'ls', 'pwd', 'head', 'tail', 'mkdir', 'rmdir', 'touch', 'rm'],
    shellInjectionEnabled: false,
    maxOutputSize: 1024 * 1024,
};
export class SkillRunner {
    sessionId;
    config;
    constructor(config) {
        this.sessionId = this.generateSessionId();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    async executeSkill(skill, args = []) {
        const startTime = Date.now();
        const context = {
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
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - startTime,
            };
        }
    }
    preprocessContent(content, context) {
        let processed = content;
        processed = processed.replace(/\$ARGUMENTS/g, this.escapeArg(context.arguments.join(' ')));
        processed = processed.replace(/\$ARGUMENTS\[(\d+)\]/g, (_, index) => {
            const i = parseInt(index, 10);
            return this.escapeArg(context.arguments[i] || '');
        });
        processed = processed.replace(/\$(\d+)/g, (_, index) => {
            const i = parseInt(index, 10);
            return this.escapeArg(context.arguments[i] || '');
        });
        processed = processed.replace(/\$\{CLAUDE_SESSION_ID\}/g, context.sessionId);
        processed = processed.replace(/\$\{CLAUDE_SKILL_DIR\}/g, context.skillDir);
        if (this.config.shellInjectionEnabled) {
            const shellInjectionRegex = /!`([^`]+)`/g;
            processed = processed.replace(shellInjectionRegex, (_, command) => {
                return `__SHELL_INJECTION_${command}__`;
            });
        }
        return processed;
    }
    escapeArg(arg) {
        if (!arg)
            return '';
        return arg.replace(/[;&|`$(){}[\]<>\\!#*?"']/g, '\\$&');
    }
    async executeContent(content, skill, context) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _ctx = context;
        const lines = content.split('\n');
        const outputs = [];
        const shell = skill.manifest.frontmatter.shell === 'powershell' ? 'powershell' : 'bash';
        for (const line of lines) {
            if (line.startsWith('__SHELL_INJECTION_')) {
                const command = line.replace('__SHELL_INJECTION_', '').replace(/__$/, '');
                const result = await this.executeShellCommand(command.trim(), shell);
                outputs.push(result);
            }
            else if (line.trim()) {
                outputs.push(line);
            }
        }
        return outputs.join('\n');
    }
    async executeShellCommand(command, shell = 'bash') {
        const sanitizedCommand = this.sanitizeCommand(command);
        if (!sanitizedCommand) {
            throw new Error('Empty or invalid command after sanitization');
        }
        const maxOutputSize = this.config.maxOutputSize || DEFAULT_CONFIG.maxOutputSize;
        return new Promise((resolve, reject) => {
            execFile(shell, ['-c', sanitizedCommand], {
                timeout: 60000,
                maxBuffer: maxOutputSize,
                env: { ...process.env, HOME: process.env.HOME },
            }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Command failed (exit ${error.code}): ${stderr || error.message}`));
                }
                else {
                    resolve(stdout.trim());
                }
            });
        });
    }
    sanitizeCommand(command) {
        const trimmed = command.trim();
        if (!trimmed)
            return null;
        const parts = trimmed.split(/\s+/);
        const baseCmd = parts[0];
        if (this.config.allowedCommands && this.config.allowedCommands.length > 0) {
            if (!this.config.allowedCommands.includes(baseCmd)) {
                console.warn(`[SkillRunner] Command "${baseCmd}" not in allowed list.`);
                return null;
            }
        }
        return trimmed;
    }
    async executeSkillWithTimeout(skill, args = [], timeout) {
        const timeoutMs = timeout || skill.manifest.opencowork?.timeout || 300000;
        try {
            return await Promise.race([
                this.executeSkill(skill, args),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Skill execution timed out')), timeoutMs)),
            ]);
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                duration: timeoutMs,
            };
        }
    }
    generateSessionId() {
        return `session_${crypto.randomUUID()}_${Date.now()}`;
    }
    getSessionId() {
        return this.sessionId;
    }
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    cleanup() {
        this.sessionId = '';
        console.log('[SkillRunner] Cleaned up');
    }
}
let skillRunnerInstance = null;
let skillRunnerConfig;
export function getSkillRunner(config) {
    if (config) {
        skillRunnerConfig = config;
    }
    if (!skillRunnerInstance) {
        skillRunnerInstance = new SkillRunner(skillRunnerConfig);
    }
    return skillRunnerInstance;
}
export function createSkillRunner(config) {
    const oldRunner = skillRunnerInstance;
    skillRunnerInstance = new SkillRunner(config);
    if (oldRunner) {
        oldRunner.cleanup();
    }
    return skillRunnerInstance;
}
export function resetSkillRunner() {
    if (skillRunnerInstance) {
        skillRunnerInstance.cleanup();
        skillRunnerInstance = null;
    }
    skillRunnerConfig = undefined;
}
