<script context="module">
</script>

<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import { page } from '$app/stores';
  import { loadConfig } from '$lib/config';
  import { createLueckeRuntime, ensureLueckeElements } from '$lib/custom-elements/luecke';
  import { createUmfrageRuntime, ensureUmfrageElements } from '$lib/custom-elements/umfrage';
  import { applySchoolCiCss } from '$lib/ci';

  const STORAGE_KEY = 'abu.learner';
  const ANON_RUNTIME_TOKEN_PREFIX = 'abu.anon.runtime';
  const ANON_SESSION_CODE_PREFIX = 'abu.anon.code';
  const ANON_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

  let apiBaseUrl = '';
  let configError = '';
  let loading = true;
  let loadError = '';

  let sheetKey = '';
  let sheet = null;
  let sheetHtml = '';
  let assignmentForm = '';
  let classroomSchoolCss = '';
  let classroomId = null;
  let anonymousToken = '';
  let anonymousSessionCode = '';

  let progress = { percent: 0, answered: 0, total: 0 };
  let saveStatus = '';
  let saveMessage = '';
  let saveAt = 0;

  let contentEl;
  let lueckeRuntime = null;
  let umfrageRuntime = null;
  let lastLoadedKey = '';
  let lastLoadedClassroom = null;
  let lastRuntimeSignature = '';

  let learner = null;
  let loginCode = '';
  let loginError = '';
  let loginLoading = false;
  let authReady = false;
  let classroomHint = null;

  const updateProgress = (next) => {
    progress = next;
  };

  const readPayload = async (res) => {
    try {
      return await res.json();
    } catch {
      return { warning: 'Antwort ist kein JSON', data: {} };
    }
  };

  const createAnonymousToken = () => {
    if (typeof crypto !== 'undefined') {
      if (typeof crypto.randomUUID === 'function') {
        return `anon_${crypto.randomUUID().replace(/-/g, '')}`;
      }
      if (typeof crypto.getRandomValues === 'function') {
        const buffer = new Uint8Array(16);
        crypto.getRandomValues(buffer);
        return (
          'anon_' +
          Array.from(buffer)
            .map((num) => num.toString(16).padStart(2, '0'))
            .join('')
        );
      }
    }
    return `anon_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  };

  const createAnonymousSessionCode = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const buffer = new Uint8Array(4);
      crypto.getRandomValues(buffer);
      return Array.from(buffer)
        .map((num) => num.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    }
    return Math.random().toString(36).slice(2, 10).toUpperCase();
  };

  const readCookie = (name) => {
    if (typeof document === 'undefined') return '';
    const encodedName = `${encodeURIComponent(name)}=`;
    const parts = document.cookie ? document.cookie.split(';') : [];
    for (const rawPart of parts) {
      const part = rawPart.trim();
      if (part.startsWith(encodedName)) {
        const encodedValue = part.slice(encodedName.length);
        try {
          return decodeURIComponent(encodedValue);
        } catch {
          return encodedValue;
        }
      }
    }
    return '';
  };

  const writeCookie = (name, value) => {
    if (typeof document === 'undefined') return;
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; Max-Age=${ANON_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  };

  const getPersistentAnonymousValue = (prefix, classId, key, creator) => {
    if (!classId || !key) return '';
    const storageKey = `${prefix}.${classId}.${key}`;

    const fromCookie = readCookie(storageKey);
    if (fromCookie) return fromCookie;

    if (typeof sessionStorage !== 'undefined') {
      const fromSession = sessionStorage.getItem(storageKey);
      if (fromSession) {
        writeCookie(storageKey, fromSession);
        return fromSession;
      }
    }

    const value = creator();
    writeCookie(storageKey, value);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(storageKey, value);
    }
    return value;
  };

  const getAnonymousRuntimeToken = (classId, key) => {
    return getPersistentAnonymousValue(ANON_RUNTIME_TOKEN_PREFIX, classId, key, createAnonymousToken);
  };

  const getAnonymousSessionCode = (classId, key) => {
    return getPersistentAnonymousValue(ANON_SESSION_CODE_PREFIX, classId, key, createAnonymousSessionCode);
  };

  const resolveActiveCiCss = (learnerEntry = learner) => {
    const learnerCss = (learnerEntry?.school_css ?? '').trim();
    const fallbackCss = (classroomSchoolCss ?? '').trim();
    return learnerCss || fallbackCss;
  };

  const applyLearnerCi = (learnerEntry = learner) => {
    applySchoolCiCss(resolveActiveCiCss(learnerEntry));
  };

  const normalizeClassroomId = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num;
  };

  const normalizeAssignmentForm = (value) => String(value ?? '').trim().toLowerCase();
  const isAnonymousModeActive = () => normalizeAssignmentForm(assignmentForm) === 'anonym';
  const isAnonymousRuntimeActive = () =>
    typeof anonymousToken === 'string' && anonymousToken.startsWith('anon_');
  const isAnonymousDisplayMode = () => isAnonymousModeActive() || isAnonymousRuntimeActive();

  const updateSaveState = (event) => {
    saveStatus = event?.status || '';
    saveMessage = event?.message || '';
    if (event?.at) {
      saveAt = event.at;
    }
  };

  const saveStatusLabel = () => {
    if (saveStatus === 'saving') return 'Speichert...';
    if (saveStatus === 'saved') {
      if (saveAt) {
        try {
          const formatted = new Intl.DateTimeFormat('de-CH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }).format(new Date(saveAt));
          return `Gespeichert um ${formatted}`;
        } catch {
          return 'Gespeichert';
        }
      }
      return 'Gespeichert';
    }
    if (saveStatus === 'error') return saveMessage ? `Fehler: ${saveMessage}` : 'Speichern fehlgeschlagen';
    return '';
  };

  const persistLearner = (nextLearner) => {
    learner = nextLearner;
    applyLearnerCi(nextLearner);
    if (typeof localStorage !== 'undefined') {
      if (nextLearner) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextLearner));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

  const validateLearner = async (code) => {
    if (!apiBaseUrl || !code) return null;
    try {
      const res = await fetch(`${apiBaseUrl}learner-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const payload = await readPayload(res);
      if (res.ok && payload?.data?.learner?.code) {
        return payload.data.learner;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const loginLearner = async (codeInput) => {
    loginError = '';
    loginLoading = true;
    try {
      const cleaned = (codeInput || '').replace(/\s+/g, '');
      const validated = await validateLearner(cleaned);
      if (!validated) {
        loginError = 'Code ungueltig.';
        return;
      }
      persistLearner(validated);
      loginCode = '';
    } catch (err) {
      loginError = err?.message ?? 'Login fehlgeschlagen';
    } finally {
      loginLoading = false;
    }
  };

  async function fetchSheet(key, classId = null) {
    if (!apiBaseUrl) return;
    loading = true;
    loadError = '';
    anonymousToken = '';
    anonymousSessionCode = '';

    try {
      const url = new URL(`${apiBaseUrl}sheet/public`);
      url.searchParams.set('key', key);
      if (classId) {
        url.searchParams.set('classroom', String(classId));
      }
      const res = await fetch(url.toString());
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        loadError = payload?.warning || 'Sheet nicht gefunden';
        sheet = null;
        sheetHtml = '';
        assignmentForm = '';
        classroomSchoolCss = '';
        loading = false;
        return;
      }
      sheet = payload?.data ?? null;
      sheetHtml = sheet?.content ?? '';
      assignmentForm = sheet?.assignment_form ?? '';
      classroomSchoolCss = typeof sheet?.school_css === 'string' ? sheet.school_css : '';
      saveStatus = '';
      saveMessage = '';
      saveAt = 0;
      applyLearnerCi(learner);

      loading = false;
      await tick();
      await setupRuntime();
    } catch (err) {
      loadError = err?.message ?? 'Sheet konnte nicht geladen werden';
      classroomSchoolCss = '';
      loading = false;
    }
  }

  onMount(async () => {
    try {
      const config = await loadConfig();
      apiBaseUrl = config.apiBaseUrl.endsWith('/')
        ? config.apiBaseUrl
        : `${config.apiBaseUrl}/`;
      ensureLueckeElements();
      ensureUmfrageElements();
    } catch (err) {
      configError = err?.message ?? 'config konnte nicht geladen werden';
    }
    authReady = true;
    if (typeof localStorage !== 'undefined') {
      if (typeof window !== 'undefined') {
        const params = new URL(window.location.href).searchParams;
        const hadPersonalParam = params.has('personal');
        params.delete('personal');
        classroomHint = normalizeClassroomId(params.get('classroom'));
        const urlCode = (params.get('code') || '').trim();
        if (urlCode) {
          const validated = await validateLearner(urlCode.replace(/\s+/g, ''));
          params.delete('code');
          const newUrl =
            window.location.pathname +
            (params.toString() ? `?${params.toString()}` : '') +
            window.location.hash;
          window.history.replaceState({}, document.title, newUrl);
          if (validated) {
            persistLearner(validated);
          }
        } else if (hadPersonalParam) {
          const newUrl =
            window.location.pathname +
            (params.toString() ? `?${params.toString()}` : '') +
            window.location.hash;
          window.history.replaceState({}, document.title, newUrl);
        }
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const stored = JSON.parse(raw);
          if (stored?.code) {
            const validated = await validateLearner(stored.code);
            if (validated) {
              persistLearner(validated);
            } else {
              persistLearner(null);
            }
          }
        } catch {
          persistLearner(null);
        }
      }
    }
  });

  $: classroomId = learner?.classroom ?? classroomHint ?? null;

  $: {
    const nextKey = $page?.params?.key || '';
    sheetKey = nextKey;
    const nextClassroom = classroomId;
    if (
      nextKey &&
      apiBaseUrl &&
      (nextKey !== lastLoadedKey || nextClassroom !== lastLoadedClassroom)
    ) {
      lastLoadedKey = nextKey;
      lastLoadedClassroom = nextClassroom;
      fetchSheet(nextKey, nextClassroom);
    }
  }

  const setupRuntime = async () => {
    if (!contentEl || !apiBaseUrl || !sheetKey) return;

    const isAnonymous = isAnonymousModeActive();
    const activeClassroom = classroomId;
    let runtimeUser = '';
    let runtimeClassroom = activeClassroom;

    if (isAnonymous) {
      if (!activeClassroom) return;
      runtimeUser = getAnonymousRuntimeToken(activeClassroom, sheetKey);
      anonymousToken = runtimeUser;
      anonymousSessionCode = getAnonymousSessionCode(activeClassroom, sheetKey);
    } else {
      if (!learner?.code) return;
      runtimeUser = learner.code;
      anonymousToken = '';
      anonymousSessionCode = '';
    }

    const signature = `${runtimeUser}::${runtimeClassroom ?? ''}::${assignmentForm}`;
    if (lueckeRuntime && umfrageRuntime && lastRuntimeSignature === signature) {
      await lueckeRuntime.refresh();
      await umfrageRuntime.refresh();
      return;
    }
    lueckeRuntime?.destroy();
    umfrageRuntime?.destroy();
    lueckeRuntime = createLueckeRuntime({
      root: contentEl,
      apiBaseUrl,
      sheetKey,
      user: runtimeUser,
      classroom: runtimeClassroom,
      onProgress: updateProgress,
      onSaveState: updateSaveState
    });
    umfrageRuntime = createUmfrageRuntime({
      root: contentEl,
      apiBaseUrl,
      sheetKey,
      user: runtimeUser,
      classroom: runtimeClassroom,
      onSaveState: updateSaveState
    });
    lastRuntimeSignature = signature;
    await lueckeRuntime.refresh();
    await umfrageRuntime.refresh();
  };

  onDestroy(() => {
    lueckeRuntime?.destroy();
    umfrageRuntime?.destroy();
  });
</script>

<div class="page">
  <header class="hero">
    <div class="hero-text">
      <p class="eyebrow">ABU - Lueckentext</p>
      <h1 class="ci-title">{sheet?.name || (sheetKey ? `Sheet ${sheetKey}` : 'Lueckentext')}</h1>
      <p class="meta">
        Key: {sheetKey || '-'}
        {sheet?.updated_at ? `- Stand ${sheet.updated_at}` : ''}
      </p>
    </div>
    <div class="progress-card">
      <span class="progress-label">Fortschritt</span>
      <span class="progress-value">{progress.percent}%</span>
      <span class="progress-meta">{progress.answered}/{progress.total} beantwortet</span>
      <div class="progress-bar">
        <div class="progress-fill" style={`width: ${progress.percent}%`}></div>
      </div>
      <span class="progress-hint">
        {#if isAnonymousDisplayMode()}
          <span class="anonymous-symbol" title="Anonyme Zuweisung" aria-label="Anonyme Zuweisung">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M7 10V8a5 5 0 1 1 10 0v2M6 10h12v9H6z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          Anonyme Teilnahme
          {anonymousSessionCode ? ` · Session-Code ${anonymousSessionCode}` : ''}
        {:else if learner}
          Aktuell als {learner.name} ({learner.code})
        {:else}
          Bitte zuerst einloggen
        {/if}
      </span>
      {#if saveStatusLabel()}
        <span class={`save-state ${saveStatus === 'error' ? 'save-state--error' : ''}`}>
          {saveStatusLabel()}
        </span>
      {/if}
    </div>
  </header>

  {#if authReady && !learner && !isAnonymousDisplayMode()}
    <div class="login-card">
      <h2>Identifikationscode</h2>
      <p>Bitte gib deinen 12-stelligen Code ein, um Antworten zu speichern.</p>
      <div class="login-row">
        <input
          type="text"
          inputmode="numeric"
          maxlength="12"
          bind:value={loginCode}
          placeholder="123456789012"
        />
        <button class="ci-btn-primary" on:click={() => loginLearner(loginCode)} disabled={loginLoading}>
          {loginLoading ? '...' : 'Einloggen'}
        </button>
      </div>
      {#if loginError}
        <p class="state error">{loginError}</p>
      {/if}
    </div>
  {/if}

  {#if isAnonymousDisplayMode() && !classroomId}
    <div class="state error">
      Dieser anonyme Link braucht eine Klasse (classroom-Parameter). Bitte den korrekten Klassenlink
      verwenden.
    </div>
  {/if}

  {#if configError}
    <div class="state error">{configError}</div>
  {:else if loading}
    <div class="state">Lade Sheet...</div>
  {:else if loadError}
    <div class="state error">{loadError}</div>
  {:else}
    <main class="sheet" bind:this={contentEl}>
      {@html sheetHtml}
    </main>
  {/if}

  <footer class="footer">
    <div class="footer-card">
      {#if isAnonymousDisplayMode()}
        <span class="anonymous-symbol" title="Anonyme Zuweisung" aria-label="Anonyme Zuweisung">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M7 10V8a5 5 0 1 1 10 0v2M6 10h12v9H6z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        Anonym geoeffnet. Antworten werden anonym gespeichert.
        {anonymousSessionCode
          ? ` Dein Session-Code: ${anonymousSessionCode} (lokal als Cookie gespeichert).`
          : ''}
      {:else if learner}
        Persoenlich geoeffnet als {learner.name || 'Lernende:r'}
        {learner.code ? ` (${learner.code})` : ''}.
      {:else}
        Bitte einloggen, damit deine Antworten gespeichert werden.
      {/if}
      Lueckentext-Antworten werden beim Klick auf ? gespeichert, Umfrage-Antworten direkt bei Auswahl.
    </div>
  </footer>
</div>

<style>
  @import '../../../lib/check-btn.css';

  :global(body) {
    margin: 0;
    background: radial-gradient(circle at top left, #f9f1e7 0%, #f5f5f9 45%, #e9eef2 100%);
    color: #1c232f;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .page {
    min-height: 100vh;
    padding: 32px clamp(16px, 4vw, 56px) 64px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    font-family: var(--ci-font-body, 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif);
  }

  .hero {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
  }

  .eyebrow {
    margin: 0 0 8px;
    text-transform: uppercase;
    letter-spacing: 0.28em;
    font-size: 11px;
    color: #7a6f62;
  }

  h1 {
    margin: 0;
    font-size: clamp(30px, 4vw, 44px);
    letter-spacing: -0.02em;
  }

  .meta {
    margin: 8px 0 0;
    color: #6f6a60;
    font-size: 14px;
  }

  .progress-card {
    background: #fff;
    border-radius: 18px;
    padding: 18px 22px;
    border: 1px solid #eadfd3;
    box-shadow: 0 12px 26px rgba(26, 25, 23, 0.08);
    min-width: 220px;
    display: grid;
    gap: 8px;
  }

  .login-card {
    background: #fff;
    border-radius: 16px;
    padding: 18px 22px;
    border: 1px solid #eadfd3;
    box-shadow: 0 10px 22px rgba(26, 25, 23, 0.08);
    display: grid;
    gap: 10px;
    max-width: 520px;
  }

  .login-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .login-row input {
    flex: 1 1 220px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #cbd5e1;
    font-size: 16px;
  }

  .progress-label {
    text-transform: uppercase;
    letter-spacing: 0.2em;
    font-size: 11px;
    color: #7a6f62;
  }

  .progress-value {
    font-size: 28px;
    font-weight: 600;
  }

  .progress-meta {
    font-size: 13px;
    color: #6f6a60;
  }

  .progress-bar {
    height: 6px;
    background: #f0e7dc;
    border-radius: 999px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #2f8f83, #96b93e);
    width: 0;
    transition: width 0.3s ease;
  }

  .progress-hint {
    font-size: 12px;
    color: #8a847b;
  }

  .save-state {
    font-size: 12px;
    color: #4d463d;
  }

  .save-state--error {
    color: #b42318;
  }

  .anonymous-symbol {
    width: 16px;
    height: 16px;
    display: inline-flex;
    vertical-align: text-bottom;
    margin-right: 4px;
    color: #6f6a60;
  }

  .anonymous-symbol svg {
    width: 14px;
    height: 14px;
  }

  .state {
    padding: 18px 20px;
    border-radius: 14px;
    background: #fff;
    border: 1px solid #e7dfd2;
    color: #5e554a;
    box-shadow: 0 12px 24px rgba(26, 25, 23, 0.06);
  }

  .state.error {
    border-color: #e2b2b2;
    color: #8b3d3d;
    background: #fff5f5;
  }

  .sheet {
    background: #fff;
    border-radius: 22px;
    padding: clamp(20px, 4vw, 34px);
    border: 1px solid #eadfd3;
    box-shadow: 0 18px 40px rgba(26, 25, 23, 0.1);
    line-height: 1.65;
  }

  .sheet :global(p) {
    margin: 0 0 1rem;
  }

  .sheet :global(h2) {
    margin: 1.6rem 0 0.8rem;
  }

  .sheet :global(.video-container) {
    position: relative;
    padding-bottom: 56.25%;
    height: 0;
    margin: 1.5rem 0;
    border-radius: 16px;
    overflow: hidden;
    background: #0f141a;
  }

  .sheet :global(.video-container iframe) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }

  .sheet :global(.next-step) {
    margin-top: 1.75rem;
    padding-top: 1.25rem;
    border-top: 1px solid #e2d8cc;
    text-align: center;
  }

  .sheet :global(.next-step__link) {
    display: inline-block;
    padding: 0.65rem 1rem;
    border-radius: 999px;
    text-decoration: none;
    font-weight: 600;
  }

  .sheet :global(.next-step__link:hover) {
    text-decoration: none;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
  }

  .footer-card {
    background: #f6f0e6;
    border-radius: 14px;
    padding: 12px 16px;
    color: #6a6156;
    border: 1px solid #eadfd3;
    font-size: 13px;
    display: grid;
    gap: 6px;
  }

  :global(.luecke) {
    display: inline-block;
    min-width: 8ch;
    border: none;
    border-bottom: 2px solid #6f6a60;
    padding: 0.1rem 0.25rem;
    margin: 0 0.15rem;
    font: inherit;
    background: transparent;
  }

  :global(.luecke:focus) {
    outline: none;
    border-bottom-color: #2f8f83;
  }

  .sheet :global(pre),
  .sheet :global(input[type='text']),
  .sheet :global(textarea),
  .sheet :global(button),
  .sheet :global(select),
  .sheet :global(input[type='checkbox']),
  .sheet :global(input[type='radio']),
  .sheet :global(input[type='button']),
  .sheet :global(input[type='submit']) {
    position: relative;
  }

  .sheet :global(pre)::before,
  .sheet :global(input[type='text'])::before,
  .sheet :global(textarea)::before {
    content: '|';
    position: absolute;
    top: -14px;
    left: 2px;
    font-weight: 700;
    font-size: 16px;
    line-height: 1;
    color: #0f172a;
    pointer-events: none;
    animation: abu-caret-blink 1s steps(1, end) infinite;
  }

  @keyframes abu-caret-blink {
    0%,
    45% {
      opacity: 1;
    }
    50%,
    100% {
      opacity: 0;
    }
  }

  :global(luecke-gap) {
    position: relative;
    display: inline-block;
  }

  :global(luecke-gap-wide) {
    position: relative;
    display: block;
    margin: 0.6rem 0 1rem;
  }

  :global(luecke-gap-wide .luecke) {
    display: block;
    width: 100%;
    min-width: 0;
    border: 1px solid #d6cdc1;
    border-radius: 10px;
    padding: 0.5rem 0.65rem;
    background: #fff;
  }

  :global(luecke-gap-wide .luecke--richtig) {
    border-color: #1c8f4a;
  }

  :global(luecke-gap-wide .luecke--teilweise) {
    border-color: #d98a1a;
  }

  :global(luecke-gap-wide .luecke--falsch) {
    border-color: #c33b3b;
  }

  :global(.luecke--richtig) {
    background: #e4f5e7;
    border-bottom-color: #1c8f4a;
  }

  :global(.luecke--teilweise) {
    background: #fff4de;
    border-bottom-color: #d98a1a;
  }

  :global(.luecke--falsch) {
    background: #fde7e7;
    border-bottom-color: #c33b3b;
  }

  :global(.feedback) {
    position: absolute;
    right: 0;
    left: auto;
    top: calc(100% + 0.25rem);
    z-index: 5;
    max-width: min(28rem, 90vw);
    padding: 0.35rem 0.5rem;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: #fff;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
    font-size: 0.85rem;
    color: #4d463d;
    opacity: 0;
    transform: translateY(-4px);
    transition: opacity 160ms ease, transform 160ms ease;
    pointer-events: none;
  }

  :global(.feedback:empty) {
    display: none;
  }

  :global(luecke-gap-wide .feedback) {
    left: 0;
    right: auto;
  }

  :global(.feedback::before),
  :global(.feedback::after) {
    content: '';
    position: absolute;
    top: -8px;
    right: 0.9rem;
    border-style: solid;
    border-color: transparent;
  }

  :global(.feedback::before) {
    border-width: 0 7px 8px 7px;
    border-bottom-color: #e2e8f0;
  }

  :global(.feedback::after) {
    top: -7px;
    border-width: 0 6px 7px 6px;
    border-bottom-color: #fff;
  }

  :global(luecke-gap-wide .feedback::before),
  :global(luecke-gap-wide .feedback::after) {
    right: auto;
    left: 0.9rem;
  }

  :global(.feedback--visible),
  :global(.check-btn:hover + .feedback),
  :global(.check-btn:focus-visible + .feedback) {
    opacity: 1;
    transform: translateY(0);
  }

  :global(.feedback--richtig) {
    color: #1c8f4a;
    background: #e4f5e7;
    border-color: #1c8f4a;
  }

  :global(.feedback--richtig::before) {
    border-bottom-color: #1c8f4a;
  }

  :global(.feedback--richtig::after) {
    border-bottom-color: #e4f5e7;
  }

  :global(.feedback--teilweise) {
    color: #d98a1a;
    background: #fff4de;
    border-color: #d98a1a;
  }

  :global(.feedback--teilweise::before) {
    border-bottom-color: #d98a1a;
  }

  :global(.feedback--teilweise::after) {
    border-bottom-color: #fff4de;
  }

  :global(.feedback--falsch) {
    color: #c33b3b;
    background: #fde7e7;
    border-color: #c33b3b;
  }

  :global(.feedback--falsch::before) {
    border-bottom-color: #c33b3b;
  }

  :global(.feedback--falsch::after) {
    border-bottom-color: #fde7e7;
  }

  :global(umfrage-matrix) {
    display: block;
    margin: 1.5rem 0;
  }

  :global(umfrage-matrix .umfrage-matrix__scroll) {
    position: relative;
    overflow-x: auto;
  }

  :global(umfrage-matrix .umfrage-matrix__frame) {
    position: relative;
    display: inline-block;
    min-width: 100%;
    padding-right: 2.2rem;
    box-sizing: border-box;
  }

  :global(umfrage-matrix .umfrage-matrix__table) {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    min-width: 520px;
  }

  :global(umfrage-matrix .umfrage-matrix__col-statement) {
    min-width: 220px;
  }

  :global(umfrage-matrix th),
  :global(umfrage-matrix td) {
    border: 1px solid #e2d8cc;
    padding: 0.55rem 0.7rem;
    text-align: center;
  }

  :global(umfrage-matrix th) {
    background: #f6f0e6;
    color: #6a6156;
    font-weight: 600;
  }

  :global(umfrage-matrix .umfrage-matrix__statement) {
    text-align: left;
    background: #fff;
    color: #4d463d;
    font-weight: 500;
  }

  :global(umfrage-matrix .umfrage-matrix__table tbody td:last-child),
  :global(umfrage-matrix .umfrage-matrix__table tbody th:last-child) {
    position: relative;
  }

  :global(umfrage-matrix .umfrage-save-indicator) {
    position: absolute;
    top: 50%;
    right: -1.25rem;
    min-width: 0.9rem;
    padding: 0;
    border: 0;
    background: transparent;
    text-align: center;
    font-size: 0.72rem;
    font-weight: 700;
    font-family: inherit;
    line-height: 1;
    opacity: 0;
    transform: translateY(-50%) scale(0.92);
    transition: opacity 0.18s ease, transform 0.18s ease;
    pointer-events: none;
    cursor: default;
    z-index: 4;
  }

  :global(umfrage-matrix .umfrage-save-indicator--visible) {
    opacity: 1;
    transform: translateY(-50%) scale(1);
  }

  :global(umfrage-matrix .umfrage-save-indicator--saving) {
    color: #8a8072;
  }

  :global(umfrage-matrix .umfrage-save-indicator--saved) {
    color: #2f8f83;
  }

  :global(umfrage-matrix .umfrage-save-indicator--error) {
    color: #b42318;
  }

  :global(umfrage-matrix .umfrage-save-indicator--retry) {
    pointer-events: auto;
    cursor: pointer;
  }

  :global(umfrage-matrix .umfrage-save-indicator--retry:focus-visible) {
    outline: 2px solid rgba(180, 35, 24, 0.35);
    outline-offset: 2px;
    border-radius: 999px;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-value) {
    display: block;
    font-size: 1rem;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-label) {
    display: block;
    font-size: 0.75rem;
    color: #8a8072;
    margin-top: 2px;
  }

  :global(umfrage-matrix .umfrage-matrix__option) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    margin: 0;
  }

  :global(umfrage-matrix .umfrage-matrix__option input) {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: #2f8f83;
  }

  :global(umfrage-matrix .umfrage-matrix__option input:focus-visible) {
    outline: 2px solid rgba(47, 143, 131, 0.45);
    outline-offset: 2px;
  }

  @media (max-width: 720px) {
    :global(umfrage-matrix .umfrage-matrix__table) {
      min-width: 420px;
    }
  }

  @media (max-width: 720px) {
    .progress-card {
      width: 100%;
    }
  }
</style>
