export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachments?: Array<{ type: string; url: string }>;
}
export interface TutorState {
  plan: Array<{ title: string; goal: string; status: string }>;
  currentStepIndex: number;
  isLessonInitialized: boolean;
}
export interface ChatResponse {
  success: boolean;
  data?: {
    messages: Message[];
    tutorState: TutorState;
    model: string;
  };
  error?: string;
}
export const MODELS = [
  { id: 'openrouter/openai/gpt-4o-mini', name: 'GPT-4o Mini (Vision)' },
  { id: 'openrouter/openai/gpt-4o', name: 'GPT-4o (Vision)' },
  { id: 'openrouter/anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' }
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
    model: string,
    onChunk?: (chunk: string) => void,
    image?: string
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
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
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
      console.error('ChatService.sendMessage Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to connect to tutor' };
    }
  }
  async getMessages(): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Failed to load conversation' };
    }
  }
  async clearMessages(): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/clear`, { method: 'DELETE' });
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Failed to reset tutor' };
    }
  }
}
export const chatService = new ChatService();