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
  clearCredentials: () => void;
}

const CredentialsContext = createContext<CredentialsContextType | null>(null);

// Load initial credentials from localStorage
function getInitialCredentials(): Credentials | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('credentials');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

export function CredentialsProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentialsState] = useState<Credentials | null>(getInitialCredentials);
  const playwright = usePlaywright();

  // Sync credentials to Playwright service on mount
  useEffect(() => {
    if (credentials) {
      playwright.setCredentials(credentials).catch(console.error);
    }
  }, []);

  const setCredentials = async (creds: Credentials | null) => {
    if (creds) {
      localStorage.setItem('credentials', JSON.stringify(creds));
      await playwright.setCredentials(creds);
    } else {
      localStorage.removeItem('credentials');
    }
    setCredentialsState(creds);
  };

  const clearCredentials = () => {
    localStorage.removeItem('credentials');
    setCredentialsState(null);
  };

  return (
    <CredentialsContext.Provider value={{ credentials, setCredentials, clearCredentials }}>
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
