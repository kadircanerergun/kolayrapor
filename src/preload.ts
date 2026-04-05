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

  navigateToPrescription: (prescriptionNumber: string) =>
    ipcRenderer.invoke('playwright:navigateToPrescription', prescriptionNumber),

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

// Expose Captcha API to renderer (used by webview browse mode)
contextBridge.exposeInMainWorld('captchaAPI', {
  solve: (base64Image: string) => ipcRenderer.invoke('captcha:solve', base64Image),
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

// Expose Deep Link API to renderer
const isDeeplinkWindow = process.argv.includes('--deeplink');
contextBridge.exposeInMainWorld('deeplinkAPI', {
  isDeeplink: isDeeplinkWindow,
  onParams: (callback: (params: { receteNo: string; barkodlar: string[] }) => void) => {
    ipcRenderer.on(IPC_CHANNELS.DEEPLINK_PARAMS, (_event, params) => callback(params));
  },
});

// Expose Task Panel API to renderer
const isTaskPanelWindow = process.argv.includes('--task-panel');
// Cache the latest state so it can be replayed when onState is first called
let cachedTaskPanelState: any = null;
if (isTaskPanelWindow) {
  ipcRenderer.on(IPC_CHANNELS.TASK_PANEL_STATE, (_event, state) => {
    cachedTaskPanelState = state;
  });
}
contextBridge.exposeInMainWorld('taskPanelAPI', {
  isTaskPanel: isTaskPanelWindow,
  // Main window calls this to push state to the panel window via main process
  sendState: (state: any) => {
    ipcRenderer.send(IPC_CHANNELS.TASK_PANEL_STATE, state);
  },
  // Panel window listens for state updates — replays cached state immediately
  onState: (callback: (state: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.TASK_PANEL_STATE, (_event, state) => callback(state));
    // Replay cached state that arrived before React mounted
    if (cachedTaskPanelState) {
      callback(cachedTaskPanelState);
    }
  },
  // Panel window sends actions back to main window
  sendAction: (action: any) => {
    ipcRenderer.send(IPC_CHANNELS.TASK_PANEL_ACTION, action);
  },
  // Panel window requests resize
  resize: (height: number) => {
    ipcRenderer.send(IPC_CHANNELS.TASK_PANEL_RESIZE, height);
  },
  // Main window listens for actions from the panel
  onAction: (callback: (action: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.TASK_PANEL_ACTION, (_event, action) => callback(action));
  },
});
