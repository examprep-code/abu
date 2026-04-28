export type AntworttextRuntimeOptions = {
  root: HTMLElement;
  apiBaseUrl: string;
  sheetKey: string;
  user: string;
  classroom?: string | number | null;
  onSaveState?: (event: {
    status: 'saving' | 'saved' | 'error';
    message?: string;
    at?: number;
  }) => void;
};

function notifySaveState(
  options: AntworttextRuntimeOptions,
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
  label: 'RICHTIG' | 'TEILWEISE' | 'FALSCH' | null
): void {
  const buttonClasses = [
    'check-btn--richtig',
    'check-btn--teilweise',
    'check-btn--falsch',
    'check-btn--loading'
  ];
  button?.classList.remove(...buttonClasses);
  feedback?.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
  textarea?.classList.remove('antworttext--richtig', 'antworttext--teilweise', 'antworttext--falsch');

  if (label === 'RICHTIG') {
    button?.classList.add('check-btn--richtig');
    feedback?.classList.add('feedback--richtig');
    textarea?.classList.add('antworttext--richtig');
  } else if (label === 'TEILWEISE') {
    button?.classList.add('check-btn--teilweise');
    feedback?.classList.add('feedback--teilweise');
    textarea?.classList.add('antworttext--teilweise');
  } else if (label === 'FALSCH') {
    button?.classList.add('check-btn--falsch');
    feedback?.classList.add('feedback--falsch');
    textarea?.classList.add('antworttext--falsch');
  }
}

export function ensureAntworttextElements(): void {
  if (customElements.get('antworttext-block')) return;

  class AntworttextBlock extends HTMLElement {
    connectedCallback() {
      if (this.dataset.upgraded === '1') return;
      this.dataset.upgraded = '1';

      const nameAttr =
        this.getAttribute('name') || `antworttext-${Math.random().toString(36).slice(2)}`;
      this.setAttribute('name', nameAttr);

      const solutionText = (this.textContent || '').trim();
      const placeholder = this.getAttribute('placeholder') || '';
      const rowsAttr = Number(this.getAttribute('rows') || 0);
      const rows = Number.isFinite(rowsAttr) && rowsAttr > 0 ? Math.floor(rowsAttr) : 6;

      this.innerHTML = '';

      const textarea = document.createElement('textarea');
      textarea.className = 'antworttext';
      textarea.name = nameAttr;
      textarea.rows = rows;
      textarea.placeholder = placeholder;
      textarea.dataset.solution = solutionText;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'check-btn ci-btn-primary';
      button.setAttribute('data-target', nameAttr);
      button.setAttribute('aria-label', 'Antwort pruefen');

      textarea.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        if (!(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        button.click();
      });

      const feedback = document.createElement('div');
      feedback.className = 'feedback';

      this.appendChild(textarea);
      this.appendChild(button);
      this.appendChild(feedback);
    }
  }

  customElements.define('antworttext-block', AntworttextBlock);
}

async function prefillAnswers(options: AntworttextRuntimeOptions): Promise<void> {
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
        root.querySelectorAll<HTMLTextAreaElement>('textarea.antworttext')
      ).find((el) => el.name === key);
      if (!textarea) return;

      if (!textarea.value) {
        textarea.value = entry.value || '';
      }

      const { label } = classificationInfo(entry.classification, entry.classification_label);
      const wrapper = textarea.closest('antworttext-block') as HTMLElement | null;
      const button = wrapper?.querySelector('.check-btn') as HTMLButtonElement | null;
      const feedback = wrapper?.querySelector('.feedback') as HTMLElement | null;
      clearFeedback(feedback);
      setClasses(textarea, button, feedback, label);
    });
  } catch {
    // ignore
  }
}

async function checkAntworttext(
  button: HTMLButtonElement,
  options: AntworttextRuntimeOptions
): Promise<void> {
  if (button.dataset.antworttextBusy === '1') return;
  button.dataset.antworttextBusy = '1';

  const wrapper = button.closest('antworttext-block') as HTMLElement | null;
  const textarea = wrapper?.querySelector('textarea.antworttext') as HTMLTextAreaElement | null;
  const feedback = wrapper?.querySelector('.feedback') as HTMLElement | null;

  if (!textarea || !feedback) {
    notifySaveState(options, 'error', 'Eingabefeld nicht gefunden.');
    button.dataset.antworttextBusy = '';
    return;
  }

  const answer = textarea.value.trim();
  if (!answer) {
    notifySaveState(options, 'error', 'Bitte zuerst eine Antwort eingeben.');
    setClasses(textarea, button, feedback, null);
    showFeedback(feedback, 'Bitte zuerst eine Antwort schreiben.');
    button.dataset.antworttextBusy = '';
    return;
  }

  feedback.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
  showFeedback(feedback, 'Ueberpruefung laeuft...');
  button.classList.add('check-btn--loading');
  button.disabled = true;

  const musterloesung = textarea.dataset.solution || '';

  const backendResponse = await sendAnswerToBackend(options.apiBaseUrl, {
    key: textarea.name,
    sheet: options.sheetKey,
    user: options.user,
    value: answer,
    ...(options.classroom ? { classroom: String(options.classroom) } : {}),
    musterloesung
  });

  const backendError = (backendResponse && (backendResponse.error || backendResponse.warning)) || null;
  if (backendError) {
    notifySaveState(options, 'error', String(backendError));
    button.classList.remove('check-btn--loading');
    button.disabled = false;
    feedback.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
    showFeedback(feedback, String(backendError));
    button.dataset.antworttextBusy = '';
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
  notifySaveState(options, 'saved');
  button.dataset.antworttextBusy = '';
}

export function createAntworttextRuntime(options: AntworttextRuntimeOptions): {
  destroy: () => void;
  refresh: () => Promise<void>;
} {
  ensureAntworttextElements();
  bindOutsideClickHide();
  const buttonHandlers = new Map<HTMLButtonElement, EventListener>();

  const bindButtons = () => {
    const buttons = Array.from(
      options.root.querySelectorAll('antworttext-block button.check-btn')
    ) as HTMLButtonElement[];
    buttons.forEach((btn) => {
      if (buttonHandlers.has(btn)) return;
      const handler = () => {
        notifySaveState(options, 'saving');
        void checkAntworttext(btn, options);
      };
      buttonHandlers.set(btn, handler);
      btn.addEventListener('click', handler);
    });
  };

  options.root.dataset.antworttextRuntime = '1';
  bindButtons();
  const observer = new MutationObserver(() => {
    bindButtons();
  });
  observer.observe(options.root, { childList: true, subtree: true });

  const refresh = async () => {
    await prefillAnswers(options);
    bindButtons();
  };

  return {
    destroy: () => {
      observer.disconnect();
      buttonHandlers.forEach((handler, btn) => {
        btn.removeEventListener('click', handler);
      });
      buttonHandlers.clear();
      options.root.dataset.antworttextRuntime = '';
    },
    refresh
  };
}
