import OpenAI from 'openai';
import type { Message, ToolCall, ChatState, Attachment } from './types';
import type { Env } from './core-utils';
import { getToolDefinitions, executeTool } from './tools';
export class ChatHandler {
  private client: OpenAI;
  private model: string;
  constructor(env: any, model: string) {
    this.model = model;
    const isOpenRouter = model.startsWith('openrouter/');
    if (isOpenRouter) {
      const key = env.OPENROUTER_API_KEY;
      if (!key) throw new Error('OPENROUTER_API_KEY is missing in environment');
      this.client = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: key,
        defaultHeaders: {
          'HTTP-Referer': 'https://thinkstep-ai-tutor.pages.dev',
          'X-Title': 'ThinkStep AI Tutor',
        }
      });
      this.model = model.replace(/^openrouter\//, '');
    } else {
      this.client = new OpenAI({
        baseURL: env.CF_AI_BASE_URL,
        apiKey: env.CF_AI_API_KEY,
      });
    }
  }
  async processMessage(
    message: string,
    state: ChatState,
    onChunk?: (chunk: string) => void,
    newAttachments?: Attachment[]
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    try {
      const messages = this.buildConversationMessages(message, state, newAttachments);
      const toolDefinitions = await getToolDefinitions();
      const requestOptions: any = {
        model: this.model,
        messages,
        tools: toolDefinitions,
        tool_choice: 'auto',
        max_tokens: 4000,
      };
      if (onChunk) {
        const stream = await this.client.chat.completions.create({ ...requestOptions, stream: true });
        return this.handleStreamResponse(stream, messages, onChunk);
      }
      const completion = await this.client.chat.completions.create({ ...requestOptions, stream: false });
      return this.handleNonStreamResponse(completion, messages);
    } catch (error: any) {
      console.error('[ChatHandler Error]:', error);
      const errorMsg = error?.message || 'Connection to AI model failed';
      throw new Error(`Model Error (${this.model}): ${errorMsg}`);
    }
  }
  private formatMessageContent(m: { content: string; attachments?: Attachment[] }) {
    if (m.attachments && m.attachments.length > 0) {
      const contentBlocks: any[] = [];
      if (m.content) contentBlocks.push({ type: 'text', text: m.content });
      for (const attachment of m.attachments) {
        if (attachment.type === 'image') {
          contentBlocks.push({
            type: 'image_url',
            image_url: {
              url: attachment.url,
              detail: 'auto'
            }
          });
        }
      }
      return contentBlocks;
    }
    return m.content;
  }
  private buildConversationMessages(userMessage: string, state: ChatState, newAttachments?: Attachment[]) {
    const { tutorState } = state;
    const currentStepIndex = tutorState.currentStepIndex ?? 0;
    const currentStep = tutorState.plan?.[currentStepIndex];
    const systemPrompt = `You are ThinkStep, an expert Socratic Tutor.
Your goal is to guide students through complex problems using a step-by-step Lesson Plan.
CORE RULES:
1. If no lesson plan exists, analyze the user's problem and call 'create_lesson_plan'.
2. Present only ONE step at a time. Do not dump the full solution.
3. Be encouraging and ask "Checking Questions" to verify understanding.
4. Only advance (call 'mark_step_complete') when the user demonstrates understanding of the current goal.
5. If the user is confused, stay on the current step and try a different explanation.
Current Lesson State:
${tutorState.isLessonInitialized ? `
- Current Step: ${currentStepIndex + 1} of ${tutorState.plan?.length || 0}
- Current Goal: ${currentStep?.goal || 'N/A'}
` : '- No lesson plan created yet.'}`;
    const history = state.messages.slice(-12).map(m => ({
      role: m.role as any,
      content: this.formatMessageContent(m),
      ...(m.toolCalls && {
        tool_calls: m.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
        }))
      }),
      ...(m.tool_call_id && { tool_call_id: m.tool_call_id })
    }));
    return [
      { role: 'system' as const, content: systemPrompt },
      ...history,
      { role: 'user' as const, content: this.formatMessageContent({ content: userMessage, attachments: newAttachments }) }
    ];
  }
  private async handleStreamResponse(stream: any, history: any[], onChunk: (chunk: string) => void) {
    let fullContent = '';
    const accumulatedToolCalls: any[] = [];
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        fullContent += delta.content;
        onChunk(delta.content);
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!accumulatedToolCalls[tc.index]) {
            accumulatedToolCalls[tc.index] = { id: tc.id, function: { name: '', arguments: '' } };
          }
          if (tc.function?.name) accumulatedToolCalls[tc.index].function.name += tc.function.name;
          if (tc.function?.arguments) accumulatedToolCalls[tc.index].function.arguments += tc.function.arguments;
        }
      }
    }
    if (accumulatedToolCalls.length > 0) {
      const toolResults = await this.executeToolCalls(accumulatedToolCalls);
      const newMessages = this.buildToolFollowUp(history, accumulatedToolCalls, toolResults);
      const followUpStream = await this.client.chat.completions.create({
        model: this.model,
        messages: newMessages,
        stream: true
      });
      for await (const chunk of followUpStream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          onChunk(delta.content);
        }
      }
      return { content: fullContent, toolCalls: toolResults };
    }
    return { content: fullContent };
  }
  private async handleNonStreamResponse(completion: any, history: any[]) {
    const resp = completion.choices[0]?.message;
    if (resp?.tool_calls) {
      const toolResults = await this.executeToolCalls(resp.tool_calls);
      const messages = this.buildToolFollowUp(history, resp.tool_calls, toolResults);
      const followUp = await this.client.chat.completions.create({
        model: this.model,
        messages
      });
      return { content: followUp.choices[0]?.message?.content || '', toolCalls: toolResults };
    }
    return { content: resp?.content || '' };
  }
  private buildToolFollowUp(history: any[], toolCalls: any[], toolResults: ToolCall[]) {
    return [
      ...history,
      { role: 'assistant', content: null, tool_calls: toolCalls },
      ...toolResults.map(tr => ({
        role: 'tool',
        content: JSON.stringify(tr.result),
        tool_call_id: tr.id
      }))
    ];
  }
  private async executeToolCalls(openAiToolCalls: any[]): Promise<ToolCall[]> {
    return Promise.all(openAiToolCalls.map(async (tc) => {
      let args = {};
      try {
        args = typeof tc.function.arguments === 'string' 
          ? JSON.parse(tc.function.arguments) 
          : tc.function.arguments;
      } catch (e) {
        console.warn('Failed to parse tool arguments:', tc.function.arguments);
      }
      const result = await executeTool(tc.function.name, args);
      return { id: tc.id, name: tc.function.name, arguments: args, result };
    }));
  }
}