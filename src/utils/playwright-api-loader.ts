import { mockPlaywrightAPI } from '../mocks/playwright-api-mock';

/**
 * Get the Playwright API - either real or mock depending on environment
 */
export function getPlaywrightAPI() {
  // Check if we're in development and want to use mock
  const useMock = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_PLAYWRIGHT === 'true';
  
  if (useMock) {
    console.log('Using mock Playwright API for development');
    return mockPlaywrightAPI;
  }

  // Check if the real API is available
  if (typeof window !== 'undefined' && (window as any).playwrightAPI) {
    return (window as any).playwrightAPI;
  }

  // Fallback to mock if real API is not available
  console.warn('Playwright API not available, falling back to mock');
  return mockPlaywrightAPI;
}

/**
 * Type guard to check if Playwright API is available
 */
export function isPlaywrightAPIAvailable(): boolean {
  return typeof window !== 'undefined' && 'playwrightAPI' in (window as any);
}

/**
 * Initialize the Playwright API based on environment
 */
export function initializePlaywrightAPI(): void {
  if (!isPlaywrightAPIAvailable()) {
    console.log('Real Playwright API not found, mock will be used when needed');
  }
}