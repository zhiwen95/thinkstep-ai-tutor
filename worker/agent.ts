import { Agent } from 'agents';
import type { Env } from './core-utils';
import type { ChatState, Message, LessonStep } from './types';
import { ChatHandler } from './chat';
import { API_RESPONSES } from './config';
import { createMessage, createStreamResponse, createEncoder } from './utils';
export class ChatAgent extends Agent<Env, ChatState> {
  private chatHandler?: ChatHandler;
  initialState: ChatState = {
    messages: [],
    sessionId: crypto.randomUUID(),
    isProcessing: false,
    model: 'google-ai-studio/gemini-2.5-flash',
    tutorState: {
      plan: [],
      currentStepIndex: 0,
      isLessonInitialized: false
    }
  };
  async onStart(): Promise<void> {
    this.chatHandler = new ChatHandler(this.env.CF_AI_BASE_URL, this.env.CF_AI_API_KEY, this.state.model);
  }
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/messages') return Response.json({ success: true, data: this.state });
    if (request.method === 'POST' && url.pathname === '/chat') return this.handleChatMessage(await request.json());
    if (request.method === 'DELETE' && url.pathname === '/clear') {
      this.setState(this.initialState);
      return Response.json({ success: true, data: this.state });
    }
    return Response.json({ success: false, error: API_RESPONSES.NOT_FOUND }, { status: 404 });
  }
  private async handleChatMessage(body: { message: string; model?: string; stream?: boolean }): Promise<Response> {
    const { message, stream } = body;
    if (!message?.trim()) return Response.json({ success: false, error: API_RESPONSES.MISSING_MESSAGE }, { status: 400 });
    const userMsg = createMessage('user', message.trim());
    this.setState({ ...this.state, messages: [...this.state.messages, userMsg], isProcessing: true });
    try {
      if (stream) {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = createEncoder();
        (async () => {
          try {
            const resp = await this.chatHandler!.processMessage(message, this.state, (chunk) => {
              writer.write(encoder.encode(chunk));
            });
            this.applyTutorUpdates(resp.toolCalls);
            const assistantMsg = createMessage('assistant', resp.content, resp.toolCalls);
            this.setState({ ...this.state, messages: [...this.state.messages, assistantMsg], isProcessing: false });
          } finally {
            writer.close();
          }
        })();
        return createStreamResponse(readable);
      } else {
        const resp = await this.chatHandler!.processMessage(message, this.state);
        this.applyTutorUpdates(resp.toolCalls);
        const assistantMsg = createMessage('assistant', resp.content, resp.toolCalls);
        this.setState({ ...this.state, messages: [...this.state.messages, assistantMsg], isProcessing: false });
        return Response.json({ success: true, data: this.state });
      }
    } catch (e) {
      this.setState({ ...this.state, isProcessing: false });
      return Response.json({ success: false, error: String(e) }, { status: 500 });
    }
  }
  private applyTutorUpdates(toolCalls?: any[]) {
    if (!toolCalls) return;
    let newTutorState = { ...this.state.tutorState };
    for (const tc of toolCalls) {
      if (tc.name === 'create_lesson_plan') {
        newTutorState.plan = (tc.arguments.steps as any[]).map(s => ({ ...s, status: 'pending' }));
        if (newTutorState.plan.length > 0) {
          newTutorState.plan[0].status = 'active';
          newTutorState.isLessonInitialized = true;
        }
      } else if (tc.name === 'mark_step_complete') {
        if (newTutorState.plan[newTutorState.currentStepIndex]) {
          newTutorState.plan[newTutorState.currentStepIndex].status = 'completed';
        }
        newTutorState.currentStepIndex++;
        if (newTutorState.plan[newTutorState.currentStepIndex]) {
          newTutorState.plan[newTutorState.currentStepIndex].status = 'active';
        }
      }
    }
    this.setState({ ...this.state, tutorState: newTutorState });
  }
}