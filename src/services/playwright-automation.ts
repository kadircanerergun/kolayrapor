// Lazy import of Playwright to avoid Electron startup issues
import type { Page, ChromiumBrowser } from 'playwright';
let chromium: typeof import('playwright').chromium;

interface NavigationResult {
  success: boolean;
  currentUrl?: string;
  redirectedToLogin?: boolean;
  error?: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

async function loadPlaywright() {
  if (!chromium) {
    try {
      const pw = await import('playwright');
      chromium = pw.chromium;
    } catch (error) {
      throw new Error(`Failed to load Playwright: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export class PlaywrightAutomationService {
  private browser: ChromiumBrowser | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  private debugMode: boolean = false;

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    // If changing debug mode while browser is running, we need to restart
    if (this.isInitialized) {
      console.log(`Debug mode changed to ${enabled}, browser will restart on next action`);
    }
  }

  getDebugMode(): boolean {
    return this.debugMode;
  }

  async initialize(forceRestart: boolean = false): Promise<void> {
    try {
      // Load Playwright dynamically
      await loadPlaywright();

      // If already initialized and not forcing restart, return
      if (this.isInitialized && !forceRestart) return;

      // Close existing browser if restarting
      if (forceRestart && this.browser) {
        await this.close();
      }

      this.browser = await chromium.launch({
        headless: !this.debugMode, // Show browser when debug mode is enabled
        slowMo: this.debugMode ? 500 : 100, // Slower when debugging
        devtools: this.debugMode, // Open devtools in debug mode
        args: this.debugMode ? [
          '--start-maximized',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ] : []
      });

      const context = await this.browser.newContext();
      this.page = await context.newPage();
      this.isInitialized = true;

      console.log('Playwright automation service initialized');
    } catch (error) {
      console.error('Failed to initialize Playwright:', error);
      throw error;
    }
  }

  async navigateTo(url: string): Promise<NavigationResult> {
    try {
      if (!this.page) {
        throw new Error('Playwright not initialized');
      }

      await this.page.goto(url, { waitUntil: 'networkidle' });
      const currentUrl = this.page.url();

      // Check if redirected to login page
      const redirectedToLogin = currentUrl.includes('/login') && !url.includes('/login');
      if (redirectedToLogin) {
        console.log("Redirected to login page, performing login");
        await this.page.waitForLoadState('load')
        const pageContent = await this.page.content();
        console.log('pageContent', pageContent);
      }

      return {
        success: true,
        currentUrl,
        redirectedToLogin
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Navigation failed'
      };
    }
  }

  async performLogin(credentials: LoginCredentials): Promise<NavigationResult> {
    try {
      if (!this.page) {
        throw new Error('Playwright not initialized');
      }

      // Wait for SGK login form
      await this.page.waitForSelector('input[name*="text1"]', { timeout: 10000 });
      await this.page.waitForSelector('input[name*="secret1"]', { timeout: 10000 });

      // Fill username - specific SGK selector
      const usernameField = await this.page.$('input[name*="text1"]');
      if (!usernameField) {
        throw new Error('Could not find username field');
      }

      await usernameField.clear();
      await usernameField.fill(credentials.username);

      // Fill password - specific SGK selector
      const passwordField = await this.page.$('input[type="password"][name*="secret1"]');
      if (!passwordField) {
        throw new Error('Could not find password field');
      }

      await passwordField.clear();
      await passwordField.fill(credentials.password);

      // Handle captcha
      const captchaResult = await this.handleCaptcha();
      if (!captchaResult.success) {
        throw new Error(`Captcha handling failed: ${captchaResult.error}`);
      }

      // Fill captcha solution
      const captchaField = await this.page.$('input[name*="j_id_jsp_2072829783_5"]');
      if (!captchaField) {
        throw new Error('Could not find captcha field');
      }

      await captchaField.clear();
      await captchaField.fill(captchaResult.solution!);

      // Check KVKK consent checkbox
      const consentCheckbox = await this.page.$('input[name*="kvkkTaahhut"]');
      if (consentCheckbox) {
        await consentCheckbox.check();
      }

      // Click login button
      const loginButton = await this.page.$('input[type="submit"][value="Giriş Yap"]');
      if (!loginButton) {
        throw new Error('Could not find login button');
      }

      // Submit form and wait for navigation
      await Promise.all([
        this.page.waitForNavigation({ timeout: 15000 }),
        loginButton.click()
      ]);

      const currentUrl = this.page.url();
      const stillOnLogin = currentUrl.includes('login.jsp');

      return {
        success: !stillOnLogin,
        currentUrl,
        redirectedToLogin: stillOnLogin,
        error: stillOnLogin ? 'Login failed - still on login page' : undefined
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  private async handleCaptcha(): Promise<{ success: boolean; solution?: string; error?: string }> {
    try {
      if (!this.page) {
        throw new Error('Page not initialized');
      }

      // Find captcha image
      const captchaImage = await this.page.$('img[src="/eczane/SayiUretenImageYeniServlet"]');
      if (!captchaImage) {
        throw new Error('Could not find captcha image');
      }

      // Get image as base64
      const imageBuffer = await captchaImage.screenshot();
      const base64Image = imageBuffer.toString('base64');

      // Send to captcha solving API
      const response = await fetch('http://localhost:3000/medula/numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          image: base64Image
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = await response.json();

      if (!result.numbers) {
        throw new Error('No captcha solution received from API');
      }

      return {
        success: true,
        solution: result.numbers
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Captcha handling failed'
      };
    }
  }

  async navigateToSGKPortal(): Promise<NavigationResult> {
    const sgkUrl = 'https://medeczane.sgk.gov.tr/eczane';
    console.log('Navigating to SGK portal:', sgkUrl);
    return this.navigateTo(sgkUrl);
  }

  async searchPrescription(prescriptionNumber: string): Promise<NavigationResult & { prescriptionData?: unknown }> {
    try {
      if (!this.page) {
        throw new Error('Playwright not initialized');
      }

      // First navigate to main portal URL
      const mainPortalResult = await this.navigateToSGKPortal();
      if (!mainPortalResult.success) {
        return mainPortalResult;
      }

      // If redirected to login, the navigate function should handle it
      if (mainPortalResult.redirectedToLogin) {
        // Login should have been handled automatically by navigateTo
        // Wait a moment for post-login redirect
        await this.page.waitForTimeout(2000);
      }

      // Navigate to the search page
      const searchPageUrl = 'https://medeczane.sgk.gov.tr/eczane/faces/index.jsp';
      const searchNavResult = await this.navigateTo(searchPageUrl);
      if (!searchNavResult.success) {
        return searchNavResult;
      }

      // Wait for the prescription number form
      await this.page.waitForSelector('input[name="form1:text1"]', { timeout: 10000 });

      // Fill the prescription number
      const prescriptionField = await this.page.$('input[name="form1:text1"]');
      if (!prescriptionField) {
        throw new Error('Could not find prescription number field');
      }

      await prescriptionField.clear();
      await prescriptionField.fill(prescriptionNumber);

      // Click the search button
      const searchButton = await this.page.$('input[type="submit"][value="Sorgula"]#form1\\:buttonReceteNoSorgula');
      if (!searchButton) {
        throw new Error('Could not find search button');
      }

      // Submit the form and wait for results
      await Promise.all([
        this.page.waitForNavigation({ timeout: 15000 }).catch(() => {
          // Sometimes the page doesn't navigate, just updates content
          console.log('No navigation occurred, content might be updated in place');
        }),
        searchButton.click()
      ]);

      // Wait a moment for the results to load
      await this.page.waitForTimeout(3000);

      // Extract prescription data (you can customize this based on the actual results structure)
      const prescriptionData = await this.extractPrescriptionData();

      return {
        success: true,
        currentUrl: this.page.url(),
        prescriptionData: {
          number: prescriptionNumber,
          searchResults: prescriptionData,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Prescription search failed'
      };
    }
  }

  private async extractPrescriptionData(): Promise<unknown> {
    try {
      if (!this.page) {
        return { error: 'Page not available' };
      }

      // Wait for results to appear (adjust selector based on actual results structure)
      await this.page.waitForTimeout(2000);

      // Extract any visible data from the results
      // This is a basic implementation - you can customize based on the actual SGK results structure
      const pageContent = await this.page.content();

      // Look for common result patterns (customize based on actual SGK response)
      const hasResults = pageContent.includes('sonuç') ||
                        pageContent.includes('bulunamadı') ||
                        pageContent.includes('geçerli') ||
                        pageContent.includes('geçersiz');

      return {
        hasResults,
        pageUrl: this.page.url(),
        extractedAt: new Date().toISOString(),
        // Add more specific data extraction here based on SGK portal structure
      };

    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Data extraction failed'
      };
    }
  }

  async close(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
      }
    } catch (error) {
      console.error('Error closing Playwright:', error);
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.page !== null;
  }

  getCurrentUrl(): string | null {
    return this.page?.url() || null;
  }
}

// Export singleton instance
export const playwrightService = new PlaywrightAutomationService();
