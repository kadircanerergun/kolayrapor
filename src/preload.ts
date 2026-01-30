import { ipcRenderer, contextBridge } from "electron";
import { IPC_CHANNELS } from "./constants";

window.addEventListener("message", (event) => {
  if (event.data === IPC_CHANNELS.START_ORPC_SERVER) {
    const [serverPort] = event.ports;

    ipcRenderer.postMessage(IPC_CHANNELS.START_ORPC_SERVER, null, [serverPort]);
  }
});

// Expose Playwright API to renderer
contextBridge.exposeInMainWorld('playwrightAPI', {
  initialize: () => {
    return ipcRenderer.invoke('playwright:initialize');
  },
  ensureBrowsers: () => {
    return ipcRenderer.invoke('playwright:ensureBrowsers');
  },
  onBrowserInstallProgress: (callback: (progress: { status: string; message: string; progress?: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: { status: string; message: string; progress?: number }) => {
      callback(progress);
    };
    ipcRenderer.on('playwright:browserInstallProgress', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('playwright:browserInstallProgress', handler);
    };
  },
  navigate: (url: string) => {
    return ipcRenderer.invoke('playwright:navigate', url);
  },
  login: (credentials: { username: string; password: string }) => {
    console.log('preload: login called');
    return ipcRenderer.invoke('playwright:login', credentials);
  },
  navigateToSGK: () => {
    console.log('preload: navigateToSGK called');
    return ipcRenderer.invoke('playwright:navigateToSGK');
  },
  searchPrescription: (prescriptionNumber: string) =>
    ipcRenderer.invoke('playwright:searchPrescription', prescriptionNumber),

  searchByDateRange: (startDate: string, endDate: string) =>
    ipcRenderer.invoke('playwright:searchByDateRange', startDate, endDate),

  getCurrentUrl: () => ipcRenderer.invoke('playwright:getCurrentUrl'),
  isReady: () => ipcRenderer.invoke('playwright:isReady'),
  close: () => ipcRenderer.invoke('playwright:close'),
  setDebugMode: (enabled: boolean) => ipcRenderer.invoke('playwright:setDebugMode', enabled),
  getDebugMode: () => ipcRenderer.invoke('playwright:getDebugMode'),
  restart: () => ipcRenderer.invoke('playwright:restart'),
  setCredentials: (credentials: { username: string; password: string }) => ipcRenderer.invoke('playwright:setCredentials', credentials),
  getStoredCredentials: () => ipcRenderer.invoke('playwright:getStoredCredentials'),
  hasCredentials: () => ipcRenderer.invoke('playwright:hasCredentials'),
  autoLogin: () => ipcRenderer.invoke('playwright:autoLogin')
});

// Expose Secure Storage API to renderer
contextBridge.exposeInMainWorld('secureStorage', {
  isAvailable: () => ipcRenderer.invoke('secureStorage:isAvailable'),
  setCredentials: (credentials: { username: string; password: string; loginTime: string }) =>
    ipcRenderer.invoke('secureStorage:setCredentials', credentials),
  getCredentials: () => ipcRenderer.invoke('secureStorage:getCredentials'),
  clearCredentials: () => ipcRenderer.invoke('secureStorage:clearCredentials'),
  hasCredentials: () => ipcRenderer.invoke('secureStorage:hasCredentials'),
});
