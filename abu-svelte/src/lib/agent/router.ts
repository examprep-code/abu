export interface AgentSheetEntry {
  id: string | number;
  key?: string;
  name?: string;
  content?: string;
}

export interface AgentMemory {
  sheetMatchIds: Array<string | number>;
  lastExerciseTopic: string;
  lastExerciseIntent: string;
  lastSheetAuditIntent: string;
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

export interface AgentNavigationOptions {
  prompt: string;
  memory: AgentMemory;
  getSheets: () => AgentSheetEntry[];
  isLoadingSheets: () => boolean;
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
  'zur',
  'zum',
  'ueber',
  'von'
]);

const normalizePromptText = (value = '') =>
  value
    .toLowerCase()
    .replace(/\u00e4/g, 'ae')
    .replace(/\u00f6/g, 'oe')
    .replace(/\u00fc/g, 'ue')
    .replace(/\u00df/g, 'ss');

const OPEN_OR_NAV_VERB_PATTERN =
  /\b(oeffne|oeffnen|open|lade|laden|zeige|wechsel|wechsle|gehe|geh|spring|springe|navigiere)\b/;

const hasNavigationKeyword = (value = '') =>
  /\b(gehe|geh|wechsel|wechsle|navigiere|spring|springe|oeffne|oeffnen|zeige|zurueck|zuruck)\b/.test(
    value
  );

const startsWithQuestionWord = (value = '') =>
  /^(was|wie|wer|wo|wann|warum|wieso|weshalb|what|how|who|where|when|why)\b/.test(value);

const looksLikeMathPrompt = (value = '') =>
  /\d/.test(value) &&
  /(?:[+\-*/=]|\bplus\b|\bminus\b|\bmal\b|\bgeteilt\b|\btimes\b|\bdivided\b)/.test(value);

const looksLikeExerciseCreationPrompt = (value = '') => {
  const hasCreateVerb = /\b(erstelle|erzeuge|generiere|schreibe|mache|entwirf|formuliere)\b/.test(value);
  const hasTaskShape = /\b(luecke|luecken|fragen|frage|quiz|test)\b/.test(value);
  return hasCreateVerb || hasTaskShape;
};

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

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeMemoryId = (value: string | number | null | undefined) => String(value ?? '').trim();

const normalizeExerciseTopicTokens = (topic = '') => {
  const baseTokens = tokenizeLookupWords(topic).filter(
    (token) => token.length > 1 && !EXERCISE_TOPIC_STOPWORDS.has(token)
  );
  const tokenSet = new Set(baseTokens);

  if (tokenSet.has('eu')) {
    tokenSet.add('europaeische');
    tokenSet.add('union');
  }
  if (tokenSet.has('europaeische') && tokenSet.has('union')) {
    tokenSet.add('eu');
  }

  return Array.from(tokenSet);
};

const stripHtml = (value = '') => value.replace(/<[^>]*>/g, ' ');

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
  const escapedTopic = escapeRegExp(normalizedTopic);
  const topicWordPattern = new RegExp(`(?:^|\\s)${escapedTopic}(?:\\s|$)`, 'i');
  if (topicWordPattern.test(haystack)) {
    score += 220;
  }

  let matchedTokens = 0;
  for (const token of topicTokens) {
    if (tokenSet.has(token)) {
      matchedTokens += 1;
      score += token.length <= 2 ? 90 : 45;
    }
  }

  if (topicTokens.length >= 2 && matchedTokens === topicTokens.length) {
    score += 80;
  } else if (topicTokens.length >= 2 && matchedTokens === 1) {
    score -= 20;
  }

  if (topicTokens.includes('eu') && tokenSet.has('europaeische') && tokenSet.has('union')) {
    score += 90;
  }

  if (matchedTokens === 0 && score < 150) {
    return 0;
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
  if (!tokens.length) {
    if (/\beu\b/.test(normalizeLookupValue(value))) {
      return 'eu';
    }
    return '';
  }
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

const isShortTopicPrompt = (value = '') => {
  const tokens = tokenizeLookupWords(value).filter(
    (token) => token.length > 1 && !EXERCISE_TOPIC_STOPWORDS.has(token)
  );
  return tokens.length > 0 && tokens.length <= 3;
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

const isEditorContext = (context = '') =>
  context === 'html' ||
  context === 'visual' ||
  context === 'preview' ||
  context === 'answers' ||
  context === 'sheets';

const resolveCurrentContext = (options: AgentNavigationOptions) =>
  resolveAgentContext({
    activeTab: options.getActiveTab(),
    selectedId: options.getSelectedId(),
    editorView: options.getEditorView ? options.getEditorView() : 'html'
  });

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

const buildVisibleItemsMessage = (context: string, visibleItems: string[] = []) => {
  const effectiveItems = visibleItems.length
    ? visibleItems
    : defaultVisibleItemsByContext[context] || defaultVisibleItemsByContext.app;
  if (!effectiveItems.length) return 'Keine sichtbaren Elemente ermittelt.';
  return `Sichtbar hier:\n${effectiveItems.map((entry) => `- ${entry}`).join('\n')}`;
};

export const resolveAgentNavigationIntent = async (
  options: AgentNavigationOptions
): Promise<AgentNavigationResult> => {
  const nextMemory: AgentMemory = {
    sheetMatchIds: [...(options.memory?.sheetMatchIds ?? [])]
      .map((entry) => normalizeMemoryId(entry))
      .filter(Boolean),
    lastExerciseTopic: options.memory?.lastExerciseTopic ?? '',
    lastExerciseIntent: options.memory?.lastExerciseIntent ?? '',
    lastSheetAuditIntent: options.memory?.lastSheetAuditIntent ?? ''
  };

  const done = (payload: Omit<AgentNavigationResult, 'memory'>): AgentNavigationResult => ({
    ...payload,
    memory: nextMemory
  });

  const normalizedPrompt = normalizePromptText(options.prompt || '');
  const currentContext = resolveCurrentContext(options);
  const currentContextLabel = describeAgentContext(currentContext);
  const contextDetails = options.getContextDetails ? options.getContextDetails() : {};
  const visibleItems = Array.isArray(contextDetails?.visible)
    ? contextDetails.visible
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean)
    : [];
  const inEditorContext = isEditorContext(currentContext);
  const navigational = hasNavigationKeyword(normalizedPrompt);
  const requestedTab = mapPromptToTab(normalizedPrompt);
  const requestedView = mapPromptToEditorView(normalizedPrompt);
  const wantsOpen = OPEN_OR_NAV_VERB_PATTERN.test(normalizedPrompt) || /\bdiese[srn]?\s+oeffnen\b/.test(normalizedPrompt);
  const asksForExerciseLookup = /\b(welche|welcher|welches|finde|suche|such|gibt)\b/.test(
    normalizedPrompt
  );
  const asksForSheetListing = /\b(zeige|liste|list|auflisten|nenn|nenne)\b/.test(normalizedPrompt);
  const hasExerciseKeyword = /\b(uebung|uebungen|aufgabe|aufgaben|arbeitsblatt|sheet|blatt)\b/.test(
    normalizedPrompt
  );
  const hasDocumentKeyword = /\b(dokument|dokumente|datei|dateien|text|inhalt)\b/.test(
    normalizedPrompt
  );
  const asksForLocalSearchCapability =
    /\b(suche|suchen|such|finden|titel|name|namen|liste|auflisten|lesen)\b/.test(
      normalizedPrompt
    ) && /\b(kannst|hast|moeglichkeit|denn|du)\b/.test(normalizedPrompt);
  const isExerciseFollowUp = /\b(ich\s+meine|gemeint\s+ist|ich\s+spreche\s+von|es\s+geht\s+um)\b/.test(
    normalizedPrompt
  );
  const resolvedTopic = extractExerciseTopic(options.prompt || '');
  const referencesExerciseContext = /\b(diese|dieses|diesen|thema|dazu|darueber)\b/.test(
    normalizedPrompt
  );
  const looksLikeCreationPrompt = looksLikeExerciseCreationPrompt(normalizedPrompt);
  const likelyQuestion = startsWithQuestionWord(normalizedPrompt) || /\?\s*$/.test(options.prompt || '');
  const likelyMathPrompt = looksLikeMathPrompt(normalizedPrompt);
  const shortTopicPrompt = isShortTopicPrompt(options.prompt || '');
  const canInferExerciseFromCarry =
    nextMemory.lastExerciseIntent !== '' &&
    !!resolvedTopic &&
    shortTopicPrompt &&
    !navigational &&
    !likelyQuestion &&
    !likelyMathPrompt &&
    !/\b(klasse|klassen|schule|schulen|settings|einstellung|html|visual|preview|antwort)\b/.test(
      normalizedPrompt
    );
  const hasSheetSearchIntent =
    !looksLikeCreationPrompt &&
    (hasExerciseKeyword || hasDocumentKeyword) &&
    (asksForExerciseLookup || asksForSheetListing || wantsOpen);
  const hasExerciseContext =
    hasSheetSearchIntent ||
    isExerciseFollowUp ||
    (nextMemory.lastExerciseIntent !== '' && referencesExerciseContext) ||
    canInferExerciseFromCarry;
  const explicitEditorIntent =
    navigational &&
    (requestedTab === 'editor' ||
      requestedView !== '' ||
      wantsOpen ||
      /\b(editor|inhalt|sheet|arbeitsblatt|blatt|dokument|datei|uebung|aufgabe)\b/.test(
        normalizedPrompt
      ));
  const asksForVisibleContext =
    /\b(was\s+siehst\s+du\s+hier|was\s+ist\s+hier\s+sichtbar|welche\s+elemente\s+sind\s+sichtbar|was\s+kannst\s+du\s+hier)\b/.test(
      normalizedPrompt
    ) ||
    /\b(zeige|nenn|nenne)\b/.test(normalizedPrompt) && /\bsichtbar\b/.test(normalizedPrompt);
  const asksForDeletion = /\b(loesch|loeschen|delete|entfern|weg)\b/.test(normalizedPrompt);
  const asksForEmptyAudit =
    /\b(leer|empty|ohne\s+inhalt|inhaltlos)\b/.test(normalizedPrompt) &&
    /\b(arbeitsblatt|arbeitsblaetter|sheet|sheets|blatt|blaetter|dokument|dokumente)\b/.test(
      normalizedPrompt
    );
  const asksForNameAudit =
    /\b(vom\s+namen\s+her|nach\s+namen|namens?|titel(n)?|bezeichnung(en)?)\b/.test(normalizedPrompt) &&
    !/\b(kannst|hast|moeglichkeit|du)\b/.test(normalizedPrompt);
  const isSheetAuditFollowUp =
    (asksForNameAudit || /\bund\s+vom\s+namen\s+her\b/.test(normalizedPrompt)) &&
    nextMemory.lastSheetAuditIntent !== '';

  const ensureSheetsLoaded = async () => {
    const currentSheets = options.getSheets();
    if (!currentSheets.length && !options.isLoadingSheets()) {
      await options.fetchSheets();
    }
  };

  if (/\b(wo\s+bin\s+ich|welcher\s+kontext|aktueller\s+kontext|in\s+welchem\s+bereich)\b/.test(
    normalizedPrompt
  )) {
    return done({
      handled: true,
      status: currentContextLabel,
      message: buildVisibleItemsMessage(currentContext, visibleItems)
    });
  }

  if (asksForVisibleContext) {
    return done({
      handled: true,
      status: currentContextLabel,
      message: buildVisibleItemsMessage(currentContext, visibleItems)
    });
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
      message: options.getSelectedId()
        ? ''
        : 'Derzeit ist kein Sheet geoeffnet. Nenne ein Sheet zum Oeffnen.'
    });
  }

  if (asksForLocalSearchCapability && !wantsOpen) {
    await ensureSheetsLoaded();
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

  if (asksForEmptyAudit || isSheetAuditFollowUp || asksForNameAudit) {
    await ensureSheetsLoaded();
    const sheets = options.getSheets();
    if (!sheets.length) {
      return done({ handled: true, status: 'Noch keine Sheets vorhanden.' });
    }

    const emptySheets = asksForEmptyAudit ? findLikelyEmptySheets(sheets) : [];
    const weakNameSheets = asksForNameAudit || isSheetAuditFollowUp ? findSheetsWithWeakNames(sheets) : [];
    const sections: string[] = [];
    const trackedIds: string[] = [];

    if (asksForEmptyAudit) {
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

    if (asksForNameAudit || isSheetAuditFollowUp) {
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

    const deletionHint = asksForDeletion
      ? '\n\nLoeschen kannst du diese Kandidaten in der Sheet-Liste. Wenn du willst, nenne ich sie dir als kurze Delete-Liste.'
      : '';

    return done({
      handled: true,
      status: 'Sheet-Check abgeschlossen.',
      message: `${sections.join('\n\n')}${deletionHint}`.trim()
    });
  }

  if (!inEditorContext && hasExerciseContext && !explicitEditorIntent) {
    return done({
      handled: true,
      status: `${currentContextLabel}.`,
      message: `${buildVisibleItemsMessage(currentContext, visibleItems)}\n\nFuer Uebungen oder Dokumente bitte explizit wechseln, z.B. "Wechsel zu Inhalt und suche nach europaeische union".`
    });
  }

  if (hasExerciseContext) {
    await ensureSheetsLoaded();
    const sheets = options.getSheets();

    if (wantsOpen && /\b(diese|diesen|dieses)\b/.test(normalizedPrompt) && nextMemory.sheetMatchIds.length) {
      const target = sheets.find((sheet) =>
        nextMemory.sheetMatchIds.includes(normalizeMemoryId(sheet.id))
      );
      if (!target) {
        return done({ handled: true, status: 'Kein vorheriger Treffer mehr vorhanden.' });
      }
      const opened = await options.openSheet(target);
      return done({
        handled: true,
        status: opened
          ? `Sheet geoeffnet: ${formatSheetLabel(target)}.`
          : 'Sheet konnte nicht geoeffnet werden.'
      });
    }

    const topic = resolvedTopic || nextMemory.lastExerciseTopic;
    if (!topic) {
      return done({
        handled: true,
        status: 'Bitte Thema praezisieren (z.B. "europaeische union").',
        message: sheets.length ? `Verfuegbare Titel:\n${buildSheetTitleListMessage(sheets, 8)}` : ''
      });
    }

    nextMemory.lastExerciseTopic = topic;
    nextMemory.lastExerciseIntent = wantsOpen ? 'open' : 'lookup';

    const matches = findSheetsByTopic(sheets, topic, 6);
    nextMemory.sheetMatchIds = matches.map((sheet) => normalizeMemoryId(sheet.id)).filter(Boolean);

    if (!matches.length) {
      return done({ handled: true, status: `Keine Uebung zu "${topic}" gefunden.` });
    }

    if (wantsOpen) {
      const target = matches[0];
      const opened = await options.openSheet(target);
      return done({
        handled: true,
        status: opened
          ? `Sheet geoeffnet: ${formatSheetLabel(target)}.`
          : 'Sheet konnte nicht geoeffnet werden.',
        message:
          matches.length > 1
            ? `Weitere Treffer zu "${topic}": ${matches
                .slice(1, 4)
                .map((sheet) => formatSheetLabel(sheet))
                .join(', ')}.`
            : `Treffer zu "${topic}" gefunden.`
      });
    }

    if (asksForExerciseLookup || isExerciseFollowUp || !wantsOpen) {
      return done({
        handled: true,
        status: `${matches.length} Treffer zu "${topic}" gefunden.`,
        message: matches
          .slice(0, 5)
          .map((sheet, index) => `${index + 1}. ${formatSheetLabel(sheet)}`)
          .join('\n')
      });
    }
  }

  if (
    navigational &&
    /\b(sheet|arbeitsblatt|blatt)\b/.test(normalizedPrompt) &&
    /\b(oeffne|open|lade|zeige|wechsel|gehe)\b/.test(normalizedPrompt)
  ) {
    await ensureSheetsLoaded();
    const query = extractSheetNavigationQuery(options.prompt);
    const target = findSheetByQuery(options.getSheets(), query);
    if (!target) {
      const label = query ? `"${query}"` : 'diesem Namen';
      return done({ handled: true, status: `Kein Sheet mit ${label} gefunden.` });
    }
    const opened = await options.openSheet(target);
    return done({
      handled: true,
      status: opened
        ? `Sheet geoeffnet: ${formatSheetLabel(target)}.`
        : 'Sheet konnte nicht geoeffnet werden.'
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
  }

  return done({ handled: false });
};
