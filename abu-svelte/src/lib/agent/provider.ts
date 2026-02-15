import type {
  AgentMemory,
  AgentModelIntent,
  AgentNavigationResult
} from './router';

export interface AgentDraftState {
  mode: string;
  html: string;
  message: string;
  blockLevel: boolean;
  view: 'html' | 'visual';
  context: string;
  sourceAction: string;
  selectedSheetId: string | number | null;
  createdAt: string;
}

export interface AgentProviderStep {
  type: string;
  data: Record<string, unknown>;
}

export interface AgentTurnHistoryEntry {
  user: string;
  assistant: string;
}

export interface AgentTurnHistoryContext {
  summary: string;
  turns: AgentTurnHistoryEntry[];
}

export interface AgentTurnRequest {
  prompt: string;
  context: string;
  scope: string;
  memory: AgentMemory;
  draft: AgentDraftState;
  selectedSheetId: string | number | null;
  history: AgentTurnHistoryContext | null;
}

export interface AgentTurnResult {
  ok: boolean;
  status: string;
  message: string;
  source: string;
  action: string;
  modelIntent: AgentModelIntent | null;
  memory: AgentMemory;
  draft: AgentDraftState;
  navigation: Record<string, unknown> | null;
  agentResult: Record<string, unknown> | null;
  steps: AgentProviderStep[];
}

type ApplyDraftResult = {
  ok: boolean;
  status: string;
  message?: string;
  details?: Record<string, unknown>;
};

export interface AgentProviderDeps {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
  readPayload: (res: Response) => Promise<any>;
  resolveNavigation: (params: {
    prompt: string;
    memory: AgentMemory;
    modelIntent: AgentModelIntent | null;
  }) => Promise<AgentNavigationResult>;
  buildContextDetails: (context: string) => Record<string, unknown>;
  buildAgentContextPayload: (context: string) => Record<string, unknown>;
  isApplyDraftPrompt: (prompt: string) => boolean;
  isDiscardDraftPrompt: (prompt: string) => boolean;
  canEditContext: (context: string) => boolean;
  applyDraft: (params: {
    draft: AgentDraftState;
    context: string;
    selectedSheetId: string | number | null;
  }) => Promise<ApplyDraftResult>;
}

const createEmptyDraft = (): AgentDraftState => ({
  mode: '',
  html: '',
  message: '',
  blockLevel: false,
  view: 'html',
  context: '',
  sourceAction: '',
  selectedSheetId: null,
  createdAt: ''
});

const cloneMemory = (input: AgentMemory): AgentMemory => ({
  sheetMatchIds: [...(input?.sheetMatchIds ?? [])],
  lastExerciseTopic: input?.lastExerciseTopic ?? '',
  lastExerciseIntent: input?.lastExerciseIntent ?? '',
  lastSheetAuditIntent: input?.lastSheetAuditIntent ?? '',
  lastKnowledgeIntent: input?.lastKnowledgeIntent ?? '',
  lastInsightIntent: input?.lastInsightIntent ?? ''
});

const normalizeDraft = (input: AgentDraftState | null | undefined): AgentDraftState => ({
  mode: typeof input?.mode === 'string' ? input.mode : '',
  html: typeof input?.html === 'string' ? input.html : '',
  message: typeof input?.message === 'string' ? input.message : '',
  blockLevel: Boolean(input?.blockLevel),
  view: input?.view === 'visual' ? 'visual' : 'html',
  context: typeof input?.context === 'string' ? input.context : '',
  sourceAction: typeof input?.sourceAction === 'string' ? input.sourceAction : '',
  selectedSheetId:
    input?.selectedSheetId === null || input?.selectedSheetId === undefined
      ? null
      : input.selectedSheetId,
  createdAt: typeof input?.createdAt === 'string' ? input.createdAt : ''
});

const normalizeIntentPayload = (raw: unknown): AgentModelIntent | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  return {
    kind: typeof value.kind === 'string' ? value.kind : '',
    confidence: Number.isFinite(Number(value.confidence)) ? Number(value.confidence) : 0,
    topic: typeof value.topic === 'string' ? value.topic : '',
    tab: typeof value.tab === 'string' ? value.tab : '',
    view: typeof value.view === 'string' ? value.view : '',
    reference: typeof value.reference === 'string' ? value.reference : ''
  };
};

const normalizeHistoryText = (value: unknown, max = 1600): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  if (text.length <= max) return text;
  const remaining = text.length - max;
  return `${text.slice(0, max)}...[truncated ${remaining} chars]`;
};

const normalizeHistory = (input: AgentTurnHistoryContext | null | undefined): AgentTurnHistoryContext | null => {
  if (!input || typeof input !== 'object') return null;
  const summary = normalizeHistoryText(input.summary, 1800);
  const rawTurns = Array.isArray(input.turns) ? input.turns : [];
  const turns: AgentTurnHistoryEntry[] = [];
  for (const entry of rawTurns.slice(0, 8)) {
    const user = normalizeHistoryText(entry?.user, 1000);
    const assistant = normalizeHistoryText(entry?.assistant, 1300);
    if (!user || !assistant) continue;
    turns.push({ user, assistant });
  }
  if (!summary && !turns.length) return null;
  return { summary, turns };
};

const buildResult = (payload: Partial<AgentTurnResult>): AgentTurnResult => ({
  ok: Boolean(payload.ok),
  status: payload.status || '',
  message: payload.message || '',
  source: payload.source || 'navigation',
  action: payload.action || '',
  modelIntent: payload.modelIntent ?? null,
  memory: payload.memory ? cloneMemory(payload.memory) : cloneMemory({
    sheetMatchIds: [],
    lastExerciseTopic: '',
    lastExerciseIntent: '',
    lastSheetAuditIntent: '',
    lastKnowledgeIntent: '',
    lastInsightIntent: ''
  }),
  draft: payload.draft ? normalizeDraft(payload.draft) : createEmptyDraft(),
  navigation: payload.navigation ?? null,
  agentResult: payload.agentResult ?? null,
  steps: Array.isArray(payload.steps) ? payload.steps : []
});

export const createDefaultAgentProvider = (deps: AgentProviderDeps) => ({
  runTurn: async (request: AgentTurnRequest): Promise<AgentTurnResult> => {
    const steps: AgentProviderStep[] = [];
    const addStep = (type: string, data: Record<string, unknown> = {}) => {
      steps.push({ type, data });
    };

    let nextMemory = cloneMemory(request.memory);
    let nextDraft = normalizeDraft(request.draft);
    let modelIntent: AgentModelIntent | null = null;
    const historyContext = normalizeHistory(request.history);

    if (deps.isDiscardDraftPrompt(request.prompt)) {
      addStep('draft_discard_request', {
        scope: request.scope,
        hadDraft: Boolean(nextDraft.mode && nextDraft.html)
      });
      if (!nextDraft.mode || !nextDraft.html) {
        return buildResult({
          ok: true,
          status: 'Kein offener Vorschlag vorhanden.',
          source: 'navigation',
          action: 'draft_discard',
          modelIntent,
          memory: nextMemory,
          draft: nextDraft,
          steps
        });
      }
      nextDraft = createEmptyDraft();
      return buildResult({
        ok: true,
        status: 'Vorschlag verworfen.',
        source: 'navigation',
        action: 'draft_discard',
        modelIntent,
        memory: nextMemory,
        draft: nextDraft,
        steps
      });
    }

    if (deps.isApplyDraftPrompt(request.prompt)) {
      addStep('draft_apply_request', {
        scope: request.scope,
        hadDraft: Boolean(nextDraft.mode && nextDraft.html)
      });
      if (!nextDraft.mode || !nextDraft.html) {
        return buildResult({
          ok: true,
          status: 'Kein offener Vorschlag vorhanden.',
          source: 'navigation',
          action: 'draft_apply',
          modelIntent,
          memory: nextMemory,
          draft: nextDraft,
          steps
        });
      }
      if (!deps.canEditContext(request.context)) {
        return buildResult({
          ok: true,
          status: 'Vorschlag kann hier nicht angewendet werden.',
          message: 'Bitte oeffne zuerst ein Sheet im Editor und wiederhole "anwenden".',
          source: 'navigation',
          action: 'draft_apply_blocked',
          modelIntent,
          memory: nextMemory,
          draft: nextDraft,
          steps
        });
      }
      if (
        nextDraft.selectedSheetId !== null &&
        nextDraft.selectedSheetId !== undefined &&
        String(nextDraft.selectedSheetId) !== String(request.selectedSheetId ?? '')
      ) {
        return buildResult({
          ok: true,
          status: 'Vorschlag gehoert zu einem anderen Sheet.',
          message:
            'Bitte oeffne das gleiche Sheet wie bei der Vorschlagserstellung oder erstelle einen neuen Vorschlag.',
          source: 'navigation',
          action: 'draft_apply_blocked',
          modelIntent,
          memory: nextMemory,
          draft: nextDraft,
          steps
        });
      }

      const applied = await deps.applyDraft({
        draft: nextDraft,
        context: request.context,
        selectedSheetId: request.selectedSheetId
      });
      if (!applied.ok) {
        return buildResult({
          ok: false,
          status: applied.status || 'Vorschlag konnte nicht angewendet werden.',
          message: applied.message || '',
          source: 'agent_runtime',
          action: 'draft_apply_error',
          modelIntent,
          memory: nextMemory,
          draft: nextDraft,
          steps
        });
      }

      addStep('draft_applied', {
        ...(applied.details || {}),
      });
      const applyMessage = nextDraft.message || applied.message || '';
      nextDraft = createEmptyDraft();
      return buildResult({
        ok: true,
        status: applied.status || 'Vorschlag angewendet.',
        message: applyMessage,
        source: 'navigation',
        action: 'draft_apply',
        modelIntent,
        memory: nextMemory,
        draft: nextDraft,
        steps
      });
    }

    addStep('intent_request', {
      endpoint: 'agent_intent',
      prompt: request.prompt,
      context: deps.buildContextDetails(request.context),
      history: {
        hasSummary: Boolean(historyContext?.summary),
        turns: historyContext?.turns?.length ?? 0
      }
    });
    try {
      const intentRes = await deps.apiFetch('agent_intent', {
        method: 'POST',
        body: JSON.stringify({
          prompt: request.prompt,
          context: deps.buildContextDetails(request.context),
          history: historyContext
        })
      });
      const intentPayload = await deps.readPayload(intentRes);
      addStep('intent_response', {
        endpoint: 'agent_intent',
        ok: intentRes.ok,
        status: intentRes.status,
        warning: intentPayload?.warning || '',
        data: intentPayload?.data ?? null
      });
      if (intentRes.ok) {
        modelIntent = normalizeIntentPayload(intentPayload?.data);
      }
    } catch (err) {
      addStep('intent_error', {
        endpoint: 'agent_intent',
        message: err instanceof Error ? err.message : 'intent request failed'
      });
    }

    addStep('intent_normalized', { modelIntent });
    addStep('navigation_start', { scope: request.scope });
    const navigation = await deps.resolveNavigation({
      prompt: request.prompt,
      memory: nextMemory,
      modelIntent
    });
    nextMemory = cloneMemory(navigation.memory);
    addStep('navigation_result', {
      handled: Boolean(navigation?.handled),
      status: navigation?.status || '',
      message: navigation?.message || ''
    });
    if (navigation?.handled) {
      return buildResult({
        ok: true,
        status: navigation.status || 'Navigation ausgefuehrt.',
        message: navigation.message || '',
        source: 'navigation',
        action: 'navigation',
        modelIntent,
        memory: nextMemory,
        draft: nextDraft,
        navigation: {
          handled: true,
          status: navigation.status || '',
          message: navigation.message || ''
        },
        steps
      });
    }

    const agentContextPayload = deps.buildAgentContextPayload(request.context);
    addStep('agent_request', {
      endpoint: 'agent',
      context: agentContextPayload,
      history: {
        hasSummary: Boolean(historyContext?.summary),
        turns: historyContext?.turns?.length ?? 0
      }
    });
    const res = await deps.apiFetch('agent', {
      method: 'POST',
      body: JSON.stringify({
        prompt: request.prompt,
        context: agentContextPayload,
        history: historyContext
      })
    });
    const payload = await deps.readPayload(res);
    addStep('agent_response', {
      endpoint: 'agent',
      ok: res.ok,
      status: res.status,
      warning: payload?.warning || '',
      data: payload?.data ?? null,
      backendAgentLogId: payload?.log?.agent_log_id ? String(payload.log.agent_log_id) : ''
    });
    if (!res.ok) {
      return buildResult({
        ok: false,
        status: payload?.warning || 'Agent-Aufruf fehlgeschlagen',
        source: 'agent_api',
        action: 'agent_http_error',
        modelIntent,
        memory: nextMemory,
        draft: nextDraft,
        agentResult: payload?.data ?? null,
        steps
      });
    }

    const result = payload?.data ?? {};
    const action = String(result.action || '');
    const html = typeof result.html === 'string' ? result.html : '';
    const message = typeof result.message === 'string' ? result.message : '';
    const blockLevel = Boolean(result.block_level ?? result.blockLevel);
    const view = result.view === 'visual' ? 'visual' : 'html';
    const suggestionMode =
      action === 'insert_html'
        ? 'insert'
        : action === 'replace_html' || action === 'replace'
        ? 'replace'
        : !action && html
        ? 'replace'
        : '';

    if (suggestionMode && html) {
      if (!deps.canEditContext(request.context)) {
        addStep('agent_draft_skipped', {
          mode: suggestionMode,
          reason: 'context_not_editable'
        });
        return buildResult({
          ok: true,
          status: 'Antwort erhalten (ohne Vorschlag im Editor).',
          message: message || 'In diesem Bereich kann kein editierbarer Vorschlag hinterlegt werden.',
          source: 'agent_api',
          action: action || 'draft_skipped',
          modelIntent,
          memory: nextMemory,
          draft: nextDraft,
          agentResult: result,
          steps
        });
      }

      nextDraft = {
        mode: suggestionMode,
        html,
        message: message || '',
        blockLevel,
        view,
        context: request.context,
        sourceAction: action || (suggestionMode === 'insert' ? 'insert_html' : 'replace_html'),
        selectedSheetId: request.selectedSheetId,
        createdAt: new Date().toISOString()
      };
      addStep('agent_draft_staged', {
        mode: suggestionMode,
        sourceAction: nextDraft.sourceAction,
        context: request.context,
        selectedSheetId: request.selectedSheetId
      });
      const followup =
        'Vorschlag gespeichert. Schreibe "anwenden", um ihn zu uebernehmen, oder "verwerfen".';
      return buildResult({
        ok: true,
        status: 'Vorschlag erstellt (nicht angewendet).',
        message: message ? `${message}\n\n${followup}` : followup,
        source: 'agent_api',
        action: action || 'draft_staged',
        modelIntent,
        memory: nextMemory,
        draft: nextDraft,
        agentResult: result,
        steps
      });
    }

    if (message) {
      addStep('agent_message_only', {
        action: action || 'message'
      });
      return buildResult({
        ok: true,
        status: 'Antwort erhalten.',
        message,
        source: 'agent_api',
        action: action || 'message',
        modelIntent,
        memory: nextMemory,
        draft: nextDraft,
        agentResult: result,
        steps
      });
    }

    addStep('agent_noop', {
      action: action || 'noop'
    });
    return buildResult({
      ok: true,
      status: 'Keine Aenderung erhalten.',
      message,
      source: 'agent_api',
      action: action || 'noop',
      modelIntent,
      memory: nextMemory,
      draft: nextDraft,
      agentResult: result,
      steps
    });
  }
});
