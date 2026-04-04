export interface ElectronAPI {
  invoke: (channel: string, data?: any) => Promise<any>;
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
  onScreenshot: (callback: (data: { screenshot: string }) => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
