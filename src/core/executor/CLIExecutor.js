import { exec } from 'child_process';
const CLI_WHITELIST = {
    git: ['status', 'pull', 'push', 'clone', 'log', 'diff', 'branch', 'checkout', 'fetch'],
    npm: ['install', 'run', 'test', 'start', 'build', 'dev', 'lint'],
    node: ['--version', '-v'],
    python: ['--version', '-c', '-m'],
    pip: ['install', 'list', 'show', 'freeze'],
    curl: ['-s', '-S', '-L', '-o', '--max-time'],
    wget: ['-q', '-O', '--timeout'],
    ls: ['-la', '-l', '-a', '-R'],
    pwd: [],
    echo: ['*'],
    cat: [],
    mkdir: ['-p'],
    cd: [],
    touch: ['*'],
};
const BLACKLIST_COMMANDS = ['rm -rf', 'dd', 'mkfs', ':(){:|:&};:', 'chmod -R 777', 'sudo', 'su'];
export class CLIExecutor {
    async execute(action) {
        const startTime = Date.now();
        if (action.type !== 'cli:execute') {
            return {
                success: false,
                error: {
                    code: 'INVALID_ACTION',
                    message: `Expected cli:execute, got ${action.type}`,
                    recoverable: false,
                },
                duration: Date.now() - startTime,
            };
        }
        const cliAction = action;
        const { command, workingDir, env } = cliAction.params;
        console.log(`[CLIExecutor] Executing: ${command}`);
        const validation = this.validateCommand(command);
        if (!validation.valid) {
            return {
                success: false,
                error: {
                    code: 'VALIDATION_FAILED',
                    message: validation.error || 'Command validation failed',
                    recoverable: false,
                },
                duration: Date.now() - startTime,
            };
        }
        return new Promise((resolve) => {
            const options = {
                timeout: 60000,
                maxBuffer: 10 * 1024 * 1024,
            };
            if (workingDir) {
                options.cwd = workingDir;
            }
            if (env) {
                options.env = { ...process.env, ...env };
            }
            let timeoutId = null;
            const commandTimeout = cliAction.params.timeout || 60000;
            timeoutId = setTimeout(() => {
                console.error('[CLIExecutor] Command timed out:', command);
                resolve({
                    success: false,
                    error: {
                        code: 'TIMEOUT',
                        message: `Command timed out after ${commandTimeout}ms`,
                        recoverable: true,
                    },
                    duration: Date.now() - startTime,
                });
            }, commandTimeout);
            exec(command, options, (error, stdout, stderr) => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                try {
                    if (error) {
                        console.error(`[CLIExecutor] Command failed:`, error.message);
                        if (error.killed) {
                            resolve({
                                success: false,
                                error: {
                                    code: 'TIMEOUT',
                                    message: 'Command timed out after 60 seconds',
                                    recoverable: true,
                                },
                                duration: Date.now() - startTime,
                            });
                            return;
                        }
                        resolve({
                            success: false,
                            output: stdout.toString(),
                            error: {
                                code: 'COMMAND_FAILED',
                                message: (stderr ? stderr.toString() : '') || error.message,
                                recoverable: true,
                            },
                            duration: Date.now() - startTime,
                        });
                        return;
                    }
                    console.log(`[CLIExecutor] Command succeeded`);
                    resolve({
                        success: true,
                        output: stdout.toString(),
                        duration: Date.now() - startTime,
                    });
                }
                catch (callbackError) {
                    console.error('[CLIExecutor] Callback error:', callbackError);
                    resolve({
                        success: false,
                        error: {
                            code: 'CALLBACK_ERROR',
                            message: callbackError.message || String(callbackError),
                            recoverable: true,
                        },
                        duration: Date.now() - startTime,
                    });
                }
            });
        });
    }
    validateCommand(command) {
        const trimmed = command.trim();
        const lower = trimmed.toLowerCase();
        for (const blocked of BLACKLIST_COMMANDS) {
            if (lower.includes(blocked.toLowerCase())) {
                return { valid: false, error: `Blocked command pattern: ${blocked}` };
            }
        }
        const parts = trimmed.split(/\s+/);
        if (parts.length === 0) {
            return { valid: false, error: 'Empty command' };
        }
        const cmd = parts[0];
        const allowedCommands = CLI_WHITELIST[cmd];
        if (!allowedCommands) {
            return { valid: false, error: `Command not in whitelist: ${cmd}` };
        }
        if (allowedCommands.length === 0) {
            return { valid: true };
        }
        if (allowedCommands[0] === '*') {
            return { valid: true };
        }
        const subCmd = parts[1];
        if (subCmd && !allowedCommands.includes(subCmd)) {
            return { valid: false, error: `Subcommand not allowed: ${subCmd}` };
        }
        return { valid: true };
    }
}
export default CLIExecutor;
