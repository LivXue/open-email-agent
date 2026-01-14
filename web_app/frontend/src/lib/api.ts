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
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
