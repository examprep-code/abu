import { logAiError, logAiRequest, logAiResponse } from '../ai-console';

export type TextdokumentProgress = {
  percent: number;
  answered: number;
  total: number;
};

export type TextdokumentRuntimeOptions = {
  root: HTMLElement;
  apiBaseUrl: string;
  sheetKey: string;
  user: string;
  classroom?: string | number | null;
  previewSchool?: string | number | null;
  previewClassroom?: string | number | null;
  previewLearner?: string | null;
  previewMode?: boolean;
  onProgress?: (progress: TextdokumentProgress) => void;
  onSaveState?: (event: {
    status: 'saving' | 'saved' | 'error';
    message?: string;
    at?: number;
  }) => void;
};

const TEXTDOKUMENT_TAG = 'textdokument-feld';
const TEXTDOKUMENT_LABEL = 'Textfeld';
const LEGACY_TEXTDOKUMENT_LABEL = 'Textdokument';
const numberFormatter = new Intl.NumberFormat('de-CH');

type ClassificationLabel = 'RICHTIG' | 'TEILWEISE' | 'FALSCH' | null;
type TextdokumentStatus = 'empty' | 'draft' | 'checking' | 'checked' | 'partial' | 'wrong' | 'error';
type TextdokumentStoredValue = {
  answer: string;
  feedback: string;
  classification: number | null;
  classificationLabel: ClassificationLabel;
  checkedAt: string;
  sourceContext: Record<string, any> | null;
};
type TextdokumentStateDetails = Partial<{
  feedback: string;
  classification: number | null;
  classificationLabel: ClassificationLabel;
  checkedAt: string;
  status: TextdokumentStatus;
  saved: boolean;
  sourceContext: Record<string, any> | null;
}>;

type ModalHandle = {
  backdrop: HTMLElement;
  cleanup: () => void;
};

let activeModal: ModalHandle | null = null;
const statusTimers = new WeakMap<HTMLElement, number>();

function textdokumentIconSvg(): string {
  return `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
    <path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
    <path d="M14 3v5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
    <path d="M9 12h6M9 16h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
  </svg>`;
}

function textdokumentSavedIconSvg(): string {
  return `<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
    <path d="M3.4 8.2 6.5 11.1 12.7 4.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}

function classificationInfo(
  value: unknown,
  labelHint?: string | null
): {
  score: number | null;
  label: ClassificationLabel;
} {
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

function getTextStats(value: string): { chars: number; words: number } {
  const text = String(value || '');
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  return {
    chars: text.length,
    words
  };
}

function formatCompactTextStats(value: string): string {
  const { chars, words } = getTextStats(value);
  if (!chars) return '';
  if (words > 1) return `${numberFormatter.format(words)} Wörter`;
  if (words === 1) return '1 Wort';
  return `${numberFormatter.format(chars)} Zeichen`;
}

function formatDetailedTextStats(value: string): string {
  const { chars, words } = getTextStats(value);
  const wordLabel = words === 1 ? 'Wort' : 'Wörter';
  const charLabel = chars === 1 ? 'Zeichen' : 'Zeichen';
  return `${numberFormatter.format(words)} ${wordLabel}, ${numberFormatter.format(chars)} ${charLabel}`;
}

function getTextdokumentLabel(field: HTMLElement | null): string {
  const value = (
    field?.getAttribute('label') ||
    field?.getAttribute('title') ||
    field?.getAttribute('name') ||
    TEXTDOKUMENT_LABEL
  ).trim();
  if (!value || value.toLowerCase() === LEGACY_TEXTDOKUMENT_LABEL.toLowerCase()) {
    return TEXTDOKUMENT_LABEL;
  }
  return value;
}

function getTextdokumentPlaceholder(field: HTMLElement | null): string {
  const value = (
    field?.getAttribute('placeholder') ||
    field?.getAttribute('data-placeholder') ||
    'Text hier einfügen...'
  ).trim();
  return value || 'Text hier einfügen...';
}

function emptyStoredTextdokumentValue(answer = ''): TextdokumentStoredValue {
  return {
    answer,
    feedback: '',
    classification: null,
    classificationLabel: null,
    checkedAt: '',
    sourceContext: null
  };
}

function parseStoredTextdokumentValue(rawValue: unknown): TextdokumentStoredValue {
  const raw = String(rawValue || '');
  if (!raw.trim().startsWith('{')) return emptyStoredTextdokumentValue(raw);

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyStoredTextdokumentValue(raw);
    const answer =
      typeof parsed.answer === 'string'
        ? parsed.answer
        : typeof parsed.text === 'string'
        ? parsed.text
        : typeof parsed.value === 'string'
        ? parsed.value
        : '';
    const info = classificationInfo(parsed.classification, parsed.classification_label);
    return {
      answer,
      feedback:
        typeof parsed.feedback === 'string'
          ? parsed.feedback
          : typeof parsed.explanation === 'string'
          ? parsed.explanation
          : '',
      classification: info.score,
      classificationLabel: info.label,
      checkedAt: typeof parsed.checked_at === 'string' ? parsed.checked_at : '',
      sourceContext:
        parsed.source_context && typeof parsed.source_context === 'object'
          ? (parsed.source_context as Record<string, any>)
          : null
    };
  } catch {
    return emptyStoredTextdokumentValue(raw);
  }
}

function buildStoredTextdokumentValue(answer: string): string {
  return JSON.stringify({
    type: 'textdokument',
    answer
  });
}

function getTextdokumentPrompt(field: HTMLElement | null): string {
  const value = (
    field?.getAttribute('prompt') ||
    field?.getAttribute('teacher-prompt') ||
    field?.getAttribute('data-prompt') ||
    field?.getAttribute('data-teacher-prompt') ||
    ''
  ).trim();
  return value;
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

    logAiResponse(endpoint, payload, resp.status, parsed);
    if (!resp.ok) {
      return { error: parsed.warning || parsed.error || `Fehler im Backend (${resp.status})` };
    }
    return parsed;
  } catch (err) {
    logAiError(endpoint, payload, err);
    return { error: 'Textfeld konnte nicht gespeichert werden.' };
  }
}

function previewPayload(options: TextdokumentRuntimeOptions): Record<string, string> {
  if (!options.previewMode) return {};
  return {
    preview_mode: '1',
    ...(options.previewSchool ? { preview_school: String(options.previewSchool) } : {}),
    ...(options.previewClassroom ? { preview_classroom: String(options.previewClassroom) } : {}),
    ...(options.previewLearner ? { preview_learner: String(options.previewLearner) } : {})
  };
}

function notifySaveState(
  options: TextdokumentRuntimeOptions,
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

function statusFromClassification(
  filled: boolean,
  label: ClassificationLabel,
  fallback: TextdokumentStatus = 'draft'
): TextdokumentStatus {
  if (!filled) return 'empty';
  if (label === 'RICHTIG') return 'checked';
  if (label === 'TEILWEISE') return 'partial';
  if (label === 'FALSCH') return 'wrong';
  return fallback;
}

function textdokumentStatusLabel(status: TextdokumentStatus): string {
  if (status === 'checking') return 'Prüft...';
  if (status === 'checked') return 'Geprüft';
  if (status === 'partial') return 'Teilweise';
  if (status === 'wrong') return 'Prüfen';
  if (status === 'error') return 'Fehler';
  if (status === 'draft') return 'Gespeichert';
  return 'Offen';
}

function updateTextdokumentState(
  field: HTMLElement,
  value: string,
  details: TextdokumentStateDetails = {}
): void {
  const answer = String(value || '');
  const filled = answer.trim() !== '';
  const label = getTextdokumentLabel(field);
  const button = field.querySelector<HTMLButtonElement>('.textdokument-trigger');
  const count = field.querySelector<HTMLElement>('.textdokument-count');
  const status = field.querySelector<HTMLElement>('.textdokument-status');
  const saveIndicator = field.querySelector<HTMLElement>('.textdokument-save-indicator');
  const feedback = field.querySelector<HTMLElement>('.textdokument-feedback');
  const compactStats = formatCompactTextStats(answer);
  const detailedStats = formatDetailedTextStats(answer);
  const info = classificationInfo(
    Object.prototype.hasOwnProperty.call(details, 'classification')
      ? details.classification
      : field.dataset.classification,
    Object.prototype.hasOwnProperty.call(details, 'classificationLabel')
      ? details.classificationLabel
      : field.dataset.classificationLabel
  );
  const feedbackText = Object.prototype.hasOwnProperty.call(details, 'feedback')
    ? String(details.feedback || '').trim()
    : String(field.dataset.feedback || '').trim();
  const statusKind =
    details.status ||
    statusFromClassification(
      filled,
      info.label,
      (field.dataset.textdokumentStatus as TextdokumentStatus) || 'draft'
    );

  field.dataset.value = answer;
  field.dataset.feedback = feedbackText;
  field.dataset.textdokumentStatus = statusKind;
  field.dataset.classification = info.score === null ? '' : String(info.score);
  field.dataset.classificationLabel = info.label || '';
  field.dataset.checkedAt =
    Object.prototype.hasOwnProperty.call(details, 'checkedAt')
      ? details.checkedAt || ''
      : field.dataset.checkedAt || '';
  if (details.sourceContext) {
    field.dataset.sourceContext = JSON.stringify(details.sourceContext);
  }
  if (info.label) {
    field.dataset.checkedValue = answer;
  } else if (statusKind !== 'checking') {
    delete field.dataset.checkedValue;
  }
  field.classList.toggle('textdokument-feld--filled', filled);
  field.classList.toggle('textdokument-feld--has-feedback', feedbackText !== '');
  button?.classList.toggle('textdokument-trigger--filled', filled);
  button?.classList.toggle('textdokument-trigger--checking', statusKind === 'checking');
  if (button) {
    button.disabled = statusKind === 'checking';
    button.title = filled ? `${label} (${detailedStats})` : label;
    button.setAttribute('aria-label', `${label} öffnen`);
  }
  if (count) {
    count.textContent = compactStats || '0 Zeichen';
    count.title = detailedStats;
  }
  if (status) {
    status.textContent = textdokumentStatusLabel(statusKind);
    status.dataset.status = statusKind;
  }
  if (feedback) {
    feedback.textContent = feedbackText;
    feedback.hidden = feedbackText === '';
    feedback.dataset.status = statusKind;
  }
  if (saveIndicator && details.saved) {
    const existingTimer = statusTimers.get(saveIndicator);
    if (existingTimer) window.clearTimeout(existingTimer);
    saveIndicator.innerHTML = `
        <span class="textdokument-status__icon">${textdokumentSavedIconSvg()}</span>
        <span class="textdokument-sr">Gespeichert</span>
      `;
    saveIndicator.classList.add('textdokument-save-indicator--visible');
    const timer = window.setTimeout(() => {
      saveIndicator.classList.remove('textdokument-save-indicator--visible');
      saveIndicator.innerHTML = '';
    }, 2400);
    statusTimers.set(saveIndicator, timer);
  }
}

function updateProgress(
  root: HTMLElement,
  onProgress?: (progress: TextdokumentProgress) => void
): TextdokumentProgress {
  const fields = Array.from(root.querySelectorAll<HTMLElement>(TEXTDOKUMENT_TAG));
  const total = fields.length;
  const answered = fields.filter((field) => String(field.dataset.value || '').trim()).length;
  const progress = {
    total,
    answered,
    percent: total ? Math.round((answered / total) * 100) : 0
  };
  onProgress?.(progress);
  return progress;
}

function closeActiveModal(): void {
  if (!activeModal) return;
  activeModal.cleanup();
  activeModal.backdrop.remove();
  activeModal = null;
}

function openTextdokumentModal(
  field: HTMLElement,
  options: TextdokumentRuntimeOptions,
  onSaved: () => void
): void {
  closeActiveModal();

  const label = getTextdokumentLabel(field);
  const backdrop = document.createElement('div');
  backdrop.className = 'textdokument-modal-backdrop';

  const card = document.createElement('div');
  card.className = 'textdokument-modal-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');

  const titleId = `textdokument-title-${Math.random().toString(36).slice(2)}`;
  const title = document.createElement('h3');
  title.id = titleId;
  title.textContent = label;
  card.setAttribute('aria-labelledby', titleId);

  const form = document.createElement('form');
  form.className = 'textdokument-form';

  const textarea = document.createElement('textarea');
  textarea.value = field.dataset.value || '';
  textarea.placeholder = getTextdokumentPlaceholder(field);
  textarea.rows = 12;
  textarea.setAttribute('aria-label', label);

  const meta = document.createElement('div');
  meta.className = 'textdokument-meta';
  const updateMeta = () => {
    meta.textContent = formatDetailedTextStats(textarea.value);
  };
  updateMeta();

  const checkedValue = field.dataset.checkedValue;
  const currentFeedback = String(field.dataset.feedback || '').trim();
  const modalFeedback = document.createElement('div');
  modalFeedback.className = 'textdokument-modal-feedback';
  modalFeedback.hidden = currentFeedback === '';
  modalFeedback.textContent = currentFeedback;

  const handleTextareaInput = () => {
    updateMeta();
    if (checkedValue === undefined || textarea.value.trim() === checkedValue) return;
    modalFeedback.hidden = true;
    modalFeedback.textContent = '';
  };
  textarea.addEventListener('input', handleTextareaInput);

  const error = document.createElement('p');
  error.className = 'textdokument-error';

  const actions = document.createElement('div');
  actions.className = 'textdokument-actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'ghost ci-btn-outline';
  cancel.textContent = 'Abbrechen';

  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'ci-btn-secondary';
  save.textContent = 'Speichern & prüfen';

  actions.append(cancel, save);
  form.append(textarea, meta, modalFeedback, error, actions);
  card.append(title, form);
  backdrop.append(card);
  document.body.append(backdrop);

  const close = () => closeActiveModal();
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  };
  const handleBackdropClick = (event: MouseEvent) => {
    if (event.target === backdrop) close();
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    save.disabled = true;
    save.textContent = 'Prüft...';
    const saved = await saveTextdokument(field, textarea.value, options, error);
    save.disabled = false;
    save.textContent = 'Speichern & prüfen';
    if (!saved) return;
    onSaved();
    close();
  });

  cancel.addEventListener('click', close);
  backdrop.addEventListener('click', handleBackdropClick);
  window.addEventListener('keydown', handleKeydown);

  activeModal = {
    backdrop,
    cleanup: () => {
      window.removeEventListener('keydown', handleKeydown);
      backdrop.removeEventListener('click', handleBackdropClick);
    }
  };

  window.setTimeout(() => {
    textarea.focus();
    textarea.select();
  }, 0);
}

async function prefillAnswers(options: TextdokumentRuntimeOptions): Promise<void> {
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
    const latestByKey: Record<string, Record<string, any>> = {};

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

    Array.from(root.querySelectorAll<HTMLElement>(TEXTDOKUMENT_TAG)).forEach((field) => {
      const key = (field.getAttribute('name') || '').trim();
      if (!key || !latestByKey[key]) {
        updateTextdokumentState(field, field.dataset.value || '');
        return;
      }
      const stored = parseStoredTextdokumentValue(latestByKey[key].value || '');
      const info = classificationInfo(
        latestByKey[key].classification ?? stored.classification,
        latestByKey[key].classification_label ?? stored.classificationLabel
      );
      updateTextdokumentState(field, stored.answer, {
        feedback: stored.feedback,
        classification: info.score,
        classificationLabel: info.label,
        checkedAt: stored.checkedAt,
        sourceContext: stored.sourceContext,
        status: statusFromClassification(stored.answer.trim() !== '', info.label)
      });
    });
  } catch {
    // Prefill is non-critical.
  }
}

async function saveTextdokument(
  field: HTMLElement,
  value: string,
  options: TextdokumentRuntimeOptions,
  errorEl?: HTMLElement
): Promise<boolean> {
  if (field.dataset.textdokumentBusy === '1') return false;
  field.dataset.textdokumentBusy = '1';

  const key = (field.getAttribute('name') || '').trim();
  const answer = String(value ?? '').trim();
  if (!key) {
    const message = 'Textfeld hat keinen Namen.';
    if (errorEl) errorEl.textContent = message;
    notifySaveState(options, 'error', message);
    field.dataset.textdokumentBusy = '';
    return false;
  }

  notifySaveState(options, 'saving');
  updateTextdokumentState(field, answer, {
    feedback: '',
    classification: null,
    classificationLabel: null,
    status: answer ? 'checking' : 'empty'
  });
  const backendResponse = await sendAnswerToBackend(options.apiBaseUrl, {
    key,
    sheet: options.sheetKey,
    user: options.user,
    value: buildStoredTextdokumentValue(answer),
    answer_text: answer,
    exercise_type: 'textdokument',
    title: getTextdokumentLabel(field),
    task_prompt: getTextdokumentPrompt(field),
    prompt: getTextdokumentPrompt(field),
    ...(options.classroom ? { classroom: String(options.classroom) } : {}),
    ...previewPayload(options)
  });

  const backendError = (backendResponse && (backendResponse.error || backendResponse.warning)) || null;
  if (backendError) {
    const message = String(backendError);
    if (errorEl) errorEl.textContent = message;
    updateTextdokumentState(field, answer, {
      feedback: message,
      status: 'error'
    });
    notifySaveState(options, 'error', message);
    field.dataset.textdokumentBusy = '';
    return false;
  }

  const chatgpt = backendResponse?.data?.chatgpt || {};
  const chatgptError = chatgpt && chatgpt.error ? String(chatgpt.error) : '';
  const rawText =
    (chatgpt && (chatgpt.raw || chatgpt.explanation)) ||
    (chatgptError ? chatgptError : 'Keine Rückmeldung erhalten.');
  const info = classificationInfo(chatgpt?.classification, chatgpt?.classification_label);
  const feedbackText = String(chatgpt?.explanation || rawText || '').trim();
  const sourceContext =
    chatgpt?.source_context && typeof chatgpt.source_context === 'object'
      ? (chatgpt.source_context as Record<string, any>)
      : null;

  updateTextdokumentState(field, answer, {
    feedback: feedbackText,
    classification: info.score,
    classificationLabel: info.label,
    checkedAt: new Date().toISOString(),
    status: statusFromClassification(answer !== '', info.label, 'checked'),
    sourceContext,
    saved: true
  });
  updateProgress(options.root, options.onProgress);
  notifySaveState(options, 'saved');
  options.root.dispatchEvent(
    new CustomEvent('abu-answer-saved', {
      bubbles: true,
      detail: {
        key,
        sheet: options.sheetKey,
        user: options.user,
        classification: info.score,
        classification_label: info.label,
        value: answer,
        source_context: sourceContext
      }
    })
  );
  field.dataset.textdokumentBusy = '';
  return true;
}

export function ensureTextdokumentElements(): void {
  if (customElements.get(TEXTDOKUMENT_TAG)) return;

  const upgraded = new WeakSet<HTMLElement>();
  const isVisualEditorField = (el: HTMLElement) => Boolean(el.closest('.block-editor__visual'));

  class TextdokumentFeld extends HTMLElement {
    connectedCallback() {
      const existingName = (this.getAttribute('name') || '').trim();
      if (!existingName) {
        this.setAttribute('name', `textfeld-${Math.random().toString(36).slice(2)}`);
      }

      this.removeAttribute('data-upgraded');
      if (isVisualEditorField(this)) {
        this.setAttribute('contenteditable', 'false');
        return;
      }
      this.removeAttribute('contenteditable');
      this.removeAttribute('data-editor-selected');
      this.removeAttribute('style');

      if (upgraded.has(this)) return;
      upgraded.add(this);

      const label = getTextdokumentLabel(this);
      this.innerHTML = '';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'textdokument-trigger ci-btn-outline';
      button.title = label;
      button.setAttribute('aria-label', `${label} öffnen`);
      button.innerHTML = `
        <span class="textdokument-trigger__icon">${textdokumentIconSvg()}</span>
        <span class="textdokument-sr">${label}</span>
      `;

      const status = document.createElement('span');
      status.className = 'textdokument-status';
      status.setAttribute('aria-live', 'polite');

      const saveIndicator = document.createElement('span');
      saveIndicator.className = 'textdokument-save-indicator';
      saveIndicator.setAttribute('aria-live', 'polite');

      const count = document.createElement('span');
      count.className = 'textdokument-count';
      count.setAttribute('aria-hidden', 'true');

      const feedback = document.createElement('div');
      feedback.className = 'textdokument-feedback';
      feedback.hidden = true;

      this.append(button, saveIndicator, count, status, feedback);
      updateTextdokumentState(this, this.dataset.value || '');
    }
  }

  customElements.define(TEXTDOKUMENT_TAG, TextdokumentFeld);
}

export function createTextdokumentRuntime(options: TextdokumentRuntimeOptions): {
  destroy: () => void;
  refresh: () => Promise<void>;
} {
  ensureTextdokumentElements();
  const triggerHandlers = new Map<HTMLButtonElement, EventListener>();

  const bindTriggers = () => {
    const triggers = Array.from(
      options.root.querySelectorAll<HTMLButtonElement>(`${TEXTDOKUMENT_TAG} .textdokument-trigger`)
    );
    triggers.forEach((trigger) => {
      if (triggerHandlers.has(trigger)) return;
      const handler = () => {
        const field = trigger.closest(TEXTDOKUMENT_TAG) as HTMLElement | null;
        if (!field) return;
        openTextdokumentModal(field, options, () => updateProgress(options.root, options.onProgress));
      };
      triggerHandlers.set(trigger, handler);
      trigger.addEventListener('click', handler);
    });
  };

  options.root.dataset.textdokumentRuntime = '1';
  bindTriggers();
  const observer = new MutationObserver(() => {
    bindTriggers();
  });
  observer.observe(options.root, { childList: true, subtree: true });

  const refresh = async () => {
    await prefillAnswers(options);
    updateProgress(options.root, options.onProgress);
    bindTriggers();
  };

  return {
    destroy: () => {
      observer.disconnect();
      triggerHandlers.forEach((handler, trigger) => {
        trigger.removeEventListener('click', handler);
      });
      triggerHandlers.clear();
      options.root.dataset.textdokumentRuntime = '';
      closeActiveModal();
    },
    refresh
  };
}
