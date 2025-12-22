import { fork, ChildProcess } from 'child_process';
import path from 'path';

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

export class PlaywrightProcessManager {
  private worker: ChildProcess | null = null;
  private messageId = 0;
  private pendingMessages = new Map<number, { resolve: Function; reject: Function }>();
  private debugMode = false;

  async initialize(): Promise<void> {
    if (this.worker) {
      return;
    }

    // Start the worker process
    const workerPath = path.join(__dirname, 'playwright-worker.js');
    this.worker = fork(workerPath);

    // Handle messages from worker
    this.worker.on('message', (response: any) => {
      const { id, result } = response;
      const pending = this.pendingMessages.get(id);
      if (pending) {
        this.pendingMessages.delete(id);
        pending.resolve(result);
      }
    });

    // Handle worker errors
    this.worker.on('error', (error: Error) => {
      console.error('Playwright worker error:', error);
      // Reject all pending messages
      for (const [id, pending] of this.pendingMessages) {
        pending.reject(error);
        this.pendingMessages.delete(id);
      }
    });

    // Handle worker exit
    this.worker.on('exit', (code: number | null) => {
      console.log(`Playwright worker exited with code ${code}`);
      this.worker = null;
      // Reject all pending messages
      for (const [id, pending] of this.pendingMessages) {
        pending.reject(new Error('Worker process exited'));
        this.pendingMessages.delete(id);
      }
    });

    // Initialize Playwright in the worker
    await this.sendMessage('initialize', { debugMode: this.debugMode });
  }

  private async sendMessage(action: string, data?: any): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker process not started');
    }

    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pendingMessages.set(id, { resolve, reject });
      
      // Set timeout for the message
      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error('Message timeout'));
        }
      }, 30000); // 30 second timeout

      this.worker!.send({ id, action, data });
    });
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  getDebugMode(): boolean {
    return this.debugMode;
  }

  async navigateTo(url: string): Promise<NavigationResult> {
    try {
      await this.initialize();
      const result = await this.sendMessage('navigate', { url });
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Navigation failed'
      };
    }
  }

  async performLogin(credentials: LoginCredentials): Promise<NavigationResult> {
    try {
      await this.initialize();
      const result = await this.sendMessage('login', { credentials });
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  async navigateToSGKPortal(): Promise<NavigationResult> {
    const sgkUrl = 'https://medeczane.sgk.gov.tr/eczane';
    return this.navigateTo(sgkUrl);
  }

  async searchPrescription(prescriptionNumber: string): Promise<NavigationResult & { prescriptionData?: any }> {
    try {
      await this.initialize();
      
      // First navigate to main portal
      const mainPortalResult = await this.navigateToSGKPortal();
      if (!mainPortalResult.success) {
        return mainPortalResult;
      }

      // If redirected to login, handle it
      if (mainPortalResult.redirectedToLogin) {
        const credentials = localStorage.getItem('credentials');
        if (credentials) {
          try {
            const creds = JSON.parse(credentials);
            const loginResult = await this.performLogin(creds);
            if (!loginResult.success) {
              return loginResult;
            }
          } catch {
            return {
              success: false,
              error: 'Failed to parse stored credentials'
            };
          }
        } else {
          return {
            success: false,
            error: 'No credentials found for automatic login'
          };
        }
      }

      // Perform prescription search
      const result = await this.sendMessage('searchPrescription', { prescriptionNumber });
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Prescription search failed'
      };
    }
  }

  async close(): Promise<void> {
    try {
      if (this.worker) {
        await this.sendMessage('close');
        this.worker.kill();
        this.worker = null;
      }
    } catch (error) {
      console.error('Error closing Playwright:', error);
    }
  }

  isReady(): boolean {
    return this.worker !== null;
  }

  async getCurrentUrl(): Promise<string | null> {
    try {
      if (!this.worker) return null;
      const result = await this.sendMessage('getCurrentUrl');
      return result.currentUrl || null;
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const playwrightService = new PlaywrightProcessManager();