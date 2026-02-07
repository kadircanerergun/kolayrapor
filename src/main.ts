import "dotenv/config";
import { app, autoUpdater, BrowserWindow, dialog } from "electron";
import path from "path";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
  REDUX_DEVTOOLS,
} from "electron-devtools-installer";
import { ipcMain } from "electron/main";
import { ipcContext } from "@/ipc/context";
import { IPC_CHANNELS } from "./constants";
import { setupPlaywrightIPC } from "./ipc/playwright";
import { setupSecureStorageIPC } from "./ipc/secure-storage";

// Handle Squirrel events (install, uninstall, update) on Windows.
// This must be at the top before any other logic runs.
import electronSquirrelStartup from "electron-squirrel-startup";
if (electronSquirrelStartup) app.quit();

// Ensure only one instance of the app runs at a time.
// This prevents "Access is denied" errors on Windows when cache files are locked.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('Another instance is already running. Quitting...');
  app.quit();
}

app.on('second-instance', () => {
  // Someone tried to run a second instance, focus our window instead
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    if (windows[0].isMinimized()) windows[0].restore();
    windows[0].focus();
  }
});

const inDevelopment = process.env.NODE_ENV === "development";
const apiUrl = "https://kolay-rapor-api-8503f0bb8557.herokuapp.com"
console.log('API URL:', apiUrl);

// --- Auto-Update ---

const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

function setupAutoUpdater() {
  // Don't check updates on first install — Squirrel holds a lock
  if (process.argv.includes("--squirrel-firstrun")) return;

  // Never auto-update in development
  if (inDevelopment) {
    console.log("Auto-updater disabled in development mode.");
    return;
  }

  // Feed URL: directory containing RELEASES + .nupkg files
  // Squirrel appends /RELEASES automatically
  const feedURL = "https://kolayasistan.uk/kolay-rapor/releases/win32/x64";

  try {
    autoUpdater.setFeedURL({ url: feedURL });
  } catch (err) {
    console.error("Failed to set auto-update feed URL:", err);
    return;
  }

  autoUpdater.on("checking-for-update", () => {
    console.log("Checking for update...");
  });

  autoUpdater.on("update-available", () => {
    console.log("Update available, downloading...");
  });

  autoUpdater.on("update-not-available", () => {
    console.log("App is up to date.");
  });

  autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
    console.log(`Update downloaded: ${releaseName}`);

    const mainWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      // No window available, install on next restart
      return;
    }

    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Güncelleme Hazır",
        message: `Yeni sürüm ${releaseName ? `(${releaseName}) ` : ""}indirildi.`,
        detail:
          "Uygulamayı şimdi yeniden başlatarak güncellemek ister misiniz?",
        buttons: ["Şimdi Güncelle", "Daha Sonra"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on("error", (err) => {
    console.error("Auto-update error:", err);
    // Silently fail — don't block the user
  });

  // Check now, then periodically
  autoUpdater.checkForUpdates();
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, UPDATE_CHECK_INTERVAL);
}

// --- Window ---

function createWindow() {
  const preload = path.join(__dirname, "preload.js");
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    icon: path.join(__dirname, "../../images/icon.ico"),
    webPreferences: {
      devTools: inDevelopment,
      contextIsolation: true,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: false,
      preload: preload,
      webviewTag: true,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition:
      process.platform === "darwin" ? { x: 15, y: 5 } : undefined,
  });
  ipcContext.setMainWindow(mainWindow);

  // Security: restrict webview capabilities
  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences, _params) => {
    // Disable node integration in webview for security
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

async function installExtensions() {
  // Only install devtools extensions in development mode
  if (!inDevelopment) {
    console.log('Skipping extension installation in production mode');
    return;
  }

  // Add timeout to prevent hanging when disk cache is locked
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.log('Extension installation timed out, continuing...');
      resolve();
    }, 5000); // 5 second timeout
  });

  const installPromise = (async () => {
    try {
      const react = await installExtension(REACT_DEVELOPER_TOOLS);
      console.log(`Extension installed: ${react.name}`);
      const redux = await installExtension(REDUX_DEVTOOLS);
      console.log(`Extension installed: ${redux.name}`);
    } catch (err) {
      console.error("Failed to install extensions:", err);
    }
  })();

  // Race between installation and timeout
  await Promise.race([installPromise, timeoutPromise]);
}


async function setupORPC() {
  const { rpcHandler } = await import("./ipc/handler");

  ipcMain.on(IPC_CHANNELS.START_ORPC_SERVER, (event) => {
    const [serverPort] = event.ports;

    serverPort.start();
    rpcHandler.upgrade(serverPort);
  });
}

// Only initialize the app if we got the single instance lock
if (gotTheLock) {
  app
    .whenReady()
    .then(createWindow)  // Create window first so user sees something
    .then(setupORPC)
    .then(() => {
      console.log('Setting up IPC handlers...');
      setupSecureStorageIPC();
      setupPlaywrightIPC();
      console.log('IPC handlers registered');
    })
    .then(setupAutoUpdater)
    .then(() => {
      // Install extensions last (non-blocking for app functionality)
      installExtensions().catch(err => {
        console.error('Extension installation failed:', err);
      });
    })
    .catch((error) => {
      console.error('App initialization error:', error);
    });

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
}
