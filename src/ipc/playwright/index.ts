import { ipcMain, BrowserWindow } from 'electron';
import { ipcContext } from '@/ipc/context';
import { playwrightService, ensureBrowsersInstalled, BrowserInstallProgress } from '../../services/playwright-automation';
import { captchaSolverService, ensureSolverInstalled, solveCaptcha } from '../../services/captcha-solver';

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function createHandler(channel: string, handler: Function) {
  // Remove existing handler if present (prevents duplicate handler errors during hot reload)
  ipcMain.removeHandler(channel);
  return ipcMain.handle(channel, async (event, ...args) => {
    // Send log to renderer since main process console is suppressed
    event.sender.executeJavaScript(`console.log('[MAIN] ${channel}:', ${JSON.stringify(args)})`);
    try {
      const result = await handler(...args);
      event.sender.executeJavaScript(`console.log('[MAIN] ${channel} result:', ${JSON.stringify(result)})`);
      return result;
    } catch (error) {
      event.sender.executeJavaScript(
        `console.error('[MAIN] ${channel} error:', ${JSON.stringify(error instanceof Error ? error.message : String(error))})`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}

export function setupPlaywrightIPC() {
  console.log('Setting up Playwright IPC handlers...');

  // Ensure browsers are installed (called from splash screen)
  createHandler('playwright:ensureBrowsers', async () => {
    const window = ipcContext.mainWindow || BrowserWindow.getAllWindows()[0];

    await ensureBrowsersInstalled((progress: BrowserInstallProgress) => {
      // Send progress to renderer
      if (window && !window.isDestroyed()) {
        window.webContents.send('playwright:browserInstallProgress', progress);
      }
    });

    // Yerel captcha çözücü artık tek yol (uzak API fallback'i kaldırıldı), bu
    // yüzden koşulsuz kuruluyor. Yine de burada patlamak uygulamayı açtırmamak
    // anlamına gelirdi; hata durumunda solveCaptcha() ilk captcha'da kurulumu
    // ve başlatmayı tekrar deniyor.
    try {
      await ensureSolverInstalled((progress) => {
        if (window && !window.isDestroyed()) {
          window.webContents.send('playwright:browserInstallProgress', progress);
        }
      });
      // Warm up the model in the background; don't await (it takes a few seconds).
      captchaSolverService.start().catch((err) => {
        console.warn('[CaptchaSolver] start failed, will retry on first solve:', err);
      });
    } catch (err) {
      console.warn('[CaptchaSolver] install failed, will retry on first solve:', err);
    }

    return { success: true };
  });

  // Initialize Playwright
  createHandler('playwright:initialize', async () => {
    const window = ipcContext.mainWindow || BrowserWindow.getAllWindows()[0];

    await playwrightService.initialize(false, (progress: BrowserInstallProgress) => {
      // Send progress to renderer
      if (window && !window.isDestroyed()) {
        window.webContents.send('playwright:browserInstallProgress', progress);
      }
    });

    return { success: true };
  });

  // Navigate to URL
  createHandler('playwright:navigate', async (url: string) => {
    return await playwrightService.navigateTo(url);
  });

  // Login with credentials
  createHandler('playwright:login', async (credentials: { username: string; password: string }) => {
    return await playwrightService.performLogin(credentials);
  });

  // Navigate to SGK portal
  createHandler('playwright:navigateToSGK', async () => {
    return await playwrightService.navigateToSGKPortal();
  });

  // Search prescription
  createHandler('playwright:searchPrescription', async (prescriptionNumber: string) => {
    return await playwrightService.searchPrescription(prescriptionNumber);
  });

  // Navigate to prescription (visual only, no parsing)
  createHandler('playwright:navigateToPrescription', async (prescriptionNumber: string) => {
    return await playwrightService.navigateToPrescription(prescriptionNumber);
  });

  createHandler('playwright:searchByDateRange', async (startDate: string, endDate: string, faturaTuru: '1' | '28' = '1') => {
    return await playwrightService.searchByDateRange(startDate, endDate, faturaTuru);
  });

  // Get current URL
  createHandler('playwright:getCurrentUrl', async () => {
    const currentUrl = playwrightService.getCurrentUrl();
    return { success: true, currentUrl };
  });

  // Check if ready
  createHandler('playwright:isReady', async () => {
    return { success: true, ready: playwrightService.isReady() };
  });

  // Close Playwright
  createHandler('playwright:close', async () => {
    await playwrightService.close();
    return { success: true };
  });

  // Set debug mode
  createHandler('playwright:setDebugMode', async (enabled: boolean) => {
    playwrightService.setDebugMode(enabled);
    return { success: true, debugMode: enabled };
  });

  // Get debug mode
  createHandler('playwright:getDebugMode', async () => {
    const debugMode = playwrightService.getDebugMode();
    return { success: true, debugMode };
  });

  // Set credentials
  createHandler('playwright:setCredentials', async (credentials: { username: string; password: string }) => {
    playwrightService.setCredentials(credentials);
    return { success: true };
  });

  // Get stored credentials
  createHandler('playwright:getStoredCredentials', async () => {
    const credentials = playwrightService.getStoredCredentials();
    return { success: true, credentials };
  });

  // Check if credentials are available
  createHandler('playwright:hasCredentials', async () => {
    const hasCredentials = playwrightService.hasCredentials();
    return { success: true, hasCredentials };
  });

  // Perform auto-login with stored credentials
  createHandler('playwright:autoLogin', async () => {
    return await playwrightService.performAutoLogin();
  });

  // Restart Playwright
  createHandler('playwright:restart', async () => {
    await playwrightService.close();
    await playwrightService.initialize(true);
    return { success: true };
  });

  // Solve captcha (used by webview-based browse mode).
  // Yalnızca bundled offline EasyOCR çözücü kullanılıyor; Playwright login
  // akışıyla aynı solveCaptcha() fonksiyonundan geçiyor.
  createHandler('captcha:solve', async (base64Image: string) => {
    const outcome = await solveCaptcha(base64Image);
    return { success: outcome.success, code: outcome.code, error: outcome.error };
  });

  console.log('Playwright IPC handlers registered');
}
