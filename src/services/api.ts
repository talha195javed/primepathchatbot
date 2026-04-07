const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export interface WidgetConfig {
  widgetId: string;
  companyId: string;
  agentId: string;
  name: string;
  description: string;
  photoUrl: string | null;
  chatIconUrl: string | null;
  initialMessage: string | null;
  theme: 'light' | 'dark';
  sendBgColor: string;
  sendTextColor: string;
  receiveBgColor: string;
  receiveTextColor: string;
  height: string;
  width: string;
  zIndex: number;
  isLeftIcon: boolean;
  mainColor: string;
  mainTextColor: string;
  isPlainBackground: boolean;
  chatBgColor: string;
}

export interface ThreadResponse {
  threadId: string;
  customerId: string;
}

export interface ChatResponse {
  threadId: string;
  botResponse: string;
}

export const fetchWidgetConfig = async (widgetId: string): Promise<WidgetConfig> => {
  const res = await fetch(`${API_BASE_URL}/agent/get-widget?widgetId=${widgetId}`);
  if (!res.ok) throw new Error('Failed to fetch widget config');
  return res.json();
};

export const createThread = async (data: {
  companyId: string;
  agentId: string;
  name?: string;
  phone?: string;
  email?: string;
  code?: string;
}): Promise<ThreadResponse> => {
  const res = await fetch(`${API_BASE_URL}/customer/create-customer-thread`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create thread');
  return res.json();
};

export const sendMessage = async (threadId: string, message: string): Promise<ChatResponse> => {
  const res = await fetch(`${API_BASE_URL}/chat/chat-web`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId, message }),
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
};

export const getApiBaseUrl = () => API_BASE_URL;
