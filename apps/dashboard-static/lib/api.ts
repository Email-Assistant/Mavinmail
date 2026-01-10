import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const selectedModel = localStorage.getItem('selectedModel');

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (selectedModel) {
      config.headers['x-model-id'] = selectedModel;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      if (typeof window !== 'undefined') {
        window.location.href = '/sign-in';
      }
    }
    return Promise.reject(error);
  }
);

// ====================================================================
// Auth API Functions
// ====================================================================

export const signup = async (userData: { email: string; password: string }) => {
  try {
    const response = await api.post('/auth/signup', userData);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Something went wrong during signup');
  }
};

export const login = async (userData: { email: string; password: string }) => {
  try {
    const response = await api.post('/auth/login', userData);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Something went wrong during login');
  }
};

// ====================================================================
// Google OAuth API Functions
// ====================================================================

export const getGoogleUrl = async (): Promise<string> => {
  try {
    const response = await api.get('/auth/google/url');
    return response.data.url;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please log in again.');
    }
    throw new Error(error.response?.data?.error || 'Failed to get Google URL');
  }
};

// ====================================================================
// Connection Status API Functions
// ====================================================================

export interface ConnectionStatus {
  isConnected: boolean;
  email?: string;
}

export interface ConnectedAccount {
  id: number;
  provider: string;
  email: string;
  status: 'Active' | 'Re-auth Needed' | 'Error';
  lastSync?: string;
}

// Get connection status for a user (single account)
export const checkConnectionStatus = async (): Promise<ConnectionStatus> => {
  try {
    const response = await api.get('/user/connection-status');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch connection status:', error);
    return { isConnected: false };
  }
};

// Get all connected accounts for a user (multiple accounts)
export const getConnectedAccounts = async (): Promise<ConnectedAccount[]> => {
  try {
    const response = await api.get('/user/connections');
    return response.data.accounts || [];
  } catch (error: any) {
    console.error('Failed to fetch connected accounts:', error);
    // If endpoint doesn't exist yet, fallback to single account check
    const status = await checkConnectionStatus();
    if (status.isConnected && status.email) {
      return [{
        id: 1,
        provider: 'Gmail',
        email: status.email,
        status: 'Active',
      }];
    }
    return [];
  }
};

// Disconnect a Google account
export const disconnectGoogle = async (accountId?: number) => {
  try {
    // Backend currently only supports /user/connections/google endpoint
    // accountId parameter is for future enhancement when backend supports multiple accounts
    // For now, always use the Google-specific endpoint
    const response = await api.delete('/user/connections/google');
    return response.data || { success: true };
  } catch (error: any) {
    console.error('Disconnect error:', error);
    throw new Error(error.response?.data?.message || 'Failed to disconnect account');
  }
};

// ====================================================================
// User Preferences API Functions
// ====================================================================

export const getModelPreference = async (): Promise<string> => {
  try {
    const response = await api.get('/user/preferences');
    return response.data.preferredModel || '';
  } catch (error) {
    console.error('Failed to fetch model preference:', error);
    return '';
  }
};

export const updateModelPreference = async (modelId: string) => {
  try {
    const response = await api.put('/user/preferences', { preferredModel: modelId });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update preferences');
  }
};

export default api;

