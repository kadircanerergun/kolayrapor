import { useState, useCallback } from 'react';

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
      const result = await window.playwrightAPI.initialize();
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
      const result = await window.playwrightAPI.navigate(url);
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
      console.log('navigateToSGK: About to call window.playwrightAPI.navigateToSGK()');
      const result = await window.playwrightAPI.navigateToSGK();
      console.log('navigateToSGK: Got result:', result);

      // Handle auto-login if redirected
      if (result.redirectedToLogin) {
        const credentials = localStorage.getItem('credentials');
        if (credentials) {
          try {
            const creds = JSON.parse(credentials);
            console.log('navigateToSGK: Auto-logging in due to redirect...');
            // Clear any previous captcha debug data
            clearCaptchaDebug();
            
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
            
            const loginResult = await window.playwrightAPI.login(creds);
            console.log = originalConsoleLog; // Restore original console.log
            console.log('navigateToSGK: Auto-login result:', loginResult);
            setSuccess(loginResult);
            return loginResult;
          } catch {
            setError('Failed to parse stored credentials');
            return { success: false, error: 'Failed to parse stored credentials' };
          }
        } else {
          setError('No credentials found for automatic login');
          return { success: false, error: 'No credentials found for automatic login' };
        }
      }

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
      const result = await window.playwrightAPI.searchPrescription(prescriptionNumber);
      setSuccess(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Prescription search failed';
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
      
      const result = await window.playwrightAPI.login(credentials);
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
      const result = await window.playwrightAPI.getCurrentUrl();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get current URL';
      return { success: false, error: errorMessage };
    }
  }, []);

  const checkReady = useCallback(async () => {
    try {
      const result = await window.playwrightAPI.isReady();
      setState(prev => ({ ...prev, isReady: result.ready }));
      return result;
    } catch (error) {
      return { success: false, ready: false };
    }
  }, []);

  const close = useCallback(async () => {
    try {
      const result = await window.playwrightAPI.close();
      setState(prev => ({ ...prev, isReady: false }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Close failed';
      return { success: false, error: errorMessage };
    }
  }, []);

  const setDebugMode = useCallback(async (enabled: boolean) => {
    try {
      const result = await window.playwrightAPI.setDebugMode(enabled);
      if (result.success) {
        setState(prev => ({ ...prev, debugMode: enabled }));
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set debug mode';
      return { success: false, error: errorMessage };
    }
  }, []);

  const getDebugMode = useCallback(async () => {
    try {
      const result = await window.playwrightAPI.getDebugMode();
      if (result.success && typeof result.debugMode === 'boolean') {
        setState(prev => ({ ...prev, debugMode: result.debugMode! }));
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get debug mode';
      return { success: false, error: errorMessage };
    }
  }, []);

  const restart = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.playwrightAPI.restart();
      if (result.success) {
        setState(prev => ({ ...prev, isReady: true, isLoading: false }));
        setSuccess(result);
      } else {
        setError(result.error || 'Restart failed');
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Restart failed';
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
    login,
    getCurrentUrl,
    checkReady,
    close,
    setDebugMode,
    getDebugMode,
    restart
  };
}
