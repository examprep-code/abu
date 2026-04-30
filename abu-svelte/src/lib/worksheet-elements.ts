export type WorksheetElementId =
  | 'html'
  | 'titel'
  | 'luecke'
  | 'textdokument'
  | 'freitext'
  | 'umfrage';

export type WorksheetElementType = {
  id: WorksheetElementId;
  label: string;
  shortLabel: string;
  meta: string;
  icon: {
    viewBox: string;
    paths: string[];
  };
  defaultView: 'html' | 'visual';
  blockLevel: boolean;
  pattern?: RegExp;
};

export type WorksheetBlockTemplate = {
  id: Exclude<WorksheetElementId, 'luecke' | 'textdokument'>;
  label: string;
  meta: string;
  icon: WorksheetElementType['icon'];
  view: 'html' | 'visual';
};

const HTML_ELEMENT_TYPE: WorksheetElementType = {
  id: 'html',
  label: 'HTML',
  shortLabel: 'HTML Block',
  meta: 'Externes HTML',
  icon: {
    viewBox: '0 0 24 24',
    paths: ['M8 9l-4 3 4 3', 'M16 9l4 3-4 3', 'M14 5l-4 14']
  },
  defaultView: 'visual',
  blockLevel: true
};

export const WORKSHEET_ELEMENT_TYPES: WorksheetElementType[] = [
  {
    id: 'titel',
    label: 'Titel',
    shortLabel: 'Titel',
    meta: 'Titel / Untertitel',
    icon: {
      viewBox: '0 0 24 24',
      paths: ['M4 5h16', 'M6 5v4', 'M18 5v4', 'M12 5v14', 'M8 19h8']
    },
    defaultView: 'visual',
    blockLevel: true,
    pattern: /^\s*<\s*h[1-3]\b/i
  },
  {
    id: 'luecke',
    label: 'Lücke',
    shortLabel: 'Lücke',
    meta: 'Inline-Antwort',
    icon: {
      viewBox: '0 0 24 24',
      paths: ['M5 8h3', 'M16 8h3', 'M5 16h3', 'M16 16h3', 'M8 8v8', 'M16 8v8', 'M10.5 12h3']
    },
    defaultView: 'visual',
    blockLevel: false,
    pattern: /<\s*luecke-gap\b/i
  },
  {
    id: 'textdokument',
    label: 'Textfeld',
    shortLabel: 'Textfeld',
    meta: 'Inline-Textablage',
    icon: {
      viewBox: '0 0 24 24',
      paths: ['M6 3h8l4 4v14H6z', 'M14 3v5h5', 'M9 12h6', 'M9 16h6']
    },
    defaultView: 'visual',
    blockLevel: false,
    pattern: /<\s*textdokument-feld\b/i
  },
  {
    id: 'freitext',
    label: 'Freitext',
    shortLabel: 'Freitext',
    meta: 'Text mit Pflichtteilen/Werten',
    icon: {
      viewBox: '0 0 24 24',
      paths: ['M6 3h9l3 3v15H6z', 'M15 3v4h4', 'M9 11h6', 'M9 15h6', 'M9 18h4']
    },
    defaultView: 'visual',
    blockLevel: true,
    pattern: /<\s*freitext-block\b/i
  },
  {
    id: 'umfrage',
    label: 'Antwortmatrix',
    shortLabel: 'Antwortmatrix',
    meta: 'Skalenumfrage',
    icon: {
      viewBox: '0 0 24 24',
      paths: ['M4 5h16v14H4z', 'M4 10h16', 'M4 15h16', 'M10 5v14', 'M16 5v14']
    },
    defaultView: 'visual',
    blockLevel: true,
    pattern: /<\s*umfrage-matrix\b/i
  }
];

export const TITEL_LEVEL_OPTIONS = [
  { value: '1', label: 'Titel' },
  { value: '2', label: 'Untertitel' },
  { value: '3', label: 'Unteruntertitel' }
];

export const BLOCK_LEVEL_TAG_NAMES = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'section',
  'article',
  'table',
  'ul',
  'ol',
  'blockquote',
  'pre',
  'hr',
  'figure',
  'header',
  'footer',
  'nav',
  'umfrage-matrix',
  'freitext-block'
];

export const BLOCK_TEMPLATE_DEFINITIONS: WorksheetBlockTemplate[] = [
  ...WORKSHEET_ELEMENT_TYPES.filter((type) => type.id === 'titel'),
  HTML_ELEMENT_TYPE,
  ...WORKSHEET_ELEMENT_TYPES.filter((type) => type.id !== 'titel')
].filter(
  (type) => type.blockLevel
).map((type) => ({
  id: type.id as WorksheetBlockTemplate['id'],
  label: type.label,
  meta: type.meta,
  icon: type.icon,
  view: type.id === 'html' ? 'html' : type.defaultView
}));

export const getWorksheetElementType = (id: string): WorksheetElementType =>
  id === 'html'
    ? HTML_ELEMENT_TYPE
    : WORKSHEET_ELEMENT_TYPES.find((type) => type.id === id) ?? HTML_ELEMENT_TYPE;

export const detectWorksheetBlockType = (html = ''): WorksheetElementType => {
  const value = String(html || '');
  const blockType = WORKSHEET_ELEMENT_TYPES.find(
    (type) => type.blockLevel && type.pattern?.test(value)
  );
  if (blockType) return blockType;
  if (getWorksheetElementType('luecke').pattern?.test(value)) {
    return getWorksheetElementType('html');
  }
  if (getWorksheetElementType('textdokument').pattern?.test(value)) {
    return getWorksheetElementType('html');
  }
  return getWorksheetElementType('html');
};

export const getWorksheetBlockTypeLabel = (html = ''): string =>
  detectWorksheetBlockType(html).shortLabel;

export const detectWorksheetContentTypes = (html = ''): WorksheetElementType[] => {
  const value = String(html || '');
  return WORKSHEET_ELEMENT_TYPES.filter((type) => type.id !== 'html' && type.pattern?.test(value));
};
