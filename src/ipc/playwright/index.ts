import { ipcMain } from 'electron';
import { playwrightHandlers } from './handlers';

export function setupPlaywrightIPC() {
  Object.entries(playwrightHandlers).forEach(([channel, handler]) => {
    ipcMain.handle(channel, async (event, ...args) => {
      console.log(`[IPC] Playwright action: ${channel}`, args);
      try {
        const result = await handler(...args);
        console.log(`[IPC] Playwright result: ${channel}`, result);
        return result;
      } catch (error) {
        console.error(`[IPC] Playwright error: ${channel}`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  });

  console.log('Playwright IPC handlers registered');
}