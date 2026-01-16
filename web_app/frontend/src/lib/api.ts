import axios from 'axios';

const API_BASE_URL = '/api';

export interface EnvSettings {
  MODEL: string;
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  DISPLAY_REASONING: boolean;
  TAVILY_API_KEY: string;
  USERNAME: string;
  PASSWORD: string;
  IMAP_SERVER: string;
  IMAP_PORT: number;
  IMAP_USE_PROXY: boolean;
  SMTP_SERVER: string;
  SMTP_PORT: number;
  SMTP_USE_SSL: boolean;
  SMTP_USE_PROXY: boolean;
  DONT_SET_READ: boolean;
  PROXY?: string;
  BACKEND_PORT: number;
  FRONTEND_PORT: number;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
  withCredentials: false, // Set to true if you need to send cookies
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - Status: ${response.status}`);
    return response;
  },
  (error) => {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        console.error('API Timeout:', error.config?.url);
      } else if (error.response) {
        console.error(`API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url} - Status: ${error.response.status}`);
      } else if (error.request) {
        console.error('API Network Error: No response received from', error.config?.url);
      } else {
        console.error('API Request Setup Error:', error.message);
      }
    } else {
      console.error('Unexpected API Error:', error);
    }
    return Promise.reject(error);
  }
);

export const settingsApi = {
  getSettings: async (): Promise<EnvSettings> => {
    const response = await api.get<EnvSettings>('/settings');
    return response.data;
  },

  updateSettings: async (settings: EnvSettings): Promise<{ status: string; message: string }> => {
    const response = await api.post('/settings', settings);
    return response.data;
  },
};

export const healthApi = {
  check: async (): Promise<{ status: string; timestamp: string }> => {
    const response = await api.get('/health');
    return response.data;
  },
};

// ==================== Contacts API ====================

export interface Contact {
  id: string;
  name: string;
  emails: string[];
  groups: string[];
  created_time: string;
  update_time: string;
}

export interface ContactCreate {
  name: string;
  emails?: string[];
  groups?: string[];
}

export interface ContactUpdate {
  name?: string;
  emails?: string[];
  groups?: string[];
}

export interface ContactsResponse {
  status: string;
  contacts: Contact[];
  total: number;
}

export interface ContactResponse {
  status: string;
  contact: Contact;
  message?: string;
}

export interface GroupsResponse {
  status: string;
  groups: string[];
  total: number;
}

export const contactsApi = {
  // Get all contacts with optional filtering
  getContacts: async (params?: {
    name?: string;
    email?: string;
    group?: string;
  }): Promise<ContactsResponse> => {
    const response = await api.get<ContactsResponse>('/contacts', { params });
    return response.data;
  },

  // Get a single contact by ID
  getContact: async (id: string): Promise<ContactResponse> => {
    const response = await api.get<ContactResponse>(`/contacts/${id}`);
    return response.data;
  },

  // Create a new contact
  createContact: async (contact: ContactCreate): Promise<ContactResponse> => {
    const response = await api.post<ContactResponse>('/contacts', contact);
    return response.data;
  },

  // Update an existing contact
  updateContact: async (id: string, contact: ContactUpdate): Promise<ContactResponse> => {
    const response = await api.put<ContactResponse>(`/contacts/${id}`, contact);
    return response.data;
  },

  // Delete a contact
  deleteContact: async (id: string): Promise<{ status: string; message: string }> => {
    const response = await api.delete<{ status: string; message: string }>(`/contacts/${id}`);
    return response.data;
  },

  // Get all groups
  getGroups: async (): Promise<GroupsResponse> => {
    const response = await api.get<GroupsResponse>('/groups');
    return response.data;
  },
};
