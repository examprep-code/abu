import type { AgentMemory } from './router';
import type { AgentDraftState } from './provider';

export const createEmptyAgentMemory = (): AgentMemory => ({
  sheetMatchIds: [],
  lastExerciseTopic: '',
  lastExerciseIntent: '',
  lastSheetAuditIntent: '',
  lastKnowledgeIntent: '',
  lastInsightIntent: ''
});

export const createEmptyAgentDraft = (): AgentDraftState => ({
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

const normalizeMemory = (memory: AgentMemory | null | undefined): AgentMemory => ({
  sheetMatchIds: Array.isArray(memory?.sheetMatchIds) ? [...memory.sheetMatchIds] : [],
  lastExerciseTopic:
    typeof memory?.lastExerciseTopic === 'string' ? memory.lastExerciseTopic : '',
  lastExerciseIntent:
    typeof memory?.lastExerciseIntent === 'string' ? memory.lastExerciseIntent : '',
  lastSheetAuditIntent:
    typeof memory?.lastSheetAuditIntent === 'string' ? memory.lastSheetAuditIntent : '',
  lastKnowledgeIntent:
    typeof memory?.lastKnowledgeIntent === 'string' ? memory.lastKnowledgeIntent : '',
  lastInsightIntent:
    typeof memory?.lastInsightIntent === 'string' ? memory.lastInsightIntent : ''
});

const normalizeDraft = (draft: AgentDraftState | null | undefined): AgentDraftState => ({
  mode: typeof draft?.mode === 'string' ? draft.mode : '',
  html: typeof draft?.html === 'string' ? draft.html : '',
  message: typeof draft?.message === 'string' ? draft.message : '',
  blockLevel: Boolean(draft?.blockLevel),
  view: draft?.view === 'visual' ? 'visual' : 'html',
  context: typeof draft?.context === 'string' ? draft.context : '',
  sourceAction: typeof draft?.sourceAction === 'string' ? draft.sourceAction : '',
  selectedSheetId:
    draft?.selectedSheetId === null || draft?.selectedSheetId === undefined
      ? null
      : draft.selectedSheetId,
  createdAt: typeof draft?.createdAt === 'string' ? draft.createdAt : ''
});

export const createAgentScopeState = () => {
  let memoryByScope: Record<string, AgentMemory> = {};
  let draftByScope: Record<string, AgentDraftState> = {};

  return {
    reset: () => {
      memoryByScope = {};
      draftByScope = {};
    },
    getMemory: (scope: string): AgentMemory =>
      normalizeMemory(memoryByScope?.[scope] || createEmptyAgentMemory()),
    setMemory: (scope: string, memory: AgentMemory) => {
      memoryByScope = {
        ...memoryByScope,
        [scope]: normalizeMemory(memory)
      };
    },
    getDraft: (scope: string): AgentDraftState =>
      normalizeDraft(draftByScope?.[scope] || createEmptyAgentDraft()),
    setDraft: (scope: string, draft: AgentDraftState) => {
      draftByScope = {
        ...draftByScope,
        [scope]: normalizeDraft(draft)
      };
    },
    clearDraft: (scope: string) => {
      draftByScope = {
        ...draftByScope,
        [scope]: createEmptyAgentDraft()
      };
    }
  };
};
