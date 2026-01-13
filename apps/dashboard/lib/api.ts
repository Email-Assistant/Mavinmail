import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

import { getSession, signOut } from "next-auth/react";

// Request interceptor to add auth token to all requests
api.interceptors.request.use(
  async (config) => {
    // 1. Try to get token from NextAuth session first
    const session = await getSession();
    const token = (session as any)?.accessToken || (session as any)?.token;

    // 2. Fallback to localStorage (legacy/dev support) or specialized headers
    const selectedModel = typeof window !== 'undefined' ? localStorage.getItem('selectedModel') : null;

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
      // If 401, we should sign out the user from NextAuth too
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        signOut({ callbackUrl: '/login' });
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
    // If endpoint doesn't exist yet (404), fallback to single account check
    if (error.response?.status === 404) {
      try {
        const status = await checkConnectionStatus();
        if (status.isConnected && status.email) {
          return [{
            id: 1,
            provider: 'Gmail',
            email: status.email,
            status: 'Active',
          }];
        }
      } catch (fallbackError) {
        console.warn('Connection status fallback also failed:', fallbackError);
      }
    } else {
      console.error('Failed to fetch connected accounts:', error);
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

// ====================================================================
// Dashboard API Functions
// ====================================================================

import type {
  DashboardStats,
  ActivityItem,
  UsageTrend,
} from './types';

/**
 * Generate mock dashboard stats for development/fallback
 */
const getMockDashboardStats = (): DashboardStats => ({
  totalEmails: 1234,
  emailsToday: 45,
  emailsIndexed: 1189,
  draftsGenerated: 89,
  questionsAnswered: 156,
  threadsSummarized: 234,
  textEnhancements: 67,
  timeSavedMinutes: 750,
  lastSyncTime: new Date().toISOString(),
  connectedAccounts: 1,
});

/**
 * Generate mock activity feed for development/fallback
 */
const getMockActivityFeed = (): ActivityItem[] => [
  {
    id: 1,
    action: 'summarize',
    description: 'Summarized 25-email thread from Project Alpha',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    success: true,
  },
  {
    id: 2,
    action: 'draft',
    description: "Drafted reply to Sarah's meeting request",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    success: true,
  },
  {
    id: 3,
    action: 'enhance',
    description: 'Enhanced email tone to formal',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    success: true,
  },
  {
    id: 4,
    action: 'rag_query',
    description: 'Answered: "What\'s the deadline for the report?"',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    success: true,
  },
  {
    id: 5,
    action: 'digest',
    description: 'Generated daily digest with 32 emails',
    timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    success: true,
  },
];

/**
 * Generate mock usage trends for development/fallback
 */
const getMockUsageTrends = (): UsageTrend[] => {
  const trends: UsageTrend[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    trends.push({
      date: date.toISOString().split('T')[0],
      total: Math.floor(Math.random() * 30) + 10,
      summarize: Math.floor(Math.random() * 10) + 2,
      draft: Math.floor(Math.random() * 8) + 1,
      enhance: Math.floor(Math.random() * 6) + 1,
      rag: Math.floor(Math.random() * 12) + 3,
    });
  }
  return trends;
};

/**
 * Fetch dashboard statistics
 * Falls back to mock data if backend endpoint is unavailable
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    const response = await api.get('/dashboard/stats');
    return response.data.stats || response.data;
  } catch (error: any) {
    console.warn('Dashboard stats endpoint unavailable, using mock data:', error.message);
    return getMockDashboardStats();
  }
};

/**
 * Fetch recent AI activity feed
 * Falls back to mock data if backend endpoint is unavailable
 */
export const getActivityFeed = async (limit: number = 10): Promise<ActivityItem[]> => {
  try {
    const response = await api.get(`/dashboard/activity?limit=${limit}`);
    // Backend returns { activity: [...] }
    return response.data.activity || response.data.activities || response.data;
  } catch (error: any) {
    console.warn('Activity feed endpoint unavailable, using mock data:', error.message);
    return getMockActivityFeed();
  }
};

/**
 * Fetch usage trends for charts
 * Falls back to mock data if backend endpoint is unavailable
 */
export const getUsageTrends = async (days: number = 7): Promise<UsageTrend[]> => {
  try {
    // Backend endpoint is /dashboard/trends (not /dashboard/usage-trends)
    const response = await api.get(`/dashboard/trends?days=${days}`);
    return response.data.trends || response.data;
  } catch (error: any) {
    console.warn('Usage trends endpoint unavailable, using mock data:', error.message);
    return getMockUsageTrends();
  }
};

/**
 * Get user profile information
 */
export const getUserProfile = async (): Promise<{ email: string; name?: string }> => {
  try {
    const response = await api.get('/user/profile');
    return response.data;
  } catch (error: any) {
    console.warn('User profile endpoint unavailable:', error.message);
    return { email: 'user@example.com', name: 'User' };
  }
};

export default api;

