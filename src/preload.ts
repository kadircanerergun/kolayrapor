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
  initialize: () => ipcRenderer.invoke('playwright:initialize'),
  navigate: (url: string) => ipcRenderer.invoke('playwright:navigate', url),
  login: (credentials: { username: string; password: string }) => 
    ipcRenderer.invoke('playwright:login', credentials),
  navigateToSGK: () => ipcRenderer.invoke('playwright:navigateToSGK'),
  searchPrescription: (prescriptionNumber: string) => 
    ipcRenderer.invoke('playwright:searchPrescription', prescriptionNumber),
  getCurrentUrl: () => ipcRenderer.invoke('playwright:getCurrentUrl'),
  isReady: () => ipcRenderer.invoke('playwright:isReady'),
  close: () => ipcRenderer.invoke('playwright:close'),
  setDebugMode: (enabled: boolean) => ipcRenderer.invoke('playwright:setDebugMode', enabled),
  getDebugMode: () => ipcRenderer.invoke('playwright:getDebugMode'),
  restart: () => ipcRenderer.invoke('playwright:restart')
});
