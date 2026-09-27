// Preload for `npm run preview:panel`. Stubs the slice of taskPanelAPI that
// src/components/task-panel-window.tsx consumes, so the real component runs
// unmodified: it receives one "running" notification and its showPanel /
// resize / closePanel calls are forwarded to the preview's main process.
const { contextBridge, ipcRenderer } = require('electron');

// Mirrors IPC_CHANNELS in src/constants/index.ts.
const TASK_PANEL_ACTION = 'task-panel:action';
const TASK_PANEL_RESIZE = 'task-panel:resize';

const flag = process.argv.find((a) => a.startsWith('--preview-notification='));
const notification = flag
  ? JSON.parse(decodeURIComponent(flag.split('=').slice(1).join('=')))
  : null;

contextBridge.exposeInMainWorld('taskPanelAPI', {
  isTaskPanel: true,
  onState: (callback) => {
    // Deliver on the next tick so the component has mounted its listener.
    setTimeout(() => callback({ notification }), 0);
  },
  sendAction: (action) => ipcRenderer.send(TASK_PANEL_ACTION, action),
  resize: (size) => ipcRenderer.send(TASK_PANEL_RESIZE, size),
  sendState: () => {},
  onAction: () => {},
});
