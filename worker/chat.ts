import OpenAI from 'openai';
import type { Message, ToolCall, ChatState, Attachment } from './types';
import { getToolDefinitions, executeTool } from './tools';
export class ChatHandler {
  private client: OpenAI;
  private model: string;
  constructor(aiGatewayUrl: string, apiKey: string, model: string) {
    this.client = new OpenAI({
      baseURL: aiGatewayUrl,
      apiKey: apiKey
    });
    this.model = model;
  }
  async processMessage(
    message: string,
    state: ChatState,
    onChunk?: (chunk: string) => void,
    newAttachments?: Attachment[]
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
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
  }
  private formatMessageContent(m: { content: string; attachments?: Attachment[] }) {
    if (m.attachments && m.attachments.length > 0) {
      const contentBlocks: any[] = [{ type: 'text', text: m.content || 'Please look at this image.' }];
      for (const attachment of m.attachments) {
        if (attachment.type === 'image') {
          contentBlocks.push({ type: 'image_url', image_url: { url: attachment.url } });
        }
      }
      return contentBlocks;
    }
    return m.content;
  }
  private buildConversationMessages(userMessage: string, state: ChatState, newAttachments?: Attachment[]) {
    const { tutorState } = state;
    const currentStep = tutorState.plan[tutorState.currentStepIndex];
    const systemPrompt = `You are ThinkStep, an expert Socratic Tutor.
Your goal is to guide students through complex problems using a step-by-step Lesson Plan.
CORE RULES:
1. If no lesson plan exists, analyze the user's problem (and any provided images) and call 'create_lesson_plan'.
2. Present only ONE step at a time. Do not dump the full solution.
3. Be encouraging and ask "Checking Questions" to verify understanding.
4. Only advance (call 'mark_step_complete') when the user demonstrates understanding of the current goal.
5. If the user is confused, stay on the current step and try a different explanation.
6. Acknowledge any diagrams or images the user provides.
Current Lesson State:
${tutorState.isLessonInitialized ? `
- Current Step: ${tutorState.currentStepIndex + 1} of ${tutorState.plan.length}
- Current Goal: ${currentStep?.goal || 'N/A'}
` : '- No lesson plan created yet.'}`;
    const history = state.messages.slice(-10).map(m => ({
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
    const currentUserMsg = {
      role: 'user' as const,
      content: this.formatMessageContent({ content: userMessage, attachments: newAttachments })
    };
    return [
      { role: 'system' as const, content: systemPrompt },
      ...history,
      currentUserMsg
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
      const followUp = await this.generateToolResponse(history, accumulatedToolCalls, toolResults);
      return { content: followUp, toolCalls: toolResults };
    }
    return { content: fullContent };
  }
  private async handleNonStreamResponse(completion: any, history: any[]) {
    const resp = completion.choices[0]?.message;
    if (resp?.tool_calls) {
      const toolResults = await this.executeToolCalls(resp.tool_calls);
      const followUp = await this.generateToolResponse(history, resp.tool_calls, toolResults);
      return { content: followUp, toolCalls: toolResults };
    }
    return { content: resp?.content || '' };
  }
  private async executeToolCalls(openAiToolCalls: any[]): Promise<ToolCall[]> {
    return Promise.all(openAiToolCalls.map(async (tc) => {
      const args = JSON.parse(tc.function.arguments || '{}');
      const result = await executeTool(tc.function.name, args);
      return { id: tc.id, name: tc.function.name, arguments: args, result };
    }));
  }
  private async generateToolResponse(history: any[], openAiToolCalls: any[], toolResults: ToolCall[]) {
    const messages: any[] = [
      ...history,
      { role: 'assistant', content: null, tool_calls: openAiToolCalls },
      ...toolResults.map(tr => ({ 
        role: 'tool', 
        content: JSON.stringify(tr.result), 
        tool_call_id: tr.id 
      }))
    ];
    const completion = await this.client.chat.completions.create({ 
      model: this.model, 
      messages,
      max_tokens: 2000 
    });
    return completion.choices[0]?.message?.content || '';
  }
  updateModel(newModel: string): void { this.model = newModel; }
}