const BACKEND_BASE_URL =
  (window.API_CONFIG && window.API_CONFIG.backendBaseUrl) ||
  new URL('../abu-back/', window.location.href).toString();
let FRONTEND_USER =
  new URLSearchParams(window.location.search).get('user') ||
  (window.API_CONFIG && window.API_CONFIG.defaultUser) ||
  '';
const FRONTEND_SHEET =
  new URLSearchParams(window.location.search).get('sheet') ||
  (window.API_CONFIG && window.API_CONFIG.defaultSheet) ||
  'index.html';

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
  'für',
  'auf',
  'über',
  'unter',
  'nach',
  'bei',
  'aus',
  'als',
]);

let tokenOverlay;
let prefillBuffer = null;
let prefillTries = 0;
let loadedAnswersKey = null;
let logoutButton = null;

function setUserDisplay(name) {
  const display = document.getElementById('user-display');
  if (display) {
    display.textContent = name ? 'Eingeloggt als: ' + name : '';
  }
  ensureLogoutButton();
  if (logoutButton) {
    logoutButton.hidden = !name;
  }
}

function ensureLogoutButton() {
  if (logoutButton) return;
  const header = document.querySelector('header');
  if (!header) return;

  const actions = document.createElement('div');
  actions.style.marginTop = '10px';
  actions.style.display = 'flex';
  actions.style.justifyContent = 'center';
  actions.style.gap = '10px';
  actions.style.flexWrap = 'wrap';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'abu-logout';
  btn.textContent = 'Abmelden';
  btn.title = 'Token vergessen und abmelden';
  btn.hidden = true;
  btn.style.border = '1px solid #cbd5e1';
  btn.style.background = '#fff';
  btn.style.color = '#0f172a';
  btn.style.padding = '6px 10px';
  btn.style.borderRadius = '8px';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = '13px';

  btn.addEventListener('click', () => {
    logout();
  });

  actions.appendChild(btn);
  header.appendChild(actions);
  logoutButton = btn;
}

function logout() {
  localStorage.removeItem('abu_token');
  localStorage.removeItem('abu_user');
  FRONTEND_USER = '';
  loadedAnswersKey = null;
  prefillBuffer = null;
  prefillTries = 0;

  const progressEl = document.getElementById('progress-display');
  if (progressEl) {
    progressEl.textContent = '';
  }

  document.querySelectorAll('input.luecke').forEach(input => {
    input.value = '';
    input.disabled = false;
    input.title = '';
    input.classList.remove('luecke--richtig', 'luecke--teilweise', 'luecke--falsch');
  });

  document.querySelectorAll('.check-btn').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove(
      'check-btn--richtig',
      'check-btn--teilweise',
      'check-btn--falsch',
      'check-btn--loading'
    );
  });

  document.querySelectorAll('.feedback').forEach(feedbackEl => {
    feedbackEl.textContent = '';
    feedbackEl.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
    feedbackEl.removeAttribute('data-user-feedback');
  });

  setUserDisplay('');
  updateNextStepUnlock(0);
  showTokenOverlay();
}

async function fetchUserFromToken(token) {
  const resp = await fetch(BACKEND_BASE_URL + 'user/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  const text = await resp.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (e) {
    parsed = {};
  }

  if (!resp.ok) {
    const warn = parsed.warning || parsed.message || parsed.error;
    return { error: warn || 'Token ungültig.' };
  }

  const user = parsed && parsed.data && parsed.data.user;
  if (!user || !user.name) {
    return { error: 'Token ungültig.' };
  }

  return { user };
}

function setLoggedInUser(token, userName) {
  localStorage.setItem('abu_token', token);
  localStorage.setItem('abu_user', userName);
  FRONTEND_USER = userName;
  setUserDisplay(userName);
}

function ensureAnswersLoaded() {
  const storedToken = localStorage.getItem('abu_token');
  const storedUser = localStorage.getItem('abu_user');
  if (!storedToken || !storedUser) return;
  if (!FRONTEND_USER || FRONTEND_USER === 'dummywert') return;
  if (storedUser !== FRONTEND_USER) return;
  if (!document.querySelector('input.luecke')) return;
  const key = `${FRONTEND_SHEET}::${FRONTEND_USER}`;
  if (loadedAnswersKey === key) return;
  loadedAnswersKey = key;
  ladeVorhandeneAntworten();
}

function showTokenOverlay() {
  if (tokenOverlay) return;

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(15,23,42,0.8)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';

  const box = document.createElement('div');
  box.style.background = '#fff';
  box.style.padding = '20px';
  box.style.borderRadius = '10px';
  box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
  box.style.minWidth = '280px';
  box.style.textAlign = 'center';

  const title = document.createElement('h2');
  title.textContent = 'Token eingeben';
  title.style.margin = '0 0 10px 0';

  const input = document.createElement('input');
  input.type = 'password';
  input.placeholder = 'Token';
  input.style.width = '100%';
  input.style.padding = '10px';
  input.style.fontSize = '16px';
  input.style.border = '1px solid #cbd5e1';
  input.style.borderRadius = '8px';

  const error = document.createElement('div');
  error.style.color = '#b91c1c';
  error.style.fontSize = '13px';
  error.style.marginTop = '6px';
  error.style.minHeight = '18px';

  const btn = document.createElement('button');
  btn.textContent = 'Weiter';
  btn.style.marginTop = '12px';
  btn.style.padding = '10px 14px';
  btn.style.fontSize = '15px';
  btn.style.background = '#0f172a';
  btn.style.color = '#fff';
  btn.style.border = 'none';
  btn.style.borderRadius = '8px';
  btn.style.cursor = 'pointer';

  async function validate() {
    const val = (input.value || '').trim();
    if (!val) {
      error.textContent = 'Token fehlt.';
      return;
    }

    error.textContent = '';
    btn.disabled = true;
    const prevText = btn.textContent;
    btn.textContent = '...';

    try {
      const result = await fetchUserFromToken(val);
      if (result && result.user && result.user.name) {
        setLoggedInUser(val, result.user.name);
        ensureAnswersLoaded();
        document.body.removeChild(overlay);
        tokenOverlay = null;
        return;
      }
      error.textContent = (result && result.error) || 'Token ungültig.';
    } catch (err) {
      console.error('Login fehlgeschlagen', err);
      error.textContent = 'Login fehlgeschlagen.';
    } finally {
      btn.disabled = false;
      btn.textContent = prevText;
    }
  }

  btn.addEventListener('click', validate);
  input.addEventListener('keyup', e => {
    if (e.key === 'Enter') validate();
  });

  box.appendChild(title);
  box.appendChild(input);
  box.appendChild(btn);
  box.appendChild(error);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  input.focus();
  tokenOverlay = overlay;
}

function requireToken() {
  const storedToken = localStorage.getItem('abu_token');
  const storedUser = localStorage.getItem('abu_user');
  if (storedToken && storedUser) {
    FRONTEND_USER = storedUser;
    setUserDisplay(storedUser);
    ensureAnswersLoaded();
    return true;
  }
  showTokenOverlay();
  return false;
}

async function initTokenLogin() {
  // Auto-Login via URL: ?token=...
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  if (urlToken) {
    const token = urlToken.trim();
    try {
      const result = await fetchUserFromToken(token);
      if (result && result.user && result.user.name) {
        setLoggedInUser(token, result.user.name);
        ensureAnswersLoaded();

        // Token aus URL entfernen (damit er nicht weiter geteilt wird)
        params.delete('token');
        const newUrl =
          window.location.pathname +
          (params.toString() ? '?' + params.toString() : '') +
          window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
        return;
      }
    } catch (err) {
      console.error('Auto-Login per Token fehlgeschlagen', err);
    }

    // Ungültiger Token: Storage leeren und Overlay anzeigen
    localStorage.removeItem('abu_token');
    localStorage.removeItem('abu_user');
    FRONTEND_USER = '';
    setUserDisplay('');
    showTokenOverlay();
    return;
  }

  // Login aus Storage (Token immer serverseitig prüfen)
  const storedToken = localStorage.getItem('abu_token');
  const storedUser = localStorage.getItem('abu_user');
  if (storedUser && !storedToken) {
    localStorage.removeItem('abu_user');
  }

  if (storedToken) {
    try {
      const result = await fetchUserFromToken(storedToken);
      if (result && result.user && result.user.name) {
        setLoggedInUser(storedToken, result.user.name);
        ensureAnswersLoaded();
        return;
      }
    } catch (err) {
      console.error('Auto-Login aus Storage fehlgeschlagen', err);
    }

    localStorage.removeItem('abu_token');
    localStorage.removeItem('abu_user');
    FRONTEND_USER = '';
    setUserDisplay('');
  }

  showTokenOverlay();
}

function normalisiereTextFuerVergleich(text) {
  return text
    .toLowerCase()
    .replace(/[()\[\]{}.,;:!?"'–-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(wort => !STOPWORTER_DE.has(wort));
}

function istGrobRichtig(antwort, musterloesung) {
  const antwortTokens = normalisiereTextFuerVergleich(antwort);
  const musterTokens = normalisiereTextFuerVergleich(musterloesung);

  if (!antwortTokens.length || !musterTokens.length) return false;

  let overlap = 0;
  antwortTokens.forEach(token => {
    if (musterTokens.includes(token)) overlap++;
  });

  const deckungAntwort = overlap / antwortTokens.length;

  return deckungAntwort >= 0.8;
}

function istInAkzeptierterListe(antwort, inputElement) {
  if (!inputElement || !inputElement.dataset || !inputElement.dataset.accepted) return false;

  const normAntwort = antwort.toLowerCase();
  const eintraege = inputElement.dataset.accepted
    .split(';')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  if (!eintraege.length) return false;

  return eintraege.some(eintrag => normAntwort.includes(eintrag));
}

class LueckeGap extends HTMLElement {
  connectedCallback() {
    const nameAttr = this.getAttribute('name') || 'luecke-' + Math.random().toString(36).slice(2);
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
    button.className = 'check-btn';
    button.setAttribute('data-target', nameAttr);
    button.textContent = 'Prüfen';

    const feedback = document.createElement('div');
    feedback.className = 'feedback';
    feedback.id = 'feedback-' + nameAttr;

    this.appendChild(input);
    this.appendChild(button);
    this.appendChild(feedback);
  }
}

customElements.define('luecke-gap', LueckeGap);

// Full-width variant (used on tasks with longer free-text answers)
class LueckeGapWide extends LueckeGap {}
customElements.define('luecke-gap-wide', LueckeGapWide);

function classificationInfo(value, labelHint) {
  let score = null;
  let label = null;

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

// Token-Gate beim Laden
initTokenLogin();

async function sendeAntwortAnBackend(key, sheet, user, value, lueckentext, musterloesung) {
  try {
    const resp = await fetch(BACKEND_BASE_URL + 'answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key, sheet, user, value, lueckentext, musterloesung }),
    });
    const text = await resp.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch (e) {
      parsed = {};
    }

    // Debug-Ausgabe in die Browser-Konsole, um die Backend-Antwort zu sehen
    console.log('Antwort vom Backend', {
      status: resp.status,
      ok: resp.ok,
      raw: text,
      parsed,
    });

    if (!resp.ok) {
      const warn =
        parsed.warning ||
        (parsed.data && parsed.data.chatgpt && parsed.data.chatgpt.error) ||
        parsed.error;
      return { error: warn || 'Fehler im Backend (' + resp.status + ')' };
    }

    return parsed;
  } catch (err) {
    console.error('Antwort konnte nicht an das Backend gesendet werden.', err);
    return { error: 'Antwort konnte nicht an das Backend gesendet werden.' };
  }
}

async function pruefeLuecke(targetName) {
  if (!requireToken()) return;

  const input = document.querySelector('input.luecke[name="' + targetName + '"]');
  const feedbackEl = document.getElementById('feedback-' + targetName);
  const button = document.querySelector('.check-btn[data-target="' + targetName + '"]');

  if (!input || !feedbackEl) return;

  const antwort = input.value.trim();
  if (!antwort) {
    feedbackEl.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
    if (button) {
      button.classList.remove('check-btn--richtig', 'check-btn--teilweise', 'check-btn--falsch');
    }
    feedbackEl.textContent = 'Bitte zuerst eine Antwort in die Lücke schreiben.';
    return;
  }

  feedbackEl.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
  if (button) {
    button.classList.remove('check-btn--richtig', 'check-btn--teilweise', 'check-btn--falsch');
    button.classList.add('check-btn--loading');
    button.disabled = true;
  }
  feedbackEl.textContent = 'Überprüfung läuft...';
  // Markiere, dass der User gerade Feedback sieht, damit Prefill es nicht überschreibt
  feedbackEl.dataset.userFeedback = '1';

  function getParagraphTextWithInputs(p) {
    let result = '';
    p.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'INPUT') {
          result += (node.value && node.value.trim()) || '____';
        } else {
          result += node.textContent;
        }
      }
    });
    return result.trim();
  }

  const paragraphs = Array.from(document.querySelectorAll('main p'));
  const lueckentext = paragraphs.map(getParagraphTextWithInputs).join('\n\n');

  const musterloesung = input.dataset.solution || '';

  try {
    const backendResponse = await sendeAntwortAnBackend(
      targetName,
      FRONTEND_SHEET,
      FRONTEND_USER,
      antwort,
      lueckentext,
      musterloesung
    );

    const backendError = (backendResponse && (backendResponse.error || backendResponse.warning)) || null;
    if (backendError) {
      if (button) {
        button.classList.remove('check-btn--loading');
        button.disabled = false;
      }
      feedbackEl.textContent = backendError;
      return;
    }

    const chatgpt = backendResponse && backendResponse.data && backendResponse.data.chatgpt;
    if (chatgpt && chatgpt.error) {
      if (button) {
        button.classList.remove('check-btn--loading');
        button.disabled = false;
      }
      feedbackEl.textContent = chatgpt.error;
      return;
    }

    const rohText = (chatgpt && (chatgpt.raw || chatgpt.explanation)) || 'Keine Rückmeldung erhalten.';

    const info = classificationInfo(chatgpt && chatgpt.classification, chatgpt && chatgpt.classification_label);
    let classificationLabel = info.label;
    let erklaerung = rohText;
    let overrideByAccepted = false;
    let overrideByGrob = false;

    if (classificationLabel && chatgpt && chatgpt.explanation) {
      erklaerung = chatgpt.explanation;
    }

    if (istInAkzeptierterListe(antwort, input)) {
      classificationLabel = 'RICHTIG';
      overrideByAccepted = true;
    }

    if (istGrobRichtig(antwort, musterloesung) && classificationLabel && classificationLabel !== 'RICHTIG') {
      classificationLabel = 'RICHTIG';
      overrideByGrob = true;
    }

    if (classificationLabel === 'RICHTIG') {
      const erkLower = (erklaerung || '').toLowerCase();
      const klingtNegativ =
        erkLower.includes('passt nicht') ||
        erkLower.includes('falsch') ||
        erkLower.includes('nicht korrekt') ||
        erkLower.includes('stimmt nicht');

      if (overrideByAccepted || overrideByGrob || klingtNegativ) {
        erklaerung = 'Korrekt. Deine Antwort ist in diesem Kontext inhaltlich passend.';
      }
    }

    feedbackEl.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');

    // Anzeige: Lücke einfärben, Antwort als Tooltip auf der Lücke
    const displayText = antwort || '';
    if (input) {
      input.classList.remove('luecke--richtig', 'luecke--teilweise', 'luecke--falsch');
      input.title = displayText;
    }
    if (feedbackEl) {
      feedbackEl.textContent = '';
      feedbackEl.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
    }
    if (button) {
      button.classList.remove('check-btn--richtig', 'check-btn--teilweise', 'check-btn--falsch');
      button.classList.remove('check-btn--loading');
      button.disabled = false;
    }

    if (classificationLabel === 'RICHTIG') {
      input && input.classList.add('luecke--richtig');
      if (button) button.classList.add('check-btn--richtig');
      if (button) button.disabled = true;
      if (input) input.disabled = true;
    } else if (classificationLabel === 'TEILWEISE') {
      input && input.classList.add('luecke--teilweise');
      if (button) button.classList.add('check-btn--teilweise');
      if (button) button.disabled = false;
      if (input) input.disabled = false;
    } else if (classificationLabel === 'FALSCH') {
      input && input.classList.add('luecke--falsch');
      if (button) button.classList.add('check-btn--falsch');
      if (button) button.disabled = false;
      if (input) input.disabled = false;
    }

    if (feedbackEl) {
      feedbackEl.textContent = erklaerung || rohText;
      feedbackEl.dataset.userFeedback = '1';
    }

    updateProgressFromDom();
  } catch (err) {
    console.error(err);
    feedbackEl.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
    feedbackEl.textContent = 'Es ist ein Fehler bei der Verbindung zur KI aufgetreten.';
    feedbackEl.dataset.userFeedback = '1';
    if (button) {
      button.classList.remove('check-btn--loading');
      button.disabled = false;
    }
  }
}

document.querySelectorAll('.check-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-target');
    if (target) {
      pruefeLuecke(target);
    }
  });
});

async function ladeVorhandeneAntworten() {
  if (!FRONTEND_USER || FRONTEND_USER === 'dummywert') return;
  try {
    async function fetchAnswers(url) {
      const r = await fetch(url);
      if (!r.ok) return [];
      const p = await r.json();
      return (p && p.data && p.data.answer) || [];
    }

    const endpointUser =
      BACKEND_BASE_URL +
      'answer?sheet=' +
      encodeURIComponent(FRONTEND_SHEET) +
      '&user=' +
      encodeURIComponent(FRONTEND_USER);
    const answers = await fetchAnswers(endpointUser);

    // pro key den neuesten Eintrag (nach updated_at oder id) nehmen
    const latestByKey = {};
    answers.forEach(entry => {
      const key = entry.key;
      if (!key) return;
      const current = latestByKey[key];
      const ts = entry.updated_at ? new Date(entry.updated_at).getTime() : 0;
      const currTs = current && current._ts ? current._ts : -1;
      if (!current || ts > currTs || (!entry.updated_at && entry.id > (current.id || 0))) {
        latestByKey[key] = { ...entry, _ts: ts };
      }
    });

    updateProgress(latestByKey);

    prefillBuffer = latestByKey;
    prefillTries = 0;
    applyPrefillValues();
  } catch (err) {
    loadedAnswersKey = null;
    console.error('Vorhandene Antworten konnten nicht geladen werden', err);
  }
}

function applyPrefillValues() {
  if (!prefillBuffer) return;
  let missing = false;
    Object.values(prefillBuffer).forEach(entry => {
      const key = entry.key;
    const value = entry.value;
    if (!key) return;
    const input = document.querySelector('input.luecke[name="' + key + '"]');
    if (input) {
      // Nur füllen, wenn das Feld leer ist, um Nutzer-Eingaben nicht zu überschreiben
      if (!input.value) {
        input.value = value || '';
      }
      const feedbackEl = document.getElementById('feedback-' + key);
      const button = document.querySelector('.check-btn[data-target="' + key + '"]');
      // Lücke: Tooltip immer aktualisieren
      input.title = input.value || '';

      // Nicht überschreiben, wenn gerade ein Check läuft oder der User Feedback sieht
      const lockFeedback = feedbackEl && feedbackEl.dataset.userFeedback === '1';
      const isChecking = button && button.classList.contains('check-btn--loading');
      if (lockFeedback || isChecking) return;

      // Klassifizierung einfärben wie nach dem Prüfen
      const info = classificationInfo(entry.classification, entry.classification_label);
      if (feedbackEl) {
        feedbackEl.textContent = '';
        feedbackEl.classList.remove('feedback--richtig', 'feedback--teilweise', 'feedback--falsch');
      }
      if (button) {
        button.classList.remove('check-btn--richtig', 'check-btn--teilweise', 'check-btn--falsch');
      }

      input.classList.remove('luecke--richtig', 'luecke--teilweise', 'luecke--falsch');
      if (info.label === 'RICHTIG') {
        input.classList.add('luecke--richtig');
        button && button.classList.add('check-btn--richtig');
        if (button) button.disabled = true;
        input.disabled = true;
      } else if (info.label === 'TEILWEISE') {
        input.classList.add('luecke--teilweise');
        button && button.classList.add('check-btn--teilweise');
        if (button) button.disabled = false;
        input.disabled = false;
      } else if (info.label === 'FALSCH') {
        input.classList.add('luecke--falsch');
        button && button.classList.add('check-btn--falsch');
        if (button) button.disabled = false;
        input.disabled = false;
      }
    } else {
      missing = true;
    }
  });

  if (missing && prefillTries < 10) {
    prefillTries += 1;
    setTimeout(applyPrefillValues, 50);
  } else if (!missing) {
    // Buffer leeren, damit spätere User-Eingaben nicht überschrieben werden
    prefillBuffer = null;
  }
}

function updateProgress(latestByKey) {
  const display = document.getElementById('progress-display');
  if (!display) return;
  const totalGaps = document.querySelectorAll('input.luecke').length || 0;
  if (!totalGaps) {
    display.textContent = '';
    updateNextStepUnlock(0);
    return;
  }

  let sum = 0;
  Object.values(latestByKey || {}).forEach(entry => {
    const info = classificationInfo(entry.classification, entry.classification_label);
    if (typeof info.score === 'number') {
      sum += info.score;
    }
  });
  const pct = Math.round((sum / (totalGaps * 1000)) * 100);
  display.textContent = `Korrekt gelöst: ${pct}%`;
  updateNextStepUnlock(pct);
}

function updateProgressFromDom() {
  const display = document.getElementById('progress-display');
  if (!display) return;
  const inputs = Array.from(document.querySelectorAll('input.luecke'));
  if (!inputs.length) {
    display.textContent = '';
    updateNextStepUnlock(0);
    return;
  }

  let sum = 0;
  inputs.forEach(input => {
    if (input.classList.contains('luecke--richtig')) sum += 1000;
    else if (input.classList.contains('luecke--teilweise')) sum += 500;
  });

  const pct = Math.round((sum / (inputs.length * 1000)) * 100);
  display.textContent = `Korrekt gelöst: ${pct}%`;
  updateNextStepUnlock(pct);
}

function updateNextStepUnlock(percent) {
  const sections = document.querySelectorAll('[data-unlock-percent]');
  if (!sections.length) return;

  const canUnlockForUser = FRONTEND_USER && FRONTEND_USER !== 'dummywert';
  sections.forEach(el => {
    const threshold = Number(el.dataset.unlockPercent);
    const unlocked =
      canUnlockForUser && !Number.isNaN(threshold) && typeof percent === 'number' && percent >= threshold;
    el.hidden = !unlocked;
  });
}

// Fallback: wenn nach DOM-Load Inputs noch nicht da waren
document.addEventListener('DOMContentLoaded', () => {
  applyPrefillValues();
});
