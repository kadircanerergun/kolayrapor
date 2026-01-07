import { useState, useCallback } from 'react';
import { getPlaywrightAPI } from '../utils/playwright-api-loader';

interface PlaywrightState {
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  lastResult: any;
  debugMode: boolean;
  captchaImage: string | null;
  captchaSolution: string | null;
}

export function usePlaywright() {
  const [state, setState] = useState<PlaywrightState>({
    isLoading: false,
    isReady: false,
    error: null,
    lastResult: null,
    debugMode: false,
    captchaImage: null,
    captchaSolution: null
  });

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading, error: null }));
  }, []);

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, isLoading: false, error }));
  }, []);

  const setSuccess = useCallback((result: any) => {
    setState(prev => ({
      ...prev,
      isLoading: false,
      error: null,
      lastResult: result
    }));
  }, []);

  const clearCaptchaDebug = useCallback(() => {
    setState(prev => ({
      ...prev,
      captchaImage: null,
      captchaSolution: null
    }));
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    try {
      const api = getPlaywrightAPI();
      const result = await api.initialize();
      if (result.success) {
        setState(prev => ({ ...prev, isReady: true, isLoading: false }));
        setSuccess(result);
      } else {
        setError(result.error || 'Initialization failed');
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Initialization failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError, setSuccess]);

  const navigate = useCallback(async (url: string) => {
    setLoading(true);
    try {
      const api = getPlaywrightAPI();
      const result = await api.navigate(url);
      setSuccess(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Navigation failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError, setSuccess]);

  const navigateToSGK = useCallback(async () => {
    console.log('navigateToSGK: Starting...');
    setLoading(true);
    try {
      console.log('navigateToSGK: About to call getPlaywrightAPI().navigateToSGK()');
      const result = await getPlaywrightAPI().navigateToSGK();
      console.log('navigateToSGK: Got result:', result);

      setSuccess(result);
      return result;
    } catch (error) {
      console.error('navigateToSGK: Error occurred:', error);
      const errorMessage = error instanceof Error ? error.message : 'SGK navigation failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError, setSuccess, clearCaptchaDebug]);

  const searchPrescription = useCallback(async (prescriptionNumber: string) => {
    setLoading(true);
    try {
      const result = await getPlaywrightAPI().searchPrescription(prescriptionNumber);
      console.log('searchPrescription:', result);
      setSuccess(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Prescription search failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError, setSuccess]);

  const searchByDateRange = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    try {
      const result = await getPlaywrightAPI().searchByDateRange(startDate, endDate);
      console.log('usePlaywright.searchByDateRange:', result);
      setSuccess(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Date range search failed';
      console.log(errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError, setSuccess]);

  const login = useCallback(async (credentials: { username: string; password: string }) => {
    setLoading(true);
    // Clear any previous captcha debug data
    clearCaptchaDebug();
    try {
      // Listen for captcha debug data during login
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        if (args[0] === 'CAPTCHA_DEBUG' && args[1]) {
          try {
            // args[1] should be the data object directly from executeJavaScript
            const data = typeof args[1] === 'string' ? JSON.parse(args[1]) : args[1];
            setState(prev => ({
              ...prev,
              captchaImage: data.image || null,
              captchaSolution: data.solution || null
            }));
          } catch (e) {
            console.error('Failed to parse captcha debug data:', e);
          }
        }
        originalConsoleLog.apply(console, args);
      };

      const result = await getPlaywrightAPI().login(credentials);
      console.log = originalConsoleLog; // Restore original console.log
      setSuccess(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError, setSuccess, clearCaptchaDebug]);

  const getCurrentUrl = useCallback(async () => {
    try {
      const result = await getPlaywrightAPI().getCurrentUrl();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get current URL';
      return { success: false, error: errorMessage };
    }
  }, []);

  const checkReady = useCallback(async () => {
    try {
      const result = await getPlaywrightAPI().isReady();
      setState(prev => ({ ...prev, isReady: result }));
      return result;
    } catch (error) {
      return { success: false, ready: false, error: error };
    }
  }, []);

  const close = useCallback(async () => {
    try {
      const result = await getPlaywrightAPI().close();
      setState(prev => ({ ...prev, isReady: false }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Close failed';
      return { success: false, error: errorMessage };
    }
  }, []);

  const setDebugMode = useCallback(async (enabled: boolean) => {
    try {
      await getPlaywrightAPI().setDebugMode(enabled);
      setState(prev => ({ ...prev, debugMode: enabled }));
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set debug mode';
      return { success: false, error: errorMessage };
    }
  }, []);

  const getDebugMode = useCallback(async () => {
    try {
      const result = await getPlaywrightAPI().getDebugMode();
      setState(prev => ({ ...prev, debugMode: result.debugMode }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get debug mode';
      return { success: false, error: errorMessage };
    }
  }, []);

  const restart = useCallback(async () => {
    setLoading(true);
    try {
      await getPlaywrightAPI().restart();
      setState(prev => ({ ...prev, isReady: true, isLoading: false }));
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Restart failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError]);

  const setCredentials = useCallback(async (credentials: { username: string; password: string }) => {
    try {
      await getPlaywrightAPI().setCredentials(credentials);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set credentials';
      return { success: false, error: errorMessage };
    }
  }, []);

  const getStoredCredentials = useCallback(async () => {
    try {
      const result = await getPlaywrightAPI().getStoredCredentials();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get stored credentials';
      return { success: false, error: errorMessage };
    }
  }, []);

  const hasCredentials = useCallback(async () => {
    try {
      const result = await getPlaywrightAPI().hasCredentials();
      return result;
    } catch (error) {
      return { success: false, hasCredentials: false };
    }
  }, []);

  const autoLogin = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPlaywrightAPI().autoLogin();
      if (result.success) {
        setSuccess(result);
      } else {
        setError(result.error || 'Auto-login failed');
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Auto-login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError, setSuccess]);

  return {
    // State
    isLoading: state.isLoading,
    isReady: state.isReady,
    error: state.error,
    lastResult: state.lastResult,
    debugMode: state.debugMode,
    captchaImage: state.captchaImage,
    captchaSolution: state.captchaSolution,

    // Actions
    initialize,
    navigate,
    navigateToSGK,
    searchPrescription,
    searchByDateRange,
    login,
    getCurrentUrl,
    checkReady,
    close,
    setDebugMode,
    getDebugMode,
    restart,
    setCredentials,
    getStoredCredentials,
    hasCredentials,
    autoLogin
  };
}
