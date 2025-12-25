import { Agent } from 'agents';
import type { Env } from './core-utils';
import type { ChatState, Message, Attachment } from './types';
import { ChatHandler } from './chat';
import { API_RESPONSES } from './config';
import { createMessage, createStreamResponse, createEncoder } from './utils';
export class ChatAgent extends Agent<Env, ChatState> {
  initialState: ChatState = {
    messages: [],
    sessionId: crypto.randomUUID(),
    isProcessing: false,
    model: 'openrouter/openai/gpt-4o-mini',
    tutorState: {
      plan: [],
      currentStepIndex: 0,
      isLessonInitialized: false
    }
  };
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
  private async handleChatMessage(body: {
    message: string;
    model?: string;
    stream?: boolean;
    attachments?: Attachment[];
  }): Promise<Response> {
    const { message, stream, attachments } = body;
    const currentModel = body.model || this.state.model;
    console.log(`[Agent] Processing request with model: ${currentModel}`);
    const chatHandler = new ChatHandler(this.env, currentModel);
    if (!message?.trim() && (!attachments || attachments.length === 0)) {
      return Response.json({ success: false, error: API_RESPONSES.MISSING_MESSAGE }, { status: 400 });
    }
    const userMsg = createMessage('user', message?.trim() || '', undefined);
    if (attachments) {
      userMsg.attachments = attachments;
    }
    const currentState = this.state;
    this.setState({
      ...currentState,
      messages: [...currentState.messages, userMsg],
      isProcessing: true,
      model: currentModel
    });
    try {
      if (stream) {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = createEncoder();
        (async () => {
          try {
            const resp = await chatHandler.processMessage(message || '', currentState, (chunk) => {
              writer.write(encoder.encode(chunk));
            }, attachments);
            this.applyTutorUpdates(resp.toolCalls || []);
            const assistantMsg = createMessage('assistant', resp.content, resp.toolCalls || []);
            this.setState({ ...this.state, messages: [...this.state.messages, assistantMsg], isProcessing: false });
          } catch (err) {
            console.error('[Agent Stream Error]:', err);
            const errorMsg = encoder.encode(`\n\n[Error]: ${err instanceof Error ? err.message : 'Processing failed'}`);
            writer.write(errorMsg);
          } finally {
            writer.close();
          }
        })();
        return createStreamResponse(readable);
      } else {
        const resp = await chatHandler.processMessage(message || '', currentState, undefined, attachments);
        this.applyTutorUpdates(resp.toolCalls || []);
        const assistantMsg = createMessage('assistant', resp.content, resp.toolCalls || []);
        this.setState({ ...this.state, messages: [...this.state.messages, assistantMsg], isProcessing: false });
        return Response.json({ success: true, data: this.state });
      }
    } catch (e) {
      console.error('[Agent Chat Error]:', e);
      this.setState({ ...this.state, isProcessing: false });
      return Response.json({
        success: false,
        error: e instanceof Error ? e.message : API_RESPONSES.PROCESSING_ERROR
      }, { status: 500 });
    }
  }
  private applyTutorUpdates(toolCalls: any[]) {
    if (!toolCalls || toolCalls.length === 0) return;
    const state = this.state;
    let newTutorState = { ...state.tutorState };
    for (const tc of toolCalls) {
      const functionName = tc.name || tc.function?.name;
      const args = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : (tc.arguments || tc.function?.arguments || {});
      if (functionName === 'create_lesson_plan' && args.steps) {
        newTutorState.plan = (args.steps as any[]).map(s => ({ 
          title: s.title || s.goal || 'Untitled Step',
          goal: s.goal || s.title || '', 
          status: 'pending' 
        }));
        if (newTutorState.plan.length > 0) {
          newTutorState.plan[0].status = 'active';
          newTutorState.isLessonInitialized = true;
          newTutorState.currentStepIndex = 0;
        }
      } else if (functionName === 'mark_step_complete') {
        if (newTutorState.plan[newTutorState.currentStepIndex]) {
          newTutorState.plan[newTutorState.currentStepIndex].status = 'completed';
        }
        newTutorState.currentStepIndex++;
        if (newTutorState.plan[newTutorState.currentStepIndex]) {
          newTutorState.plan[newTutorState.currentStepIndex].status = 'active';
        }
      }
    }
    this.setState({ ...state, tutorState: newTutorState });
  }
}