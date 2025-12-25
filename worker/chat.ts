import OpenAI from 'openai';
import type { Message, ToolCall, ChatState } from './types';
import { getToolDefinitions, executeTool } from './tools';
import { ChatCompletionMessageFunctionToolCall } from 'openai/resources/index.mjs';
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
    onChunk?: (chunk: string) => void
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const messages = this.buildConversationMessages(message, state);
    const toolDefinitions = await getToolDefinitions();
    const requestOptions = {
      model: this.model,
      messages,
      tools: toolDefinitions,
      tool_choice: 'auto',
      max_tokens: 4000,
    };
    if (onChunk) {
      const stream = await this.client.chat.completions.create({ ...requestOptions, stream: true });
      return this.handleStreamResponse(stream, message, state.messages, onChunk);
    }
    const completion = await this.client.chat.completions.create({ ...requestOptions, stream: false });
    return this.handleNonStreamResponse(completion, message, state.messages);
  }
  private buildConversationMessages(userMessage: string, state: ChatState) {
    const { tutorState } = state;
    const currentStep = tutorState.plan[tutorState.currentStepIndex];
    let systemPrompt = `You are ThinkStep, an expert Socratic Tutor.
Your goal is to guide students through complex problems using a step-by-step Lesson Plan.
CORE RULES:
1. If no lesson plan exists, analyze the user's problem and call 'create_lesson_plan'.
2. Present only ONE step at a time. Do not dump the full solution.
3. Be encouraging and ask "Checking Questions" to verify understanding.
4. Only advance (call 'mark_step_complete') when the user demonstrates understanding of the current goal.
5. If the user is confused, stay on the current step and try a different explanation.
Current Lesson State:
${tutorState.isLessonInitialized ? `
- Current Step: ${tutorState.currentStepIndex + 1} of ${tutorState.plan.length}
- Current Goal: ${currentStep?.goal || 'N/A'}
` : '- No lesson plan created yet.'}`;
    return [
      { role: 'system' as const, content: systemPrompt },
      ...state.messages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant' | 'system' | 'tool',
        content: m.content,
        ...(m.toolCalls && { tool_calls: m.toolCalls }),
        ...(m.tool_call_id && { tool_call_id: m.tool_call_id })
      })),
      { role: 'user' as const, content: userMessage }
    ];
  }
  private async handleStreamResponse(stream: any, message: string, history: Message[], onChunk: any) {
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
          if (!accumulatedToolCalls[tc.index]) accumulatedToolCalls[tc.index] = { id: tc.id, function: { name: '', arguments: '' } };
          if (tc.function?.name) accumulatedToolCalls[tc.index].function.name += tc.function.name;
          if (tc.function?.arguments) accumulatedToolCalls[tc.index].function.arguments += tc.function.arguments;
        }
      }
    }
    if (accumulatedToolCalls.length > 0) {
      const toolCalls = await this.executeToolCalls(accumulatedToolCalls);
      const followUp = await this.generateToolResponse(message, history, accumulatedToolCalls, toolCalls);
      return { content: followUp, toolCalls };
    }
    return { content: fullContent };
  }
  private async handleNonStreamResponse(completion: any, message: string, history: Message[]) {
    const resp = completion.choices[0]?.message;
    if (resp?.tool_calls) {
      const toolCalls = await this.executeToolCalls(resp.tool_calls);
      const followUp = await this.generateToolResponse(message, history, resp.tool_calls, toolCalls);
      return { content: followUp, toolCalls };
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
  private async generateToolResponse(userMessage: string, history: Message[], openAiToolCalls: any[], toolResults: ToolCall[]) {
    const messages: any[] = [
      { role: 'system', content: 'You are ThinkStep. Now provide your pedagogical response based on the tool result.' },
      ...history.slice(-5).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
      { role: 'assistant', content: null, tool_calls: openAiToolCalls },
      ...toolResults.map(tr => ({ role: 'tool', content: JSON.stringify(tr.result), tool_call_id: tr.id }))
    ];
    const completion = await this.client.chat.completions.create({ model: this.model, messages });
    return completion.choices[0]?.message?.content || '';
  }
  updateModel(newModel: string): void { this.model = newModel; }
}