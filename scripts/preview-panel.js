// Preview the KolayAsistan (deeplink) panel window on its own — no Medula
// login and no real check. Boots the renderer dev server, shows the
// "İnceleniyor" pill in the top-right, then closes it.
//
//   npm run preview:panel
//   npm run preview:panel -- --seconds=10 --patient="AYSE DEMIR"
//
// The geometry below mirrors createTaskPanelWindow() in src/main.ts — keep the
// two in sync if the panel's anchoring changes. The dev server is used on
// purpose: a plain `vite build` emits CSS without the Tailwind utilities, so a
// built bundle previews unstyled.
//
// CommonJS on purpose: an ESM entry deadlocks, because Electron cannot emit
// `ready` while the entry module is still evaluating a top-level await.
const path = require('node:path');
const { app, BrowserWindow, ipcMain, screen } = require('electron');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Mirrors IPC_CHANNELS in src/constants/index.ts.
const TASK_PANEL_ACTION = 'task-panel:action';
const TASK_PANEL_RESIZE = 'task-panel:resize';

// Mirrors TASK_PANEL_MARGIN / TASK_PANEL_MIN_WIDTH in src/main.ts.
const MARGIN = 16;
const WIDTH = 84;

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const seconds = Number(arg('seconds', '5'));
const notification = {
  id: 'preview-1',
  receteNo: '1A2B3C4D5',
  patientName: arg('patient', 'MEHMET YILMAZ'),
  status: 'running',
};

function anchor(width, height) {
  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: area.x + area.width - width - MARGIN,
    y: area.y + MARGIN,
    width,
    height,
  };
}

let panel = null;

// The component drives the window exactly as it does in the real app.
ipcMain.on(TASK_PANEL_RESIZE, (_event, size) => {
  if (!panel || panel.isDestroyed()) return;
  const height = typeof size === 'number' ? size : size.height;
  const width =
    typeof size === 'number' ? panel.getBounds().width : (size.width ?? WIDTH);
  panel.setBounds(anchor(width, Math.max(Math.round(height), 40)));
});

ipcMain.on(TASK_PANEL_ACTION, (_event, action) => {
  if (!panel || panel.isDestroyed()) return;
  console.log('[preview] action: ' + action.type);
  if (action.type === 'showPanel') panel.show();
  if (action.type === 'hidePanel') panel.hide();
  if (action.type === 'closePanel') panel.close();
});

app.whenReady().then(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: path.join(PROJECT_ROOT, 'vite.renderer.config.mts'),
    root: PROJECT_ROOT,
    server: { port: 5199, strictPort: false },
    logLevel: 'error',
  });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  console.log('[preview] renderer at ' + url);

  panel = new BrowserWindow({
    ...anchor(WIDTH, 80),
    show: false,
    alwaysOnTop: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    frame: false,
    transparent: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(PROJECT_ROOT, 'scripts', 'preview-panel-preload.js'),
      additionalArguments: [
        '--task-panel',
        '--preview-notification=' +
          encodeURIComponent(JSON.stringify(notification)),
      ],
    },
  });

  await panel.loadURL(url);
  panel.show();
  console.log(
    '[preview] showing "Inceleniyor" pill for ' + seconds + 's — Ctrl+C to stop early',
  );

  setTimeout(async () => {
    console.log('[preview] closing');
    if (panel && !panel.isDestroyed()) panel.destroy();
    await server.close();
    app.quit();
  }, seconds * 1000);
});
