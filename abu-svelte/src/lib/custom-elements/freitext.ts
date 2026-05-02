import { logAiError, logAiRequest, logAiResponse } from '../ai-console';

export type FreitextProgress = {
  percent: number;
  answered: number;
  total: number;
};

export type FreitextCriterion = {
  id: string;
  label: string;
  description: string;
  example: string;
  internalDescription: string;
};

export type FreitextPremise = {
  id: string;
  label: string;
  description: string;
  sourceKey: string;
  sourceType: string;
  type: string;
  sourceUrl: string;
  sourceLabel: string;
  required: boolean;
};

export type FreitextRuntimeOptions = {
  root: HTMLElement;
  apiBaseUrl: string;
  sheetKey: string;
  user: string;
  classroom?: string | number | null;
  previewSchool?: string | number | null;
  previewClassroom?: string | number | null;
  previewLearner?: string | null;
  previewMode?: boolean;
  onProgress?: (progress: FreitextProgress) => void;
  onSaveState?: (event: {
    status: 'saving' | 'saved' | 'error';
    message?: string;
    at?: number;
  }) => void;
};

type ClassificationLabel = 'RICHTIG' | 'TEILWEISE' | 'FALSCH' | null;
type ClassificationInfo = {
  score: number | null;
  label: ClassificationLabel;
};
type PremiseFulfillmentState = {
  value: string;
  ready: boolean;
  status: 'ready' | 'missing' | 'unchecked' | 'partial' | 'wrong';
  label: string;
  promptStatus: string;
};
const FREITEXT_INSTRUCTION_SELECTOR = 'freitext-anweisung, freitext-instruction';
const FREITEXT_QUESTION_PLACEHOLDER =
  'Optional: Was soll beim Prüfen besonders beachtet werden?';
const BLOCK_PROMPT_TAG = 'abu-block-prompt';

function notifySaveState(
  options: FreitextRuntimeOptions,
  status: 'saving' | 'saved' | 'error',
  message = ''
): void {
  if (!options.onSaveState) return;
  options.onSaveState({
    status,
    message,
    at: status === 'saved' ? Date.now() : undefined
  });
}

function previewPayload(options: FreitextRuntimeOptions): Record<string, string> {
  if (!options.previewMode) return {};
  return {
    preview_mode: '1',
    ...(options.previewSchool ? { preview_school: String(options.previewSchool) } : {}),
    ...(options.previewClassroom ? { preview_classroom: String(options.previewClassroom) } : {}),
    ...(options.previewLearner ? { preview_learner: String(options.previewLearner) } : {})
  };
}

function classificationInfo(
  value: unknown,
  labelHint?: string | null
): ClassificationInfo {
  let score: number | null = null;
  let label: ClassificationLabel = null;

  if (typeof value === 'number') {
    score = value;
  } else if (typeof value === 'string') {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      score = num;
    } else {
      const upper = value.toUpperCase();
      if (upper === 'RICHTIG') score = 1000;
      else if (upper === 'TEILWEISE') score = 500;
      else if (upper === 'FALSCH') score = 0;
    }
  }

  if (score !== null) {
    if (score >= 900) label = 'RICHTIG';
    else if (score >= 101) label = 'TEILWEISE';
    else label = 'FALSCH';
  } else if (labelHint) {
    const upper = labelHint.toUpperCase();
    if (upper === 'RICHTIG' || upper === 'TEILWEISE' || upper === 'FALSCH') {
      label = upper;
    }
  }

  return { score, label };
}

function scoreForClassificationLabel(label: ClassificationLabel): number | null {
  if (label === 'RICHTIG') return 1000;
  if (label === 'TEILWEISE') return 500;
  if (label === 'FALSCH') return 0;
  return null;
}

async function sendAnswerToBackend(
  apiBaseUrl: string,
  payload: Record<string, string>
): Promise<Record<string, any>> {
  const endpoint = `${apiBaseUrl}answer`;
  logAiRequest(endpoint, payload);
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const text = await resp.text();
    let parsed: Record<string, any> = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }

    if (!resp.ok) {
      const warn =
        parsed.warning ||
        (parsed.data && parsed.data.chatgpt && parsed.data.chatgpt.error) ||
        parsed.error;
      logAiResponse(endpoint, payload, resp.status, parsed);
      return { error: warn || `Fehler im Backend (${resp.status})` };
    }

    logAiResponse(endpoint, payload, resp.status, parsed);
    return parsed;
  } catch (err) {
    logAiError(endpoint, payload, err);
    return { error: 'Antwort konnte nicht an das Backend gesendet werden.' };
  }
}

const FEEDBACK_HIDE_DELAY = 4500;
const feedbackTimers = new WeakMap<HTMLElement, number>();
let feedbackClickBound = false;

type FeedbackGroupKey = 'fulfilled' | 'partial' | 'wrong' | 'missing';

type FeedbackGroupDefinition = {
  key: FeedbackGroupKey;
  label: string;
  aliases: string[];
};

type ParsedFreitextFeedback = {
  promptAnswer: string;
  summary: string[];
  groups: Record<FeedbackGroupKey, string[]>;
  structured: boolean;
};

const FEEDBACK_GROUP_DEFINITIONS: FeedbackGroupDefinition[] = [
  {
    key: 'fulfilled',
    label: 'Erfüllt',
    aliases: ['erfullt', 'erfuellt', 'fulfilled', 'ok']
  },
  {
    key: 'partial',
    label: 'Teilweise',
    aliases: ['teilweise', 'teils', 'partial']
  },
  {
    key: 'wrong',
    label: 'Fehlerhaft',
    aliases: ['fehlerhaft', 'falsch', 'wrong', 'incorrect']
  },
  {
    key: 'missing',
    label: 'Fehlt',
    aliases: ['fehlt', 'fehlend', 'missing', 'offen']
  }
];

function emptyFeedbackGroups(): Record<FeedbackGroupKey, string[]> {
  return {
    fulfilled: [],
    partial: [],
    wrong: [],
    missing: []
  };
}

function normalizeFeedbackHeading(value: string): string {
  let text = String(value || '')
    .trim()
    .replace(/^#+\s*/, '')
    .trim();
  text = text.replace(/^([*_]{1,3})(.+)\1$/u, '$2').trim();
  text = text.replace(/[:：]+$/, '').trim();
  text = text.replace(/^([*_]{1,3})(.+)\1$/u, '$2').trim();
  return text
    .replace(/[:：]+$/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeFeedbackItem(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/ß/g, 'ss')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripFeedbackBullet(value: string): string {
  return String(value || '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
    .trim();
}

function feedbackGroupForHeading(value: string): FeedbackGroupDefinition | null {
  const heading = normalizeFeedbackHeading(value);
  return (
    FEEDBACK_GROUP_DEFINITIONS.find((definition) => definition.aliases.includes(heading)) || null
  );
}

function splitFeedbackGroupLine(
  value: string
): { group: FeedbackGroupDefinition; text: string } | null {
  const clean = stripFeedbackBullet(value);
  const match = clean.match(/^([^:：]{1,40})[:：]\s*(.*)$/u);
  if (!match) return null;
  const group = feedbackGroupForHeading(match[1]);
  if (!group) return null;
  return {
    group,
    text: stripFeedbackBullet(match[2] || '')
  };
}

function isLanguageErrorFeedbackItem(value: string): boolean {
  const normalized = normalizeFeedbackItem(value);
  const hasLanguageSignal =
    /rechtschreib|grammatik|komma|kommasetzung|sprachfehler|sprachlich|formulierung|stil/u.test(
      normalized
    );
  if (!hasLanguageSignal) return false;
  if (
    /kein(?:e|en|er|es|em)?\s+(?:rechtschreib|grammatik|komma|kommasetzung|sprachfehler)|(?:rechtschreibung|grammatik|kommasetzung)\s+(?:korrekt|stimmt)/u.test(
      normalized
    )
  ) {
    return false;
  }
  return /fehler|fehlerhaft|falsch|ungenau|unklar|umstandlich|verbesser|korrigier|gross|klein/u.test(
    normalized
  );
}

function isMissingFeedbackItem(value: string): boolean {
  const normalized = normalizeFeedbackItem(value);
  if (!normalized) return false;

  if (
    /kein(?:e|en|er|es|em)?\s+(?:falsch|fehler|fehlerhaft|ungenau|unkorrekt|nicht korrekt|rechtschreib|grammatik|komma|kommasetzung|sprachfehler)/u.test(
      normalized
    ) ||
    /\b(?:fehlt|fehlen)\s+nicht\b/u.test(normalized) ||
    /kein(?:e|en|er|es|em)?\s+fehlend/u.test(normalized)
  ) {
    return false;
  }

  return (
    /kein(?:e|en|er|es|em)?\s+(?:angaben|informationen|hinweise|nennungen|details)\b.*\b(?:vorhanden|genannt|angegeben|erwahnt|enthalten)\b/u.test(
      normalized
    ) ||
    /\b(?:angaben|informationen|hinweise|details|preisangaben|preise?|miete|nebenkosten|etage|baujahr|ausstattung|ambiente|lageinformationen?)\b.*\bfehl(?:t|en|end)\b/u.test(
      normalized
    ) ||
    /\b(?:fehlt|fehlen|fehlend|nicht vorhanden|(?:wird|werden)\s+nicht\s+(?:genannt|angegeben|erwahnt)|nicht\s+(?:genannt|angegeben|erwahnt|enthalten))\b/u.test(
      normalized
    )
  );
}

function isContentErrorFeedbackItem(value: string): boolean {
  const normalized = normalizeFeedbackItem(value);
  const contrastParts = normalized.split(
    /\b(?:aber|jedoch|allerdings|hingegen|trotzdem|sondern)\b/u
  );
  const issueText =
    contrastParts.length > 1 ? contrastParts.slice(1).join(' ') : normalized;

  if (
    contrastParts.length === 1 &&
    /kein(?:e|en|er|es|em)?\s+(?:falsch|fehler|fehlerhaft|ungenau|unkorrekt|nicht korrekt)/u.test(
      normalized
    )
  ) {
    return false;
  }

  if (
    /nicht\s+korrekt|inkorrekt|fehlerhaft|falsch|ungenau|unprazis|unpraezis|irrefuhrend|widerspr|abweich|zu\s+(?:hoch|niedrig|gross|klein|allgemein)|korrigier|falsche\s+angabe/u.test(
      issueText
    )
  ) {
    return true;
  }

  const hasContrast = contrastParts.length > 1;
  if (!hasContrast) {
    return /\b(?:statt|anstelle)\b.*\b(?:korrekt|richtig|quelle|inserat|ausgangslage|vorgabe|muss|musste)\b/u.test(
      normalized
    );
  }

  return (
    /\b(?:quelle|inserat|ausgangslage|vorgabe|referenz|lehrerlosung)\b.*\b(?:aber|jedoch|allerdings|hingegen|sondern)\b/u.test(
      normalized
    ) ||
    /\b(?:korrekt|richtig)\s+(?:ist|sind|ware|waere)\s+(?:aber|jedoch|allerdings|hingegen|sondern)\b/u.test(
      normalized
    ) ||
    /\b(?:aber|jedoch|allerdings|hingegen|sondern)\b.*\b(?:korrekt|richtig|quelle|inserat|ausgangslage|vorgabe|statt|nennt|genannt|angegeben|beschrieben|tatsachlich|richtigerweise)\b/u.test(
      normalized
    )
  );
}

function feedbackGroupForItem(
  group: FeedbackGroupDefinition,
  itemText: string
): FeedbackGroupDefinition {
  if (group.key !== 'missing' && isMissingFeedbackItem(itemText)) {
    const missingGroup = FEEDBACK_GROUP_DEFINITIONS.find(
      (definition) => definition.key === 'missing'
    );
    return missingGroup || group;
  }
  if (
    group.key !== 'wrong' &&
    (isLanguageErrorFeedbackItem(itemText) || isContentErrorFeedbackItem(itemText))
  ) {
    const wrongGroup = FEEDBACK_GROUP_DEFINITIONS.find((definition) => definition.key === 'wrong');
    return wrongGroup || group;
  }
  return group;
}

function pushFeedbackGroupItem(
  groups: Record<FeedbackGroupKey, string[]>,
  group: FeedbackGroupDefinition,
  itemText: string
): void {
  const targetGroup = feedbackGroupForItem(group, itemText);
  groups[targetGroup.key].push(itemText);
}

function parseFreitextFeedback(text: string): ParsedFreitextFeedback {
  const parsed: ParsedFreitextFeedback = {
    promptAnswer: '',
    summary: [],
    groups: emptyFeedbackGroups(),
    structured: false
  };
  const promptLines: string[] = [];
  let currentGroup: FeedbackGroupDefinition | null = null;
  let readingPromptAnswer = false;
  let readingEvaluation = false;

  String(text || '')
    .split(/\r\n|\r|\n/)
    .forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        readingPromptAnswer = false;
        return;
      }

      const normalized = normalizeFeedbackHeading(line);
      if (normalized === 'richtig' || normalized === 'teilweise' || normalized === 'falsch') {
        return;
      }

      const promptMatch = line.match(/^Antwort\s+auf\s+Pr(?:ü|ue)fhinweis\s*:\s*(.*)$/iu);
      if (promptMatch) {
        parsed.structured = true;
        readingPromptAnswer = true;
        readingEvaluation = false;
        currentGroup = null;
        const answer = stripFeedbackBullet(promptMatch[1] || '');
        if (answer) promptLines.push(answer);
        return;
      }

      const evaluationMatch = line.match(/^Bewertung\s*:\s*(.*)$/iu);
      if (evaluationMatch) {
        parsed.structured = true;
        readingPromptAnswer = false;
        readingEvaluation = true;
        currentGroup = null;
        const remainder = stripFeedbackBullet(evaluationMatch[1] || '');
        if (remainder) {
          const inlineGroup = splitFeedbackGroupLine(remainder);
          if (inlineGroup) {
            currentGroup = inlineGroup.group;
            if (inlineGroup.text) {
              pushFeedbackGroupItem(parsed.groups, inlineGroup.group, inlineGroup.text);
            }
          } else {
            parsed.summary.push(remainder);
          }
        }
        return;
      }

      const inlineGroup = splitFeedbackGroupLine(line);
      if (inlineGroup) {
        parsed.structured = true;
        readingPromptAnswer = false;
        readingEvaluation = true;
        currentGroup = inlineGroup.group;
        if (inlineGroup.text) {
          pushFeedbackGroupItem(parsed.groups, inlineGroup.group, inlineGroup.text);
        }
        return;
      }

      const headingGroup = feedbackGroupForHeading(line);
      if (headingGroup) {
        parsed.structured = true;
        readingPromptAnswer = false;
        readingEvaluation = true;
        currentGroup = headingGroup;
        return;
      }

      const clean = stripFeedbackBullet(line);
      if (!clean) return;
      if (readingPromptAnswer) {
        promptLines.push(clean);
        return;
      }
      if (currentGroup) {
        pushFeedbackGroupItem(parsed.groups, currentGroup, clean);
        return;
      }
      if (readingEvaluation || parsed.structured) {
        parsed.summary.push(clean);
      }
    });

  parsed.promptAnswer = promptLines.join(' ');
  parsed.structured =
    parsed.structured &&
    Boolean(
      parsed.promptAnswer ||
        parsed.summary.length ||
        FEEDBACK_GROUP_DEFINITIONS.some((definition) => parsed.groups[definition.key].length)
    );
  return parsed;
}

function reconcileFreitextClassificationWithFeedback(
  info: ClassificationInfo,
  feedbackText: string
): ClassificationInfo {
  const parsed = parseFreitextFeedback(feedbackText);
  if (!parsed.structured) return info;

  const fulfilled = parsed.groups.fulfilled.length;
  const partial = parsed.groups.partial.length;
  const severe = parsed.groups.wrong.length + parsed.groups.missing.length;
  const issues = partial + severe;
  let nextLabel = info.label;

  if (info.label === 'RICHTIG' && issues > 0) {
    nextLabel = severe > 0 && fulfilled === 0 && partial === 0 ? 'FALSCH' : 'TEILWEISE';
  } else if (
    (info.label === 'TEILWEISE' || info.label === null) &&
    severe > 0 &&
    fulfilled === 0 &&
    partial === 0
  ) {
    nextLabel = 'FALSCH';
  } else if (info.label === null) {
    if (issues > 0) {
      nextLabel = 'TEILWEISE';
    } else if (fulfilled > 0) {
      nextLabel = 'RICHTIG';
    }
  }

  if (nextLabel === info.label) return info;
  return {
    score: scoreForClassificationLabel(nextLabel),
    label: nextLabel
  };
}

function createFeedbackTextBlock(className: string, title: string, text: string): HTMLElement {
  const block = document.createElement('section');
  block.className = className;

  const heading = document.createElement('div');
  heading.className = 'freitext-feedback__heading';
  heading.textContent = title;
  block.appendChild(heading);

  const body = document.createElement('div');
  body.className = 'freitext-feedback__body';
  body.textContent = text;
  block.appendChild(body);

  return block;
}

function renderFreitextFeedback(feedback: HTMLElement, text: string): boolean {
  const parsed = parseFreitextFeedback(text);
  feedback.textContent = '';

  if (!parsed.structured) {
    feedback.classList.remove('feedback--structured');
    feedback.textContent = text;
    return false;
  }

  feedback.classList.add('feedback--structured');
  const root = document.createElement('div');
  root.className = 'freitext-feedback';

  if (parsed.promptAnswer) {
    root.appendChild(
      createFeedbackTextBlock(
        'freitext-feedback__prompt',
        'Antwort auf Prüfhinweis',
        parsed.promptAnswer
      )
    );
  }

  if (parsed.summary.length) {
    root.appendChild(
      createFeedbackTextBlock('freitext-feedback__summary', 'Hinweis', parsed.summary.join(' '))
    );
  }

  const visibleGroups = FEEDBACK_GROUP_DEFINITIONS.filter(
    (definition) => parsed.groups[definition.key].length
  );
  if (visibleGroups.length) {
    const groups = document.createElement('div');
    groups.className = 'freitext-feedback__groups';
    visibleGroups.forEach((definition) => {
      const group = document.createElement('section');
      group.className = `freitext-feedback__group freitext-feedback__group--${definition.key}`;

      const heading = document.createElement('div');
      heading.className = 'freitext-feedback__group-title';
      heading.textContent = definition.label;
      group.appendChild(heading);

      const list = document.createElement('ul');
      list.className = 'freitext-feedback__list';
      parsed.groups[definition.key].forEach((itemText) => {
        const item = document.createElement('li');
        item.textContent = itemText;
        list.appendChild(item);
      });
      group.appendChild(list);
      groups.appendChild(group);
    });
    root.appendChild(groups);
  }

  feedback.appendChild(root);
  return true;
}

function cancelFeedbackHide(feedback: HTMLElement | null): void {
  if (!feedback) return;
  const existing = feedbackTimers.get(feedback);
  if (!existing) return;
  window.clearTimeout(existing);
  feedbackTimers.delete(feedback);
}

function keepFeedbackVisible(feedback: HTMLElement | null): boolean {
  if (!feedback) return false;
  const hasFeedback = String(feedback.dataset.lastText || feedback.textContent || '').trim() !== '';
  if (!hasFeedback) return false;
  cancelFeedbackHide(feedback);
  feedback.classList.add('feedback--visible');
  return true;
}

function showFeedback(feedback: HTMLElement, text: string, autoHide = false): void {
  cancelFeedbackHide(feedback);
  renderFreitextFeedback(feedback, text);
  feedback.dataset.lastText = text;
  feedback.classList.add('feedback--visible');
  if (autoHide) {
    scheduleFeedbackHide(feedback);
  }
}

function scheduleFeedbackHide(feedback: HTMLElement, delay = FEEDBACK_HIDE_DELAY): void {
  const existing = feedbackTimers.get(feedback);
  if (existing) window.clearTimeout(existing);
  const timer = window.setTimeout(() => {
    feedback.classList.remove('feedback--visible');
  }, delay);
  feedbackTimers.set(feedback, timer);
}

function clearFeedback(feedback: HTMLElement | null): void {
  if (!feedback) return;
  cancelFeedbackHide(feedback);
  feedback.textContent = '';
  feedback.classList.remove(
    'feedback--visible',
    'feedback--richtig',
    'feedback--teilweise',
    'feedback--falsch',
    'feedback--structured'
  );
  feedback.removeAttribute('data-last-text');
}

function bindOutsideClickHide(): void {
  if (feedbackClickBound) return;
  feedbackClickBound = true;
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.feedback') || target.closest('.check-btn')) return;
    document.querySelectorAll('.feedback.feedback--visible').forEach((feedback) => {
      if (feedback.closest('freitext-block')) return;
      feedback.classList.remove('feedback--visible');
    });
  });
}

type AnswerEntry = Record<string, any>;

function setClasses(
  textarea: HTMLTextAreaElement | null,
  button: HTMLButtonElement | null,
  feedback: HTMLElement | null,
  label: ClassificationLabel
): void {
  const buttonClasses = [
    'check-btn--richtig',
    'check-btn--teilweise',
    'check-btn--falsch',
    'check-btn--loading'
  ];
  button?.classList.remove(...buttonClasses);
  feedback?.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
  textarea?.classList.remove('freitext--richtig', 'freitext--teilweise', 'freitext--falsch');

  if (label === 'RICHTIG') {
    button?.classList.add('check-btn--richtig');
    feedback?.classList.add('feedback--richtig');
    textarea?.classList.add('freitext--richtig');
  } else if (label === 'TEILWEISE') {
    button?.classList.add('check-btn--teilweise');
    feedback?.classList.add('feedback--teilweise');
    textarea?.classList.add('freitext--teilweise');
  } else if (label === 'FALSCH') {
    button?.classList.add('check-btn--falsch');
    feedback?.classList.add('feedback--falsch');
    textarea?.classList.add('freitext--falsch');
  }
}

function rememberCheckedValue(textarea: HTMLTextAreaElement, label: ClassificationLabel): void {
  if (label) {
    textarea.dataset.checkedValue = textarea.value.trim();
  } else {
    delete textarea.dataset.checkedValue;
  }
}

function clearCheckedStateIfEdited(textarea: HTMLTextAreaElement): void {
  if (!Object.prototype.hasOwnProperty.call(textarea.dataset, 'checkedValue')) return;
  if (textarea.value.trim() === textarea.dataset.checkedValue) return;

  const wrapper = textarea.closest('freitext-block') as HTMLElement | null;
  const button = wrapper?.querySelector('.check-btn') as HTMLButtonElement | null;
  const feedback = wrapper?.querySelector('.feedback') as HTMLElement | null;
  setClasses(textarea, button, feedback, null);
  keepFeedbackVisible(feedback);
  delete textarea.dataset.checkedValue;
}

function updateProgress(
  root: HTMLElement,
  onProgress?: (progress: FreitextProgress) => void
): FreitextProgress {
  const blocks = Array.from(root.querySelectorAll('freitext-block')) as HTMLElement[];
  const total = blocks.length;
  const answered = blocks.filter((block) => {
    const textarea = block.querySelector(
      'textarea.freitext__textarea'
    ) as HTMLTextAreaElement | null;
    return Boolean(textarea && textarea.value.trim() !== '');
  }).length;
  const percent = total ? Math.round((answered / total) * 100) : 0;
  const progress = { percent, answered, total };
  if (onProgress) onProgress(progress);
  return progress;
}

function normalizeCriterionId(value = '', index = 0): string {
  const base = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `teil-${index + 1}`;
}

function parseFreitextCriteria(block: HTMLElement | null): FreitextCriterion[] {
  if (!block) return [];
  const criteriaNodes = Array.from(
    block.querySelectorAll('freitext-teil, freitext-part, freitext-kriterium')
  );
  return criteriaNodes
    .map((entry, index) => {
      const rawLabel =
        entry.getAttribute('label') ||
        entry.getAttribute('title') ||
        entry.getAttribute('name') ||
        '';
      const description = (entry.textContent || '').replace(/\s+/g, ' ').trim();
      const example = (
        entry.getAttribute('example') ||
        entry.getAttribute('data-example') ||
        entry.getAttribute('beispiel') ||
        ''
      )
        .replace(/\s+/g, ' ')
        .trim();
      const internalDescription = (
        entry.getAttribute('internal-description') ||
        entry.getAttribute('data-internal-description') ||
        entry.getAttribute('internal') ||
        ''
      )
        .replace(/\s+/g, ' ')
        .trim();
      const key = (entry.getAttribute('key') || '').trim();
      if (!key && !String(rawLabel).trim() && !description && !example && !internalDescription) {
        return null;
      }
      const label = String(rawLabel || `Teil ${index + 1}`).trim();
      return {
        id: normalizeCriterionId(key || label, index),
        label,
        description,
        example,
        internalDescription
      };
    })
    .filter((entry): entry is FreitextCriterion => Boolean(entry && entry.label !== ''));
}

function normalizePremiseType(value = ''): string {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'number' || type === 'url' || type === 'date' || type === 'email') return type;
  return 'text';
}

function normalizeAnswerSourceType(value = ''): string {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'gap' || type === 'luecke') return 'luecke';
  if (type === 'textdokument' || type === 'text-document' || type === 'document') {
    return 'textdokument';
  }
  if (type === 'free-text' || type === 'freitext') return 'freitext';
  return '';
}

function parseRequiredAttribute(entry: Element): boolean {
  if (entry.hasAttribute('optional')) return false;
  const raw = (entry.getAttribute('required') || '').trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'nein' || raw === 'no') return false;
  return true;
}

function parseFreitextPremises(block: HTMLElement | null): FreitextPremise[] {
  if (!block) return [];
  const premiseNodes = Array.from(
    block.querySelectorAll(
      'freitext-prämisse, freitext-praemisse, freitext-premise, freitext-wert, freitext-value'
    )
  );

  return premiseNodes
    .map((entry, index) => {
      const rawLabel =
        entry.getAttribute('label') ||
        entry.getAttribute('title') ||
        entry.getAttribute('name') ||
        entry.getAttribute('key') ||
        '';
      const sourceUrl =
        entry.getAttribute('source') ||
        entry.getAttribute('href') ||
        entry.getAttribute('url') ||
        '';
      const sourceLabel =
        entry.getAttribute('source-label') ||
        entry.getAttribute('link-label') ||
        (sourceUrl ? 'Quelle öffnen' : '');
      const description = (entry.textContent || '').replace(/\s+/g, ' ').trim();
      const sourceKey = (
        entry.getAttribute('source-key') ||
        entry.getAttribute('answer-key') ||
        entry.getAttribute('target') ||
        entry.getAttribute('ref') ||
        ''
      ).trim();
      const sourceType = normalizeAnswerSourceType(
        entry.getAttribute('source-type') ||
          entry.getAttribute('answer-type') ||
          entry.getAttribute('element-type') ||
          ''
      );
      const labelText = String(rawLabel).replace(/\s+/g, ' ').trim();
      const isEmptyDefaultPlaceholder =
        /^(Prämisse|Praemisse)\s+1$/i.test(labelText) &&
        !description &&
        !sourceKey &&
        !String(sourceUrl).trim() &&
        !String(sourceLabel).trim() &&
        !entry.hasAttribute('key') &&
        !entry.hasAttribute('name') &&
        !entry.hasAttribute('title') &&
        !entry.hasAttribute('source-key') &&
        !entry.hasAttribute('answer-key') &&
        !entry.hasAttribute('target') &&
        !entry.hasAttribute('ref') &&
        !entry.hasAttribute('source') &&
        !entry.hasAttribute('href') &&
        !entry.hasAttribute('url') &&
        !entry.hasAttribute('source-label') &&
        !entry.hasAttribute('link-label') &&
        !entry.hasAttribute('type') &&
        !entry.hasAttribute('required') &&
        !entry.hasAttribute('optional');
      if (isEmptyDefaultPlaceholder) return null;
      if (
        !String(rawLabel).trim() &&
        !String(sourceUrl).trim() &&
        !String(sourceLabel).trim() &&
        !description &&
        !sourceKey
      ) {
        return null;
      }
      const label = String(rawLabel || `Wert ${index + 1}`).trim();

      return {
        id: normalizeCriterionId(
          entry.getAttribute('key') || entry.getAttribute('name') || label,
          index
        ),
        label,
        description,
        sourceKey,
        sourceType,
        type: normalizePremiseType(entry.getAttribute('type') || ''),
        sourceUrl: String(sourceUrl).trim(),
        sourceLabel: String(sourceLabel).trim(),
        required: parseRequiredAttribute(entry)
      };
    })
    .filter((entry): entry is FreitextPremise => Boolean(entry && entry.label !== ''));
}

function getFreitextInstructionHtml(block: HTMLElement | null): string {
  if (!block) return '';
  const instruction = block.querySelector(FREITEXT_INSTRUCTION_SELECTOR);
  return (instruction?.innerHTML || '').trim();
}

function getFreitextTeacherPrompt(block: HTMLElement | null): string {
  if (!block) return '';
  return (
    block.getAttribute('prompt') ||
    block.getAttribute('teacher-prompt') ||
    block.getAttribute('data-prompt') ||
    block.getAttribute('data-teacher-prompt') ||
    ''
  ).trim();
}

function textFromHtml(html = ''): string {
  if (!html || typeof document === 'undefined') return '';
  const container = document.createElement('div');
  container.innerHTML = html;
  return (container.textContent || '').replace(/\s+/g, ' ').trim();
}

function titleFromInstructionHtml(html = ''): string {
  if (!html || typeof document === 'undefined') return '';
  const container = document.createElement('div');
  container.innerHTML = html;
  const heading = container.querySelector('h1, h2, h3');
  return (heading?.textContent || '').replace(/\s+/g, ' ').trim();
}

function consumeBlockPromptText(block: HTMLElement | null): string {
  if (!block) return '';
  const promptNode =
    block.querySelector(BLOCK_PROMPT_TAG) ||
    (block.previousElementSibling?.tagName.toLowerCase() === BLOCK_PROMPT_TAG
      ? block.previousElementSibling
      : null);
  const prompt = (promptNode?.textContent || '').replace(/\s+/g, ' ').trim();
  if (promptNode?.parentElement && promptNode.tagName.toLowerCase() === BLOCK_PROMPT_TAG) {
    promptNode.remove();
  }
  return prompt;
}

function isVisualEditorBlock(el: HTMLElement): boolean {
  return Boolean(el.closest('.block-editor__visual[contenteditable="true"]'));
}

function clearLegacyFreitextLocks(block: HTMLElement): void {
  block.classList.remove('freitext-block--locked');
  block
    .querySelectorAll('.freitext__lock-message, .freitext__references-wrap, .freitext__action-hint')
    .forEach((entry) => entry.remove());
}

function unlockTextControl(control: HTMLInputElement | HTMLTextAreaElement | null): void {
  if (!control) return;
  control.disabled = false;
  control.readOnly = false;
  control.removeAttribute('aria-disabled');
}

export function ensureFreitextElements(): void {
  if (customElements.get('freitext-block')) return;

  class FreitextBlock extends HTMLElement {
    connectedCallback() {
      const existingName = (this.getAttribute('name') || '').trim();
      const nameAttr = existingName || `freitext-${Math.random().toString(36).slice(2)}`;
      if (!existingName) {
        this.setAttribute('name', nameAttr);
      }

      if (isVisualEditorBlock(this)) {
        return;
      }

      const title = (this.getAttribute('title') || '').trim();
      const task =
        (this.getAttribute('task') || this.getAttribute('instruction') || '').trim();
      const instructionHtml = getFreitextInstructionHtml(this);
      const teacherPrompt = getFreitextTeacherPrompt(this);
      const blockPrompt = consumeBlockPromptText(this);
      const placeholder =
        this.getAttribute('placeholder') || 'Schreiben Sie Ihren Text hier...';
      const rowsAttr = Number(this.getAttribute('rows') || 0);
      const rows = Number.isFinite(rowsAttr) && rowsAttr > 0 ? Math.floor(rowsAttr) : 10;
      const minLength = (this.getAttribute('min-length') || '').trim();
      const maxLength = (this.getAttribute('max-length') || '').trim();
      const criteria = parseFreitextCriteria(this);
      const premises = parseFreitextPremises(this);
      const reuseExistingRuntimeConfig =
        this.dataset.upgraded === '1' && Boolean(this.querySelector('.freitext'));

      clearLegacyFreitextLocks(this);

      const configureTextarea = (textarea: HTMLTextAreaElement): void => {
        textarea.className = 'freitext__textarea';
        textarea.name = nameAttr;
        textarea.rows = rows;
        textarea.placeholder = placeholder;
        unlockTextControl(textarea);
        textarea.dataset.criteria =
          !reuseExistingRuntimeConfig || criteria.length || !textarea.dataset.criteria
            ? JSON.stringify(criteria)
            : textarea.dataset.criteria;
        textarea.dataset.premises =
          !reuseExistingRuntimeConfig || premises.length || !textarea.dataset.premises
            ? JSON.stringify(premises)
            : textarea.dataset.premises;
        textarea.dataset.task =
          task || textFromHtml(instructionHtml) || textarea.dataset.task || '';
        textarea.dataset.teacherPrompt = teacherPrompt || textarea.dataset.teacherPrompt || '';
        textarea.dataset.blockPrompt = blockPrompt || textarea.dataset.blockPrompt || '';
        textarea.dataset.title =
          title || titleFromInstructionHtml(instructionHtml) || textarea.dataset.title || '';
        if (minLength) textarea.dataset.minLength = minLength;
        else delete textarea.dataset.minLength;
        if (maxLength) textarea.dataset.maxLength = maxLength;
        else delete textarea.dataset.maxLength;
      };

      const bindTextFieldShortcut = (
        field: HTMLTextAreaElement | HTMLInputElement,
        button: HTMLButtonElement
      ): void => {
        if (field.dataset.freitextShortcutBound === '1') return;
        field.dataset.freitextShortcutBound = '1';
        field.addEventListener('keydown', (event) => {
          const keyboardEvent = event as KeyboardEvent;
          if (keyboardEvent.key !== 'Enter') return;
          if (!(keyboardEvent.ctrlKey || keyboardEvent.metaKey)) return;
          event.preventDefault();
          button.click();
        });
      };

      const ensureAnswerControls = (
        target: HTMLElement,
        textarea: HTMLTextAreaElement
      ): void => {
        let actionRow = this.querySelector('.freitext__actions') as HTMLElement | null;
        if (!actionRow) {
          actionRow = document.createElement('div');
          actionRow.className = 'freitext__actions';
          target.insertBefore(actionRow, this.querySelector('.feedback') || null);
        }

        let button = this.querySelector('button.check-btn') as HTMLButtonElement | null;
        if (!button) {
          button = document.createElement('button');
          button.type = 'button';
          button.className = 'check-btn ci-btn-primary';
          actionRow.appendChild(button);
        } else if (button.parentElement !== actionRow) {
          actionRow.prepend(button);
        }

        button.type = 'button';
        button.classList.add('check-btn', 'ci-btn-primary');
        button.disabled = button.dataset.freitextBusy === '1';
        button.removeAttribute('aria-disabled');
        button.setAttribute('data-target', nameAttr);
        button.setAttribute('aria-label', 'Aktuellen Stand prüfen');
        bindTextFieldShortcut(textarea, button);

        actionRow
          .querySelectorAll('.freitext__action-hint')
          .forEach((actionHint) => actionHint.remove());

        const questionWrap = this.querySelector('.freitext__question') as HTMLElement | null;
        let questionField = this.querySelector(
          '.freitext__question-field'
        ) as HTMLInputElement | HTMLTextAreaElement | null;
        if (!questionField) {
          questionField = document.createElement('input');
          questionField.className = 'freitext__question-field';
        } else if (questionField.tagName.toLowerCase() !== 'input') {
          const nextQuestionField = document.createElement('input');
          nextQuestionField.className = questionField.className;
          nextQuestionField.value = questionField.value;
          questionField.replaceWith(nextQuestionField);
          questionField = nextQuestionField;
        }
        if (questionField instanceof HTMLInputElement) {
          questionField.type = 'text';
        }
        questionField.placeholder = FREITEXT_QUESTION_PLACEHOLDER;
        unlockTextControl(questionField);
        questionField.setAttribute('aria-label', 'Zusatzfrage zur Prüfung');
        actionRow.appendChild(questionField);
        if (questionWrap && !questionWrap.querySelector('.freitext__question-field')) {
          questionWrap.remove();
        }
        bindTextFieldShortcut(questionField, button);

        let feedbackSlot = this.querySelector('.freitext__feedback') as HTMLElement | null;
        if (!feedbackSlot) {
          feedbackSlot = document.createElement('div');
          feedbackSlot.className = 'freitext__feedback';
          actionRow.insertAdjacentElement('afterend', feedbackSlot);
        } else if (feedbackSlot.previousElementSibling !== actionRow) {
          actionRow.insertAdjacentElement('afterend', feedbackSlot);
        }

        let feedback = this.querySelector('.feedback') as HTMLElement | null;
        if (!feedback) {
          feedback = document.createElement('div');
          feedback.className = 'feedback';
        }
        if (feedback.parentElement !== feedbackSlot) {
          feedbackSlot.appendChild(feedback);
        }
      };

      if (this.dataset.upgraded === '1') {
        const target = this.querySelector('.freitext') as HTMLElement | null;
        if (!target) {
          this.dataset.upgraded = '';
        } else {
          let textarea = this.querySelector(
            'textarea.freitext__textarea'
          ) as HTMLTextAreaElement | null;
          if (!textarea) {
            textarea = document.createElement('textarea');
            target.appendChild(textarea);
          }
          configureTextarea(textarea);
          ensureAnswerControls(target, textarea);
          return;
        }
      }

      this.dataset.upgraded = '1';

      this.innerHTML = '';

      const wrapper = document.createElement('div');
      wrapper.className = 'freitext';

      if (
        instructionHtml ||
        title ||
        task ||
        criteria.length ||
        premises.length ||
        minLength ||
        maxLength
      ) {
        const intro = document.createElement('div');
        intro.className = 'freitext__intro';

        if (instructionHtml) {
          const instructionEl = document.createElement('div');
          instructionEl.className = 'freitext__instruction';
          instructionEl.innerHTML = instructionHtml;
          intro.appendChild(instructionEl);
        } else if (title) {
          const titleEl = document.createElement('h3');
          titleEl.className = 'freitext__title';
          titleEl.textContent = title;
          intro.appendChild(titleEl);
        }

        if (!instructionHtml && task) {
          const taskEl = document.createElement('p');
          taskEl.className = 'freitext__task';
          taskEl.textContent = task;
          intro.appendChild(taskEl);
        }

        if (premises.length) {
          const premiseWrap = document.createElement('div');
          premiseWrap.className = 'freitext__premises-wrap';

          const premiseLabel = document.createElement('strong');
          premiseLabel.className = 'freitext__criteria-label';
          premiseLabel.textContent = 'Prämissen';
          premiseWrap.appendChild(premiseLabel);

          const premiseGrid = document.createElement('div');
          premiseGrid.className = 'freitext__premises';

          premises.forEach((premise) => {
            const hasLinkedSource = premise.sourceKey.trim() !== '';
            const field = document.createElement(hasLinkedSource ? 'div' : 'label');
            field.className = hasLinkedSource
              ? 'freitext__premise freitext__premise--linked'
              : 'freitext__premise';
            field.dataset.premiseId = premise.id;
            if (hasLinkedSource) field.dataset.sourceKey = premise.sourceKey;

            const labelEl = document.createElement('span');
            labelEl.className = 'freitext__premise-label';
            labelEl.textContent = premise.label;
            field.appendChild(labelEl);

            if (premise.sourceUrl) {
              const hint = document.createElement('span');
              hint.className = 'freitext__premise-hint';
              const link = document.createElement('a');
              link.href = premise.sourceUrl;
              link.target = '_blank';
              link.rel = 'noreferrer';
              link.textContent = premise.sourceLabel || 'Quelle öffnen';
              hint.appendChild(link);
              field.appendChild(hint);
            }

            const inputRow = document.createElement('span');
            inputRow.className = 'freitext__premise-input-row';

            if (hasLinkedSource) {
              const status = document.createElement('span');
              status.className = 'freitext__premise-status freitext__premise-status--missing';
              status.dataset.premiseId = premise.id;
              status.dataset.sourceKey = premise.sourceKey;
              status.dataset.required = premise.required ? '1' : '0';
              status.dataset.ready = '0';
              status.dataset.value = '';
              status.setAttribute('role', 'status');
              status.textContent = 'Wartet auf Eingabefeld.';
              inputRow.appendChild(status);
            } else {
              const input = document.createElement('input');
              input.className = 'freitext__premise-input';
              input.type = premise.type;
              input.name = `${nameAttr}__${premise.id}`;
              input.dataset.premiseId = premise.id;
              input.dataset.required = premise.required ? '1' : '0';
              input.required = premise.required;
              input.setAttribute('aria-label', premise.label);
              input.placeholder = 'Wert eintragen';
              if (premise.type === 'number') {
                input.inputMode = 'decimal';
                input.step = 'any';
              }
              inputRow.appendChild(input);
            }

            field.appendChild(inputRow);
            premiseGrid.appendChild(field);
          });

          premiseWrap.appendChild(premiseGrid);
          intro.appendChild(premiseWrap);
        }

        if (criteria.length) {
          const criteriaWrap = document.createElement('div');
          criteriaWrap.className = 'freitext__criteria-wrap';

          const criteriaLabel = document.createElement('strong');
          criteriaLabel.className = 'freitext__criteria-label';
          criteriaLabel.textContent = 'Checkliste';
          criteriaWrap.appendChild(criteriaLabel);

          const list = document.createElement('ol');
          list.className = 'freitext__criteria';
          criteria.forEach((criterion) => {
            const item = document.createElement('li');
            item.className = 'freitext__criterion';
            item.dataset.key = criterion.id;

            const labelEl = document.createElement('span');
            labelEl.className = 'freitext__criterion-label';
            labelEl.textContent = criterion.label;
            item.appendChild(labelEl);

            if (criterion.description) {
              const descEl = document.createElement('span');
              descEl.className = 'freitext__criterion-description';
              descEl.textContent = criterion.description;
              item.appendChild(descEl);
            }

            if (criterion.example) {
              const exampleEl = document.createElement('span');
              exampleEl.className = 'freitext__criterion-example';
              exampleEl.textContent = `Beispiel: ${criterion.example}`;
              item.appendChild(exampleEl);
            }

            list.appendChild(item);
          });
          criteriaWrap.appendChild(list);
          intro.appendChild(criteriaWrap);
        }

        if (minLength || maxLength) {
          const meta = document.createElement('p');
          meta.className = 'freitext__meta';
          const parts = [];
          if (minLength) parts.push(`mind. ${minLength} Zeichen`);
          if (maxLength) parts.push(`max. ${maxLength} Zeichen`);
          meta.textContent = parts.join(' · ');
          intro.appendChild(meta);
        }

        wrapper.appendChild(intro);
      }

      const textarea = document.createElement('textarea');
      configureTextarea(textarea);

      wrapper.appendChild(textarea);

      const actionRow = document.createElement('div');
      actionRow.className = 'freitext__actions';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'check-btn ci-btn-primary';
      button.setAttribute('data-target', nameAttr);
      button.setAttribute('aria-label', 'Aktuellen Stand prüfen');
      actionRow.appendChild(button);
      bindTextFieldShortcut(textarea, button);

      const questionField = document.createElement('input');
      questionField.type = 'text';
      questionField.className = 'freitext__question-field';
      questionField.placeholder = FREITEXT_QUESTION_PLACEHOLDER;
      questionField.setAttribute('aria-label', 'Zusatzfrage zur Prüfung');
      actionRow.appendChild(questionField);
      bindTextFieldShortcut(questionField, button);

      wrapper.appendChild(actionRow);

      const feedbackSlot = document.createElement('div');
      feedbackSlot.className = 'freitext__feedback';

      const feedback = document.createElement('div');
      feedback.className = 'feedback';
      feedbackSlot.appendChild(feedback);
      wrapper.appendChild(feedbackSlot);

      this.appendChild(wrapper);
    }
  }

  customElements.define('freitext-block', FreitextBlock);
}

function parseStoredFreitextValue(rawValue: unknown): {
  answer: string;
  premiseValues: Record<string, string>;
  structured: boolean;
} {
  const raw = String(rawValue || '');
  if (!raw.trim().startsWith('{')) {
    return { answer: raw, premiseValues: {}, structured: false };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { answer: raw, premiseValues: {}, structured: false };
    }

    const answer =
      typeof parsed.answer === 'string'
        ? parsed.answer
        : typeof parsed.text === 'string'
        ? parsed.text
        : '';
    const sourceValues =
      parsed.premise_values && typeof parsed.premise_values === 'object'
        ? parsed.premise_values
        : parsed.premises && typeof parsed.premises === 'object'
        ? parsed.premises
        : {};
    const premiseValues: Record<string, string> = {};
    Object.entries(sourceValues).forEach(([key, value]) => {
      premiseValues[key] = String(value ?? '');
    });
    return { answer, premiseValues, structured: true };
  } catch {
    return { answer: raw, premiseValues: {}, structured: false };
  }
}

function latestAnswersByKey(answers: AnswerEntry[]): Record<string, AnswerEntry> {
  const latestByKey: Record<string, AnswerEntry> = {};
  answers.forEach((entry) => {
    const key = entry?.key;
    if (!key) return;
    const existing = latestByKey[key];
    if (!existing) {
      latestByKey[key] = entry;
      return;
    }
    const existingTime = new Date(existing.updated_at || 0).getTime();
    const entryTime = new Date(entry.updated_at || 0).getTime();
    if (entryTime > existingTime) {
      latestByKey[key] = entry;
    } else if (entryTime === existingTime && (entry.id || 0) > (existing.id || 0)) {
      latestByKey[key] = entry;
    }
  });
  return latestByKey;
}

function readPremisesFromTextarea(textarea: HTMLTextAreaElement | null): FreitextPremise[] {
  if (!textarea) return [];
  try {
    const parsed = JSON.parse(textarea.dataset.premises || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sourceAnswerText(entry: AnswerEntry | null | undefined): string {
  if (!entry) return '';
  const raw = String(entry.value || '');
  const stored = parseStoredFreitextValue(raw);
  if (stored.answer) return stored.answer;
  return raw.trim().startsWith('{') ? '' : raw.trim();
}

function premiseFulfillmentFromEntry(
  entry: AnswerEntry | null | undefined
): PremiseFulfillmentState {
  const value = sourceAnswerText(entry);
  if (!value.trim()) {
    return {
      value: '',
      ready: false,
      status: 'missing',
      label: 'Fehlt.',
      promptStatus: 'fehlt'
    };
  }

  const { score, label } = classificationInfo(entry?.classification, entry?.classification_label);
  if (score === null) {
    return {
      value,
      ready: false,
      status: 'unchecked',
      label: 'Wartet auf Prüfung.',
      promptStatus: 'eingetragen, aber noch nicht geprüft'
    };
  }
  if (score >= 900) {
    return {
      value,
      ready: true,
      status: 'ready',
      label: 'Erfüllt.',
      promptStatus: label || 'RICHTIG'
    };
  }
  if (score >= 101) {
    return {
      value,
      ready: false,
      status: 'partial',
      label: 'Teilweise erfüllt.',
      promptStatus: label || 'TEILWEISE'
    };
  }
  return {
    value,
    ready: false,
    status: 'wrong',
    label: 'Nicht erfüllt.',
    promptStatus: label || 'FALSCH'
  };
}

function draftPremiseFulfillment(value: string): PremiseFulfillmentState {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return {
      value: '',
      ready: false,
      status: 'missing',
      label: 'Fehlt.',
      promptStatus: 'fehlt'
    };
  }
  return {
    value: trimmed,
    ready: false,
    status: 'unchecked',
    label: 'Wartet auf Prüfung.',
    promptStatus: 'eingetragen, aber noch nicht geprüft'
  };
}

function applyPremiseStatus(status: HTMLElement, state: PremiseFulfillmentState): void {
  status.dataset.value = state.value;
  status.dataset.ready = state.ready ? '1' : '0';
  status.dataset.status = state.status;
  status.dataset.promptStatus = state.promptStatus;
  status.title = state.ready || state.value ? state.value : '';
  status.textContent = state.label;
  status.classList.toggle('freitext__premise-status--ready', state.ready);
  status.classList.toggle('freitext__premise-status--missing', state.status === 'missing');
  status.classList.toggle(
    'freitext__premise-status--warning',
    state.status === 'unchecked' || state.status === 'partial'
  );
  status.classList.toggle('freitext__premise-status--invalid', state.status === 'wrong');
  status.closest('.freitext__premise')?.classList.toggle('freitext__premise--fulfilled', state.ready);
}

function updateLinkedPremiseSourceDraft(root: HTMLElement, sourceKey: string, value: string): void {
  if (!sourceKey) return;
  const state = draftPremiseFulfillment(value);
  Array.from(root.querySelectorAll<HTMLElement>('.freitext__premise-status'))
    .filter((status) => status.dataset.sourceKey === sourceKey)
    .forEach((status) => {
      applyPremiseStatus(status, state);
    });
}

function updatePremiseStates(root: HTMLElement, latestByKey: Record<string, AnswerEntry>): void {
  const blocks = Array.from(root.querySelectorAll('freitext-block')) as HTMLElement[];
  blocks.forEach((block) => {
    const textarea = block.querySelector('textarea.freitext__textarea') as HTMLTextAreaElement | null;
    const premises = readPremisesFromTextarea(textarea).filter((premise) => premise.sourceKey);
    if (!premises.length) return;

    premises.forEach((premise) => {
      const status = Array.from(
        block.querySelectorAll<HTMLElement>('.freitext__premise-status')
      ).find((entry) => entry.dataset.premiseId === premise.id);
      if (!status) return;

      const state = premiseFulfillmentFromEntry(latestByKey[premise.sourceKey]);
      applyPremiseStatus(status, state);
    });
  });
}

async function prefillAnswers(options: FreitextRuntimeOptions): Promise<void> {
  const { apiBaseUrl, sheetKey, user, root } = options;
  if (!user) return;

  const params = new URLSearchParams();
  params.set('sheet', sheetKey);
  params.set('user', user);
  if (options.classroom) {
    params.set('classroom', String(options.classroom));
  }
  const endpoint = `${apiBaseUrl}answer?${params.toString()}`;

  try {
    const resp = await fetch(endpoint);
    if (!resp.ok) return;
    const payload = await resp.json().catch(() => ({}));
    const answers: Array<Record<string, any>> = payload?.data?.answer ?? [];
    const latestByKey = latestAnswersByKey(answers);

    Object.entries(latestByKey).forEach(([key, entry]) => {
      const textarea = Array.from(
        root.querySelectorAll<HTMLTextAreaElement>('freitext-block textarea.freitext__textarea')
      ).find((el) => el.name === key);
      if (!textarea) return;

      const wrapper = textarea.closest('freitext-block') as HTMLElement | null;
      const stored = parseStoredFreitextValue(entry.value || '');
      if (stored.answer.trim()) {
        textarea.dataset.hasStoredAnswer = '1';
      } else {
        delete textarea.dataset.hasStoredAnswer;
      }
      if (textarea.dataset.userEdited !== '1' && !textarea.value) {
        textarea.value = stored.answer || '';
      }
      Object.entries(stored.premiseValues).forEach(([premiseId, value]) => {
        const input = Array.from(
          wrapper?.querySelectorAll<HTMLInputElement>('.freitext__premise-input') ?? []
        ).find((field) => field.dataset.premiseId === premiseId);
        if (input && !input.value) input.value = value;
      });

      const { label } = classificationInfo(entry.classification, entry.classification_label);
      const storedAnswer = stored.answer.trim();
      const appliedLabel = storedAnswer !== '' && textarea.value.trim() === storedAnswer ? label : null;
      const button = wrapper?.querySelector('.check-btn') as HTMLButtonElement | null;
      const feedback = wrapper?.querySelector('.feedback') as HTMLElement | null;
      setClasses(textarea, button, feedback, appliedLabel);
      rememberCheckedValue(textarea, appliedLabel);
    });
    updatePremiseStates(root, latestByKey);
  } catch {
    // ignore
  }
}

function criteriaText(criteria: FreitextCriterion[]): string {
  if (!criteria.length) return '';
  return criteria
    .map((criterion, index) => {
      const details = [];
      if (criterion.description) details.push(`sichtbar: ${criterion.description}`);
      if (criterion.example) details.push(`beispiel: ${criterion.example}`);
      if (criterion.internalDescription) details.push(`intern: ${criterion.internalDescription}`);
      return `${index + 1}. ${criterion.label}${details.length ? ` | ${details.join(' | ')}` : ''}`;
    })
    .join('\n');
}

function collectPremiseValues(wrapper: HTMLElement | null): Record<string, string> {
  if (!wrapper) return {};
  const values: Record<string, string> = {};
  wrapper
    .querySelectorAll<HTMLInputElement>('.freitext__premise-input')
    .forEach((input) => {
      const key = input.dataset.premiseId || input.name;
      values[key] = input.value.trim();
    });
  wrapper
    .querySelectorAll<HTMLElement>('.freitext__premise-status')
    .forEach((status) => {
      const key = status.dataset.premiseId || '';
      if (!key) return;
      values[key] = String(status.dataset.value || '').trim();
    });
  return values;
}

function premiseStatusFromDom(
  wrapper: HTMLElement | null,
  premise: FreitextPremise,
  values: Record<string, string>
): PremiseFulfillmentState {
  const value = String(values[premise.id] || '').trim();
  if (!premise.sourceKey) {
    if (value) {
      return {
        value,
        ready: true,
        status: 'ready',
        label: 'Eingetragen.',
        promptStatus: 'eingetragen'
      };
    }
    return {
      value: '',
      ready: false,
      status: 'missing',
      label: 'Fehlt.',
      promptStatus: 'fehlt'
    };
  }

  const statusEl = Array.from(
    wrapper?.querySelectorAll<HTMLElement>('.freitext__premise-status') ?? []
  ).find((entry) => entry.dataset.premiseId === premise.id);
  const status = (statusEl?.dataset.status || 'missing') as PremiseFulfillmentState['status'];
  const label = (statusEl?.textContent || '').replace(/\s+/g, ' ').trim();
  return {
    value,
    ready: statusEl?.dataset.ready === '1',
    status,
    label: label || (value ? 'Wartet auf Prüfung.' : 'Fehlt.'),
    promptStatus: statusEl?.dataset.promptStatus || (value ? 'eingetragen' : 'fehlt')
  };
}

function premiseFeedbackNotice(
  premises: FreitextPremise[],
  states: Record<string, PremiseFulfillmentState>
): string {
  const missing = premises
    .filter((premise) => premise.required && !states[premise.id]?.ready)
    .map((premise) => {
      const state = states[premise.id];
      return `${premise.label}: ${state?.label || 'Fehlt.'}`;
    });
  if (!missing.length) return '';
  return `Hinweis: Folgende Prämisse${missing.length === 1 ? '' : 'n'} ${
    missing.length === 1 ? 'ist' : 'sind'
  } nicht erfüllt: ${missing.join('; ')}. Die Rückmeldung berücksichtigt das.`;
}

function premisesText(
  premises: FreitextPremise[],
  values: Record<string, string>,
  states: Record<string, PremiseFulfillmentState> = {}
): string {
  if (!premises.length) return '';
  return premises
    .map((premise, index) => {
      const state = states[premise.id] || premiseStatusFromDom(null, premise, values);
      const parts = [`${index + 1}. ${premise.label}`];
      if (premise.description) parts.push(`KI-Hinweis: ${premise.description}`);
      if (premise.sourceKey) {
        parts.push(
          `Eingabeelement: ${premise.sourceKey}${
            premise.sourceType ? ` (${premise.sourceType})` : ''
          }`
        );
      }
      if (premise.sourceUrl) parts.push(`Quelle: ${premise.sourceUrl}`);
      const learnerValue = String(values[premise.id] || '').trim();
      parts.push(
        premise.sourceKey
          ? `Automatisch übernommener Wert: ${learnerValue !== '' ? learnerValue : '[fehlt]'}`
          : `Eingabe Lernende: ${learnerValue !== '' ? learnerValue : '[fehlt]'}`
      );
      parts.push(`Status Prämisse: ${state.promptStatus}`);
      parts.push(`Prämisse erfüllt: ${state.ready ? 'ja' : 'nein'}`);
      parts.push(`Pflichtfeld: ${premise.required ? 'ja' : 'nein'}`);
      return parts.join(' | ');
    })
    .join('\n');
}

function buildStoredFreitextValue(
  answer: string,
  premises: FreitextPremise[],
  values: Record<string, string>
): string {
  if (!premises.length) return answer;
  return JSON.stringify({
    type: 'freitext',
    version: 1,
    answer,
    premise_values: values
  });
}

async function checkFreitext(
  button: HTMLButtonElement,
  options: FreitextRuntimeOptions
): Promise<void> {
  if (button.dataset.freitextBusy === '1') return;
  button.dataset.freitextBusy = '1';

  const wrapper = button.closest('freitext-block') as HTMLElement | null;
  const textarea = wrapper?.querySelector('textarea.freitext__textarea') as HTMLTextAreaElement | null;
  const questionField = wrapper?.querySelector(
    '.freitext__question-field'
  ) as HTMLInputElement | HTMLTextAreaElement | null;
  const feedback = wrapper?.querySelector('.feedback') as HTMLElement | null;

  if (!textarea || !feedback) {
    notifySaveState(options, 'error', 'Eingabefeld nicht gefunden.');
    button.dataset.freitextBusy = '';
    return;
  }

  const answer = textarea.value.trim();

  let criteria: FreitextCriterion[] = [];
  try {
    criteria = JSON.parse(textarea.dataset.criteria || '[]');
  } catch {
    criteria = [];
  }

  let premises: FreitextPremise[] = [];
  try {
    premises = JSON.parse(textarea.dataset.premises || '[]');
  } catch {
    premises = [];
  }

  const premiseValues = collectPremiseValues(wrapper);
  const premiseStates = Object.fromEntries(
    premises.map((premise) => [
      premise.id,
      premiseStatusFromDom(wrapper, premise, premiseValues)
    ])
  ) as Record<string, PremiseFulfillmentState>;
  const premiseNotice = premiseFeedbackNotice(premises, premiseStates);
  const additionalQuestion = questionField?.value.trim() || '';

  if (!answer) {
    const message = 'Bitte zuerst einen Text schreiben.';
    notifySaveState(options, 'error', message);
    setClasses(textarea, button, feedback, null);
    showFeedback(feedback, message);
    button.dataset.freitextBusy = '';
    return;
  }

  if (!keepFeedbackVisible(feedback)) {
    feedback.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
    showFeedback(feedback, 'Rückmeldung wird erstellt...');
  }
  button.classList.add('check-btn--loading');
  button.disabled = true;

  const backendResponse = await sendAnswerToBackend(options.apiBaseUrl, {
    key: textarea.name,
    sheet: options.sheetKey,
    user: options.user,
    value: buildStoredFreitextValue(answer, premises, premiseValues),
    answer_text: answer,
    ...(options.classroom ? { classroom: String(options.classroom) } : {}),
    ...previewPayload(options),
    exercise_type: 'freitext',
    task_prompt: textarea.dataset.task || '',
    instruction_text: textarea.dataset.task || '',
    teacher_prompt: textarea.dataset.teacherPrompt || '',
    block_prompt: textarea.dataset.blockPrompt || '',
    additional_prompt: [textarea.dataset.teacherPrompt || '', textarea.dataset.blockPrompt || '']
      .filter((part) => part.trim() !== '')
      .join('\n\n'),
    title: textarea.dataset.title || '',
    criteria_text: criteriaText(criteria),
    criteria_json: JSON.stringify(criteria),
    additional_question: additionalQuestion,
    premises_text: premisesText(premises, premiseValues, premiseStates),
    premises_json: JSON.stringify(premises),
    premise_values_json: JSON.stringify(premiseValues),
    min_length: textarea.dataset.minLength || '',
    max_length: textarea.dataset.maxLength || ''
  });

  if (textarea.value.trim() !== answer) {
    const message = 'Antwort wurde geändert. Bitte erneut prüfen.';
    notifySaveState(options, 'error', message);
    setClasses(textarea, button, feedback, null);
    button.disabled = false;
    showFeedback(feedback, message);
    button.dataset.freitextBusy = '';
    return;
  }

  const backendError = (backendResponse && (backendResponse.error || backendResponse.warning)) || null;
  if (backendError) {
    notifySaveState(options, 'error', String(backendError));
    button.classList.remove('check-btn--loading');
    button.disabled = false;
    feedback.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
    showFeedback(feedback, String(backendError));
    button.dataset.freitextBusy = '';
    return;
  }

  const chatgpt = backendResponse?.data?.chatgpt;
  const chatgptError = chatgpt && chatgpt.error ? String(chatgpt.error) : '';
  const rawText =
    (chatgpt && (chatgpt.raw || chatgpt.explanation)) ||
    (chatgptError ? chatgptError : 'Keine Rückmeldung erhalten.');

  const feedbackText = [premiseNotice, chatgpt?.explanation || rawText].filter(Boolean).join('\n\n');
  const info = reconcileFreitextClassificationWithFeedback(
    classificationInfo(chatgpt?.classification, chatgpt?.classification_label),
    feedbackText
  );
  setClasses(textarea, button, feedback, info.label);
  rememberCheckedValue(textarea, info.label);
  textarea.dataset.hasStoredAnswer = '1';
  delete textarea.dataset.userEdited;
  showFeedback(feedback, feedbackText);

  button.classList.remove('check-btn--loading');
  button.disabled = false;
  updateProgress(options.root, options.onProgress);
  notifySaveState(options, 'saved');
  options.root.dispatchEvent(
    new CustomEvent('abu-answer-saved', {
      bubbles: true,
      detail: {
        key: textarea.name,
        sheet: options.sheetKey,
        user: options.user,
        classification: info.score,
        classification_label: info.label,
        value: answer
      }
    })
  );
  button.dataset.freitextBusy = '';
}

export function createFreitextRuntime(options: FreitextRuntimeOptions): {
  destroy: () => void;
  refresh: () => Promise<void>;
} {
  ensureFreitextElements();
  bindOutsideClickHide();
  const buttonHandlers = new Map<HTMLButtonElement, EventListener>();
  const textareaHandlers = new Map<HTMLTextAreaElement, EventListener>();
  const premiseHandlers = new Map<HTMLInputElement, EventListener>();
  let refreshTimer: number | null = null;
  const sourceDraftHandler = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (!target.matches('input.luecke, textarea.freitext__textarea')) return;
    updateLinkedPremiseSourceDraft(options.root, target.name || '', target.value || '');
  };

  const bindButtons = () => {
    const buttons = Array.from(
      options.root.querySelectorAll('freitext-block button.check-btn')
    ) as HTMLButtonElement[];
    buttons.forEach((btn) => {
      if (buttonHandlers.has(btn)) return;
      const handler = () => {
        notifySaveState(options, 'saving');
        void checkFreitext(btn, options);
      };
      buttonHandlers.set(btn, handler);
      btn.addEventListener('click', handler);
    });
  };

  const bindTextareas = () => {
    const textareas = Array.from(
      options.root.querySelectorAll('freitext-block textarea.freitext__textarea')
    ) as HTMLTextAreaElement[];
    textareas.forEach((textarea) => {
      if (textareaHandlers.has(textarea)) return;
      const handler = () => {
        textarea.dataset.userEdited = '1';
        clearCheckedStateIfEdited(textarea);
        updateProgress(options.root, options.onProgress);
      };
      textareaHandlers.set(textarea, handler);
      textarea.addEventListener('input', handler);
      textarea.addEventListener('change', handler);
    });
  };

  const bindPremiseInputs = () => {
    const inputs = Array.from(
      options.root.querySelectorAll<HTMLInputElement>('freitext-block .freitext__premise-input')
    );
    inputs.forEach((input) => {
      if (premiseHandlers.has(input)) return;
      const handler = () => {
        updateProgress(options.root, options.onProgress);
      };
      premiseHandlers.set(input, handler);
      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    });
  };

  options.root.dataset.freitextRuntime = '1';
  bindButtons();
  bindTextareas();
  bindPremiseInputs();
  options.root.addEventListener('input', sourceDraftHandler);
  options.root.addEventListener('change', sourceDraftHandler);
  const observer = new MutationObserver(() => {
    bindButtons();
    bindTextareas();
    bindPremiseInputs();
  });
  observer.observe(options.root, { childList: true, subtree: true });

  const refresh = async () => {
    await prefillAnswers(options);
    updateProgress(options.root, options.onProgress);
    bindButtons();
    bindTextareas();
    bindPremiseInputs();
  };

  const answerSavedHandler = () => {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      void refresh();
    }, 80);
  };
  options.root.addEventListener('abu-answer-saved', answerSavedHandler as EventListener);

  return {
    destroy: () => {
      observer.disconnect();
      if (refreshTimer) window.clearTimeout(refreshTimer);
      options.root.removeEventListener('abu-answer-saved', answerSavedHandler as EventListener);
      options.root.removeEventListener('input', sourceDraftHandler);
      options.root.removeEventListener('change', sourceDraftHandler);
      buttonHandlers.forEach((handler, btn) => {
        btn.removeEventListener('click', handler);
      });
      textareaHandlers.forEach((handler, textarea) => {
        textarea.removeEventListener('input', handler);
        textarea.removeEventListener('change', handler);
      });
      premiseHandlers.forEach((handler, input) => {
        input.removeEventListener('input', handler);
        input.removeEventListener('change', handler);
      });
      buttonHandlers.clear();
      textareaHandlers.clear();
      premiseHandlers.clear();
      options.root.dataset.freitextRuntime = '';
    },
    refresh
  };
}
