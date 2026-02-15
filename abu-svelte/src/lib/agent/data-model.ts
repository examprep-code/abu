export interface AgentDataField {
  name: string;
  type: string;
  description: string;
}

export interface AgentDataEntity {
  id: string;
  label: string;
  description: string;
  fields: AgentDataField[];
  relations: string[];
}

export interface AgentApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  usedByViews: string[];
  returns: string;
}

export interface AgentQueryRecipe {
  id: string;
  label: string;
  whenToUse: string;
  steps: string[];
  endpoints: string[];
}

export const AGENT_DATA_MODEL: AgentDataEntity[] = [
  {
    id: 'user',
    label: 'User',
    description: 'Lehrperson/Admin mit Login-Token.',
    fields: [
      { name: 'id', type: 'int', description: 'Primarschluessel' },
      { name: 'email', type: 'varchar', description: 'Login-Email' },
      { name: 'password', type: 'varchar(hash)', description: 'Gehashtes Passwort' },
      { name: 'token', type: 'varchar', description: 'Aktiver API-Token' },
      { name: 'valid_until', type: 'datetime', description: 'Token-Gueltigkeit' }
    ],
    relations: ['1:n sheet', '1:n school', '1:n classroom', '1:n learner']
  },
  {
    id: 'sheet',
    label: 'Sheet',
    description: 'Arbeitsblatt; Versionierung ueber key + is_current.',
    fields: [
      { name: 'id', type: 'int', description: 'Version-ID' },
      { name: 'user', type: 'fkey user.id', description: 'Besitzender User' },
      { name: 'key', type: 'word', description: 'Stabiler Sheet-Schluessel' },
      { name: 'name', type: 'word', description: 'Titel des Sheets' },
      { name: 'content', type: 'text', description: 'HTML-Inhalt' },
      { name: 'is_current', type: 'bool', description: 'Aktive Version' }
    ],
    relations: ['n:1 user', '1:n classroom_sheet (via sheet_key)', '1:n answer (via sheet key)']
  },
  {
    id: 'school',
    label: 'School',
    description: 'Schule inkl. CI CSS.',
    fields: [
      { name: 'id', type: 'int', description: 'Primarschluessel' },
      { name: 'user', type: 'fkey user.id', description: 'Besitzender User' },
      { name: 'name', type: 'word', description: 'Schulname' },
      { name: 'ci_css', type: 'text', description: 'CI CSS' }
    ],
    relations: ['n:1 user', '1:n classroom']
  },
  {
    id: 'classroom',
    label: 'Classroom',
    description: 'Klasse mit Stammdaten und optionaler Schule.',
    fields: [
      { name: 'id', type: 'int', description: 'Primarschluessel' },
      { name: 'user', type: 'fkey user.id', description: 'Besitzender User' },
      { name: 'school', type: 'fkey school.id', description: 'Optional verknuepfte Schule' },
      { name: 'name', type: 'word', description: 'Klassenname' },
      { name: 'year', type: 'word', description: 'Jahrgang' },
      { name: 'profession', type: 'word', description: 'Beruf/Fachrichtung' },
      { name: 'notes', type: 'text', description: 'Notizen' }
    ],
    relations: ['n:1 user', 'n:1 school', '1:n learner', '1:n classroom_sheet']
  },
  {
    id: 'learner',
    label: 'Learner',
    description: 'Lernende Person mit Login-Code.',
    fields: [
      { name: 'id', type: 'int', description: 'Primarschluessel' },
      { name: 'user', type: 'fkey user.id', description: 'Besitzender User' },
      { name: 'classroom', type: 'fkey classroom.id', description: 'Klassen-ID' },
      { name: 'name', type: 'word', description: 'Anzeigename' },
      { name: 'email', type: 'email', description: 'Optionale Email' },
      { name: 'code', type: 'token', description: '12-stelliger Lernenden-Code' },
      { name: 'notes', type: 'text', description: 'Notizen' }
    ],
    relations: ['n:1 user', 'n:1 classroom']
  },
  {
    id: 'classroom_sheet',
    label: 'ClassroomSheet',
    description: 'Zuordnung Sheet <-> Klasse inkl. Status und Form.',
    fields: [
      { name: 'id', type: 'int', description: 'Primarschluessel' },
      { name: 'user', type: 'fkey user.id', description: 'Besitzender User' },
      { name: 'classroom', type: 'fkey classroom.id', description: 'Klassen-ID' },
      { name: 'sheet_key', type: 'word', description: 'Sheet key' },
      { name: 'status', type: 'word', description: 'aktiv|freiwillig|archiviert' },
      { name: 'assignment_form', type: 'word', description: 'personal|anonym' }
    ],
    relations: ['n:1 user', 'n:1 classroom', 'n:1 sheet (via key)']
  },
  {
    id: 'answer',
    label: 'Answer',
    description: 'Antworteintrag auf eine Luecke/Frage.',
    fields: [
      { name: 'id', type: 'int', description: 'Primarschluessel' },
      { name: 'key', type: 'word', description: 'Luecken-/Feld-Key im Sheet' },
      { name: 'sheet', type: 'word', description: 'Sheet key' },
      { name: 'value', type: 'word', description: 'Antworttext' },
      { name: 'user', type: 'word', description: 'Lernenden-Code oder Benutzerkennung' },
      { name: 'classroom', type: 'int', description: 'Klassen-ID (optional)' },
      { name: 'classification', type: 'int', description: '0/500/1000 Bewertung' },
      { name: 'updated_at', type: 'datetime', description: 'Zeitstempel letzte Aenderung' }
    ],
    relations: ['n:1 classroom (optional)', 'n:1 sheet (via key)']
  },
  {
    id: 'log',
    label: 'Log',
    description: 'Backend-Log fuer Antwort/KI-Rueckmeldungen.',
    fields: [
      { name: 'id', type: 'int', description: 'Primarschluessel' },
      { name: 'request', type: 'array/text', description: 'Request-JSON' },
      { name: 'chatgpt', type: 'array/text', description: 'KI-Antwort JSON' }
    ],
    relations: []
  },
  {
    id: 'agent_chat_log',
    label: 'AgentChatLog',
    description:
      'Persistenter Agent-Chat-Log mit Prompt, Ablaufprotokoll, Antwort und Nutzerbewertung.',
    fields: [
      { name: 'id', type: 'int', description: 'Primarschluessel' },
      { name: 'user', type: 'int', description: 'Besitzender User' },
      { name: 'prompt', type: 'longtext', description: 'Nutzeranfrage' },
      {
        name: 'agent_flow',
        type: 'longtext(JSON)',
        description: 'Ablaufprotokoll inkl. Navigation und API-Calls'
      },
      { name: 'response', type: 'longtext', description: 'Finale Agent-Antwort' },
      { name: 'rating', type: 'int', description: '1 positiv, 0 teilweise, -1 negativ' },
      { name: 'rating_comment', type: 'longtext', description: 'Optionaler Nutzerkommentar' }
    ],
    relations: ['n:1 user']
  }
];

export const AGENT_API_ENDPOINTS: AgentApiEndpoint[] = [
  {
    id: 'user_login',
    method: 'POST',
    path: 'user/login',
    description: 'Admin Login mit Email/Passwort.',
    usedByViews: ['admin.login'],
    returns: 'token, user'
  },
  {
    id: 'user_token_validate',
    method: 'GET',
    path: 'user/login//{token}',
    description: 'Token-Validierung.',
    usedByViews: ['admin.login'],
    returns: 'valid, user'
  },
  {
    id: 'user_register',
    method: 'POST',
    path: 'user/register',
    description: 'Admin Account registrieren.',
    usedByViews: ['public.register'],
    returns: 'user'
  },
  {
    id: 'sheet_crud',
    method: 'GET',
    path: 'sheet',
    description: 'Aktuelle Sheets laden.',
    usedByViews: ['admin.editor.list'],
    returns: 'sheet[]'
  },
  {
    id: 'sheet_versions',
    method: 'GET',
    path: 'sheet?key={key}',
    description: 'Alle Versionen zu einem Sheet key.',
    usedByViews: ['admin.editor.html', 'admin.editor.visual'],
    returns: 'sheet[]'
  },
  {
    id: 'school_crud',
    method: 'GET',
    path: 'school',
    description: 'Schulen laden.',
    usedByViews: ['admin.schools.overview', 'admin.settings.ci'],
    returns: 'school[]'
  },
  {
    id: 'classroom_crud',
    method: 'GET',
    path: 'classroom',
    description: 'Klassen laden.',
    usedByViews: ['admin.classes.overview', 'admin.editor.answers'],
    returns: 'classroom[]'
  },
  {
    id: 'learner_by_class',
    method: 'GET',
    path: 'learner?classroom={id}',
    description: 'Lernende je Klasse.',
    usedByViews: ['admin.classes.learners', 'admin.editor.answers'],
    returns: 'learner[]'
  },
  {
    id: 'plan_by_class',
    method: 'GET',
    path: 'plan?classroom={id}',
    description: 'Sheet-Zuordnung je Klasse.',
    usedByViews: ['admin.classes.assignments'],
    returns: 'classroom_sheet[]'
  },
  {
    id: 'answer_query',
    method: 'GET',
    path: 'answer?sheet={key}&classroom={id}&user={code}',
    description: 'Antworten gefiltert laden.',
    usedByViews: ['admin.editor.answers', 'review.sheet'],
    returns: 'answer[]'
  },
  {
    id: 'sheet_public',
    method: 'GET',
    path: 'sheet/public?key={key}&classroom={id}',
    description: 'Oeffentliches aktuelles Sheet laden.',
    usedByViews: ['learner.sheet', 'review.sheet'],
    returns: 'sheet'
  },
  {
    id: 'sheet_public_list',
    method: 'GET',
    path: 'sheet/public-list?code={learnerCode}',
    description: 'Fuer Lernende sichtbare Sheets laden.',
    usedByViews: ['learner.login'],
    returns: 'sheet[]'
  },
  {
    id: 'learner_login',
    method: 'POST',
    path: 'learner-login',
    description: 'Lernenden-Code validieren.',
    usedByViews: ['learner.login', 'learner.sheet'],
    returns: 'learner, valid'
  },
  {
    id: 'agent_log_create',
    method: 'POST',
    path: 'agent_log',
    description: 'Agent-Chat in DB protokollieren (prompt, flow, response).',
    usedByViews: ['admin.agent.sidebar'],
    returns: 'logged, log_id'
  },
  {
    id: 'agent_log_rate',
    method: 'PATCH',
    path: 'agent_log',
    description: 'Bewertung fuer Agent-Log speichern (positiv/negativ + Kommentar).',
    usedByViews: ['admin.agent.sidebar'],
    returns: 'rated, log_id'
  }
];

export const AGENT_QUERY_RECIPES: AgentQueryRecipe[] = [
  {
    id: 'exercise_overview',
    label: 'Analyse aller Uebungen',
    whenToUse: 'Wenn eine Uebersicht ueber vorhandene Sheets oder deren Antwortqualitaet benoetigt wird.',
    steps: [
      'GET sheet -> aktuelle Sheets laden.',
      'Pro relevantem Sheet GET answer?sheet={key} laden.',
      'Antwortanzahl und durchschnittliche Klassifizierung pro Sheet berechnen.',
      'Schwaechste/staerkste Sheets mit kurzer Interpretation ausgeben.'
    ],
    endpoints: ['sheet_crud', 'answer_query']
  },
  {
    id: 'struggling_learners',
    label: 'Lernende mit Muehe identifizieren',
    whenToUse: 'Wenn erfragt wird, wer aktuell am meisten Schwierigkeiten hat.',
    steps: [
      'GET classroom -> Klassen laden.',
      'Fuer jede Klasse GET learner?classroom={id} laden.',
      'Fuer jede Klasse GET answer?classroom={id} laden.',
      'Pro Lernenden Fehl-/Teilraten, Volumen und Aktualitaet berechnen.',
      'Top-Risiko-Liste mit Begruendung ausgeben.'
    ],
    endpoints: ['classroom_crud', 'learner_by_class', 'answer_query']
  },
  {
    id: 'class_assignment_matrix',
    label: 'Welche Klasse hat welche Sheets',
    whenToUse: 'Wenn Zuordnungen und Status einer Klasse gefragt sind.',
    steps: [
      'GET plan?classroom={id} laden.',
      'Optional GET sheet laden, um Titel fuer sheet_key aufloesen.',
      'Status und assignment_form als Matrix darstellen.'
    ],
    endpoints: ['plan_by_class', 'sheet_crud']
  },
  {
    id: 'topic_assignment_completion',
    label: 'Haben Lernende zugewiesene Themenblaetter erledigt?',
    whenToUse:
      'Wenn geprueft werden soll, ob Lernende die zugewiesenen Blaetter zu einem Thema (z.B. EU) ausgefuellt haben.',
    steps: [
      'GET sheet -> thematisch passende Sheets bestimmen.',
      'GET classroom -> Klassen laden.',
      'Pro Klasse GET plan?classroom={id} -> zugewiesene sheet_key filtern.',
      'Pro Klasse GET learner?classroom={id} und GET answer?classroom={id} laden.',
      'Lueckenanzahl pro Sheet mit gegebenen/korrekten Antworten pro Lernenden vergleichen.',
      'Offene bzw. fehlerhafte Luecken als Engpaesse zusammenfassen.'
    ],
    endpoints: ['sheet_crud', 'classroom_crud', 'plan_by_class', 'learner_by_class', 'answer_query']
  },
  {
    id: 'learner_recent_answers',
    label: 'Kuerzliche Antworten einer lernenden Person',
    whenToUse: 'Wenn Verlauf oder aktuelle Schwierigkeiten einer Person gefragt sind.',
    steps: [
      'GET answer?classroom={id}&user={code} laden.',
      'Nach updated_at absteigend sortieren.',
      'Klassifizierungstrend und haeufige Fehlfelder zusammenfassen.'
    ],
    endpoints: ['answer_query']
  },
  {
    id: 'sheet_answer_snapshot',
    label: 'Antwortlage eines Sheets',
    whenToUse: 'Wenn ein einzelnes Sheet analysiert werden soll.',
    steps: [
      'GET answer?sheet={key} (optional +classroom) laden.',
      'Verteilung 0/500/1000 sowie Luecken mit hoher Fehlerquote berechnen.',
      'Kurzfazit mit moeglichen Ursachen ausgeben.'
    ],
    endpoints: ['answer_query']
  }
];

const RECIPE_SYNONYM_RULES: Array<{ pattern: RegExp; canonical: string }> = [
  {
    pattern: /\b(schueler|schuelern|schuelerin|schuelerinnen|studierende|studierenden|student|studenten)\b/g,
    canonical: 'lernende'
  },
  {
    pattern: /\b(uebung|uebungen|aufgabe|aufgaben|arbeitsblatt|arbeitsblaetter|blatt|blaetter)\b/g,
    canonical: 'sheet'
  }
];

const applyRecipeSynonyms = (value = '') => {
  let normalized = value;
  for (const rule of RECIPE_SYNONYM_RULES) {
    normalized = normalized.replace(rule.pattern, rule.canonical);
  }
  return normalized;
};

const normalize = (value = '') =>
  applyRecipeSynonyms(
    value
      .toLowerCase()
      .replace(/\u00e4/g, 'ae')
      .replace(/\u00f6/g, 'oe')
      .replace(/\u00fc/g, 'ue')
      .replace(/\u00df/g, 'ss')
  )
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const scoreRecipe = (recipe: AgentQueryRecipe, prompt = '') => {
  const normalizedPrompt = normalize(prompt);
  if (!normalizedPrompt) return 0;

  const hay = normalize(`${recipe.label} ${recipe.whenToUse} ${recipe.steps.join(' ')}`);
  let score = 0;

  const promptTokens = normalizedPrompt.split(' ').filter(Boolean);
  for (const token of promptTokens) {
    if (token.length < 3) continue;
    if (hay.includes(token)) score += 8;
  }

  if (normalizedPrompt.includes(normalize(recipe.label))) {
    score += 120;
  }

  return score;
};

export const findQueryRecipesByPrompt = (prompt: string, limit = 3) =>
  AGENT_QUERY_RECIPES.map((recipe) => ({ recipe, score: scoreRecipe(recipe, prompt) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.recipe);

export const buildDataModelDigest = (limit = 8) =>
  AGENT_DATA_MODEL.slice(0, limit)
    .map((entity, index) => {
      const fields = entity.fields.slice(0, 5).map((field) => `${field.name}:${field.type}`).join(', ');
      return `${index + 1}. ${entity.label} - ${entity.description}\n   Felder: ${fields}`;
    })
    .join('\n');

export const buildRecipeGuide = (prompt: string) => {
  const matches = findQueryRecipesByPrompt(prompt, 3);
  const list = matches.length ? matches : AGENT_QUERY_RECIPES.slice(0, 3);

  return list
    .map((recipe, index) => {
      const steps = recipe.steps.map((line, stepIndex) => `   ${stepIndex + 1}. ${line}`).join('\n');
      return `${index + 1}. ${recipe.label}\n   Einsatz: ${recipe.whenToUse}\n${steps}`;
    })
    .join('\n');
};
