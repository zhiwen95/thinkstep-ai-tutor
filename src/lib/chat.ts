export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachments?: Array<{ type: string; url: string }>;
}

export interface TutorState {
  plan: Array<{ goal: string; status: string }>;
  currentStepIndex: number;
  isLessonInitialized: boolean;
}

export interface ChatResponse {
  success: boolean;
  data?: {
    messages: Message[];
    tutorState: TutorState;
  };
  error?: string;
}
export const MODELS = [
  { id: 'openrouter/openai/gpt-4o-mini', name: 'GPT-4o Mini (Vision)' },
  { id: 'openrouter/openai/gpt-4o', name: 'GPT-4o' },
  { id: 'cf/google/gemini-1.5-flash-exp', name: 'Gemini 1.5 Flash' }
];
class ChatService {
  private sessionId: string;
  private baseUrl: string;
  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.sessionId = localStorage.getItem('chatSessionId') || crypto.randomUUID();
      localStorage.setItem('chatSessionId', this.sessionId);
    } else {
      this.sessionId = crypto.randomUUID();
    }
    this.baseUrl = `/api/chat/${this.sessionId}`;
  }
  async sendMessage(
    message: string,
    model?: string,
    onChunk?: (chunk: string) => void,
    image?: string // Base64 data URL
  ): Promise<ChatResponse> {
    try {
      const payload: any = { message, model, stream: !!onChunk };
      if (image) {
        payload.attachments = [{ type: 'image', url: image }];
      }
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (onChunk && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            if (chunk) onChunk(chunk);
          }
        } finally {
          reader.releaseLock();
        }
        return { success: true };
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to send message:', error instanceof Error ? error.message : String(error));
      return { success: false, error: 'Failed to send message' };
    }
  }
  async getMessages(): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to get messages:', error instanceof Error ? error.message : String(error));
      return { success: false, error: 'Failed to load messages' };
    }
  }
  async clearMessages(): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/clear`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to clear messages:', error instanceof Error ? error.message : String(error));
      return { success: false, error: 'Failed to clear messages' };
    }
  }
  getSessionId(): string { return this.sessionId; }
  newSession(): void {
    this.sessionId = crypto.randomUUID();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('chatSessionId', this.sessionId);
    }
    this.baseUrl = `/api/chat/${this.sessionId}`;
  }
  switchSession(sessionId: string): void {
    this.sessionId = sessionId;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('chatSessionId', this.sessionId);
    }
    this.baseUrl = `/api/chat/${sessionId}`;
  }
  async createSession(title?: string, sessionId?: string, firstMessage?: string) {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, sessionId, firstMessage })
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to create session:', error instanceof Error ? error.message : String(error));
      return { success: false, error: 'Failed to create session' };
    }
  }
  async listSessions() {
    try {
      const response = await fetch('/api/sessions');
      return await response.json();
    } catch (error) {
      console.error('Failed to list sessions:', error instanceof Error ? error.message : String(error));
      return { success: false, error: 'Failed to list sessions' };
    }
  }
  async deleteSession(sessionId: string) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      return await response.json();
    } catch (error) {
      console.error('Failed to delete session:', error instanceof Error ? error.message : String(error));
      return { success: false, error: 'Failed to delete session' };
    }
  }
}
export const chatService = new ChatService();
export const renderToolCall = (toolCall: { name: string }): string => {
  return `🔧 ${toolCall.name}: Done`;
};