import axios from 'axios';

// IMPORTANT: Use the actual backend URL, not a relative path.
const API_URL = 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    // 1. We MUST use chrome.storage in an extension, not localStorage.
    const result = await chrome.storage.local.get(['token', 'selectedModel']);
    const token = result.token;
    const selectedModel = result.selectedModel;

    console.log('API Interceptor: Token found:', !!token, 'Model:', selectedModel);

    // 2. If the token exists, add the Authorization header.
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Add model header if selected
    if (selectedModel) {
      config.headers['x-model-id'] = selectedModel;
    }

    // 3. Return the modified config.
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// We can add an interceptor here later if needed, but for login it's not required.

export const login = async (credentials: { email: string; password: string }) => {
  try {
    const response = await api.post('/auth/login', credentials);
    // The response from your backend should contain the token
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 429) {
      throw new Error(error.response.data.error || 'Too many attempts. Please try again after 15 minutes.');
    }
    throw new Error(error.response?.data?.error || 'Login failed. Please check your credentials.');
  }
};
export const summarizeEmailText = async (text: string): Promise<{ summary: string }> => {
  try {
    // The interceptor will automatically add the auth token
    const response = await api.post('/ai/summarize', { text });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to get summary.');
  }
};



// auto complete
export const fetchAutocomplete = async (text: string): Promise<{ suggestion: string }> => {
  try {
    // The interceptor will automatically add the auth token
    const response = await api.post('/ai/autocomplete', { text });
    return response.data;
  } catch (error: any) {
    console.error("Autocomplete fetch failed:", error);
    // Return a failed state that won't cause a crash
    return { suggestion: '' };
  }
};

export default api;



//rag

export const syncEmails = async (): Promise<{ message: string }> => {
  const response = await api.post('/sync/emails');
  return response.data;
};

export const askQuestion = async (question: string, useRag: boolean = true): Promise<{ answer: string }> => {
  const response = await api.post('/ai/ask', { question, useRag });
  return response.data;
};

/**
 * 🚀 STREAMING: Ask a question with real-time streaming response
 * Uses EventSource to receive SSE stream and calls callbacks for updates
 */
export const askQuestionStream = async (
  question: string,
  useRag: boolean,
  onStatus: (status: string) => void,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (error: string) => void
): Promise<void> => {
  const result = await chrome.storage.local.get(['token', 'selectedModel']);
  const token = result.token;
  const selectedModel = result.selectedModel;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
    if (selectedModel) {
      headers['x-model-id'] = String(selectedModel);
    }

    const response = await fetch(`${API_URL}/ai/ask/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ question, useRag }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            onDone();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'status') {
              onStatus(parsed.message);
            } else if (parsed.type === 'answer') {
              onChunk(parsed.content);
            } else if (parsed.type === 'error') {
              onError(parsed.message);
            }
          } catch (e) {
            // Ignore parse errors for individual lines
          }
        }
      }
    }

    onDone();
  } catch (error: any) {
    onError(error.message || 'Streaming failed');
  }
};


export const getDailyDigest = async (): Promise<{ summary: string }> => {
  const response = await api.get('/gmail/digest'); // Model header added by interceptor
  return response.data;
};

// ====================================================================
// =====> NEW: Sync Model Preference <=====
// ====================================================================
export const syncModelPreference = async () => {
  try {
    const response = await api.get('/user/preferences');
    const { preferredModel } = response.data;
    if (preferredModel) {
      await chrome.storage.local.set({ selectedModel: preferredModel });
      console.log('✅ Extension synced model preference:', preferredModel);
    }
  } catch (error) {
    console.error('Failed to sync model preference:', error);
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


// --- Text Enhancement ---
export const enhanceText = async (text: string, type: 'formal' | 'concise' | 'casual' | 'clarity' | 'more') => {
  try {
    const response = await api.post('/ai/enhance', { text, type });
    return response.data.enhancedText;
  } catch (error) {
    console.error('Error enhancing text:', error);
    throw error;
  }
};

export const getUserStats = async () => {
  const response = await api.get('/dashboard/stats');
  return response.data;
};

export const getConnectionStatus = async (): Promise<{ isConnected: boolean; email?: string }> => {
  const response = await api.get('/user/connection-status');
  return response.data;
};

export const getRecentActivity = async (limit: number = 10) => {
  const response = await api.get(`/dashboard/activity?limit=${limit}`);
  return response.data.activity;
};

export const deleteActivity = async (id: number): Promise<{ success: boolean }> => {
  const response = await api.delete(`/dashboard/activity/${id}`);
  return response.data;
};

// User Profile
export const getUserProfile = async (): Promise<{ firstName: string; lastName: string; email: string }> => {
  try {
    const response = await api.get('/user/profile');
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to get profile.');
  }
};

export const updateUserProfile = async (profile: { firstName: string; lastName: string; email: string }) => {
  try {
    const response = await api.put('/user/profile', profile);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to update profile.');
  }
};

// ====================================================================
// Support Tickets
// ====================================================================

export interface SupportTicket {
  id: number;
  title: string;
  description: string;
  source: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export const createSupportTicket = async (data: { title: string; description: string; priority?: string }) => {
  try {
    const response = await api.post('/support/tickets', {
      ...data,
      source: 'extension',
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to create support ticket.');
  }
};

export const getUserSupportTickets = async (): Promise<{ tickets: SupportTicket[]; pagination: any }> => {
  try {
    const response = await api.get('/support/tickets');
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to get support tickets.');
  }
};

export const deleteSupportTicket = async (id: number): Promise<{ success: boolean; deletedId: number }> => {
  try {
    const response = await api.delete(`/support/tickets/${id}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to delete support ticket.');
  }
};

// ====================================================================
// AI Model API Functions
// ====================================================================

export interface AIModel {
  id: number;
  modelId: string;
  displayName: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
}

// Get active models for selection dropdown
export const getAvailableModels = async (): Promise<AIModel[]> => {
  try {
    const response = await api.get('/models');
    return response.data.models || [];
  } catch (error: any) {
    console.error('Failed to fetch available models:', error);
    return [];
  }
};

// ====================================================================
// System Status
// ====================================================================

export const getPublicSystemStatus = async (): Promise<{
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcement: string;
  announcementActive: boolean;
}> => {
  try {
    // This endpoint should be public (no auth required)
    const response = await api.get('/system/status');
    return response.data;
  } catch (error: any) {
    // Fail silently/gracefully by returning "everything is fine"
    return {
      maintenanceMode: false,
      maintenanceMessage: '',
      announcement: '',
      announcementActive: false,
    };
  }
};
