import "dotenv/config";
import { app, BrowserWindow } from "electron";
import path from "path";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
  REDUX_DEVTOOLS,
} from "electron-devtools-installer";
import { ipcMain } from "electron/main";
import { ipcContext } from "@/ipc/context";
import { IPC_CHANNELS } from "./constants";
import { updateElectronApp, UpdateSourceType } from "update-electron-app";
import { setupPlaywrightIPC } from "./ipc/playwright";
import { setupSecureStorageIPC } from "./ipc/secure-storage";

// Handle Squirrel events (install, uninstall, update) on Windows.
// This must be at the top before any other logic runs.
import electronSquirrelStartup from "electron-squirrel-startup";
if (electronSquirrelStartup) app.quit();

const inDevelopment = process.env.NODE_ENV === "development";
const apiUrl = "https://kolay-rapor-api-8503f0bb8557.herokuapp.com"
console.log('API URL:', apiUrl);
// Playwright IPC will be setup in the promise chain below

function createWindow() {
  const preload = path.join(__dirname, "preload.js");
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    webPreferences: {
      devTools: inDevelopment,
      contextIsolation: true,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: false,
      preload: preload,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition:
      process.platform === "darwin" ? { x: 15, y: 5 } : undefined,
  });
  ipcContext.setMainWindow(mainWindow);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

async function installExtensions() {
  try {
    const react = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Extension installed: ${react.name}`);
    const redux = await installExtension(REDUX_DEVTOOLS);
    console.log(`Extension installed: ${redux.name}`);
  } catch {
    console.error("Failed to install extensions");
  }
}


async function setupORPC() {
  const { rpcHandler } = await import("./ipc/handler");

  ipcMain.on(IPC_CHANNELS.START_ORPC_SERVER, (event) => {
    const [serverPort] = event.ports;

    serverPort.start();
    rpcHandler.upgrade(serverPort);
  });
}

app
  .whenReady()
  .then(installExtensions)
  .then(createWindow)
  .then(setupORPC)
  .then(() => {
    console.log('About to setup Playwright IPC...');
    setupSecureStorageIPC();
    return setupPlaywrightIPC();
  })
  .catch((error) => {
    console.error('App initialization error:', error);
  });

//osX only
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
//osX only ends
