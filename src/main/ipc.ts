import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../config/constants';
import { IPC_HANDLERS } from './ipcHandlers';

let registeredChannels: string[] = [];

export function setupIPC(
  mainWindow: BrowserWindow | null,
  previewWindow: BrowserWindow | null
): void {
  console.log(
    '[IPC] setupIPC called, mainWindow:',
    mainWindow ? 'exists' : 'null',
    'previewWindow:',
    previewWindow ? 'exists' : 'null'
  );

  registeredChannels = Object.keys(IPC_HANDLERS);
  registeredChannels.forEach((channel) => {
    const ipcHandler = IPC_HANDLERS[channel];
    ipcMain.handle(channel, async (event, payload) => {
      console.log(`[IPC] ${channel}:`, payload, 'mainWindow:', mainWindow ? 'exists' : 'null');
      try {
        const result = await ipcHandler(mainWindow, previewWindow, payload);
        return { success: true, data: result };
      } catch (error: any) {
        console.error(`[IPC] ${channel} error:`, error);
        return { success: false, error: error.message || 'Unknown error' };
      }
    });
  });

  console.log('[IPC] IPC handlers registered');
}

export function cleanupIPC(): void {
  registeredChannels.forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
  registeredChannels = [];
  console.log('[IPC] IPC handlers cleaned up');
}
