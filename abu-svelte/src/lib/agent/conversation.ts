import type { AgentMemory, AgentModelIntent } from './router';
import type {
  AgentDraftState,
  AgentTurnHistoryContext,
  AgentTurnRequest,
  AgentTurnResult
} from './provider';

const FLOW_MAX_TEXT = 4000;
const FLOW_MAX_ITEMS = 40;
const FLOW_MAX_DEPTH = 6;

export interface AgentConversationLogPayload {
  prompt: string;
  response: string;
  status: string;
  context: string;
  source: string;
  error: boolean;
  changeDecision?: string;
  modelIntent: AgentModelIntent | null;
  navigation?: Record<string, unknown> | null;
  action?: string;
  agentResult?: Record<string, unknown> | null;
  agentFlow?: Record<string, unknown> | null;
}

export interface AgentConversationDeps {
  runTurn: (request: AgentTurnRequest) => Promise<AgentTurnResult>;
  appendHistoryPrompt: (prompt: string, scope: string) => Promise<string>;
  resolveHistoryPrompt: (id: string, response: string, error?: boolean) => Promise<void>;
  setHistoryLogId: (id: string, logId: string) => void;
  logConversation: (payload: AgentConversationLogPayload) => Promise<string>;
  resolveScope: () => string;
  buildHistoryContext: (scope: string) => AgentTurnHistoryContext | null;
  getMemoryForScope: (scope: string) => AgentMemory;
  setMemoryForScope: (scope: string, memory: AgentMemory) => void;
  getDraftForScope: (scope: string) => AgentDraftState;
  setDraftForScope: (scope: string, draft: AgentDraftState) => void;
}

export interface AgentConversationPromptRequest {
  prompt: string;
  context: string;
  selectedSheetId: string | number | null;
}

export interface AgentConversationPromptResult {
  ok: boolean;
  status: string;
  displayStatus: string;
  response: string;
  source: string;
  action: string;
  modelIntent: AgentModelIntent | null;
}

const sanitizeFlowValue = (value: unknown, depth = 0): unknown => {
  if (depth >= FLOW_MAX_DEPTH) return '[max-depth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length <= FLOW_MAX_TEXT) return value;
    const remaining = value.length - FLOW_MAX_TEXT;
    return `${value.slice(0, FLOW_MAX_TEXT)}...[truncated ${remaining} chars]`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const sliced = value.slice(0, FLOW_MAX_ITEMS);
    const mapped = sliced.map((entry) => sanitizeFlowValue(entry, depth + 1));
    if (value.length > FLOW_MAX_ITEMS) {
      mapped.push(`[truncated ${value.length - FLOW_MAX_ITEMS} items]`);
    }
    return mapped;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).slice(0, FLOW_MAX_ITEMS);
    const mapped: Record<string, unknown> = Object.fromEntries(
      entries.map(([key, entry]) => [key, sanitizeFlowValue(entry, depth + 1)])
    );
    if (Object.keys(value).length > FLOW_MAX_ITEMS) {
      mapped.__truncated_keys = Object.keys(value).length - FLOW_MAX_ITEMS;
    }
    return mapped;
  }
  return String(value);
};

const toErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

export const createAgentConversation = (deps: AgentConversationDeps) => ({
  runPrompt: async (
    request: AgentConversationPromptRequest
  ): Promise<AgentConversationPromptResult> => {
    const promptText = (request.prompt || '').trim();
    if (!promptText) {
      return {
        ok: false,
        status: 'Bitte einen Prompt eingeben.',
        displayStatus: 'Bitte einen Prompt eingeben.',
        response: '',
        source: 'navigation',
        action: 'validation_error',
        modelIntent: null
      };
    }

    const scope = deps.resolveScope();
    const historyEntryId = await deps.appendHistoryPrompt(promptText, scope);
    const historyContext = deps.buildHistoryContext(scope);
    let modelIntent: AgentModelIntent | null = null;
    const flowStartedAt = new Date().toISOString();
    const flowSteps: Array<{ type: string; at: string; data: unknown }> = [];

    const addFlowStep = (type: string, payload: unknown = {}) => {
      flowSteps.push({
        type,
        at: new Date().toISOString(),
        data: sanitizeFlowValue(payload)
      });
    };

    const buildFlowPayload = (state: 'success' | 'error', extra: Record<string, unknown> = {}) => ({
      version: 1,
      state,
      startedAt: flowStartedAt,
      finishedAt: new Date().toISOString(),
      context: request.context,
      ...extra,
      steps: flowSteps
    });

    addFlowStep('prompt_received', {
      prompt: promptText,
      context: request.context
    });
    addFlowStep('history_context', {
      scope,
      hasSummary: Boolean(historyContext?.summary),
      turns: historyContext?.turns?.length ?? 0
    });

    const finalizeSuccess = async (
      status: string,
      message: string,
      extra: {
        source?: string;
        action?: string;
        changeDecision?: string;
        navigation?: Record<string, unknown> | null;
        agentResult?: Record<string, unknown> | null;
      } = {}
    ) => {
      const finalResponse = message || status || '';
      await deps.resolveHistoryPrompt(historyEntryId, finalResponse);
      addFlowStep('finalize_success', {
        status: status || '',
        response: finalResponse,
        source: extra.source || 'navigation',
        action: extra.action || ''
      });
      const logId = await deps.logConversation({
        prompt: promptText,
        response: finalResponse,
        status: status || '',
        context: request.context,
        source: extra.source || 'navigation',
        error: false,
        changeDecision: (extra.changeDecision || 'none').toString(),
        modelIntent,
        navigation: extra.navigation ?? null,
        action: extra.action || '',
        agentResult: extra.agentResult ?? null,
        agentFlow: buildFlowPayload('success', {
          finalStatus: status || '',
          finalSource: extra.source || 'navigation'
        })
      });
      if (logId) {
        deps.setHistoryLogId(historyEntryId, logId);
      }
      return {
        ok: true,
        status,
        displayStatus: '',
        response: finalResponse,
        source: extra.source || 'navigation',
        action: extra.action || '',
        modelIntent
      } satisfies AgentConversationPromptResult;
    };

    const finalizeError = async (
      status: string,
      extra: {
        source?: string;
        action?: string;
        changeDecision?: string;
        navigation?: Record<string, unknown> | null;
        agentResult?: Record<string, unknown> | null;
      } = {}
    ) => {
      const message = status || 'Agent-Aufruf fehlgeschlagen';
      await deps.resolveHistoryPrompt(historyEntryId, message, true);
      addFlowStep('finalize_error', {
        status: status || '',
        response: message,
        source: extra.source || 'agent_api',
        action: extra.action || ''
      });
      const logId = await deps.logConversation({
        prompt: promptText,
        response: message,
        status: status || '',
        context: request.context,
        source: extra.source || 'agent_api',
        error: true,
        changeDecision: (extra.changeDecision || 'none').toString(),
        modelIntent,
        navigation: extra.navigation ?? null,
        action: extra.action || '',
        agentResult: extra.agentResult ?? null,
        agentFlow: buildFlowPayload('error', {
          finalStatus: status || '',
          finalSource: extra.source || 'agent_api'
        })
      });
      if (logId) {
        deps.setHistoryLogId(historyEntryId, logId);
      }
      return {
        ok: false,
        status: message,
        displayStatus: message,
        response: message,
        source: extra.source || 'agent_api',
        action: extra.action || '',
        modelIntent
      } satisfies AgentConversationPromptResult;
    };

    try {
      const turn = await deps.runTurn({
        prompt: promptText,
        context: request.context,
        scope,
        memory: deps.getMemoryForScope(scope),
        draft: deps.getDraftForScope(scope),
        selectedSheetId: request.selectedSheetId,
        history: historyContext
      });

      modelIntent = turn.modelIntent ?? null;
      deps.setMemoryForScope(scope, turn.memory);
      deps.setDraftForScope(scope, turn.draft);

      for (const step of turn.steps || []) {
        addFlowStep(step.type, step.data || {});
      }

      if (!turn.ok) {
        return await finalizeError(turn.status || 'Agent-Aufruf fehlgeschlagen', {
          source: turn.source || 'agent_runtime',
          action: turn.action || 'error',
          changeDecision: turn.changeDecision || 'none',
          navigation: turn.navigation ?? null,
          agentResult: turn.agentResult ?? null
        });
      }

      return await finalizeSuccess(turn.status || 'Antwort erhalten.', turn.message || '', {
        source: turn.source || 'navigation',
        action: turn.action || '',
        changeDecision: turn.changeDecision || 'none',
        navigation: turn.navigation ?? null,
        agentResult: turn.agentResult ?? null
      });
    } catch (err) {
      const status = toErrorMessage(err, 'Agent-Aufruf fehlgeschlagen');
      addFlowStep('agent_exception', { message: status });
      return await finalizeError(status, {
        source: 'agent_runtime',
        action: 'exception'
      });
    }
  }
});
