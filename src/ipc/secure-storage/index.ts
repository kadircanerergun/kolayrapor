import { ipcMain, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const CREDENTIALS_FILE = 'credentials.enc';

function getCredentialsPath(): string {
  return path.join(app.getPath('userData'), CREDENTIALS_FILE);
}

export function setupSecureStorageIPC() {
  console.log('Setting up Secure Storage IPC handlers...');

  // Check if encryption is available
  ipcMain.handle('secureStorage:isAvailable', () => {
    return safeStorage.isEncryptionAvailable();
  });

  // Save credentials securely
  ipcMain.handle('secureStorage:setCredentials', async (_event, credentials: { username: string; password: string; loginTime: string }) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return { success: false, error: 'Encryption not available' };
      }

      const data = JSON.stringify(credentials);
      const encrypted = safeStorage.encryptString(data);
      const filePath = getCredentialsPath();

      fs.writeFileSync(filePath, encrypted);

      return { success: true };
    } catch (error) {
      console.error('Failed to save credentials:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get credentials securely
  ipcMain.handle('secureStorage:getCredentials', async () => {
    try {
      const filePath = getCredentialsPath();

      if (!fs.existsSync(filePath)) {
        return { success: true, credentials: null };
      }

      if (!safeStorage.isEncryptionAvailable()) {
        return { success: false, error: 'Encryption not available' };
      }

      const encrypted = fs.readFileSync(filePath);
      const decrypted = safeStorage.decryptString(encrypted);
      const credentials = JSON.parse(decrypted);

      return { success: true, credentials };
    } catch (error) {
      console.error('Failed to get credentials:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Clear credentials
  ipcMain.handle('secureStorage:clearCredentials', async () => {
    try {
      const filePath = getCredentialsPath();

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to clear credentials:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Check if credentials exist
  ipcMain.handle('secureStorage:hasCredentials', async () => {
    const filePath = getCredentialsPath();
    return { success: true, hasCredentials: fs.existsSync(filePath) };
  });

  console.log('Secure Storage IPC handlers registered');
}
