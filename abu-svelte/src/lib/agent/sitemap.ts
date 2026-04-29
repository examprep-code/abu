export interface AgentSitemapNode {
  id: string;
  label: string;
  route: string;
  area: 'admin' | 'learner' | 'public';
  kind: 'page' | 'tab' | 'view' | 'modal';
  description: string;
  shows: string[];
  editable: string[];
  actions: string[];
  apiCalls: string[];
  keywords: string[];
}

export const AGENT_SITEMAP: AgentSitemapNode[] = [
  {
    id: 'admin.login',
    label: 'Admin Login',
    route: '/',
    area: 'public',
    kind: 'page',
    description: 'Login für Lehrpersonen/Admins.',
    shows: ['Email', 'Passwort', 'Login-Status'],
    editable: [],
    actions: ['Einloggen', 'Zur Registrierung wechseln'],
    apiCalls: ['POST user/login', 'GET user/login//{token}'],
    keywords: ['login', 'anmeldung', 'einloggen', 'account']
  },
  {
    id: 'admin.editor.list',
    label: 'Inhalt / Sheet-Liste',
    route: '/ (Tab: editor, ohne geöffnetes Sheet)',
    area: 'admin',
    kind: 'tab',
    description: 'Liste aller aktuellen Sheets mit Suche/Sortierung.',
    shows: ['Sheet-Liste', 'Filter', 'Sortierung'],
    editable: ['Sheet erstellen', 'Sheet löschen'],
    actions: ['Sheet auswählen', 'Neues Sheet'],
    apiCalls: ['GET sheet', 'POST sheet', 'DELETE sheet'],
    keywords: ['inhalt', 'sheet liste', 'arbeitsblatt liste', 'sheets']
  },
  {
    id: 'admin.editor.html',
    label: 'Editor / HTML',
    route: '/ (Tab: editor, View: html)',
    area: 'admin',
    kind: 'view',
    description: 'Direkte Bearbeitung des HTML-Inhalts eines Sheets.',
    shows: ['HTML Code', 'Versionen', 'Sheet Name'],
    editable: ['Sheet HTML', 'Sheet Name'],
    actions: ['Speichern', 'Version wiederherstellen'],
    apiCalls: ['PATCH sheet', 'GET sheet?key=...'],
    keywords: ['html', 'code', 'markup', 'editor']
  },
  {
    id: 'admin.editor.visual',
    label: 'Editor / Visuell',
    route: '/ (Tab: editor, View: visual)',
    area: 'admin',
    kind: 'view',
    description: 'Block-basierte visuelle Bearbeitung eines Sheets.',
    shows: ['Blöcke', 'Format-Werkzeuge', 'Block-Ansicht'],
    editable: ['Blöcke', 'Block-Reihenfolge', 'Inline-Inhalte'],
    actions: ['Block einfügen', 'Block löschen', 'Zwischen HTML/Visual wechseln'],
    apiCalls: ['PATCH sheet'],
    keywords: ['visuell', 'block', 'visual', 'formatieren']
  },
  {
    id: 'admin.editor.preview',
    label: 'Editor / Preview',
    route: '/ (Tab: editor, View: preview)',
    area: 'admin',
    kind: 'view',
    description: 'Vorschau des aktuellen Sheet-Inhalts.',
    shows: ['Gerenderter Sheet-Inhalt'],
    editable: [],
    actions: ['Nur Ansicht'],
    apiCalls: [],
    keywords: ['preview', 'vorschau', 'anzeigen']
  },
  {
    id: 'admin.editor.answers',
    label: 'Editor / Antworten',
    route: '/ (Tab: editor, View: answers)',
    area: 'admin',
    kind: 'view',
    description: 'Aggregierte Antworten und Klassifizierung pro Lücke.',
    shows: ['Antworten pro Gap', 'Klassenfilter', 'Lernendenfilter'],
    editable: ['Klassifizierung (RICHTIG/TEILWEISE/FALSCH)'],
    actions: ['Antworten filtern', 'Antworten aktualisieren'],
    apiCalls: ['GET answer', 'GET learner?classroom=...', 'PUT answer'],
    keywords: ['antworten', 'auswertung', 'klassifizierung', 'bewertung']
  },
  {
    id: 'admin.classes.overview',
    label: 'Klassen / Übersicht',
    route: '/ (Tab: classes, ohne Klasse ausgewählt)',
    area: 'admin',
    kind: 'tab',
    description: 'Übersicht aller Klassen.',
    shows: ['Klassenliste', 'Sortierung'],
    editable: ['Klasse erstellen', 'Klasse löschen'],
    actions: ['Klasse öffnen', 'Zuordnungen öffnen', 'Lernende öffnen'],
    apiCalls: ['GET classroom', 'POST classroom', 'DELETE classroom'],
    keywords: ['klassen', 'klasse', 'classroom', 'unterricht']
  },
  {
    id: 'admin.classes.details',
    label: 'Klassen / Details',
    route: '/ (Tab: classes, Detailansicht: details)',
    area: 'admin',
    kind: 'view',
    description: 'Stammdaten einer Klasse bearbeiten.',
    shows: ['Name', 'Jahr', 'Beruf', 'Notizen', 'Schule'],
    editable: ['Klassenstammdaten'],
    actions: ['Klasse speichern'],
    apiCalls: ['PATCH classroom', 'GET school'],
    keywords: ['klassendaten', 'klasse bearbeiten', 'details']
  },
  {
    id: 'admin.classes.learners',
    label: 'Klassen / Lernende',
    route: '/ (Tab: classes, Detailansicht: learners)',
    area: 'admin',
    kind: 'view',
    description: 'Lernende einer Klasse verwalten.',
    shows: ['Lernendenliste', 'Codes', 'Notizen'],
    editable: ['Lernende anlegen', 'Lernende bearbeiten', 'Lernende löschen'],
    actions: ['Lernende aktualisieren', 'Neue Lernende'],
    apiCalls: ['GET learner?classroom=...', 'POST learner', 'PATCH learner', 'DELETE learner'],
    keywords: ['lernende', 'schüler', 'studenten', 'codes']
  },
  {
    id: 'admin.classes.assignments',
    label: 'Klassen / Arbeitsblatt-Zuordnung',
    route: '/ (Tab: classes, Detailansicht: assignments)',
    area: 'admin',
    kind: 'view',
    description: 'Sheets Klassen zuweisen mit Status und Zuordnungsform.',
    shows: ['Sheet-Status pro Klasse', 'Zuordnungsform'],
    editable: ['Zuordnung aktiv/freiwillig/vergangen/archiviert', 'personal/anonym'],
    actions: ['Zuordnung setzen', 'Zuordnung entfernen'],
    apiCalls: ['GET plan?classroom=...', 'POST plan', 'PATCH plan', 'DELETE plan', 'GET sheet'],
    keywords: ['zuordnung', 'arbeitsblätter zuweisen', 'plan', 'assignment']
  },
  {
    id: 'admin.schools.overview',
    label: 'Schulen / Übersicht',
    route: '/ (Tab: schools, ohne Schule ausgewählt)',
    area: 'admin',
    kind: 'tab',
    description: 'Schulenliste und Schule anlegen.',
    shows: ['Schulenliste', 'CI-Status'],
    editable: ['Schule erstellen', 'Schule löschen'],
    actions: ['Schule auswählen'],
    apiCalls: ['GET school', 'POST school', 'DELETE school'],
    keywords: ['schule', 'schulen', 'ci', 'branding']
  },
  {
    id: 'admin.schools.edit',
    label: 'Schulen / Bearbeiten',
    route: '/ (Tab: schools, Schule ausgewählt)',
    area: 'admin',
    kind: 'view',
    description: 'Name und CI CSS einer Schule bearbeiten.',
    shows: ['Schulname', 'CI CSS'],
    editable: ['Schulname', 'CI CSS'],
    actions: ['Speichern'],
    apiCalls: ['PATCH school'],
    keywords: ['schule bearbeiten', 'ci css']
  },
  {
    id: 'admin.shop.overview',
    label: 'Bibliothek / Braintrade',
    route: '/ (Tab: shop)',
    area: 'admin',
    kind: 'tab',
    description: 'Bibliotheksansicht für ABU Materialpakete auf Basis bestehender Sheets.',
    shows: ['Bibliotheks-Karten', 'Didaktische Filter', 'Preis- und Lizenzmodelle'],
    editable: [],
    actions: ['Nach Material filtern', 'Preview öffnen', 'Sheet im Editor öffnen'],
    apiCalls: ['GET sheet'],
    keywords: ['bibliothek', 'shop', 'braintrade', 'materialtausch', 'materialportal', 'katalog']
  },
  {
    id: 'admin.settings.ci',
    label: 'Einstellungen / CI Auswahl',
    route: '/ (Tab: settings)',
    area: 'admin',
    kind: 'tab',
    description: 'Aktive CI für die Admin-Ansicht wählen.',
    shows: ['Aktive CI', 'CI-Selector'],
    editable: ['Auswahl aktive CI'],
    actions: ['CI wechseln'],
    apiCalls: ['GET school'],
    keywords: ['einstellungen', 'settings', 'ci auswahl']
  },
  {
    id: 'learner.login',
    label: 'Lernenden Login',
    route: '/lernende',
    area: 'learner',
    kind: 'page',
    description: 'Login mit 12-stelligem Lernenden-Code.',
    shows: ['Logincode Feld', 'Persönliche Sheet-Liste'],
    editable: [],
    actions: ['Einloggen', 'Sheet öffnen'],
    apiCalls: ['POST learner-login', 'GET sheet/public-list?code=...'],
    keywords: ['lernenden login', 'code login', 'lernende portal']
  },
  {
    id: 'learner.sheet',
    label: 'Lernenden Sheet',
    route: '/sheet/[key]',
    area: 'learner',
    kind: 'page',
    description: 'Bearbeitung eines konkreten Sheets durch Lernende.',
    shows: ['Sheet Inhalt', 'Fortschritt', 'Antwortfelder'],
    editable: ['Antworten in Lücke/Umfrage'],
    actions: ['Antworten speichern'],
    apiCalls: ['GET sheet/public?key=...&classroom=...', 'POST answer', 'PUT answer'],
    keywords: ['sheet bearbeiten', 'lücken ausfüllen', 'lernenden ansicht']
  },
  {
    id: 'review.sheet',
    label: 'Review / Antworten',
    route: '/sheet/[key]/review',
    area: 'admin',
    kind: 'page',
    description: 'Review einer Sheet-Antwortlage, optional je Klasse.',
    shows: ['Antwortsummen je Lücke', 'Klassenfilter'],
    editable: ['Klassifizierung einzelner Antworten'],
    actions: ['Klasse filtern', 'Klassifizierung setzen'],
    apiCalls: ['GET sheet/public', 'GET answer', 'GET classroom', 'GET plan?sheet_key=...', 'PUT answer'],
    keywords: ['review', 'auswertung', 'antwort review', 'lehreransicht']
  },
  {
    id: 'public.register',
    label: 'Registrierung',
    route: '/register',
    area: 'public',
    kind: 'page',
    description: 'Account-Erstellung für Lehrpersonen/Admins.',
    shows: ['Email', 'Passwort'],
    editable: ['Registrierungsdaten'],
    actions: ['Registrieren'],
    apiCalls: ['POST user/register'],
    keywords: ['registrieren', 'account erstellen', 'signup']
  }
];

const normalize = (value = '') =>
  value
    .toLowerCase()
    .replace(/\u00e4/g, 'ae')
    .replace(/\u00f6/g, 'oe')
    .replace(/\u00fc/g, 'ue')
    .replace(/\u00df/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const scoreNode = (node: AgentSitemapNode, prompt = '') => {
  const normalizedPrompt = normalize(prompt);
  if (!normalizedPrompt) return 0;

  let score = 0;
  const hay = normalize(
    `${node.label} ${node.description} ${node.route} ${node.keywords.join(' ')} ${node.actions.join(' ')}`
  );

  if (normalizedPrompt.includes(normalize(node.label))) {
    score += 140;
  }

  for (const keyword of node.keywords) {
    const normalizedKeyword = normalize(keyword);
    if (normalizedKeyword && normalizedPrompt.includes(normalizedKeyword)) {
      score += normalizedKeyword.length >= 8 ? 40 : 24;
    }
  }

  const promptTokens = normalizedPrompt.split(' ').filter(Boolean);
  for (const token of promptTokens) {
    if (token.length < 3) continue;
    if (hay.includes(token)) score += 6;
  }

  return score;
};

export const findSitemapMatches = (prompt: string, limit = 6) =>
  AGENT_SITEMAP.map((node) => ({ node, score: scoreNode(node, prompt) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.node);

export const buildSitemapDigest = (nodes: AgentSitemapNode[] = AGENT_SITEMAP, limit = 14) => {
  if (!nodes.length) return 'Keine Sitemap-Einträge verfügbar.';
  return nodes
    .slice(0, limit)
    .map((node, index) => `${index + 1}. ${node.label} (${node.route}) - ${node.description}`)
    .join('\n');
};

export const buildSitemapMatchMessage = (prompt: string) => {
  const matches = findSitemapMatches(prompt, 6);
  if (!matches.length) {
    return {
      status: 'Keine direkte Seite gefunden.',
      message: `Sitemap (Auszug):\n${buildSitemapDigest(AGENT_SITEMAP, 10)}`
    };
  }

  const lines = matches.map((node, index) => {
    const show = node.shows.slice(0, 2).join(', ') || 'keine Anzeigeinfos';
    const edit = node.editable.slice(0, 2).join(', ') || 'nicht editierbar';
    return `${index + 1}. ${node.label} (${node.route})\n   Zeigt: ${show}\n   Bearbeitbar: ${edit}`;
  });

  return {
    status: 'Passende Bereiche laut Sitemap gefunden.',
    message: lines.join('\n')
  };
};
