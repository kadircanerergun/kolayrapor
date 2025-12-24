import { ipcMain } from 'electron';
import { playwrightService } from '../../services/playwright-automation';

function createHandler(channel: string, handler: Function) {
  return ipcMain.handle(channel, async (event, ...args) => {
    // Send log to renderer since main process console is suppressed
    event.sender.executeJavaScript(`console.log('[MAIN] ${channel}:', ${JSON.stringify(args)})`);
    try {
      const result = await handler(...args);
      event.sender.executeJavaScript(`console.log('[MAIN] ${channel} result:', ${JSON.stringify(result)})`);
      return result;
    } catch (error) {
      event.sender.executeJavaScript(`console.error('[MAIN] ${channel} error:', ${JSON.stringify(error.message)})`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}

export function setupPlaywrightIPC() {
  console.log('Setting up Playwright IPC handlers...');
  
  // Initialize Playwright
  createHandler('playwright:initialize', async () => {
    await playwrightService.initialize();
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

  // Restart Playwright
  createHandler('playwright:restart', async () => {
    await playwrightService.close();
    await playwrightService.initialize(true);
    return { success: true };
  });

  console.log('Playwright IPC handlers registered');
}