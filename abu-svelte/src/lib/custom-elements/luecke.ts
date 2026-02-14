export type LueckeProgress = {
  percent: number;
  answered: number;
  total: number;
};

export type LueckeRuntimeOptions = {
  root: HTMLElement;
  apiBaseUrl: string;
  sheetKey: string;
  user: string;
  classroom?: string | number | null;
  onProgress?: (progress: LueckeProgress) => void;
};

const STOPWORTER_DE = new Set([
  'der',
  'die',
  'das',
  'dem',
  'den',
  'des',
  'ein',
  'eine',
  'einer',
  'einem',
  'eines',
  'zum',
  'zur',
  'im',
  'in',
  'am',
  'an',
  'und',
  'oder',
  'vom',
  'von',
  'zu',
  'mit',
  'fuer',
  'auf',
  'ueber',
  'unter',
  'nach',
  'bei',
  'aus',
  'als'
]);

function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\u00e4/g, 'ae')
    .replace(/\u00f6/g, 'oe')
    .replace(/\u00fc/g, 'ue')
    .replace(/\u00df/g, 'ss')
    .replace(/[()\[\]{}.,;:!?"'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((wort) => !STOPWORTER_DE.has(wort));
}

function isRoughlyCorrect(answer: string, solution: string): boolean {
  const answerTokens = normalizeText(answer);
  const solutionTokens = normalizeText(solution);

  if (!answerTokens.length || !solutionTokens.length) return false;

  let overlap = 0;
  answerTokens.forEach((token) => {
    if (solutionTokens.includes(token)) overlap++;
  });

  const coverage = overlap / answerTokens.length;
  return coverage >= 0.8;
}

function isInAcceptedList(answer: string, input: HTMLInputElement | null): boolean {
  if (!input || !input.dataset || !input.dataset.accepted) return false;

  const normalized = answer.toLowerCase();
  const entries = input.dataset.accepted
    .split(';')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (!entries.length) return false;
  return entries.some((entry) => normalized.includes(entry));
}

function classificationInfo(value: unknown, labelHint?: string | null): {
  score: number | null;
  label: 'RICHTIG' | 'TEILWEISE' | 'FALSCH' | null;
} {
  let score: number | null = null;
  let label: 'RICHTIG' | 'TEILWEISE' | 'FALSCH' | null = null;

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
    if (upper === 'RICHTIG') {
      score = 1000;
      label = 'RICHTIG';
    } else if (upper === 'TEILWEISE') {
      score = 500;
      label = 'TEILWEISE';
    } else if (upper === 'FALSCH') {
      score = 0;
      label = 'FALSCH';
    }
  }

  return { score, label };
}

function buildLueckentext(root: HTMLElement): string {
  const blocks = Array.from(root.querySelectorAll('p, li'));
  const elements = blocks.length ? blocks : [root];

  function getTextWithInputs(element: Element): string {
    const extract = (node: ChildNode): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? '';
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const el = node as HTMLElement;
      const tag = el.tagName;
      if (tag === 'INPUT') {
        const value = (el as HTMLInputElement).value.trim();
        return value || '____';
      }
      if (tag === 'LUECKE-GAP' || tag === 'LUECKE-GAP-WIDE') {
        const gapInput = el.querySelector('input.luecke') as HTMLInputElement | null;
        const value = gapInput?.value?.trim() || '';
        return value || '____';
      }

      let buffer = '';
      el.childNodes.forEach((child) => {
        buffer += extract(child);
      });
      return buffer;
    };

    let result = '';
    element.childNodes.forEach((node) => {
      result += extract(node);
    });
    return result.trim();
  }

  return elements.map(getTextWithInputs).filter(Boolean).join('\n\n');
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
  } catch (err) {
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
  feedback.classList.remove('feedback--visible', 'feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
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
  input: HTMLInputElement | null,
  button: HTMLButtonElement | null,
  feedback: HTMLElement | null,
  label: 'RICHTIG' | 'TEILWEISE' | 'FALSCH' | null
): void {
  if (input) {
    input.classList.remove('luecke--richtig', 'luecke--teilweise', 'luecke--falsch');
  }
  if (button) {
    button.classList.remove(
      'check-btn--richtig',
      'check-btn--teilweise',
      'check-btn--falsch',
      'check-btn--loading'
    );
  }
  if (feedback) {
    feedback.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
  }

  if (!label) {
    if (input) input.disabled = false;
    if (button) button.disabled = false;
    return;
  }

  if (label === 'RICHTIG') {
    input?.classList.add('luecke--richtig');
    button?.classList.add('check-btn--richtig');
    feedback?.classList.add('feedback--richtig');
    if (input) input.disabled = true;
    if (button) button.disabled = true;
  } else if (label === 'TEILWEISE') {
    input?.classList.add('luecke--teilweise');
    button?.classList.add('check-btn--teilweise');
    feedback?.classList.add('feedback--teilweise');
    if (input) input.disabled = false;
    if (button) button.disabled = false;
  } else if (label === 'FALSCH') {
    input?.classList.add('luecke--falsch');
    button?.classList.add('check-btn--falsch');
    feedback?.classList.add('feedback--falsch');
    if (input) input.disabled = false;
    if (button) button.disabled = false;
  }
}

function updateProgress(root: HTMLElement, onProgress?: (progress: LueckeProgress) => void): LueckeProgress {
  const inputs = Array.from(root.querySelectorAll('input.luecke')) as HTMLInputElement[];
  const total = inputs.length;
  let sum = 0;
  let answered = 0;

  inputs.forEach((input) => {
    if (input.value.trim()) answered++;
    if (input.classList.contains('luecke--richtig')) sum += 1000;
    else if (input.classList.contains('luecke--teilweise')) sum += 500;
  });

  const percent = total ? Math.round((sum / (total * 1000)) * 100) : 0;
  const progress = { percent, answered, total };
  if (onProgress) onProgress(progress);
  return progress;
}

export function ensureLueckeElements(): void {
  if (customElements.get('luecke-gap')) return;

  class LueckeGap extends HTMLElement {
    connectedCallback() {
      if (this.dataset.upgraded === '1') return;
      this.dataset.upgraded = '1';

      const nameAttr = this.getAttribute('name') || `luecke-${Math.random().toString(36).slice(2)}`;
      this.setAttribute('name', nameAttr);

      const solutionText = (this.textContent || '').trim();
      const acceptedExtra = this.getAttribute('data-accepted') || '';

      this.innerHTML = '';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'luecke';
      input.name = nameAttr;
      input.dataset.solution = solutionText;
      if (acceptedExtra) {
        input.dataset.accepted = acceptedExtra;
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'check-btn ci-btn-primary';
      button.setAttribute('data-target', nameAttr);
      button.setAttribute('aria-label', 'Antwort pruefen');

      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        button.click();
      });

      const feedback = document.createElement('div');
      feedback.className = 'feedback';

      this.appendChild(input);
      this.appendChild(button);
      this.appendChild(feedback);
    }
  }

  class LueckeGapWide extends LueckeGap {}

  customElements.define('luecke-gap', LueckeGap);
  customElements.define('luecke-gap-wide', LueckeGapWide);
}

async function prefillAnswers(options: LueckeRuntimeOptions): Promise<void> {
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
      const input = Array.from(root.querySelectorAll('input.luecke')).find(
        (el) => (el as HTMLInputElement).name === key
      ) as HTMLInputElement | undefined;
      if (!input) return;

      if (!input.value) {
        input.value = entry.value || '';
      }
      input.title = input.value || '';

      const { label } = classificationInfo(entry.classification, entry.classification_label);
      const button = input.parentElement?.querySelector('.check-btn') as HTMLButtonElement | null;
      const feedback = input.parentElement?.querySelector('.feedback') as HTMLElement | null;
      clearFeedback(feedback);
      setClasses(input, button, feedback, label);
    });
  } catch {
    // ignore prefill errors
  }
}

async function checkGap(
  button: HTMLButtonElement,
  options: LueckeRuntimeOptions
): Promise<void> {
  if (button.dataset.lueckeBusy === '1') return;
  button.dataset.lueckeBusy = '1';
  const wrapper = button.closest('luecke-gap, luecke-gap-wide') as HTMLElement | null;
  const input = wrapper?.querySelector('input.luecke') as HTMLInputElement | null;
  const feedback = wrapper?.querySelector('.feedback') as HTMLElement | null;

  if (!input || !feedback) {
    button.dataset.lueckeBusy = '';
    return;
  }

  const answer = input.value.trim();
  if (!answer) {
    setClasses(input, button, feedback, null);
    showFeedback(feedback, 'Bitte zuerst eine Antwort in die Luecke schreiben.');
    button.dataset.lueckeBusy = '';
    return;
  }

  feedback.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
  showFeedback(feedback, 'Ueberpruefung laeuft...');
  button.classList.add('check-btn--loading');
  button.disabled = true;

  const lueckentext = buildLueckentext(options.root);
  const musterloesung = input.dataset.solution || '';

  const backendResponse = await sendAnswerToBackend(options.apiBaseUrl, {
    key: input.name,
    sheet: options.sheetKey,
    user: options.user,
    value: answer,
    ...(options.classroom ? { classroom: String(options.classroom) } : {}),
    lueckentext,
    musterloesung
  });

  const backendError = (backendResponse && (backendResponse.error || backendResponse.warning)) || null;
  if (backendError) {
    button.classList.remove('check-btn--loading');
    button.disabled = false;
    feedback.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
    showFeedback(feedback, backendError);
    button.dataset.lueckeBusy = '';
    return;
  }

  const chatgpt = backendResponse?.data?.chatgpt;
  const chatgptError = chatgpt && chatgpt.error ? String(chatgpt.error) : '';

  const rawText =
    (chatgpt && (chatgpt.raw || chatgpt.explanation)) ||
    (chatgptError ? chatgptError : 'Keine Rueckmeldung erhalten.');
  const info = classificationInfo(chatgpt?.classification, chatgpt?.classification_label);
  let label = info.label;
  let explanation = chatgpt?.explanation || rawText;
  let overrideByAccepted = false;
  let overrideByRough = false;

  if (isInAcceptedList(answer, input)) {
    label = 'RICHTIG';
    overrideByAccepted = true;
  }

  if (isRoughlyCorrect(answer, musterloesung) && label !== 'RICHTIG') {
    label = 'RICHTIG';
    overrideByRough = true;
  }

  if (label === 'RICHTIG') {
    const explLower = (explanation || '').toLowerCase();
    const soundsNegative =
      explLower.includes('passt nicht') ||
      explLower.includes('falsch') ||
      explLower.includes('nicht korrekt') ||
      explLower.includes('stimmt nicht');

    if (overrideByAccepted || overrideByRough || soundsNegative) {
      explanation = 'Korrekt. Deine Antwort ist in diesem Kontext inhaltlich passend.';
    }
  }

  input.title = answer;
  showFeedback(feedback, explanation);

  setClasses(input, button, feedback, label);
  updateProgress(options.root, options.onProgress);
  button.dataset.lueckeBusy = '';
}

export function createLueckeRuntime(options: LueckeRuntimeOptions): {
  destroy: () => void;
  refresh: () => Promise<void>;
} {
  ensureLueckeElements();
  bindOutsideClickHide();

  const bindButtons = () => {
    const buttons = Array.from(options.root.querySelectorAll('button.check-btn')) as HTMLButtonElement[];
    buttons.forEach((btn) => {
      if (btn.dataset.lueckeBound === '1') return;
      btn.dataset.lueckeBound = '1';
      btn.addEventListener('click', () => {
        void checkGap(btn, options);
      });
    });
  };

  options.root.dataset.lueckeRuntime = '1';
  bindButtons();
  const observer = new MutationObserver(() => {
    bindButtons();
  });
  observer.observe(options.root, { childList: true, subtree: true });

  const refresh = async () => {
    await prefillAnswers(options);
    updateProgress(options.root, options.onProgress);
    bindButtons();
  };

  return {
    destroy: () => {
      observer.disconnect();
      options.root.dataset.lueckeRuntime = '';
    },
    refresh
  };
}
