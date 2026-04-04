import { contextBridge, ipcRenderer } from 'electron';

console.log('[Preload] Script loaded, exposing electron API');

export interface ElectronAPI {
  invoke: (channel: string, data?: any) => Promise<any>;
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
  onScreenshot: (callback: (data: { screenshot: string }) => void) => () => void;
}

const electronAPI: ElectronAPI = {
  invoke: (channel: string, data?: any) => {
    console.log(
      '[Preload] invoke called:',
      channel,
      data ? JSON.stringify(data).substring(0, 100) : ''
    );
    return ipcRenderer.invoke(channel, data).then(
      (result) => {
        console.log(
          '[Preload] invoke result for',
          channel,
          ':',
          result === undefined
            ? 'undefined'
            : Array.isArray(result)
              ? `array(${result.length})`
              : typeof result,
          result ? JSON.stringify(result).substring(0, 100) : ''
        );
        return result;
      },
      (error) => {
        console.error('[Preload] invoke error for', channel, ':', error);
        throw error;
      }
    );
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    console.log('[Preload] Registered listener for channel:', channel);
    const listener = (_event: Electron.IpcRendererEvent, ...args: any[]) => {
      console.log('[Preload] Received event, channel:', channel, 'args:', args);
      callback(...args);
    };
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  onScreenshot: (callback: (data: { screenshot: string }) => void) => {
    console.log('[Preload] Registered listener for channel: preview:screenshot');
    const listener = (_event: Electron.IpcRendererEvent, data: { screenshot: string }) => {
      console.log('[Preload] Received event, channel: preview:screenshot', data);
      callback(data);
    };
    ipcRenderer.on('preview:screenshot', listener);
    return () => {
      ipcRenderer.removeListener('preview:screenshot', listener);
    };
  },
};

contextBridge.exposeInMainWorld('electron', electronAPI);
console.log('[Preload] electron API exposed to window.electron');
