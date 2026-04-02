import { ActionType } from '../action/ActionSchema';
import { ipcMain } from 'electron';
const ASK_USER_CHANNEL = 'ask:user:request';
const ASK_USER_RESPONSE_CHANNEL = 'ask:user:response';
let mainWindowRef = null;
// 模块级标志：防止重复注册 IPC handler
let ipcHandlerRegistered = false;
// 模块级 pendingRequests Map，支持多个 AskUserExecutor 实例
let pendingRequests = new Map();
export function setAskUserMainWindow(window) {
    mainWindowRef = window;
}
export class AskUserExecutor {
    constructor() {
        // 使用模块级标志防止重复注册
        if (!ipcHandlerRegistered) {
            this.setupIpcHandlers();
            ipcHandlerRegistered = true;
        }
    }
    setupIpcHandlers() {
        ipcMain.handle(ASK_USER_RESPONSE_CHANNEL, async (event, response) => {
            const { requestId, answer, cancelled } = response;
            const pending = pendingRequests.get(requestId);
            if (!pending) {
                console.warn('[AskUserExecutor] No pending request for response:', requestId);
                return;
            }
            clearTimeout(pending.timeout);
            pendingRequests.delete(requestId);
            if (cancelled) {
                pending.reject(new Error('USER_CANCELLED'));
            }
            else {
                pending.resolve({ answer, selectedOption: answer });
            }
        });
    }
    async execute(action) {
        const startTime = Date.now();
        if (action.type !== ActionType.ASK_USER) {
            return {
                success: false,
                error: {
                    code: 'INVALID_ACTION_TYPE',
                    message: `Expected ask:user action, got ${action.type}`,
                    recoverable: false,
                },
                duration: Date.now() - startTime,
            };
        }
        const params = action.params;
        const timeout = action.constraints?.timeout || 300000;
        const requestId = `ask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`[AskUserExecutor] Requesting user input:`, params.question);
        return new Promise((resolve) => {
            const timeoutHandle = setTimeout(() => {
                pendingRequests.delete(requestId);
                console.warn('[AskUserExecutor] User response timeout');
                resolve({
                    success: false,
                    error: {
                        code: 'USER_TIMEOUT',
                        message: 'User did not respond in time',
                        recoverable: false,
                    },
                    duration: Date.now() - startTime,
                });
            }, timeout);
            pendingRequests.set(requestId, {
                resolve: (response) => {
                    clearTimeout(timeoutHandle);
                    pendingRequests.delete(requestId);
                    console.log('[AskUserExecutor] User responded:', response);
                    resolve({
                        success: true,
                        output: response,
                        duration: Date.now() - startTime,
                    });
                },
                reject: (error) => {
                    clearTimeout(timeoutHandle);
                    pendingRequests.delete(requestId);
                    console.log('[AskUserExecutor] User cancelled or error:', error.message);
                    resolve({
                        success: false,
                        error: {
                            code: error.message === 'USER_CANCELLED' ? 'USER_CANCELLED' : 'USER_ERROR',
                            message: error.message || 'User interaction failed',
                            recoverable: false,
                        },
                        duration: Date.now() - startTime,
                    });
                },
                timeout: timeoutHandle,
            });
            if (mainWindowRef && !mainWindowRef.isDestroyed()) {
                mainWindowRef.webContents.send(ASK_USER_CHANNEL, {
                    requestId,
                    question: params.question,
                    options: params.options,
                    defaultResponse: params.defaultResponse,
                    timeout,
                });
            }
            else {
                console.error('[AskUserExecutor] Main window not available');
                resolve({
                    success: false,
                    error: {
                        code: 'NO_MAIN_WINDOW',
                        message: 'Main window not available',
                        recoverable: false,
                    },
                    duration: Date.now() - startTime,
                });
            }
        });
    }
    cancelRequest(requestId) {
        const pending = pendingRequests.get(requestId);
        if (pending) {
            clearTimeout(pending.timeout);
            pendingRequests.delete(requestId);
        }
    }
    cancelAll() {
        for (const [requestId, pending] of pendingRequests) {
            clearTimeout(pending.timeout);
        }
        pendingRequests.clear();
    }
}
export default AskUserExecutor;
