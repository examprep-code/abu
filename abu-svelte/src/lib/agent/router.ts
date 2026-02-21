import {
  AGENT_SITEMAP,
  buildSitemapDigest,
  buildSitemapMatchMessage,
  findSitemapMatches
} from './sitemap';
import {
  AGENT_API_ENDPOINTS,
  AGENT_DATA_MODEL,
  AGENT_QUERY_RECIPES,
  buildDataModelDigest,
  buildRecipeGuide,
  findQueryRecipesByPrompt
} from './data-model';
import { runAgentUseCases } from './use-case-engine';
import { buildAgentPrimaryUseCases, type AgentPrimaryUseCaseFlags } from './use-cases';

export interface AgentSheetEntry {
  id: string | number;
  key?: string;
  name?: string;
  content?: string;
}

export interface AgentClassEntry {
  id: string | number;
  name?: string;
  year?: string;
  profession?: string;
}

export interface AgentLearnerEntry {
  id: string | number;
  name?: string;
  code?: string;
  classroom?: string | number;
}

export interface AgentAnswerEntry {
  id?: string | number;
  key?: string;
  sheet?: string;
  value?: string;
  user?: string;
  classroom?: string | number;
  classification?: string | number;
  updated_at?: string;
}

export interface AgentPlanEntry {
  id?: string | number;
  classroom?: string | number;
  sheet_key?: string;
  status?: string;
  assignment_form?: string;
}

export interface AgentMemory {
  sheetMatchIds: Array<string | number>;
  lastExerciseTopic: string;
  lastExerciseIntent: string;
  lastSheetAuditIntent: string;
  lastKnowledgeIntent: string;
  lastInsightIntent: string;
}

export interface AgentNavigationResult {
  handled: boolean;
  status?: string;
  message?: string;
  memory: AgentMemory;
}

export interface AgentContextDetails {
  context?: string;
  label?: string;
  visible?: string[];
}

export interface AgentModelIntent {
  kind?: string;
  confidence?: number;
  topic?: string;
  tab?: string;
  view?: string;
  reference?: string;
}

export interface AgentNavigationOptions {
  prompt: string;
  memory: AgentMemory;
  modelIntent?: AgentModelIntent | null;
  getSheets: () => AgentSheetEntry[];
  isLoadingSheets: () => boolean;
  getClasses?: () => AgentClassEntry[];
  isLoadingClasses?: () => boolean;
  fetchClasses?: () => Promise<void>;
  fetchLearnersByClass?: (classId: string | number) => Promise<AgentLearnerEntry[]>;
  fetchAnswers?: (params: {
    sheetKey?: string;
    classId?: string | number | null;
    user?: string;
  }) => Promise<AgentAnswerEntry[]>;
  fetchPlansByClass?: (classId: string | number) => Promise<AgentPlanEntry[]>;
  openClass?: (
    classEntry: AgentClassEntry,
    view?: 'details' | 'learners' | 'assignments'
  ) => Promise<boolean>;
  getActiveTab: () => string;
  getSelectedId: () => string | number | null;
  getEditorView?: () => string;
  getContextDetails?: () => AgentContextDetails;
  fetchSheets: () => Promise<void>;
  openSheet: (sheet: AgentSheetEntry) => Promise<boolean>;
  closeEditorToList: () => Promise<boolean>;
  setEditorView: (view: string) => boolean;
  switchTab: (tab: string) => Promise<boolean>;
}

const EXERCISE_TOPIC_STOPWORDS = new Set([
  'ich',
  'mir',
  'mich',
  'mein',
  'meine',
  'gemeint',
  'ist',
  'sind',
  'es',
  'geht',
  'um',
  'zu',
  'zum',
  'zur',
  'mit',
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'eine',
  'ein',
  'einem',
  'einen',
  'welche',
  'welcher',
  'welches',
  'gibt',
  'gibts',
  'bitte',
  'kannst',
  'koenntest',
  'hast',
  'habt',
  'was',
  'wie',
  'wer',
  'wo',
  'wann',
  'warum',
  'wieso',
  'weshalb',
  'du',
  'ihr',
  'denn',
  'nicht',
  'mindestens',
  'schon',
  'oder',
  'moeglichkeit',
  'diese',
  'dieses',
  'diesen',
  'kann',
  'soll',
  'sollst',
  'oeffne',
  'open',
  'lade',
  'zeige',
  'wechsel',
  'spring',
  'navigiere',
  'wo',
  'uebung',
  'uebungen',
  'aufgabe',
  'aufgaben',
  'arbeitsblatt',
  'sheet',
  'blatt',
  'dokument',
  'dokumente',
  'datei',
  'dateien',
  'text',
  'inhalt',
  'thema',
  'ausgefuellt',
  'ausfuellen',
  'ausfuellt',
  'gemacht',
  'bearbeitet',
  'zugewiesen',
  'zugeteilt',
  'fertig',
  'abgeschlossen',
  'offen',
  'haben',
  'hat',
  'habe',
  'stecken',
  'geblieben',
  'zur',
  'zum',
  'ueber',
  'von'
]);

const OPEN_OR_NAV_VERB_PATTERN =
  /\b(oeffne|oeffnen|open|lade|laden|zeige|wechsel|wechsle|gehe|geh|spring|springe|navigiere)\b/;

const MODEL_INTENT_KIND_ALIASES: Record<string, string> = {
  navigate: 'navigate_tab',
  switch_tab: 'navigate_tab',
  tab: 'navigate_tab',
  navigate_tab: 'navigate_tab',
  navigate_view: 'navigate_view',
  switch_view: 'navigate_view',
  view: 'navigate_view',
  open_sheet_by_topic: 'open_sheet_by_topic',
  open_by_topic: 'open_sheet_by_topic',
  list_sheets_by_topic: 'list_sheets_by_topic',
  search_by_topic: 'list_sheets_by_topic',
  open_sheet_by_reference: 'open_sheet_by_reference',
  open_reference: 'open_sheet_by_reference',
  audit_empty_sheets: 'audit_empty_sheets',
  audit_name_sheets: 'audit_name_sheets',
  show_context: 'show_context',
  capability_search: 'capability_search',
  show_sitemap: 'show_sitemap',
  explain_data_model: 'explain_data_model',
  suggest_data_fetch: 'suggest_data_fetch',
  analyze_exercises: 'analyze_exercises',
  analyze_assignment_completion: 'analyze_assignment_completion',
  check_assignment_completion: 'analyze_assignment_completion',
  identify_struggling_learners: 'identify_struggling_learners',
  open_largest_class_by_learners: 'open_largest_class_by_learners',
  open_largest_class: 'open_largest_class_by_learners',
  none: 'none'
};

const SUPPORTED_MODEL_INTENT_KINDS = new Set([
  'navigate_tab',
  'navigate_view',
  'open_sheet_by_topic',
  'list_sheets_by_topic',
  'open_sheet_by_reference',
  'audit_empty_sheets',
  'audit_name_sheets',
  'show_context',
  'capability_search',
  'show_sitemap',
  'explain_data_model',
  'suggest_data_fetch',
  'analyze_exercises',
  'analyze_assignment_completion',
  'identify_struggling_learners',
  'open_largest_class_by_learners'
]);

const PROMPT_SYNONYM_RULES: Array<{ pattern: RegExp; canonical: string }> = [
  {
    pattern: /\b(schueler|schuelern|schuelerin|schuelerinnen|studierende|studierenden|student|studenten)\b/g,
    canonical: 'lernende'
  },
  {
    pattern: /\b(uebung|uebungen|aufgabe|aufgaben|arbeitsblatt|arbeitsblaetter|blatt|blaetter)\b/g,
    canonical: 'sheet'
  }
];

const applyPromptSynonyms = (value = '') => {
  let normalized = value;
  for (const rule of PROMPT_SYNONYM_RULES) {
    normalized = normalized.replace(rule.pattern, rule.canonical);
  }
  return normalized.replace(/\s+/g, ' ').trim();
};

const normalizePromptText = (value = '') =>
  applyPromptSynonyms(
    value
    .toLowerCase()
    .replace(/\u00e4/g, 'ae')
    .replace(/\u00f6/g, 'oe')
    .replace(/\u00fc/g, 'ue')
    .replace(/\u00df/g, 'ss')
  );

const normalizeLookupValue = (value = '') =>
  normalizePromptText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokenizeLookupWords = (value = '') =>
  normalizeLookupValue(value)
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean);

const normalizeSheetLookup = (value = '') =>
  normalizeLookupValue(value)
    .replace(/\b(sheet|arbeitsblatt|blatt)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const stripHtml = (value = '') => value.replace(/<[^>]*>/g, ' ');

const normalizeMemoryId = (value: string | number | null | undefined) => String(value ?? '').trim();

const clampConfidence = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
};

const normalizeModelIntentKind = (value = '') => {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return MODEL_INTENT_KIND_ALIASES[normalized] || normalized;
};

const mapPromptToTab = (normalizedPrompt = '') => {
  if (/\b(klasse|klassen|class)\b/.test(normalizedPrompt)) return 'classes';
  if (/\b(schule|schulen|school|schools)\b/.test(normalizedPrompt)) return 'schools';
  if (/\b(einstellung|einstellungen|settings|setup|konfiguration)\b/.test(normalizedPrompt)) {
    return 'settings';
  }
  if (/\b(inhalt|editor|sheetliste|sheets)\b/.test(normalizedPrompt)) return 'editor';
  return '';
};

const mapPromptToEditorView = (normalizedPrompt = '') => {
  if (/\b(antwort|antworten)\b/.test(normalizedPrompt)) return 'answers';
  if (/\b(preview|vorschau)\b/.test(normalizedPrompt)) return 'preview';
  if (/\b(visual|visuell|block)\b/.test(normalizedPrompt)) return 'visual';
  if (/\bhtml\b/.test(normalizedPrompt)) return 'html';
  return '';
};

const hasNavigationKeyword = (value = '') =>
  /\b(gehe|geh|wechsel|wechsle|navigiere|spring|springe|oeffne|oeffnen|zeige|zurueck|zuruck)\b/.test(
    value
  );

const formatSheetLabel = (sheet: AgentSheetEntry) =>
  sheet?.name || sheet?.key || (sheet?.id ? `Sheet #${sheet.id}` : 'Unbekanntes Sheet');

const buildSheetTitleListMessage = (sheets: AgentSheetEntry[], limit = 10) => {
  if (!sheets.length) return '';
  return sheets
    .slice(0, limit)
    .map((sheet, index) => `${index + 1}. ${formatSheetLabel(sheet)}`)
    .join('\n');
};

const normalizeContentForEmptyCheck = (value = '') =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isSheetLikelyEmpty = (sheet: AgentSheetEntry) => {
  const content = (sheet?.content ?? '').toString();
  const withoutHtml = stripHtml(content);
  return normalizeContentForEmptyCheck(withoutHtml) === '';
};

const findLikelyEmptySheets = (sheets: AgentSheetEntry[]) =>
  sheets.filter((sheet) => isSheetLikelyEmpty(sheet));

const classifySheetNameIssue = (sheet: AgentSheetEntry) => {
  const name = normalizeLookupValue(sheet?.name ?? '');
  const key = normalizeLookupValue(sheet?.key ?? '');
  const value = name || key;
  if (!value) return 'kein Name/Key';
  if (/^(neues?\s*sheet|untitled|ohne\s*titel)$/.test(value)) return 'Platzhaltername';
  if (/^(test|test\d+|demo|tmp|temp|neu|neu\d+|blatt\d*|sheet\d*)$/.test(value)) {
    return 'generischer Testname';
  }
  if (value.length <= 3) return 'sehr kurzer Name';
  return '';
};

const findSheetsWithWeakNames = (sheets: AgentSheetEntry[]) =>
  sheets
    .map((sheet) => ({ sheet, reason: classifySheetNameIssue(sheet) }))
    .filter((entry) => entry.reason);

const cleanExerciseTopicText = (value = '') => {
  const tokens = tokenizeLookupWords(value).filter(
    (token) => token.length > 1 && !EXERCISE_TOPIC_STOPWORDS.has(token)
  );
  return tokens.join(' ');
};

const extractQuotedText = (value = '') => {
  const match = value.match(/"([^"]+)"|'([^']+)'/);
  return match ? (match[1] || match[2]).trim() : '';
};

const extractExerciseTopic = (value = '') => {
  const quoted = extractQuotedText(value);
  if (quoted) return cleanExerciseTopicText(quoted);

  const normalized = normalizePromptText(value)
    .replace(/[,.;!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';

  const byPhrase =
    normalized.match(/(?:ich\s+meine|gemeint\s+ist|ich\s+spreche\s+von)\s+(.+)/)?.[1] ||
    normalized.match(/(?:wo\s+es\s+um|wo\s+s\s+um)\s+(.+?)\s+geht\b/)?.[1] ||
    normalized.match(/(?:es\s+geht\s+um)\s+(.+)/)?.[1] ||
    normalized.match(/(?:geht(?:\s+es)?\s+um|zum\s+thema|thema)\s+(.+)/)?.[1] ||
    normalized.match(/(?:zu|ueber|um)\s+(.+)/)?.[1] ||
    normalized.match(/(?:uebung|aufgabe|arbeitsblatt|sheet)\s+(.+)/)?.[1] ||
    '';

  const candidate = byPhrase || normalized;
  return cleanExerciseTopicText(candidate);
};

const normalizeExerciseTopicTokens = (topic = '') => {
  const baseTokens = tokenizeLookupWords(topic).filter(
    (token) => token.length > 1 && !EXERCISE_TOPIC_STOPWORDS.has(token)
  );
  return Array.from(new Set(baseTokens));
};

const sheetSearchHaystack = (sheet: AgentSheetEntry) =>
  normalizeLookupValue(`${sheet?.key ?? ''} ${sheet?.name ?? ''} ${stripHtml(sheet?.content ?? '')}`);

const sheetSearchTokens = (sheet: AgentSheetEntry) => tokenizeLookupWords(sheetSearchHaystack(sheet));

const scoreSheetForTopic = (sheet: AgentSheetEntry, topic = '') => {
  const normalizedTopic = normalizeLookupValue(topic);
  const topicTokens = normalizeExerciseTopicTokens(topic);
  if (!topicTokens.length || !normalizedTopic) return 0;

  const haystack = sheetSearchHaystack(sheet);
  if (!haystack) return 0;
  const tokenSet = new Set(sheetSearchTokens(sheet));

  let score = 0;
  if (haystack.includes(normalizedTopic)) {
    score += 180;
  }

  for (const token of topicTokens) {
    if (tokenSet.has(token)) {
      score += token.length <= 2 ? 70 : 40;
    }
  }

  return score;
};

const findSheetsByTopic = (sheets: AgentSheetEntry[], topic: string, limit = 5) => {
  const ranked = sheets
    .map((sheet) => ({ sheet, score: scoreSheetForTopic(sheet, topic) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit).map((entry) => entry.sheet);
};

const extractSheetNavigationQuery = (value = '') => {
  const quoted = extractQuotedText(value);
  if (quoted) return quoted.trim();
  const openMatch = value.match(
    /(?:oeffne|open|lade|zeige|wechsel(?:\s+zu)?)\s+(?:das\s+)?(?:sheet|arbeitsblatt|blatt)\s+(.+)/i
  );
  if (openMatch?.[1]) return openMatch[1].trim();
  const keyMatch = value.match(/\bsheet\s+([A-Za-z0-9._-]+)/i);
  if (keyMatch?.[1]) return keyMatch[1].trim();
  return '';
};

const findSheetByQuery = (sheets: AgentSheetEntry[], query = '') => {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const normalizedQuery = normalizeSheetLookup(trimmed);
  if (!normalizedQuery) return null;

  const exact = sheets.find((sheet) => {
    const key = normalizeLookupValue(sheet?.key ?? '');
    const name = normalizeLookupValue(sheet?.name ?? '');
    return key === normalizedQuery || name === normalizedQuery;
  });
  if (exact) return exact;

  return (
    sheets.find((sheet) => {
      const key = normalizeLookupValue(sheet?.key ?? '');
      const name = normalizeLookupValue(sheet?.name ?? '');
      return key.includes(normalizedQuery) || name.includes(normalizedQuery);
    }) ?? null
  );
};

const parseReferenceIndex = (value = '') => {
  const normalized = normalizeLookupValue(value);
  if (!normalized) return null;

  const numeric = normalized.match(/\b(\d+)\b/);
  if (numeric) {
    const parsed = Number(numeric[1]);
    if (Number.isFinite(parsed) && parsed >= 1) return parsed - 1;
  }

  if (/\b(erste|ersten|erstes|first)\b/.test(normalized)) return 0;
  if (/\b(zweite|zweiten|zweites|second)\b/.test(normalized)) return 1;
  if (/\b(dritte|dritten|drittes|third)\b/.test(normalized)) return 2;
  if (/\b(vierte|vierten|viertes|fourth)\b/.test(normalized)) return 3;
  if (/\b(fuenfte|fuenften|fuenftes|fifth)\b/.test(normalized)) return 4;
  return null;
};

const findSheetByReference = (
  sheets: AgentSheetEntry[],
  sheetMatchIds: Array<string | number>,
  reference = ''
) => {
  const trimmed = reference.trim();
  if (!trimmed) return null;
  const normalized = normalizeLookupValue(trimmed);

  const normalizedMatchIds = sheetMatchIds.map((entry) => normalizeMemoryId(entry));
  const memoryMatches = sheets.filter((sheet) =>
    normalizedMatchIds.includes(normalizeMemoryId(sheet.id))
  );
  const rankBase = memoryMatches.length ? memoryMatches : sheets;

  if (/\b(diese|dieses|diesen|der|die|das|letzte|last|vorher)\b/.test(normalized)) {
    return rankBase[0] || null;
  }

  const byIndex = parseReferenceIndex(trimmed);
  if (byIndex !== null && byIndex >= 0 && byIndex < rankBase.length) {
    return rankBase[byIndex] || null;
  }

  const byQuery = findSheetByQuery(sheets, trimmed);
  if (byQuery) return byQuery;

  return rankBase[0] || null;
};

const parseClassificationScore = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 500;
  if (numeric >= 900) return 1000;
  if (numeric >= 101) return 500;
  return 0;
};

const normalizePlanSheetKey = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const extractGapKeysFromSheetContent = (content = '') => {
  if (!content) return [];
  const found = new Set<string>();
  const tagPattern = /<luecke-gap(?:-wide)?\b[^>]*>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = tagPattern.exec(content)) !== null) {
    const tag = match[0] || '';
    const nameMatch = tag.match(/\bname\s*=\s*["']?([^"'\s>]+)/i);
    const name = (nameMatch?.[1] ?? '').toString().trim();
    if (name) found.add(name);
  }
  return Array.from(found);
};

const countIntersection = (keys: Set<string>, subset: Set<string>) => {
  let count = 0;
  for (const key of subset) {
    if (keys.has(key)) count += 1;
  }
  return count;
};

const formatClassLabel = (entry: AgentClassEntry) => {
  const parts: string[] = [];
  if (entry?.name) parts.push(String(entry.name));
  if (entry?.year) parts.push(String(entry.year));
  if (entry?.profession) parts.push(String(entry.profession));
  if (parts.length) return parts.join(' · ');
  return `Klasse ${entry?.id ?? '?'}`;
};

const isLikelyContentEditPrompt = (normalizedPrompt = '') => {
  const hasEditVerb =
    /\b(erstelle|generiere|formuliere|schreibe|ueberarbeite|verbessere|fuege|ersetze|aendere)\b/.test(
      normalizedPrompt
    );
  const hasContentObject =
    /\b(html|text|aufgabe|uebung|luecke|quiz|arbeitsblatt|sheet)\b/.test(normalizedPrompt);
  return hasEditVerb && hasContentObject;
};

const buildVisibleItemsMessage = (context: string, visibleItems: string[] = []) => {
  const defaultVisibleItemsByContext: Record<string, string[]> = {
    html: ['Editor: HTML-Ansicht', 'Aktuelles Sheet'],
    visual: ['Editor: Visuelle Block-Ansicht', 'Aktueller Block'],
    preview: ['Editor: Preview', 'Aktuelles Sheet'],
    answers: ['Editor: Antworten', 'Aktuelles Sheet'],
    sheets: ['Sheet-Liste', 'Suche/Sortierung'],
    classes: ['Klassenliste', 'Klassen-Details'],
    schools: ['Schulenliste', 'Schul-Details'],
    settings: ['CI-Einstellungen'],
    app: ['App-Navigation']
  };

  const effectiveItems = visibleItems.length
    ? visibleItems
    : defaultVisibleItemsByContext[context] || defaultVisibleItemsByContext.app;
  if (!effectiveItems.length) return 'Keine sichtbaren Elemente ermittelt.';
  return `Sichtbar hier:\n${effectiveItems.map((entry) => `- ${entry}`).join('\n')}`;
};

export const resolveAgentContext = (params: {
  activeTab: string;
  selectedId: string | number | null;
  editorView: string;
}) => {
  if (params.activeTab === 'editor') {
    if (!params.selectedId) return 'sheets';
    return params.editorView;
  }
  if (params.activeTab === 'classes') return 'classes';
  if (params.activeTab === 'schools') return 'schools';
  if (params.activeTab === 'settings') return 'settings';
  return 'app';
};

export const describeAgentContext = (context: string) => {
  if (context === 'html') return 'Kontext: Editor / HTML';
  if (context === 'visual') return 'Kontext: Editor / Visuell (aktiver Block)';
  if (context === 'preview') return 'Kontext: Editor / Preview';
  if (context === 'answers') return 'Kontext: Editor / Antworten';
  if (context === 'sheets') return 'Kontext: Inhalt / Sheet-Liste';
  if (context === 'classes') return 'Kontext: Klassen';
  if (context === 'schools') return 'Kontext: Schulen';
  if (context === 'settings') return 'Kontext: Einstellungen';
  return 'Kontext: App';
};

const resolveCurrentContext = (options: AgentNavigationOptions) =>
  resolveAgentContext({
    activeTab: options.getActiveTab(),
    selectedId: options.getSelectedId(),
    editorView: options.getEditorView ? options.getEditorView() : 'html'
  });

const buildSitemapResponse = (prompt: string) => {
  const matchPayload = buildSitemapMatchMessage(prompt);
  const matchCount = findSitemapMatches(prompt, 6).length;
  const metadataLine = `Sitemap-Knoten: ${AGENT_SITEMAP.length}.`;
  return {
    status: matchPayload.status,
    message: `${matchPayload.message}\n\n${metadataLine}${
      matchCount ? '' : `\n\nSitemap Gesamt:\n${buildSitemapDigest(AGENT_SITEMAP, 12)}`
    }`
  };
};

const buildDataModelResponse = () => {
  const endpointsPreview = AGENT_API_ENDPOINTS.slice(0, 8)
    .map((entry, index) => `${index + 1}. ${entry.method} ${entry.path} - ${entry.description}`)
    .join('\n');

  return {
    status: 'Datenmodell bereit.',
    message: `Entitaeten (${AGENT_DATA_MODEL.length}):\n${buildDataModelDigest(8)}\n\nAPI-Endpunkte (Auszug):\n${endpointsPreview}`
  };
};

const buildRecipeResponse = (prompt: string) => {
  const matches = findQueryRecipesByPrompt(prompt, 3);
  const recipeText = buildRecipeGuide(prompt);
  return {
    status: matches.length ? 'Passende Datenabfrage-Strategie gefunden.' : 'Allgemeine Datenabfrage-Strategie.',
    message: `${recipeText}\n\nVerfuegbare Rezepte insgesamt: ${AGENT_QUERY_RECIPES.length}.`
  };
};

const runExerciseOverviewInsight = async (
  options: AgentNavigationOptions,
  topic: string
): Promise<{ status: string; message: string }> => {
  if (!options.fetchAnswers) {
    return {
      status: 'Analyse nicht verfuegbar.',
      message:
        'Antwortdaten-Fetcher fehlt. Fuer diese Analyse wird GET answer?sheet={key} benoetigt.'
    };
  }

  const sheets = options.getSheets();
  if (!sheets.length && !options.isLoadingSheets()) {
    await options.fetchSheets();
  }

  const loadedSheets = options.getSheets();
  if (!loadedSheets.length) {
    return {
      status: 'Keine Sheets vorhanden.',
      message: 'Es gibt keine Datenbasis fuer eine Uebungsanalyse.'
    };
  }

  const targetSheets = topic ? findSheetsByTopic(loadedSheets, topic, 12) : loadedSheets.slice(0, 12);
  const effectiveSheets = targetSheets.length ? targetSheets : loadedSheets.slice(0, 12);

  let classScopedAnswersBySheet = new Map<string, AgentAnswerEntry[]>();
  let usedClassScopedAggregation = false;

  if (options.getClasses && options.fetchClasses && options.fetchAnswers) {
    const classesBefore = options.getClasses();
    if (!classesBefore.length && !(options.isLoadingClasses && options.isLoadingClasses())) {
      await options.fetchClasses();
    }
    const classes = options.getClasses();
    if (classes.length) {
      usedClassScopedAggregation = true;
      const answersByClass = await Promise.all(
        classes.slice(0, 12).map(async (entry) => {
          try {
            return await options.fetchAnswers!({ classId: entry.id });
          } catch {
            return [];
          }
        })
      );
      classScopedAnswersBySheet = new Map<string, AgentAnswerEntry[]>();
      for (const classAnswers of answersByClass) {
        for (const answer of classAnswers) {
          const key = (answer?.sheet ?? '').toString().trim();
          if (!key) continue;
          const existing = classScopedAnswersBySheet.get(key) || [];
          existing.push(answer);
          classScopedAnswersBySheet.set(key, existing);
        }
      }
    }
  }

  const snapshots = await Promise.all(
    effectiveSheets.map(async (sheet) => {
      const key = (sheet?.key ?? '').toString().trim();
      if (!key) {
        return {
          key: '',
          label: formatSheetLabel(sheet),
          answers: 0,
          avgScore: null as number | null,
          wrongOrPartialRatio: null as number | null
        };
      }

      try {
        const answers = usedClassScopedAggregation
          ? classScopedAnswersBySheet.get(key) || []
          : await options.fetchAnswers!({ sheetKey: key });
        const scores = answers.map((entry) => parseClassificationScore(entry?.classification));
        const avgScore = scores.length
          ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
          : null;
        const weakCount = scores.filter((value) => value < 900).length;
        const wrongOrPartialRatio = scores.length ? weakCount / scores.length : null;

        return {
          key,
          label: formatSheetLabel(sheet),
          answers: scores.length,
          avgScore,
          wrongOrPartialRatio
        };
      } catch {
        return {
          key,
          label: formatSheetLabel(sheet),
          answers: 0,
          avgScore: null as number | null,
          wrongOrPartialRatio: null as number | null
        };
      }
    })
  );

  const withAnswers = snapshots.filter((entry) => entry.answers > 0);
  if (!withAnswers.length) {
    return {
      status: 'Keine Antworten zur Analyse gefunden.',
      message:
        'Die ausgewaehlten Sheets haben aktuell keine Antwortdaten. Pruefe, ob bereits Lernendenantworten vorliegen.'
    };
  }

  const weakest = [...withAnswers]
    .sort((a, b) => (b.wrongOrPartialRatio ?? 0) - (a.wrongOrPartialRatio ?? 0))
    .slice(0, 5);

  const summaryLines = weakest.map((entry, index) => {
    const weakRatio = Math.round((entry.wrongOrPartialRatio ?? 0) * 100);
    return `${index + 1}. ${entry.label} - Antworten: ${entry.answers}, Avg: ${entry.avgScore}/1000, Schwierigkeitsindikator: ${weakRatio}%`;
  });

  const totalAnswers = withAnswers.reduce((sum, entry) => sum + entry.answers, 0);
  const globalAvg = Math.round(
    withAnswers.reduce((sum, entry) => sum + (entry.avgScore ?? 0) * entry.answers, 0) / totalAnswers
  );

  return {
    status: 'Uebungsanalyse erstellt.',
    message:
      `Ausgewertete Sheets: ${withAnswers.length}, Antworten gesamt: ${totalAnswers}, globaler Avg: ${globalAvg}/1000.` +
      `${usedClassScopedAggregation ? '\nDatengrundlage: Klassenbezogene Antworten (eigene Klassen).' : '\nDatengrundlage: Sheet-Filter (global nach key).'}\n\nAuffaellige Sheets:\n${summaryLines.join('\n')}`
  };
};

const runAssignmentCompletionInsight = async (
  options: AgentNavigationOptions,
  normalizedPrompt: string,
  topic: string
): Promise<{ status: string; message: string }> => {
  if (
    !options.fetchPlansByClass ||
    !options.getClasses ||
    !options.fetchClasses ||
    !options.fetchLearnersByClass ||
    !options.fetchAnswers
  ) {
    return {
      status: 'Fortschrittsanalyse nicht verfuegbar.',
      message:
        'Fuer diese Analyse werden plan-, class-, learner- und answer-Loader benoetigt.'
    };
  }

  const sheetsBefore = options.getSheets();
  if (!sheetsBefore.length && !options.isLoadingSheets()) {
    await options.fetchSheets();
  }
  const loadedSheets = options.getSheets();
  if (!loadedSheets.length) {
    return {
      status: 'Keine Sheets vorhanden.',
      message: 'Es gibt keine Arbeitsblaetter als Datenbasis.'
    };
  }

  const topicHint = topic || (/\beu\b|\beuropaeische\s+union\b/.test(normalizedPrompt) ? 'eu' : '');
  if (!topicHint) {
    return {
      status: 'Thema fehlt.',
      message:
        'Bitte nenne das Thema (z.B. "EU"), damit ich passende zugewiesene Arbeitsblaetter analysieren kann.'
    };
  }

  const topicSheets = findSheetsByTopic(loadedSheets, topicHint, 24);
  if (!topicSheets.length) {
    return {
      status: `Keine Arbeitsblaetter zu "${topicHint}" gefunden.`,
      message: 'Ich kann nichts zuweisen/auswerten, solange kein passendes Sheet vorhanden ist.'
    };
  }

  const sheetByKey = new Map<string, AgentSheetEntry>();
  for (const sheet of topicSheets) {
    const key = normalizePlanSheetKey(sheet?.key);
    if (!key) continue;
    sheetByKey.set(key, sheet);
  }
  if (!sheetByKey.size) {
    return {
      status: `Keine gueltigen Sheet-Keys zu "${topicHint}" gefunden.`,
      message: 'Bitte pruefe, ob die passenden Sheets einen key besitzen.'
    };
  }

  const classesBefore = options.getClasses();
  if (!classesBefore.length && !(options.isLoadingClasses && options.isLoadingClasses())) {
    await options.fetchClasses();
  }
  const classes = options.getClasses();
  if (!classes.length) {
    return {
      status: 'Keine Klassen vorhanden.',
      message: 'Ohne Klassen kann keine Zuweisung/Fortschrittsanalyse erstellt werden.'
    };
  }

  type SheetProgressAgg = {
    key: string;
    label: string;
    classLabels: Set<string>;
    assignedLearners: number;
    completed: number;
    started: number;
    notStarted: number;
    expectedTotal: number;
    correctTotal: number;
    missingByKey: Map<string, number>;
    weakByKey: Map<string, number>;
  };

  const progressBySheet = new Map<string, SheetProgressAgg>();

  for (const classEntry of classes.slice(0, 20)) {
    const classId = classEntry?.id;
    if (!classId) continue;

    const plans = await options.fetchPlansByClass(classId).catch(() => []);
    if (!plans.length) continue;

    const relevantSheetKeys = Array.from(
      new Set(
        plans
          .filter((entry) => normalizeLookupValue(entry?.status ?? '') !== 'archiviert')
          .map((entry) => normalizePlanSheetKey(entry?.sheet_key))
          .filter((key) => key !== '' && sheetByKey.has(key))
      )
    );
    if (!relevantSheetKeys.length) continue;

    const learners = await options.fetchLearnersByClass(classId).catch(() => []);
    const learnerCodes = Array.from(
      new Set(
        learners
          .map((entry) => normalizeLookupValue((entry?.code ?? '').toString()))
          .filter(Boolean)
      )
    );
    if (!learnerCodes.length) continue;

    const classAnswers = await options.fetchAnswers({ classId }).catch(() => []);
    const answersBySheetUser = new Map<string, Map<string, AgentAnswerEntry[]>>();
    for (const answer of classAnswers) {
      const sheetKey = normalizePlanSheetKey(answer?.sheet);
      const learnerCode = normalizeLookupValue((answer?.user ?? '').toString());
      if (!sheetKey || !learnerCode) continue;
      const byUser = answersBySheetUser.get(sheetKey) || new Map<string, AgentAnswerEntry[]>();
      const list = byUser.get(learnerCode) || [];
      list.push(answer);
      byUser.set(learnerCode, list);
      answersBySheetUser.set(sheetKey, byUser);
    }

    for (const sheetKey of relevantSheetKeys) {
      const sheet = sheetByKey.get(sheetKey);
      const gapKeys = extractGapKeysFromSheetContent((sheet?.content ?? '').toString());
      if (!gapKeys.length) {
        const observed = classAnswers
          .filter((entry) => normalizePlanSheetKey(entry?.sheet) === sheetKey)
          .map((entry) => normalizePlanSheetKey(entry?.key))
          .filter(Boolean);
        gapKeys.push(...Array.from(new Set(observed)));
      }
      const gapKeySet = new Set(gapKeys);

      const sheetAgg =
        progressBySheet.get(sheetKey) ||
        (() => {
          const created: SheetProgressAgg = {
            key: sheetKey,
            label: formatSheetLabel(sheet || { id: sheetKey, key: sheetKey }),
            classLabels: new Set<string>(),
            assignedLearners: 0,
            completed: 0,
            started: 0,
            notStarted: 0,
            expectedTotal: 0,
            correctTotal: 0,
            missingByKey: new Map<string, number>(),
            weakByKey: new Map<string, number>()
          };
          progressBySheet.set(sheetKey, created);
          return created;
        })();

      sheetAgg.classLabels.add(formatClassLabel(classEntry));
      sheetAgg.assignedLearners += learnerCodes.length;
      if (gapKeySet.size) {
        sheetAgg.expectedTotal += gapKeySet.size * learnerCodes.length;
      }

      for (const learnerCode of learnerCodes) {
        const responses = answersBySheetUser.get(sheetKey)?.get(learnerCode) || [];
        const answeredKeys = new Set<string>();
        const correctKeys = new Set<string>();

        for (const response of responses) {
          const responseKey = normalizePlanSheetKey(response?.key);
          if (!responseKey) continue;
          const hasValue = (response?.value ?? '').toString().trim() !== '';
          const hasClassification = (response?.classification ?? '').toString().trim() !== '';
          if (!hasValue && !hasClassification) continue;

          answeredKeys.add(responseKey);
          if (parseClassificationScore(response?.classification) >= 900) {
            correctKeys.add(responseKey);
          }
        }

        const answeredCount = gapKeySet.size
          ? countIntersection(answeredKeys, gapKeySet)
          : answeredKeys.size;
        const correctCount = gapKeySet.size
          ? countIntersection(correctKeys, gapKeySet)
          : correctKeys.size;

        sheetAgg.correctTotal += correctCount;
        if (gapKeySet.size && correctCount >= gapKeySet.size) {
          sheetAgg.completed += 1;
        } else if (answeredCount > 0) {
          sheetAgg.started += 1;
        } else {
          sheetAgg.notStarted += 1;
        }

        if (!gapKeySet.size) continue;
        for (const gapKey of gapKeySet) {
          if (!answeredKeys.has(gapKey)) {
            sheetAgg.missingByKey.set(gapKey, (sheetAgg.missingByKey.get(gapKey) || 0) + 1);
          } else if (!correctKeys.has(gapKey)) {
            sheetAgg.weakByKey.set(gapKey, (sheetAgg.weakByKey.get(gapKey) || 0) + 1);
          }
        }
      }
    }
  }

  const progressList = Array.from(progressBySheet.values());
  if (!progressList.length) {
    return {
      status: `Keine Zuweisungen zu "${topicHint}" gefunden.`,
      message:
        'Es gibt zwar passende Sheets, aber keine aktiven Klassen-Zuweisungen (plan) fuer dieses Thema.'
    };
  }

  const totalAssigned = progressList.reduce((sum, entry) => sum + entry.assignedLearners, 0);
  const totalCompleted = progressList.reduce((sum, entry) => sum + entry.completed, 0);
  const totalStarted = progressList.reduce((sum, entry) => sum + entry.started, 0);
  const totalNotStarted = progressList.reduce((sum, entry) => sum + entry.notStarted, 0);
  const totalExpected = progressList.reduce((sum, entry) => sum + entry.expectedTotal, 0);
  const totalCorrect = progressList.reduce((sum, entry) => sum + entry.correctTotal, 0);
  const overallCompletion = totalExpected ? Math.round((totalCorrect / totalExpected) * 100) : null;

  const topSheets = [...progressList]
    .sort((a, b) => {
      if (b.assignedLearners !== a.assignedLearners) return b.assignedLearners - a.assignedLearners;
      const aCompletion = a.expectedTotal ? a.correctTotal / a.expectedTotal : 0;
      const bCompletion = b.expectedTotal ? b.correctTotal / b.expectedTotal : 0;
      if (aCompletion !== bCompletion) return aCompletion - bCompletion;
      return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
    })
    .slice(0, 6);

  const sheetLines = topSheets.map((entry, index) => {
    const completion = entry.expectedTotal
      ? `${Math.round((entry.correctTotal / entry.expectedTotal) * 100)}% korrekt`
      : 'ohne Gap-Modell';
    return (
      `${index + 1}. ${entry.label} - fertig ${entry.completed}/${entry.assignedLearners}, ` +
      `begonnen ${entry.started}/${entry.assignedLearners}, offen ${entry.notStarted}/${entry.assignedLearners}, ${completion}`
    );
  });

  const bottlenecks = progressList
    .flatMap((entry) => {
      const keys = new Set<string>([
        ...Array.from(entry.missingByKey.keys()),
        ...Array.from(entry.weakByKey.keys())
      ]);
      return Array.from(keys).map((gapKey) => {
        const missing = entry.missingByKey.get(gapKey) || 0;
        const weak = entry.weakByKey.get(gapKey) || 0;
        return {
          label: `${entry.label} / ${gapKey}`,
          missing,
          weak,
          score: missing * 2 + weak
        };
      });
    })
    .filter((entry) => entry.missing > 0 || entry.weak > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const bottleneckLines = bottlenecks.map(
    (entry, index) =>
      `${index + 1}. ${entry.label} - offen: ${entry.missing}, falsch/teilweise: ${entry.weak}`
  );

  const header =
    `Thema: ${topicHint}\n` +
    `Passende Sheets: ${progressList.length}\n` +
    `Zuweisungen (Lernenden-Slots): ${totalAssigned}\n` +
    `Fertig: ${totalCompleted}, begonnen: ${totalStarted}, offen: ${totalNotStarted}` +
    `${overallCompletion === null ? '' : `\nGesamt-Korrektheitsgrad ueber bekannte Luecken: ${overallCompletion}%`}`;

  return {
    status: `Fortschritt fuer "${topicHint}" ausgewertet.`,
    message:
      `${header}\n\nFortschritt pro Sheet:\n${sheetLines.join('\n')}` +
      `${bottleneckLines.length ? `\n\nWo Lernende haengen bleiben:\n${bottleneckLines.join('\n')}` : ''}`
  };
};

const runStrugglingLearnersInsight = async (
  options: AgentNavigationOptions,
  normalizedPrompt: string
): Promise<{ status: string; message: string }> => {
  if (
    !options.getClasses ||
    !options.fetchClasses ||
    !options.fetchLearnersByClass ||
    !options.fetchAnswers
  ) {
    return {
      status: 'Analyse nicht verfuegbar.',
      message:
        'Fuer diese Analyse werden Klassen-, Lernenden- und Antwort-Loader benoetigt (classroom/learner/answer).'
    };
  }

  const classesBefore = options.getClasses();
  if (!classesBefore.length && !(options.isLoadingClasses && options.isLoadingClasses())) {
    await options.fetchClasses();
  }

  const classes = options.getClasses();
  if (!classes.length) {
    return {
      status: 'Keine Klassen vorhanden.',
      message: 'Ohne Klassen sind keine Lernenden-Risikosignale berechenbar.'
    };
  }

  const mentionRecent = /\b(kuerzlich|letzte|recent|heute|woche|aktuell)\b/.test(normalizedPrompt);
  const cutoff = new Date(Date.now() - (mentionRecent ? 14 : 60) * 24 * 60 * 60 * 1000);

  type LearnerStats = {
    learnerCode: string;
    learnerLabel: string;
    classLabel: string;
    total: number;
    weak: number;
    lastAt: string;
    risk: number;
  };

  const allStats: LearnerStats[] = [];

  for (const classEntry of classes.slice(0, 12)) {
    const classId = classEntry?.id;
    if (!classId) continue;

    const [learners, answers] = await Promise.all([
      options.fetchLearnersByClass(classId).catch(() => []),
      options.fetchAnswers({ classId }).catch(() => [])
    ]);

    if (!answers.length) continue;

    const learnerLabelByCode = new Map<string, string>();
    for (const learner of learners) {
      const code = (learner?.code ?? '').toString().trim();
      if (!code) continue;
      learnerLabelByCode.set(code, learner?.name ? String(learner.name) : code);
    }

    const statsByCode = new Map<string, { total: number; weak: number; lastAt: string }>();

    for (const answer of answers) {
      const code = (answer?.user ?? '').toString().trim();
      if (!code) continue;

      const updatedAtRaw = (answer?.updated_at ?? '').toString().trim();
      if (updatedAtRaw) {
        const updatedAt = new Date(updatedAtRaw);
        if (!Number.isNaN(updatedAt.getTime()) && updatedAt < cutoff) {
          continue;
        }
      }

      const current = statsByCode.get(code) || { total: 0, weak: 0, lastAt: '' };
      current.total += 1;
      if (parseClassificationScore(answer?.classification) < 900) {
        current.weak += 1;
      }
      if (updatedAtRaw && updatedAtRaw > current.lastAt) {
        current.lastAt = updatedAtRaw;
      }
      statsByCode.set(code, current);
    }

    for (const [code, stats] of statsByCode.entries()) {
      if (stats.total < 2) continue;
      const weakRatio = stats.weak / stats.total;
      const volumeBoost = Math.min(stats.total, 25) / 25;
      const risk = weakRatio * 0.85 + volumeBoost * 0.15;

      allStats.push({
        learnerCode: code,
        learnerLabel: learnerLabelByCode.get(code) || code,
        classLabel: formatClassLabel(classEntry),
        total: stats.total,
        weak: stats.weak,
        lastAt: stats.lastAt,
        risk
      });
    }
  }

  if (!allStats.length) {
    return {
      status: 'Keine ausreichenden Antwortdaten gefunden.',
      message:
        'Es liegen zu wenige bewertete Antworten vor, um eine belastbare Rangliste zu bilden.'
    };
  }

  const ranked = allStats.sort((a, b) => b.risk - a.risk).slice(0, 6);
  const lines = ranked.map((entry, index) => {
    const riskPercent = Math.round(entry.risk * 100);
    const weakPercent = Math.round((entry.weak / entry.total) * 100);
    const last = entry.lastAt ? `, letzte Aktivitaet: ${entry.lastAt}` : '';
    return `${index + 1}. ${entry.learnerLabel} (${entry.classLabel}) - Risiko ${riskPercent}%, schwach ${entry.weak}/${entry.total} (${weakPercent}%)${last}`;
  });

  return {
    status: 'Risikoprofil fuer Lernende erstellt.',
    message: lines.join('\n')
  };
};

const runOpenLargestClassByLearners = async (
  options: AgentNavigationOptions
): Promise<{ status: string; message: string }> => {
  if (!options.getClasses || !options.fetchClasses || !options.fetchLearnersByClass || !options.openClass) {
    return {
      status: 'Klassenabfrage nicht verfuegbar.',
      message:
        'Fuer diese Aktion werden Klassen- und Lernenden-Loader plus Klassen-Navigation benoetigt.'
    };
  }

  const classesBefore = options.getClasses();
  if (!classesBefore.length && !(options.isLoadingClasses && options.isLoadingClasses())) {
    await options.fetchClasses();
  }

  const classes = options.getClasses();
  if (!classes.length) {
    return {
      status: 'Keine Klassen vorhanden.',
      message: 'Es wurden keine Klassen gefunden.'
    };
  }

  const counts = await Promise.all(
    classes.slice(0, 40).map(async (classEntry) => {
      try {
        const learners = await options.fetchLearnersByClass!(classEntry.id);
        return {
          classEntry,
          learnerCount: learners.length
        };
      } catch {
        return {
          classEntry,
          learnerCount: 0
        };
      }
    })
  );

  const ranked = counts
    .sort((a, b) => {
      if (b.learnerCount !== a.learnerCount) return b.learnerCount - a.learnerCount;
      return formatClassLabel(a.classEntry).localeCompare(formatClassLabel(b.classEntry), undefined, {
        sensitivity: 'base',
        numeric: true
      });
    })
    .slice(0, 5);

  const winner = ranked[0];
  if (!winner) {
    return {
      status: 'Keine Klasse ermittelbar.',
      message: 'Es konnte keine Klasse fuer die Abfrage bestimmt werden.'
    };
  }

  const opened = await options.openClass(winner.classEntry, 'learners');
  const rankingText = ranked
    .map(
      (entry, index) =>
        `${index + 1}. ${formatClassLabel(entry.classEntry)} - ${entry.learnerCount} Lernende`
    )
    .join('\n');

  if (!opened) {
    return {
      status: 'Klasse ermittelt, Navigation blockiert.',
      message: `Top-Klassen nach Lernendenzahl:\n${rankingText}`
    };
  }

  return {
    status: `Klasse geoeffnet: ${formatClassLabel(winner.classEntry)}.`,
    message: `Lernendenzahl: ${winner.learnerCount}.\n\nRanking:\n${rankingText}`
  };
};

const toMemory = (input?: AgentMemory | null): AgentMemory => ({
  sheetMatchIds: [...(input?.sheetMatchIds ?? [])].map((entry) => normalizeMemoryId(entry)).filter(Boolean),
  lastExerciseTopic: input?.lastExerciseTopic ?? '',
  lastExerciseIntent: input?.lastExerciseIntent ?? '',
  lastSheetAuditIntent: input?.lastSheetAuditIntent ?? '',
  lastKnowledgeIntent: input?.lastKnowledgeIntent ?? '',
  lastInsightIntent: input?.lastInsightIntent ?? ''
});

export const resolveAgentNavigationIntent = async (
  options: AgentNavigationOptions
): Promise<AgentNavigationResult> => {
  const nextMemory = toMemory(options.memory);

  const done = (payload: Omit<AgentNavigationResult, 'memory'>): AgentNavigationResult => ({
    ...payload,
    memory: nextMemory
  });

  const normalizedPrompt = normalizePromptText(options.prompt || '');
  const currentContext = resolveCurrentContext(options);
  const currentContextLabel = describeAgentContext(currentContext);
  const contextDetails = options.getContextDetails ? options.getContextDetails() : {};
  const visibleItems = Array.isArray(contextDetails?.visible)
    ? contextDetails.visible.map((entry) => (typeof entry === 'string' ? entry.trim() : '')).filter(Boolean)
    : [];

  const modelIntent = options.modelIntent ?? null;
  const modelIntentKind = normalizeModelIntentKind(modelIntent?.kind ?? '');
  const modelIntentConfidence = clampConfidence(modelIntent?.confidence);
  const useModelIntent =
    modelIntentKind !== '' &&
    modelIntentKind !== 'none' &&
    modelIntentConfidence >= 0.55 &&
    SUPPORTED_MODEL_INTENT_KINDS.has(modelIntentKind);

  const hasExerciseKeyword =
    /\b(uebung|uebungen|aufgabe|aufgaben|arbeitsblatt|arbeitsblaetter|sheet|sheets|blatt|blaetter|dokument|dokumente|datei|dateien)\b/.test(
      normalizedPrompt
    );
  const hasClassKeyword = /\b(klasse|klassen|class|classroom)\b/.test(normalizedPrompt);
  const hasLearnerKeyword = /\b(lernende|lernenden|schueler|schuelern|studierende|studierenden)\b/.test(
    normalizedPrompt
  );
  const hasLargestKeyword = /\b(meisten|meiste|groesste|groessten|max|mehrsten)\b/.test(
    normalizedPrompt
  );
  const hasOpenVerb =
    OPEN_OR_NAV_VERB_PATTERN.test(normalizedPrompt) || /\bdiese[srn]?\s+oeffnen\b/.test(normalizedPrompt);

  let navigational = false;
  let wantsOpen = false;
  let requestedTab = '';
  let requestedView = '';
  let asksForSheetListing = false;
  let asksForTopicSearch = false;
  let topic = '';
  let asksForVisibleContext = false;
  let asksForSitemap = false;
  let asksForDataModel = false;
  let asksForQueryRecipe = false;
  let asksForExerciseAnalysis = false;
  let asksForAssignmentCompletion = false;
  let asksToOpenLargestClassByLearners = false;
  let asksForStrugglingLearners = false;

  if (!useModelIntent) {
    navigational = hasNavigationKeyword(normalizedPrompt);
    wantsOpen = hasOpenVerb;
    requestedTab = mapPromptToTab(normalizedPrompt);
    requestedView = mapPromptToEditorView(normalizedPrompt);
    asksForSheetListing =
      hasExerciseKeyword && /\b(zeige|liste|list|auflisten|nenn|nenne)\b/.test(normalizedPrompt);
    asksForTopicSearch =
      hasExerciseKeyword && /\b(welche|welcher|welches|finde|finden|suche|such|gibt)\b/.test(normalizedPrompt);
    topic = extractExerciseTopic(options.prompt || '');
    asksForVisibleContext =
      /\b(wo\s+bin\s+ich|welcher\s+kontext|aktueller\s+kontext|in\s+welchem\s+bereich)\b/.test(
        normalizedPrompt
      ) ||
      /\b(was\s+siehst\s+du\s+hier|was\s+ist\s+hier\s+sichtbar|welche\s+elemente\s+sind\s+sichtbar|was\s+kannst\s+du\s+hier)\b/.test(
        normalizedPrompt
      );
    asksForSitemap =
      /\b(sitemap|seitenstruktur|seitenplan|wo\s+kann\s+ich|wo\s+finde\s+ich|wo\s+wird\s+.*(gezeigt|bearbeitet))\b/.test(
        normalizedPrompt
      );
    asksForDataModel =
      /\b(datenbank|datenmodell|db\s*modell|schema|tabellenstruktur|datenstruktur)\b/.test(
        normalizedPrompt
      );
    asksForQueryRecipe =
      /\b(welche\s+api|welcher\s+api|wie\s+holst\s+du\s+daten|woher\s+holst\s+du|daten\s+holen|endpoint)\b/.test(
        normalizedPrompt
      );
    asksForExerciseAnalysis =
      /\b(analyse|analysiere|auswertung|uebersicht|ueberblick)\b/.test(normalizedPrompt) &&
      hasExerciseKeyword;

    const hasCompletionKeyword =
      /\b(ausgefuellt|ausfuellen|ausfuellt|bearbeitet|gemacht|fertig|abgeschlossen|erledigt|offen|fortschritt|stecken)\b/.test(
        normalizedPrompt
      );
    const hasAssignmentKeyword =
      /\b(zugewiesen|zugeteilt|zuordnung|zuordnungen|assignment|assignments)\b/.test(normalizedPrompt);
    asksForAssignmentCompletion =
      hasExerciseKeyword &&
      (hasCompletionKeyword || hasAssignmentKeyword) &&
      (hasLearnerKeyword || hasClassKeyword || /\b(wer|welche|haben|hat|ob)\b/.test(normalizedPrompt));

    asksToOpenLargestClassByLearners =
      wantsOpen && hasClassKeyword && hasLearnerKeyword && hasLargestKeyword;

    asksForStrugglingLearners =
      /\b(wer|welche|welcher)\b/.test(normalizedPrompt) &&
      /\b(lernende|lernenden|schueler|schuelern|studierende|studierenden)\b/.test(normalizedPrompt) &&
      /\b(muehe|schwierig|probleme|am\s+schwaechsten|am\s+meisten\s+muehe|risiko)\b/.test(
        normalizedPrompt
      );
  }

  let forceEmptyAudit = false;
  let forceNameAudit = false;
  let forceLocalSearchCapability = false;
  let forcedSheetReference = '';

  if (useModelIntent) {
    const intentTopic = normalizeLookupValue(modelIntent?.topic ?? '');
    const intentReference = (modelIntent?.reference ?? '').toString().trim();

    switch (modelIntentKind) {
      case 'navigate_tab': {
        navigational = true;
        const intentTab = normalizeLookupValue(modelIntent?.tab ?? '');
        requestedTab =
          intentTab === 'editor' || intentTab === 'inhalt'
            ? 'editor'
            : intentTab === 'classes' || intentTab === 'klassen'
            ? 'classes'
            : intentTab === 'schools' || intentTab === 'schulen'
            ? 'schools'
            : intentTab === 'settings' || intentTab === 'einstellungen'
            ? 'settings'
            : requestedTab;
        if (requestedTab === 'classes' && hasOpenVerb && hasLearnerKeyword && hasLargestKeyword) {
          asksToOpenLargestClassByLearners = true;
        }
        break;
      }
      case 'navigate_view': {
        navigational = true;
        requestedTab = 'editor';
        const intentView = normalizeLookupValue(modelIntent?.view ?? '');
        requestedView =
          intentView === 'html' ||
          intentView === 'visual' ||
          intentView === 'preview' ||
          intentView === 'answers'
            ? intentView
            : requestedView;
        break;
      }
      case 'open_sheet_by_topic': {
        wantsOpen = true;
        requestedTab = requestedTab || 'editor';
        asksForTopicSearch = true;
        if (intentTopic) topic = intentTopic;
        break;
      }
      case 'list_sheets_by_topic': {
        requestedTab = requestedTab || 'editor';
        asksForSheetListing = true;
        asksForTopicSearch = true;
        if (intentTopic) topic = intentTopic;
        break;
      }
      case 'open_sheet_by_reference': {
        wantsOpen = true;
        requestedTab = requestedTab || 'editor';
        forcedSheetReference = intentReference || intentTopic;
        if (intentTopic) {
          topic = intentTopic;
          asksForTopicSearch = true;
        }
        break;
      }
      case 'audit_empty_sheets': {
        forceEmptyAudit = true;
        break;
      }
      case 'audit_name_sheets': {
        forceNameAudit = true;
        break;
      }
      case 'show_context': {
        asksForVisibleContext = true;
        break;
      }
      case 'capability_search': {
        forceLocalSearchCapability = true;
        break;
      }
      case 'show_sitemap': {
        asksForSitemap = true;
        break;
      }
      case 'explain_data_model': {
        asksForDataModel = true;
        break;
      }
      case 'suggest_data_fetch': {
        asksForQueryRecipe = true;
        break;
      }
      case 'analyze_exercises': {
        asksForExerciseAnalysis = true;
        break;
      }
      case 'analyze_assignment_completion': {
        asksForAssignmentCompletion = true;
        if (intentTopic) topic = intentTopic;
        break;
      }
      case 'identify_struggling_learners': {
        asksForStrugglingLearners = true;
        break;
      }
      case 'open_largest_class_by_learners': {
        asksToOpenLargestClassByLearners = true;
        break;
      }
      default:
        break;
    }
  }

  const primaryUseCaseFlags: AgentPrimaryUseCaseFlags = {
    asksForVisibleContext,
    asksForSitemap,
    asksForDataModel,
    asksForQueryRecipe,
    asksForAssignmentCompletion,
    asksForExerciseAnalysis,
    asksForStrugglingLearners,
    asksToOpenLargestClassByLearners,
    topic,
    normalizedPrompt,
    currentContextLabel,
    currentContext,
    visibleItems
  };

  const primaryUseCases = buildAgentPrimaryUseCases({
    options,
    buildVisibleItemsMessage,
    buildSitemapResponse,
    buildDataModelResponse,
    buildRecipeResponse,
    runAssignmentCompletionInsight,
    runExerciseOverviewInsight,
    runStrugglingLearnersInsight,
    runOpenLargestClassByLearners
  });

  const primaryResult = await runAgentUseCases(primaryUseCases, {
    flags: primaryUseCaseFlags,
    nextMemory,
    options,
    done
  });
  if (primaryResult) {
    return primaryResult;
  }

  if (isLikelyContentEditPrompt(normalizedPrompt) && !navigational) {
    return done({ handled: false });
  }

  if (navigational && requestedView && options.getActiveTab() !== 'editor') {
    const switched = await options.switchTab('editor');
    if (!switched) {
      return done({ handled: true, status: 'Navigation abgebrochen.' });
    }
    options.setEditorView(requestedView);
    return done({
      handled: true,
      status: `Zu Inhalt gewechselt (${requestedView}).`,
      message: options.getSelectedId() ? '' : 'Derzeit ist kein Sheet geoeffnet. Nenne ein Sheet zum Oeffnen.'
    });
  }

  const asksForLocalSearchCapability =
    /\b(suche|suchen|such|finden|titel|name|namen|liste|auflisten|lesen)\b/.test(normalizedPrompt) &&
    /\b(kannst|hast|moeglichkeit|denn|du)\b/.test(normalizedPrompt) ||
    forceLocalSearchCapability;

  if (asksForLocalSearchCapability && !wantsOpen) {
    const currentSheets = options.getSheets();
    if (!currentSheets.length && !options.isLoadingSheets()) {
      await options.fetchSheets();
    }
    const sheets = options.getSheets();
    if (!sheets.length) {
      return done({ handled: true, status: 'Noch keine Sheets vorhanden.' });
    }
    return done({
      handled: true,
      status: `${sheets.length} Sheets verfuegbar.`,
      message: `Ja, ich kann lokal in den Sheet-Titeln suchen.\n\nTitel:\n${buildSheetTitleListMessage(
        sheets,
        12
      )}`
    });
  }

  const asksForEmptyAudit =
    /\b(leer|empty|ohne\s+inhalt|inhaltlos)\b/.test(normalizedPrompt) &&
    /\b(arbeitsblatt|arbeitsblaetter|sheet|sheets|blatt|blaetter|dokument|dokumente)\b/.test(
      normalizedPrompt
    ) ||
    forceEmptyAudit;
  const asksForNameAudit =
    /\b(vom\s+namen\s+her|nach\s+namen|namens?|titel(n)?|bezeichnung(en)?)\b/.test(normalizedPrompt) &&
    !/\b(kannst|hast|moeglichkeit|du)\b/.test(normalizedPrompt) ||
    forceNameAudit;

  if (asksForEmptyAudit || asksForNameAudit) {
    const currentSheets = options.getSheets();
    if (!currentSheets.length && !options.isLoadingSheets()) {
      await options.fetchSheets();
    }
    const sheets = options.getSheets();
    if (!sheets.length) {
      return done({ handled: true, status: 'Noch keine Sheets vorhanden.' });
    }

    const sections: string[] = [];
    const trackedIds: string[] = [];

    if (asksForEmptyAudit) {
      const emptySheets = findLikelyEmptySheets(sheets);
      nextMemory.lastSheetAuditIntent = 'empty';
      if (!emptySheets.length) {
        sections.push('Keine klar leeren Arbeitsblaetter gefunden.');
      } else {
        const lines = emptySheets.slice(0, 12).map((sheet, index) => {
          trackedIds.push(normalizeMemoryId(sheet.id));
          return `${index + 1}. ${formatSheetLabel(sheet)}`;
        });
        sections.push(`Leer (Inhalt):\n${lines.join('\n')}`);
      }
    }

    if (asksForNameAudit) {
      const weakNameSheets = findSheetsWithWeakNames(sheets);
      nextMemory.lastSheetAuditIntent = 'name';
      if (!weakNameSheets.length) {
        sections.push('Keine auffaelligen Namen gefunden.');
      } else {
        const lines = weakNameSheets.slice(0, 12).map((entry, index) => {
          trackedIds.push(normalizeMemoryId(entry.sheet.id));
          return `${index + 1}. ${formatSheetLabel(entry.sheet)} (${entry.reason})`;
        });
        sections.push(`Auffaellige Namen:\n${lines.join('\n')}`);
      }
    }

    if (trackedIds.length) {
      nextMemory.sheetMatchIds = Array.from(new Set(trackedIds));
    }

    return done({
      handled: true,
      status: 'Sheet-Check abgeschlossen.',
      message: sections.join('\n\n')
    });
  }

  const referencesExercise =
    asksForTopicSearch ||
    asksForSheetListing ||
    (wantsOpen && (requestedTab === 'editor' || hasExerciseKeyword));

  if (referencesExercise) {
    const currentSheets = options.getSheets();
    if (!currentSheets.length && !options.isLoadingSheets()) {
      await options.fetchSheets();
    }
    const sheets = options.getSheets();

    if (wantsOpen && forcedSheetReference) {
      const target = findSheetByReference(sheets, nextMemory.sheetMatchIds, forcedSheetReference);
      if (target) {
        const opened = await options.openSheet(target);
        return done({
          handled: true,
          status: opened
            ? `Sheet geoeffnet: ${formatSheetLabel(target)}.`
            : 'Sheet konnte nicht geoeffnet werden.'
        });
      }
    }

    if (wantsOpen && /\b(diese|diesen|dieses)\b/.test(normalizedPrompt) && nextMemory.sheetMatchIds.length) {
      const target = sheets.find((sheet) => nextMemory.sheetMatchIds.includes(normalizeMemoryId(sheet.id)));
      if (!target) {
        return done({ handled: true, status: 'Kein vorheriger Treffer mehr vorhanden.' });
      }
      const opened = await options.openSheet(target);
      return done({
        handled: true,
        status: opened ? `Sheet geoeffnet: ${formatSheetLabel(target)}.` : 'Sheet konnte nicht geoeffnet werden.'
      });
    }

    if (wantsOpen && /\b(sheet|arbeitsblatt|blatt)\b/.test(normalizedPrompt)) {
      const query = extractSheetNavigationQuery(options.prompt);
      const target = findSheetByQuery(sheets, query);
      if (target) {
        const opened = await options.openSheet(target);
        return done({
          handled: true,
          status: opened
            ? `Sheet geoeffnet: ${formatSheetLabel(target)}.`
            : 'Sheet konnte nicht geoeffnet werden.'
        });
      }
    }

    const resolvedTopic = topic || nextMemory.lastExerciseTopic;
    if (!resolvedTopic) {
      if (asksForTopicSearch || asksForSheetListing || wantsOpen) {
        return done({
          handled: true,
          status: 'Bitte Thema praezisieren (z.B. "europaeische union").',
          message: sheets.length ? `Verfuegbare Titel:\n${buildSheetTitleListMessage(sheets, 8)}` : ''
        });
      }
      return done({ handled: false });
    }

    nextMemory.lastExerciseTopic = resolvedTopic;
    nextMemory.lastExerciseIntent = wantsOpen ? 'open' : 'lookup';

    const matches = findSheetsByTopic(sheets, resolvedTopic, 6);
    nextMemory.sheetMatchIds = matches.map((sheet) => normalizeMemoryId(sheet.id)).filter(Boolean);

    if (!matches.length) {
      return done({ handled: true, status: `Keine Uebung zu "${resolvedTopic}" gefunden.` });
    }

    if (wantsOpen) {
      const target = matches[0];
      const opened = await options.openSheet(target);
      return done({
        handled: true,
        status: opened ? `Sheet geoeffnet: ${formatSheetLabel(target)}.` : 'Sheet konnte nicht geoeffnet werden.',
        message:
          matches.length > 1
            ? `Weitere Treffer zu "${resolvedTopic}": ${matches
                .slice(1, 4)
                .map((sheet) => formatSheetLabel(sheet))
                .join(', ')}.`
            : `Treffer zu "${resolvedTopic}" gefunden.`
      });
    }

    return done({
      handled: true,
      status: `${matches.length} Treffer zu "${resolvedTopic}" gefunden.`,
      message: matches
        .slice(0, 5)
        .map((sheet, index) => `${index + 1}. ${formatSheetLabel(sheet)}`)
        .join('\n')
    });
  }

  if (navigational && options.getActiveTab() === 'editor' && options.getSelectedId()) {
    if (/\b(zurueck|zuruck|back)\b/.test(normalizedPrompt) && /\bliste\b/.test(normalizedPrompt)) {
      const canLeave = await options.closeEditorToList();
      return done({
        handled: true,
        status: canLeave ? 'Zur Sheet-Liste gewechselt.' : 'Wechsel abgebrochen.'
      });
    }

    if (requestedView) {
      const changed = options.setEditorView(requestedView);
      if (changed) {
        return done({ handled: true, status: `Editor-Ansicht gewechselt: ${requestedView}.` });
      }
    }
  }

  if (navigational) {
    const nextTab = requestedTab;
    if (nextTab && options.getActiveTab() !== nextTab) {
      const switched = await options.switchTab(nextTab);
      if (switched) {
        const tabLabel =
          nextTab === 'editor'
            ? 'Inhalt'
            : nextTab === 'classes'
            ? 'Klassen'
            : nextTab === 'schools'
            ? 'Schulen'
            : 'Einstellungen';
        return done({ handled: true, status: `Navigation ausgefuehrt: ${tabLabel}.` });
      }
      return done({ handled: true, status: 'Navigation abgebrochen.' });
    }

    if (requestedView && options.getActiveTab() === 'editor') {
      const changed = options.setEditorView(requestedView);
      if (changed) {
        return done({ handled: true, status: `Editor-Ansicht gewechselt: ${requestedView}.` });
      }
    }
  }

  return done({ handled: false });
};
