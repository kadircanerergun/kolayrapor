// Mock implementation for testing or development  
export const mockPlaywrightAPI = {
  initialize: async () => ({
    success: true,
  }),

  navigate: async (url: string) => ({
    success: true,
    currentUrl: url,
  }),

  login: async (credentials: PlaywrightCredentials) => {
    console.log('Mock login:', credentials);
    return {
      success: true,
      currentUrl: 'https://medula.sgk.gov.tr/home',
    };
  },

  navigateToSGK: async () => ({
    success: true,
    currentUrl: 'https://medula.sgk.gov.tr/eczane',
  }),

  searchPrescription: async (prescriptionNumber: string) => {
    console.log('Mock search prescription:', prescriptionNumber);
    return {
      success: true,
      prescriptionData: {
        number: prescriptionNumber,
        medicines: [
          { name: 'Mock Medicine 1', quantity: 1 },
          { name: 'Mock Medicine 2', quantity: 2 },
        ],
      },
    };
  },

  searchByDateRange: async (startDate: string, endDate: string) => {
    console.log('Mock search by date range:', startDate, 'to', endDate);
    return {
      success: true,
      prescriptions: ['12345', '67890', '11111'],
    };
  },

  getCurrentUrl: async () => 'https://medula.sgk.gov.tr/eczane',

  isReady: async () => true,

  close: async () => {
    console.log('Mock playwright closed');
  },

  setDebugMode: async (enabled: boolean) => {
    console.log('Mock debug mode set to:', enabled);
  },

  getDebugMode: async () => ({
    debugMode: false,
  }),

  restart: async () => {
    console.log('Mock playwright restarted');
  },

  setCredentials: async (credentials: PlaywrightCredentials) => {
    console.log('Mock credentials set:', credentials.username);
  },

  getStoredCredentials: async () => ({
    credentials: {
      username: 'mock-user',
      password: 'mock-password',
    },
  }),

  hasCredentials: async () => ({
    hasCredentials: true,
  }),

  autoLogin: async () => ({
    success: true,
    currentUrl: 'https://medula.sgk.gov.tr/home',
  }),
};

// Function to inject mock into window for testing
export function injectMockPlaywrightAPI() {
  if (typeof window !== 'undefined') {
    (window as any).playwrightAPI = mockPlaywrightAPI;
  }
}