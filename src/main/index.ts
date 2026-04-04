import { app, BrowserWindow, globalShortcut } from 'electron';
import * as path from 'path';
import { setupIPC } from './ipc';
import { createMainWindow, createPreviewWindow } from './window';
import { setupShortcuts } from './shortcuts';
import {
  setTaskEnginePreviewWindow,
  setTaskEngineMainWindow,
  getPreviewManager,
} from './ipcHandlers';
import { setAskUserMainWindow } from '../core/executor/AskUserExecutor';
import { setBrowserExecutorMainWindow } from '../core/executor/BrowserExecutor';

let mainWindow: BrowserWindow | null = null;
let previewWindow: BrowserWindow | null = null;

async function bootstrap() {
  // 创建主窗口
  mainWindow = createMainWindow();

  // 设置主窗口引用到 TaskEngine
  setTaskEngineMainWindow(mainWindow);

  // 设置主窗口引用到 AskUserExecutor
  setAskUserMainWindow(mainWindow);

  // 设置主窗口引用到 BrowserExecutor（用于实时截图）
  setBrowserExecutorMainWindow(mainWindow);

  // 初始化 PreviewManager - 不设置默认模式，让用户手动切换
  const previewManager = getPreviewManager();
  await previewManager.initialize(mainWindow);
  // 移除默认 sidebar 模式，让 Renderer 侧边栏正常显示截图
  // await previewManager.setMode('sidebar');

  // 不再默认创建独立预览窗口，只在 detached 模式时创建
  // previewWindow = createPreviewWindow();

  // 设置预览窗口引用到 TaskEngine
  setTaskEnginePreviewWindow(previewWindow);

  // 设置IPC处理器
  setupIPC(mainWindow, previewWindow);

  // 设置全局快捷键
  setupShortcuts(mainWindow);

  // 初始化 Scheduler - 加载持久化任务并启动调度
  try {
    const { initializeScheduler } = await import('../scheduler/scheduler.js');
    const scheduler = await initializeScheduler();
    scheduler.setMainWindow(mainWindow);
    await scheduler.start();
    console.log('[Scheduler] Initialized and started');
  } catch (error) {
    console.error('[Scheduler] Failed to initialize:', error);
  }

  // 开发模式下打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    const previewManager = getPreviewManager();
    previewManager.cleanup();
    mainWindow = null;
    if (previewWindow && !previewWindow.isDestroyed()) {
      previewWindow.close();
    }
  });

  previewWindow?.on('closed', () => {
    previewWindow = null;
  });

  console.log('[OpenCowork] Application started successfully');
}

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    bootstrap();
  }
});

// 错误处理 - AI设备场景下需要退出让系统重启
process.on('uncaughtException', (error) => {
  console.error('[OpenCowork] Uncaught exception:', error);
  console.error('[OpenCowork] Stack:', error.stack);
  app.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[OpenCowork] Unhandled rejection:', reason);
  // AI设备场景：记录但不一定退出，因为可能是异步操作未完成
});
