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

export type FreitextReference = {
  id: string;
  label: string;
  sourceKey: string;
  sourceType: string;
  prompt: string;
  minClassification: number;
  required: boolean;
};

type FreitextReferenceSnapshot = {
  id: string;
  label: string;
  sourceKey: string;
  sourceType: string;
  prompt: string;
  value: string;
  sourceContext: Record<string, any> | null;
  classification: number | null;
  classificationLabel: ClassificationLabel;
  updatedAt: string;
  ready: boolean;
  required: boolean;
  minClassification: number;
};

export type FreitextRuntimeOptions = {
  root: HTMLElement;
  apiBaseUrl: string;
  sheetKey: string;
  user: string;
  classroom?: string | number | null;
  previewMode?: boolean;
  onProgress?: (progress: FreitextProgress) => void;
  onSaveState?: (event: {
    status: 'saving' | 'saved' | 'error';
    message?: string;
    at?: number;
  }) => void;
};

type ClassificationLabel = 'RICHTIG' | 'TEILWEISE' | 'FALSCH' | null;
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
  return options.previewMode ? { preview_mode: '1' } : {};
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

function showFeedback(feedback: HTMLElement, text: string, autoHide = false): void {
  feedback.textContent = text;
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
  const existing = feedbackTimers.get(feedback);
  if (existing) window.clearTimeout(existing);
  feedback.textContent = '';
  feedback.classList.remove(
    'feedback--visible',
    'feedback--richtig',
    'feedback--teilweise',
    'feedback--falsch'
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
      feedback.classList.remove('feedback--visible');
    });
  });
}

type AnswerEntry = Record<string, any>;

function answerTextFromEntry(entry: AnswerEntry | null | undefined): string {
  if (!entry) return '';
  const stored = parseStoredFreitextValue(entry.value || '');
  if (stored.answer) return stored.answer;
  return String(entry.value || '').trim();
}

function thresholdLabel(score: number): string {
  if (score >= 900) return 'richtig';
  if (score >= 101) return 'mindestens teilweise richtig';
  return 'eingetragen und geprüft';
}

function referenceReady(reference: FreitextReference, entry: AnswerEntry | null | undefined): boolean {
  const value = answerTextFromEntry(entry);
  if (!entry || value === '') return false;
  const sourceType = reference.sourceType.toLowerCase();
  if (sourceType === 'url' && !/^https?:\/\/\S+\.\S+/i.test(value)) return false;
  const { score } = classificationInfo(entry.classification, entry.classification_label);
  if (reference.minClassification <= 0) return true;
  return score !== null && score >= reference.minClassification;
}

function setReferenceLockState(block: HTMLElement, locked: boolean, message = ''): void {
  const textarea = block.querySelector('textarea.freitext__textarea') as HTMLTextAreaElement | null;
  const button = block.querySelector('button.check-btn') as HTMLButtonElement | null;
  const questionField = block.querySelector(
    '.freitext__question-field'
  ) as HTMLInputElement | HTMLTextAreaElement | null;
  const lockMessage = block.querySelector('.freitext__lock-message') as HTMLElement | null;

  block.classList.toggle('freitext-block--locked', locked);

  if (textarea) {
    if (!textarea.dataset.originalPlaceholder) {
      textarea.dataset.originalPlaceholder = textarea.placeholder || '';
    }
    textarea.disabled = locked;
    textarea.placeholder = locked
      ? 'Dieser Freitext wird nach der verknüpften Vorarbeit freigeschaltet.'
      : textarea.dataset.originalPlaceholder || 'Schreibe deinen Text hier...';
  }
  if (button) {
    button.disabled = locked || button.dataset.freitextBusy === '1';
  }
  if (questionField) {
    questionField.disabled = locked;
  }
  if (lockMessage) {
    lockMessage.textContent = locked ? message : '';
    lockMessage.hidden = !locked;
  }
}

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
    if (!textarea || textarea.value.trim() === '') return false;

    const requiredPremises = Array.from(
      block.querySelectorAll<HTMLInputElement>('.freitext__premise-input[data-required="1"]')
    );
    const requiredReferences = Array.from(
      block.querySelectorAll<HTMLElement>('.freitext__reference[data-required="1"]')
    );
    return (
      requiredPremises.every((input) => input.value.trim() !== '') &&
      requiredReferences.every((entry) => entry.dataset.ready === '1')
    );
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
      const internalDescription = (
        entry.getAttribute('internal-description') ||
        entry.getAttribute('data-internal-description') ||
        entry.getAttribute('internal') ||
        ''
      )
        .replace(/\s+/g, ' ')
        .trim();
      const key = (entry.getAttribute('key') || '').trim();
      if (!key && !String(rawLabel).trim() && !description && !internalDescription) return null;
      const label = String(rawLabel || `Teil ${index + 1}`).trim();
      return {
        id: normalizeCriterionId(key || label, index),
        label,
        description,
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

function parseMinClassification(value: string | null): number {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 900;
  if (raw === 'any' || raw === 'answered' || raw === 'eingetragen' || raw === 'vorhanden') return 0;
  if (raw === 'richtig' || raw === 'correct') return 900;
  if (raw === 'teilweise' || raw === 'partial') return 101;
  if (raw === 'falsch' || raw === 'false') return 0;
  const numeric = Number(raw);
  if (!Number.isNaN(numeric)) return Math.max(0, Math.min(1000, Math.floor(numeric)));
  return 900;
}

function referencePromptText(entry: Element): string {
  const promptNode = entry.querySelector('freitext-ref-prompt, freitext-reference-prompt');
  const prompt =
    entry.getAttribute('prompt') ||
    entry.getAttribute('instruction') ||
    promptNode?.textContent ||
    entry.textContent ||
    '';
  return prompt.replace(/\s+/g, ' ').trim();
}

function parseFreitextReferences(block: HTMLElement | null): FreitextReference[] {
  if (!block) return [];
  const referenceNodes = Array.from(
    block.querySelectorAll(
      'freitext-ref, freitext-reference, freitext-verknuepfung, freitext-abhaengigkeit'
    )
  );

  return referenceNodes
    .map((entry, index) => {
      const sourceKey = (
        entry.getAttribute('source-key') ||
        entry.getAttribute('answer-key') ||
        entry.getAttribute('source') ||
        entry.getAttribute('ref') ||
        entry.getAttribute('target') ||
        entry.getAttribute('key') ||
        ''
      ).trim();
      const label =
        entry.getAttribute('label') ||
        entry.getAttribute('title') ||
        entry.getAttribute('name') ||
        sourceKey ||
        `Referenz ${index + 1}`;
      const minClassification = parseMinClassification(
        entry.getAttribute('min-classification') ||
          entry.getAttribute('min-score') ||
          entry.getAttribute('threshold') ||
          entry.getAttribute('min')
      );

      return {
        id: normalizeCriterionId(
          entry.getAttribute('key') || entry.getAttribute('name') || sourceKey || label,
          index
        ),
        label: String(label).trim(),
        sourceKey,
        sourceType: (
          entry.getAttribute('type') ||
          entry.getAttribute('source-type') ||
          'answer'
        ).trim(),
        prompt: referencePromptText(entry),
        minClassification,
        required: parseRequiredAttribute(entry)
      };
    })
    .filter((entry) => entry.sourceKey !== '' && entry.label !== '');
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
        this.getAttribute('placeholder') || 'Schreibe deinen Text hier...';
      const rowsAttr = Number(this.getAttribute('rows') || 0);
      const rows = Number.isFinite(rowsAttr) && rowsAttr > 0 ? Math.floor(rowsAttr) : 10;
      const minLength = (this.getAttribute('min-length') || '').trim();
      const maxLength = (this.getAttribute('max-length') || '').trim();
      const criteria = parseFreitextCriteria(this);
      const premises = parseFreitextPremises(this);
      const references = parseFreitextReferences(this);

      const configureTextarea = (textarea: HTMLTextAreaElement): void => {
        textarea.className = 'freitext__textarea';
        textarea.name = nameAttr;
        textarea.rows = rows;
        textarea.placeholder = placeholder;
        textarea.disabled = false;
        textarea.dataset.criteria =
          criteria.length || !textarea.dataset.criteria
            ? JSON.stringify(criteria)
            : textarea.dataset.criteria;
        textarea.dataset.premises =
          premises.length || !textarea.dataset.premises
            ? JSON.stringify(premises)
            : textarea.dataset.premises;
        textarea.dataset.references =
          references.length || !textarea.dataset.references
            ? JSON.stringify(references)
            : textarea.dataset.references;
        textarea.dataset.task =
          task || textFromHtml(instructionHtml) || textarea.dataset.task || '';
        textarea.dataset.teacherPrompt = teacherPrompt || textarea.dataset.teacherPrompt || '';
        textarea.dataset.blockPrompt = blockPrompt || textarea.dataset.blockPrompt || '';
        textarea.dataset.title =
          title || titleFromInstructionHtml(instructionHtml) || textarea.dataset.title || '';
        if (minLength) textarea.dataset.minLength = minLength;
        if (maxLength) textarea.dataset.maxLength = maxLength;
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
        questionField.setAttribute('aria-label', 'Zusatzfrage zur Prüfung');
        actionRow.appendChild(questionField);
        if (questionWrap && !questionWrap.querySelector('.freitext__question-field')) {
          questionWrap.remove();
        }
        bindTextFieldShortcut(questionField, button);

        if (!this.querySelector('.feedback')) {
          const feedback = document.createElement('div');
          feedback.className = 'feedback';
          target.appendChild(feedback);
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
        references.length ||
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
            const field = document.createElement('label');
            field.className = 'freitext__premise';

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

            field.appendChild(inputRow);
            premiseGrid.appendChild(field);
          });

          premiseWrap.appendChild(premiseGrid);
          intro.appendChild(premiseWrap);
        }

        if (references.length) {
          const referenceWrap = document.createElement('div');
          referenceWrap.className = 'freitext__references-wrap';

          const referenceLabel = document.createElement('strong');
          referenceLabel.className = 'freitext__criteria-label';
          referenceLabel.textContent = 'Verknüpfungen';
          referenceWrap.appendChild(referenceLabel);

          const referenceGrid = document.createElement('div');
          referenceGrid.className = 'freitext__references';

          references.forEach((reference) => {
            const item = document.createElement('div');
            item.className = 'freitext__reference';
            item.dataset.referenceId = reference.id;
            item.dataset.sourceKey = reference.sourceKey;
            item.dataset.required = reference.required ? '1' : '0';
            item.dataset.minClassification = String(reference.minClassification);
            item.dataset.ready = '0';

            const labelEl = document.createElement('span');
            labelEl.className = 'freitext__reference-label';
            labelEl.textContent = reference.label;
            item.appendChild(labelEl);

            const body = document.createElement('span');
            body.className = 'freitext__reference-body';

            if (reference.prompt) {
              const promptEl = document.createElement('span');
              promptEl.className = 'freitext__reference-prompt';
              promptEl.textContent = reference.prompt;
              body.appendChild(promptEl);
            }

            const statusEl = document.createElement('span');
            statusEl.className = 'freitext__reference-status';
            statusEl.textContent = `Wartet auf ${thresholdLabel(reference.minClassification)}.`;
            body.appendChild(statusEl);

            item.appendChild(body);
            referenceGrid.appendChild(item);
          });

          referenceWrap.appendChild(referenceGrid);
          intro.appendChild(referenceWrap);
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

      const lockMessage = document.createElement('p');
      lockMessage.className = 'freitext__lock-message';
      lockMessage.hidden = true;
      wrapper.appendChild(lockMessage);

      const feedback = document.createElement('div');
      feedback.className = 'feedback';
      wrapper.appendChild(feedback);

      this.appendChild(wrapper);
      if (references.some((reference) => reference.required)) {
        setReferenceLockState(
          this,
          true,
          `Freigeschaltet, sobald "${references[0].label}" ${thresholdLabel(
            references[0].minClassification
          )} ist.`
        );
      }
    }
  }

  customElements.define('freitext-block', FreitextBlock);
}

function parseStoredFreitextValue(rawValue: unknown): {
  answer: string;
  premiseValues: Record<string, string>;
  sourceContext: Record<string, any> | null;
} {
  const raw = String(rawValue || '');
  if (!raw.trim().startsWith('{')) {
    return { answer: raw, premiseValues: {}, sourceContext: null };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { answer: raw, premiseValues: {}, sourceContext: null };
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
    let sourceContext =
      parsed.source_context && typeof parsed.source_context === 'object'
        ? (parsed.source_context as Record<string, any>)
        : null;
    if (!sourceContext && Array.isArray(parsed.references)) {
      const referenceContexts = parsed.references
        .map((reference: Record<string, any>) => ({
          id: reference.id,
          label: reference.label,
          sourceKey: reference.sourceKey || reference.source_key,
          value: reference.value,
          sourceContext: reference.sourceContext || reference.source_context || null
        }))
        .filter((reference: Record<string, any>) => reference.sourceContext);
      if (referenceContexts.length) {
        sourceContext = { references: referenceContexts };
      }
    }
    return { answer, premiseValues, sourceContext };
  } catch {
    return { answer: raw, premiseValues: {}, sourceContext: null };
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

function readReferencesFromTextarea(textarea: HTMLTextAreaElement | null): FreitextReference[] {
  if (!textarea) return [];
  try {
    const parsed = JSON.parse(textarea.dataset.references || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function referenceSnapshot(
  reference: FreitextReference,
  latestByKey: Record<string, AnswerEntry>
): FreitextReferenceSnapshot {
  const entry = latestByKey[reference.sourceKey];
  const stored = parseStoredFreitextValue(entry?.value || '');
  const { score, label } = classificationInfo(entry?.classification, entry?.classification_label);
  return {
    id: reference.id,
    label: reference.label,
    sourceKey: reference.sourceKey,
    sourceType: reference.sourceType,
    prompt: reference.prompt,
    value: stored.answer || answerTextFromEntry(entry),
    sourceContext: stored.sourceContext,
    classification: score,
    classificationLabel: label,
    updatedAt: String(entry?.updated_at || ''),
    ready: referenceReady(reference, entry),
    required: reference.required,
    minClassification: reference.minClassification
  };
}

function collectReferenceSnapshots(
  references: FreitextReference[],
  latestByKey: Record<string, AnswerEntry>
): FreitextReferenceSnapshot[] {
  return references.map((reference) => referenceSnapshot(reference, latestByKey));
}

function updateReferenceStates(
  root: HTMLElement,
  latestByKey: Record<string, AnswerEntry>
): void {
  const blocks = Array.from(root.querySelectorAll('freitext-block')) as HTMLElement[];
  blocks.forEach((block) => {
    const textarea = block.querySelector('textarea.freitext__textarea') as HTMLTextAreaElement | null;
    const references = readReferencesFromTextarea(textarea);
    if (!references.length) return;

    const snapshots = collectReferenceSnapshots(references, latestByKey);
    snapshots.forEach((snapshot) => {
      const item = Array.from(block.querySelectorAll<HTMLElement>('.freitext__reference')).find(
        (entry) => entry.dataset.referenceId === snapshot.id
      );
      if (!item) return;
      item.dataset.ready = snapshot.ready ? '1' : '0';
      item.dataset.value = snapshot.value;
      item.dataset.sourceContext = snapshot.sourceContext
        ? JSON.stringify(snapshot.sourceContext)
        : '';
      item.dataset.classification = snapshot.classification !== null ? String(snapshot.classification) : '';
      item.dataset.classificationLabel = snapshot.classificationLabel || '';
      item.dataset.updatedAt = snapshot.updatedAt;
      item.classList.toggle('freitext__reference--ready', snapshot.ready);
      item.classList.toggle('freitext__reference--missing', !snapshot.ready);

      const status = item.querySelector('.freitext__reference-status') as HTMLElement | null;
      if (status) {
        const label = snapshot.classificationLabel
          ? snapshot.classificationLabel.toLowerCase()
          : snapshot.value
          ? 'eingetragen'
          : 'fehlt';
        status.textContent = snapshot.ready
          ? `Bereit: ${label}.`
          : `Wartet auf ${thresholdLabel(snapshot.minClassification)}.`;
      }
    });

    const missing = snapshots.find((snapshot) => snapshot.required && !snapshot.ready);
    setReferenceLockState(
      block,
      Boolean(missing),
      missing
        ? `Freigeschaltet, sobald "${missing.label}" ${thresholdLabel(
            missing.minClassification
          )} ist.`
        : ''
    );
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
      if (!textarea.value) {
        textarea.value = stored.answer || '';
      }
      Object.entries(stored.premiseValues).forEach(([premiseId, value]) => {
        const input = Array.from(
          wrapper?.querySelectorAll<HTMLInputElement>('.freitext__premise-input') ?? []
        ).find((field) => field.dataset.premiseId === premiseId);
        if (input && !input.value) input.value = value;
      });

      const { label } = classificationInfo(entry.classification, entry.classification_label);
      const button = wrapper?.querySelector('.check-btn') as HTMLButtonElement | null;
      const feedback = wrapper?.querySelector('.feedback') as HTMLElement | null;
      setClasses(textarea, button, feedback, label);
    });
    updateReferenceStates(root, latestByKey);
    await saveReferenceSnapshots(options, latestByKey);
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
  return values;
}

function findMissingPremise(
  premises: FreitextPremise[],
  values: Record<string, string>
): FreitextPremise | null {
  return (
    premises.find((premise) => premise.required && !String(values[premise.id] || '').trim()) ||
    null
  );
}

function premisesText(premises: FreitextPremise[], values: Record<string, string>): string {
  if (!premises.length) return '';
  return premises
    .map((premise, index) => {
      const parts = [`${index + 1}. ${premise.label}`];
      if (premise.description) parts.push(`KI-Hinweis: ${premise.description}`);
      if (premise.sourceKey) {
        parts.push(
          `Verknüpftes Eingabeelement: ${premise.sourceKey}${
            premise.sourceType ? ` (${premise.sourceType})` : ''
          }`
        );
      }
      if (premise.sourceUrl) parts.push(`Quelle: ${premise.sourceUrl}`);
      const learnerValue = String(values[premise.id] || '').trim();
      parts.push(`Eingabe Lernende: ${learnerValue !== '' ? learnerValue : '[fehlt]'}`);
      parts.push(`Pflichtfeld: ${premise.required ? 'ja' : 'nein'}`);
      return parts.join(' | ');
    })
    .join('\n');
}

function referencesText(snapshots: FreitextReferenceSnapshot[]): string {
  if (!snapshots.length) return '';
  return snapshots
    .map((snapshot, index) => {
      const parts = [`${index + 1}. ${snapshot.label}`];
      parts.push(`Referenzschlüssel: ${snapshot.sourceKey}`);
      if (snapshot.prompt) parts.push(`KI-Hinweis: ${snapshot.prompt}`);
      parts.push(`Schwelle: ${thresholdLabel(snapshot.minClassification)}`);
      const state = snapshot.classificationLabel
        ? snapshot.classificationLabel
        : snapshot.value
        ? 'eingetragen, noch ohne KI-Klassifizierung'
        : 'fehlt';
      parts.push(`Status Vorarbeit: ${state}`);
      parts.push(`Vorarbeit bereit: ${snapshot.ready ? 'ja' : 'nein'}`);
      parts.push(`Gespeicherte Vorarbeit: ${snapshot.value !== '' ? snapshot.value : '[fehlt]'}`);
      const sourceContext = referenceSourceContextText(snapshot.sourceContext);
      if (sourceContext) parts.push(`Extrahierter Inseratskontext: ${sourceContext}`);
      return parts.join(' | ');
    })
    .join('\n');
}

function referenceSourceContextText(sourceContext: Record<string, any> | null | undefined): string {
  if (!sourceContext || typeof sourceContext !== 'object') return '';
  const facts =
    sourceContext.facts && typeof sourceContext.facts === 'object'
      ? (sourceContext.facts as Record<string, any>)
      : {};
  const parts: string[] = [];

  const add = (label: string, value: unknown, suffix = '') => {
    const text = Array.isArray(value) ? value.join(', ') : String(value ?? '').trim();
    if (text) parts.push(`${label}: ${text}${suffix}`);
  };

  add('Titel', facts.title || sourceContext.title);
  add('Adresse', facts.address || sourceContext.address);
  add('Zimmer', facts.rooms || sourceContext.rooms);
  add('Wohnfläche', facts.living_area_m2 || sourceContext.living_area_m2, ' m2');
  add('Miete', facts.rent_chf || sourceContext.rent_chf, ' CHF');
  add('Etage', facts.floor || sourceContext.floor);
  add('Baujahr', facts.year_built || sourceContext.year_built);
  add('Merkmale', facts.features || sourceContext.features);

  const quality = String(sourceContext.extraction_quality || '').trim();
  const allowFlexible =
    sourceContext.allow_flexible_followup === true ||
    sourceContext.allow_flexible_followup === '1';
  if (quality) {
    add('Extraktionsqualität', quality);
  }
  if (allowFlexible) {
    add(
      'Fallback',
      sourceContext.fallback_reason ||
        'Inserat konnte nicht ausreichend automatisch gelesen werden; Folgeantworten freier bewerten'
    );
  }

  if (Array.isArray(sourceContext.references)) {
    sourceContext.references.forEach((reference: Record<string, any>) => {
      const nestedContext = reference.sourceContext || reference.source_context || null;
      const nestedText = referenceSourceContextText(nestedContext);
      const label = String(reference.label || reference.sourceKey || 'Referenz').trim();
      if (nestedText) parts.push(`${label}: ${nestedText}`);
    });
  }

  if (!parts.length && sourceContext.summary) {
    add('Zusammenfassung', sourceContext.summary);
  }
  if (!parts.length && sourceContext.excerpt) {
    add('Auszug', String(sourceContext.excerpt).slice(0, 500));
  }
  return parts.join('; ');
}

function parseReferenceSourceContext(rawValue: string): Record<string, any> | null {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : null;
  } catch {
    return null;
  }
}

function buildStoredFreitextValue(
  answer: string,
  premises: FreitextPremise[],
  values: Record<string, string>,
  referenceSnapshots: FreitextReferenceSnapshot[] = []
): string {
  if (!premises.length && !referenceSnapshots.length) return answer;
  return JSON.stringify({
    type: 'freitext',
    version: referenceSnapshots.length ? 2 : 1,
    answer,
    premise_values: values,
    references: referenceSnapshots
  });
}

async function saveReferenceSnapshots(
  options: FreitextRuntimeOptions,
  latestByKey: Record<string, AnswerEntry>
): Promise<void> {
  const blocks = Array.from(options.root.querySelectorAll('freitext-block')) as HTMLElement[];
  await Promise.all(
    blocks.map(async (block) => {
      const textarea = block.querySelector(
        'textarea.freitext__textarea'
      ) as HTMLTextAreaElement | null;
      if (!textarea) return;

      const references = readReferencesFromTextarea(textarea);
      if (!references.length) return;

      const snapshots = collectReferenceSnapshots(references, latestByKey);
      if (!snapshots.some((snapshot) => snapshot.value !== '' || snapshot.updatedAt !== '')) return;

      let premises: FreitextPremise[] = [];
      try {
        premises = JSON.parse(textarea.dataset.premises || '[]');
      } catch {
        premises = [];
      }

      const premiseValues = collectPremiseValues(block);
      const answer = textarea.value.trim();
      const signature = JSON.stringify({ answer, premiseValues, snapshots });
      if (textarea.dataset.referenceSnapshotSignature === signature) return;
      textarea.dataset.referenceSnapshotSignature = signature;

      const existing = latestByKey[textarea.name];
      const { score } = classificationInfo(existing?.classification, existing?.classification_label);
      const payload: Record<string, string> = {
        key: textarea.name,
        sheet: options.sheetKey,
        user: options.user,
        value: buildStoredFreitextValue(answer, premises, premiseValues, snapshots),
        save_only: '1',
        ...previewPayload(options)
      };
      if (options.classroom) payload.classroom = String(options.classroom);
      if (score !== null) payload.classification = String(score);

      const response = await sendAnswerToBackend(options.apiBaseUrl, payload);
      if (response?.error || response?.warning) {
        textarea.dataset.referenceSnapshotSignature = '';
      }
    })
  );
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

  const references = readReferencesFromTextarea(textarea);
  const referenceSnapshots = references.map((reference) => {
    const item = Array.from(
      wrapper?.querySelectorAll<HTMLElement>('.freitext__reference') ?? []
    ).find((entry) => entry.dataset.referenceId === reference.id);
    return {
      id: reference.id,
      label: reference.label,
      sourceKey: reference.sourceKey,
      sourceType: reference.sourceType,
      prompt: reference.prompt,
      value: item?.dataset.value || '',
      sourceContext: parseReferenceSourceContext(item?.dataset.sourceContext || ''),
      classification:
        item?.dataset.classification && !Number.isNaN(Number(item.dataset.classification))
          ? Number(item.dataset.classification)
          : null,
      classificationLabel: (item?.dataset.classificationLabel || null) as ClassificationLabel,
      updatedAt: item?.dataset.updatedAt || '',
      ready: item?.dataset.ready === '1',
      required: reference.required,
      minClassification: reference.minClassification
    };
  });

  const premiseValues = collectPremiseValues(wrapper);
  const additionalQuestion = questionField?.value.trim() || '';
  const missingReference = referenceSnapshots.find(
    (snapshot) => snapshot.required && !snapshot.ready
  );
  if (missingReference) {
    const message = `Bitte zuerst "${missingReference.label}" ${thresholdLabel(
      missingReference.minClassification
    )} abschliessen.`;
    notifySaveState(options, 'error', message);
    setClasses(textarea, button, feedback, null);
    button.classList.remove('check-btn--loading');
    button.disabled = false;
    showFeedback(feedback, message);
    button.dataset.freitextBusy = '';
    return;
  }
  const missingPremise = findMissingPremise(premises, premiseValues);
  if (missingPremise) {
    notifySaveState(options, 'error', `Bitte zuerst "${missingPremise.label}" ausfüllen.`);
    setClasses(textarea, button, feedback, null);
    button.classList.remove('check-btn--loading');
    button.disabled = false;
    showFeedback(feedback, `Bitte zuerst "${missingPremise.label}" ausfüllen.`);
    button.dataset.freitextBusy = '';
    return;
  }

  const hasPremiseValue = Object.values(premiseValues).some(
    (value) => String(value || '').trim() !== ''
  );
  if (!answer && (!premises.length || !hasPremiseValue)) {
    const message = premises.length
      ? 'Bitte zuerst Prämissen ausfüllen oder einen Text schreiben.'
      : 'Bitte zuerst einen Text schreiben.';
    notifySaveState(options, 'error', message);
    setClasses(textarea, button, feedback, null);
    showFeedback(feedback, message);
    button.dataset.freitextBusy = '';
    return;
  }

  feedback.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
  showFeedback(feedback, 'Rückmeldung wird erstellt...');
  button.classList.add('check-btn--loading');
  button.disabled = true;

  const backendResponse = await sendAnswerToBackend(options.apiBaseUrl, {
    key: textarea.name,
    sheet: options.sheetKey,
    user: options.user,
    value: buildStoredFreitextValue(answer, premises, premiseValues, referenceSnapshots),
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
    premises_text: [premisesText(premises, premiseValues), referencesText(referenceSnapshots)]
      .filter(Boolean)
      .join('\n\n'),
    premises_json: JSON.stringify(premises),
    premise_values_json: JSON.stringify(premiseValues),
    reference_snapshots_json: JSON.stringify(referenceSnapshots),
    min_length: textarea.dataset.minLength || '',
    max_length: textarea.dataset.maxLength || ''
  });

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

  const info = classificationInfo(chatgpt?.classification, chatgpt?.classification_label);
  setClasses(textarea, button, feedback, info.label);
  showFeedback(feedback, chatgpt?.explanation || rawText);

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
