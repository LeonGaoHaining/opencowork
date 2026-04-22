import { AgentStep } from '../stores/taskStore';

interface VisualTurnLike {
  turnId?: string;
  observationSummary?: string;
  proposedActions?: Array<{ type?: string }>;
  executedActions?: Array<{ type?: string }>;
  finalMessage?: string;
  duration?: number;
}

export function mapVisualTurnsToAgentSteps(turns: unknown): AgentStep[] {
  if (!Array.isArray(turns)) {
    return [];
  }

  return turns.map((turn, index) => {
    const visualTurn = (turn || {}) as VisualTurnLike;
    const proposedActions = Array.isArray(visualTurn.proposedActions) ? visualTurn.proposedActions : [];
    const executedActions = Array.isArray(visualTurn.executedActions) ? visualTurn.executedActions : [];
    const actionSummary = proposedActions.map((action) => action?.type).filter(Boolean).join(', ');

    return {
      id: visualTurn.turnId || `visual-turn-${index}`,
      toolName: 'visual',
      args: {
        action: 'turn',
        summary: actionSummary || 'visual turn',
        observationSummary: visualTurn.observationSummary,
        proposedActions,
        executedActions,
      },
      status: visualTurn.finalMessage ? 'completed' : executedActions.length > 0 ? 'completed' : 'running',
      result: visualTurn.finalMessage || actionSummary || visualTurn.observationSummary || 'visual turn',
      duration: visualTurn.duration,
    } as AgentStep;
  });
}
