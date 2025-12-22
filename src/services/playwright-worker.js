const { chromium } = require('playwright');

class PlaywrightWorker {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isInitialized = false;
    this.debugMode = false;
  }

  async initialize(debugMode = false) {
    try {
      if (this.isInitialized && this.debugMode === debugMode) {
        return { success: true };
      }

      // Close existing browser if settings changed
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
      }

      this.debugMode = debugMode;
      
      this.browser = await chromium.launch({
        headless: !this.debugMode,
        slowMo: this.debugMode ? 500 : 100,
        devtools: this.debugMode,
        args: this.debugMode ? [
          '--start-maximized',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ] : []
      });

      const context = await this.browser.newContext();
      this.page = await context.newPage();
      this.isInitialized = true;

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  async navigate(url) {
    try {
      if (!this.page) {
        throw new Error('Playwright not initialized');
      }

      await this.page.goto(url, { waitUntil: 'networkidle' });
      const currentUrl = this.page.url();

      const redirectedToLogin = currentUrl.includes('/login') || 
                               currentUrl.includes('giris') || 
                               currentUrl.includes('auth') ||
                               currentUrl.includes('login.jsp');

      return {
        success: true,
        currentUrl,
        redirectedToLogin
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async login(credentials) {
    try {
      if (!this.page) {
        throw new Error('Playwright not initialized');
      }

      // Wait for SGK login form
      await this.page.waitForSelector('input[name*="text1"]', { timeout: 10000 });
      await this.page.waitForSelector('input[name*="secret1"]', { timeout: 10000 });

      // Fill username
      const usernameField = await this.page.$('input[name*="text1"]');
      if (!usernameField) {
        throw new Error('Could not find username field');
      }
      await usernameField.clear();
      await usernameField.fill(credentials.username);

      // Fill password
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
      await captchaField.fill(captchaResult.solution);

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
        error: error.message
      };
    }
  }

  async handleCaptcha() {
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
      const fetch = (await import('node-fetch')).default;
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
        error: error.message
      };
    }
  }

  async searchPrescription(prescriptionNumber) {
    try {
      if (!this.page) {
        throw new Error('Playwright not initialized');
      }

      // Navigate to the search page
      const searchPageUrl = 'https://medeczane.sgk.gov.tr/eczane/faces/index.jsp';
      const searchNavResult = await this.navigate(searchPageUrl);
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
          console.log('No navigation occurred, content might be updated in place');
        }),
        searchButton.click()
      ]);

      // Wait a moment for the results to load
      await this.page.waitForTimeout(3000);

      // Extract prescription data
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
        error: error.message
      };
    }
  }

  async extractPrescriptionData() {
    try {
      if (!this.page) {
        return { error: 'Page not available' };
      }

      await this.page.waitForTimeout(2000);
      const pageContent = await this.page.content();
      
      const hasResults = pageContent.includes('sonuç') || 
                        pageContent.includes('bulunamadı') || 
                        pageContent.includes('geçerli') ||
                        pageContent.includes('geçersiz');

      return {
        hasResults,
        pageUrl: this.page.url(),
        extractedAt: new Date().toISOString(),
      };

    } catch (error) {
      return {
        error: error.message
      };
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
      }
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  isReady() {
    return this.isInitialized && this.page !== null;
  }

  getCurrentUrl() {
    return this.page?.url() || null;
  }
}

// IPC Communication
const worker = new PlaywrightWorker();

process.on('message', async (message) => {
  const { id, action, data } = message;
  let result;

  try {
    switch (action) {
      case 'initialize':
        result = await worker.initialize(data?.debugMode || false);
        break;
      case 'navigate':
        result = await worker.navigate(data.url);
        break;
      case 'login':
        result = await worker.login(data.credentials);
        break;
      case 'searchPrescription':
        result = await worker.searchPrescription(data.prescriptionNumber);
        break;
      case 'close':
        result = await worker.close();
        break;
      case 'isReady':
        result = { success: true, ready: worker.isReady() };
        break;
      case 'getCurrentUrl':
        result = { success: true, currentUrl: worker.getCurrentUrl() };
        break;
      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }

  // Send result back to main process
  process.send({ id, result });
});

console.log('Playwright worker started');