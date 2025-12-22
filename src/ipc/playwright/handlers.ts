// Use process manager to avoid Electron-Playwright compatibility issues

async function getPlaywrightService() {
  const { playwrightService } = await import('../../services/playwright-process-manager');
  return playwrightService;
}

export const playwrightHandlers = {
  'playwright:initialize': async () => {
    try {
      const service = await getPlaywrightService();
      const result = await service.initialize();
      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Initialization failed' 
      };
    }
  },

  'playwright:navigate': async (url: string) => {
    try {
      const service = await getPlaywrightService();
      const result = await service.navigateTo(url);
      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Navigation failed' 
      };
    }
  },

  'playwright:login': async (credentials: { username: string; password: string }) => {
    try {
      const service = await getPlaywrightService();
      const result = await service.performLogin(credentials);
      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      };
    }
  },

  'playwright:navigateToSGK': async () => {
    try {
      const service = await getPlaywrightService();
      const result = await service.navigateToSGKPortal();
      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'SGK navigation failed' 
      };
    }
  },

  'playwright:searchPrescription': async (prescriptionNumber: string) => {
    try {
      const service = await getPlaywrightService();
      const result = await service.searchPrescription(prescriptionNumber);
      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Prescription search failed' 
      };
    }
  },

  'playwright:getCurrentUrl': async () => {
    try {
      const service = await getPlaywrightService();
      const currentUrl = await service.getCurrentUrl();
      return { 
        success: true, 
        currentUrl 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get current URL' 
      };
    }
  },

  'playwright:isReady': async () => {
    try {
      const service = await getPlaywrightService();
      return { 
        success: true, 
        ready: service.isReady() 
      };
    } catch {
      return { success: true, ready: false };
    }
  },

  'playwright:close': async () => {
    try {
      const service = await getPlaywrightService();
      await service.close();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Close failed' 
      };
    }
  },

  'playwright:setDebugMode': async (enabled: boolean) => {
    try {
      const service = await getPlaywrightService();
      service.setDebugMode(enabled);
      return { 
        success: true, 
        debugMode: enabled 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to set debug mode' 
      };
    }
  },

  'playwright:getDebugMode': async () => {
    try {
      const service = await getPlaywrightService();
      const debugMode = service.getDebugMode();
      return { 
        success: true, 
        debugMode 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get debug mode' 
      };
    }
  },

  'playwright:restart': async () => {
    try {
      const service = await getPlaywrightService();
      await service.close();
      const result = await service.initialize();
      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Restart failed' 
      };
    }
  }
};