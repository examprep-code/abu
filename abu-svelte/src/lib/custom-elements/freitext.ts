export type FreitextProgress = {
  percent: number;
  answered: number;
  total: number;
};

export type FreitextCriterion = {
  id: string;
  label: string;
  description: string;
};

export type FreitextPremise = {
  id: string;
  label: string;
  description: string;
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
  'Optional: Was soll beim Pruefen besonders beachtet werden?';

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
  try {
    const resp = await fetch(`${apiBaseUrl}answer`, {
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
      return { error: warn || `Fehler im Backend (${resp.status})` };
    }

    return parsed;
  } catch {
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
    return requiredPremises.every((input) => input.value.trim() !== '');
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
      const label =
        entry.getAttribute('label') ||
        entry.getAttribute('title') ||
        entry.getAttribute('name') ||
        `Teil ${index + 1}`;
      const description = (entry.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        id: normalizeCriterionId(entry.getAttribute('key') || label, index),
        label: String(label).trim(),
        description
      };
    })
    .filter((entry) => entry.label !== '');
}

function normalizePremiseType(value = ''): string {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'number' || type === 'url' || type === 'date' || type === 'email') return type;
  return 'text';
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
      'freitext-praemisse, freitext-premise, freitext-wert, freitext-value'
    )
  );

  return premiseNodes
    .map((entry, index) => {
      const label =
        entry.getAttribute('label') ||
        entry.getAttribute('title') ||
        entry.getAttribute('name') ||
        entry.getAttribute('key') ||
        `Wert ${index + 1}`;
      const sourceUrl =
        entry.getAttribute('source') ||
        entry.getAttribute('href') ||
        entry.getAttribute('url') ||
        '';
      const sourceLabel =
        entry.getAttribute('source-label') ||
        entry.getAttribute('link-label') ||
        (sourceUrl ? 'Quelle oeffnen' : '');
      const description = (entry.textContent || '').replace(/\s+/g, ' ').trim();

      return {
        id: normalizeCriterionId(
          entry.getAttribute('key') || entry.getAttribute('name') || label,
          index
        ),
        label: String(label).trim(),
        description,
        type: normalizePremiseType(entry.getAttribute('type') || ''),
        sourceUrl: String(sourceUrl).trim(),
        sourceLabel: String(sourceLabel).trim(),
        required: parseRequiredAttribute(entry)
      };
    })
    .filter((entry) => entry.label !== '');
}

function getFreitextInstructionHtml(block: HTMLElement | null): string {
  if (!block) return '';
  const instruction = block.querySelector(FREITEXT_INSTRUCTION_SELECTOR);
  return (instruction?.innerHTML || '').trim();
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
      const placeholder =
        this.getAttribute('placeholder') || 'Schreibe deinen Text hier...';
      const rowsAttr = Number(this.getAttribute('rows') || 0);
      const rows = Number.isFinite(rowsAttr) && rowsAttr > 0 ? Math.floor(rowsAttr) : 10;
      const minLength = (this.getAttribute('min-length') || '').trim();
      const maxLength = (this.getAttribute('max-length') || '').trim();
      const criteria = parseFreitextCriteria(this);
      const premises = parseFreitextPremises(this);

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
        textarea.dataset.task =
          task || textFromHtml(instructionHtml) || textarea.dataset.task || '';
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
        button.setAttribute('aria-label', 'Aktuellen Stand pruefen');
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
        questionField.setAttribute('aria-label', 'Zusatzfrage zur Pruefung');
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
          premiseLabel.textContent = 'Praemissen';
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
              link.textContent = premise.sourceLabel || 'Quelle oeffnen';
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
      button.setAttribute('aria-label', 'Aktuellen Stand pruefen');
      actionRow.appendChild(button);
      bindTextFieldShortcut(textarea, button);

      const questionField = document.createElement('input');
      questionField.type = 'text';
      questionField.className = 'freitext__question-field';
      questionField.placeholder = FREITEXT_QUESTION_PLACEHOLDER;
      questionField.setAttribute('aria-label', 'Zusatzfrage zur Pruefung');
      actionRow.appendChild(questionField);
      bindTextFieldShortcut(questionField, button);

      wrapper.appendChild(actionRow);

      const feedback = document.createElement('div');
      feedback.className = 'feedback';
      wrapper.appendChild(feedback);

      this.appendChild(wrapper);
    }
  }

  customElements.define('freitext-block', FreitextBlock);
}

function parseStoredFreitextValue(rawValue: unknown): {
  answer: string;
  premiseValues: Record<string, string>;
} {
  const raw = String(rawValue || '');
  if (!raw.trim().startsWith('{')) {
    return { answer: raw, premiseValues: {} };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { answer: raw, premiseValues: {} };
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
    return { answer, premiseValues };
  } catch {
    return { answer: raw, premiseValues: {} };
  }
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

    Object.entries(latestByKey).forEach(([key, entry]) => {
      const textarea = Array.from(
        root.querySelectorAll<HTMLTextAreaElement>('textarea.freitext__textarea')
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
      clearFeedback(feedback);
      setClasses(textarea, button, feedback, label);
    });
  } catch {
    // ignore
  }
}

function criteriaText(criteria: FreitextCriterion[]): string {
  if (!criteria.length) return '';
  return criteria
    .map((criterion, index) => {
      const detail = criterion.description ? `: ${criterion.description}` : '';
      return `${index + 1}. ${criterion.label}${detail}`;
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
      if (premise.sourceUrl) parts.push(`Quelle: ${premise.sourceUrl}`);
      const learnerValue = String(values[premise.id] || '').trim();
      parts.push(`Eingabe Lernende: ${learnerValue !== '' ? learnerValue : '[fehlt]'}`);
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
  const additionalQuestion = questionField?.value.trim() || '';
  const missingPremise = findMissingPremise(premises, premiseValues);
  if (missingPremise) {
    notifySaveState(options, 'error', `Bitte zuerst "${missingPremise.label}" ausfuellen.`);
    setClasses(textarea, button, feedback, null);
    button.classList.remove('check-btn--loading');
    button.disabled = false;
    showFeedback(feedback, `Bitte zuerst "${missingPremise.label}" ausfuellen.`);
    button.dataset.freitextBusy = '';
    return;
  }

  const hasPremiseValue = Object.values(premiseValues).some(
    (value) => String(value || '').trim() !== ''
  );
  if (!answer && (!premises.length || !hasPremiseValue)) {
    const message = premises.length
      ? 'Bitte zuerst Praemissen ausfuellen oder einen Text schreiben.'
      : 'Bitte zuerst einen Text schreiben.';
    notifySaveState(options, 'error', message);
    setClasses(textarea, button, feedback, null);
    showFeedback(feedback, message);
    button.dataset.freitextBusy = '';
    return;
  }

  feedback.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
  showFeedback(feedback, 'Rueckmeldung wird erstellt...');
  button.classList.add('check-btn--loading');
  button.disabled = true;

  const backendResponse = await sendAnswerToBackend(options.apiBaseUrl, {
    key: textarea.name,
    sheet: options.sheetKey,
    user: options.user,
    value: buildStoredFreitextValue(answer, premises, premiseValues),
    answer_text: answer,
    ...(options.classroom ? { classroom: String(options.classroom) } : {}),
    exercise_type: 'freitext',
    task_prompt: textarea.dataset.task || '',
    title: textarea.dataset.title || '',
    criteria_text: criteriaText(criteria),
    additional_question: additionalQuestion,
    premises_text: premisesText(premises, premiseValues),
    premise_values_json: JSON.stringify(premiseValues),
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
    (chatgptError ? chatgptError : 'Keine Rueckmeldung erhalten.');

  const info = classificationInfo(chatgpt?.classification, chatgpt?.classification_label);
  setClasses(textarea, button, feedback, info.label);
  showFeedback(feedback, chatgpt?.explanation || rawText, true);

  button.classList.remove('check-btn--loading');
  button.disabled = false;
  updateProgress(options.root, options.onProgress);
  notifySaveState(options, 'saved');
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
      options.root.querySelectorAll('textarea.freitext__textarea')
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
      options.root.querySelectorAll<HTMLInputElement>('.freitext__premise-input')
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

  return {
    destroy: () => {
      observer.disconnect();
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
