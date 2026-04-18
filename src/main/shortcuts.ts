import { globalShortcut, BrowserWindow } from 'electron';
import { TASK_ENGINE_CONFIG } from '../config/constants';

export function setupShortcuts(mainWindow: BrowserWindow | null): void {
  // ESC键 - 中断任务并保存状态
  const escRegistered = globalShortcut.register('Escape', () => {
    console.log('[Shortcut] ESC pressed - triggering interrupt');
    if (mainWindow) {
      mainWindow.webContents.send('shortcut:interrupt');
    }
  });

  if (!escRegistered) {
    console.warn('[Shortcut] Failed to register ESC shortcut');
  }

  console.log('[Shortcut] Global shortcuts registered');
}

export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
  console.log('[Shortcut] All shortcuts unregistered');
}
