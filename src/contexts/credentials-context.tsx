import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePlaywright } from '@/hooks/usePlaywright';

interface Credentials {
  username: string;
  password: string;
  loginTime: string;
}

interface CredentialsContextType {
  credentials: Credentials | null;
  setCredentials: (creds: Credentials | null) => Promise<void>;
  clearCredentials: () => Promise<void>;
  isLoading: boolean;
}

const CredentialsContext = createContext<CredentialsContextType | null>(null);

export function CredentialsProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentialsState] = useState<Credentials | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const playwright = usePlaywright();

  // Load credentials from secure storage on mount
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const result = await window.secureStorage.getCredentials();
        if (result.success && result.credentials) {
          setCredentialsState(result.credentials);
          // Also sync to Playwright service
          await playwright.setCredentials(result.credentials);
        }
      } catch (error) {
        console.error('Failed to load credentials:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCredentials();
  }, []);

  const setCredentials = async (creds: Credentials | null) => {
    if (creds) {
      const result = await window.secureStorage.setCredentials(creds);
      if (result.success) {
        await playwright.setCredentials(creds);
        setCredentialsState(creds);
      } else {
        throw new Error(result.error || 'Failed to save credentials');
      }
    } else {
      await window.secureStorage.clearCredentials();
      setCredentialsState(null);
    }
  };

  const clearCredentials = async () => {
    await window.secureStorage.clearCredentials();
    setCredentialsState(null);
  };

  return (
    <CredentialsContext.Provider value={{ credentials, setCredentials, clearCredentials, isLoading }}>
      {children}
    </CredentialsContext.Provider>
  );
}

export function useCredentials() {
  const context = useContext(CredentialsContext);
  if (!context) {
    throw new Error('useCredentials must be used within a CredentialsProvider');
  }
  return context;
}
