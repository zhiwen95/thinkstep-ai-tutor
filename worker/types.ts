export interface ApiResponse<T = unknown> { success: boolean; data?: T; error?: string; }
export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  id: string;
  toolCalls?: ToolCall[];
  tool_call_id?: string;
}
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}
export interface LessonStep {
  title: string;
  goal: string;
  status: 'pending' | 'active' | 'completed';
}
export interface TutorState {
  plan: LessonStep[];
  currentStepIndex: number;
  isLessonInitialized: boolean;
}
export interface ChatState {
  messages: Message[];
  sessionId: string;
  isProcessing: boolean;
  model: string;
  streamingMessage?: string;
  tutorState: TutorState;
}
export interface SessionInfo {
  id: string;
  title: string;
  createdAt: number;
  lastActive: number;
}
export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}