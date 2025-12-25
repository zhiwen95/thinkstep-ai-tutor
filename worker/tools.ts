import { mcpManager } from './mcp-client';
export type ToolResult = { content: string } | { error: string } | any;
const tutorTools = [
  {
    type: 'function' as const,
    function: {
      name: 'create_lesson_plan',
      description: 'Create a structured learning roadmap with multiple steps to solve the user problem.',
      parameters: {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Short title of the step' },
                goal: { type: 'string', description: 'Educational goal for this step' }
              },
              required: ['title', 'goal']
            }
          }
        },
        required: ['steps']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'mark_step_complete',
      description: 'Mark the current lesson step as finished and move to the next step.',
      parameters: {
        type: 'object',
        properties: {
          feedback: { type: 'string', description: 'Brief observation of student understanding' }
        },
        required: ['feedback']
      }
    }
  }
];
export async function getToolDefinitions() {
  const mcpTools = await mcpManager.getToolDefinitions();
  return [...tutorTools, ...mcpTools];
}
export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      case 'create_lesson_plan':
        return { content: `Lesson plan created with ${Array.isArray(args.steps) ? args.steps.length : 0} steps.` };
      case 'mark_step_complete':
        return { content: `Step marked complete. ${args.feedback || ''}` };
      default: {
        const content = await mcpManager.executeTool(name, args);
        return { content };
      }
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}