<script context="module">
</script>

<script>
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/stores';
  import { loadConfig } from '$lib/config';
  import { createLueckeRuntime, ensureLueckeElements } from '$lib/custom-elements/luecke';
  import {
    createTextdokumentRuntime,
    ensureTextdokumentElements
  } from '$lib/custom-elements/textdokument';
  import { createFreitextRuntime, ensureFreitextElements } from '$lib/custom-elements/freitext';
  import { createUmfrageRuntime, ensureUmfrageElements } from '$lib/custom-elements/umfrage';
  import { applySchoolCiCss } from '$lib/ci';
  import { formatSwissDateTime, formatSwissTime } from '$lib/date';

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
  let lueckeProgress = { percent: 0, answered: 0, total: 0 };
  let textdokumentProgress = { percent: 0, answered: 0, total: 0 };
  let freitextProgress = { percent: 0, answered: 0, total: 0 };
  let saveStatus = '';
  let saveMessage = '';
  let saveAt = 0;

  let contentEl;
  let lueckeRuntime = null;
  let textdokumentRuntime = null;
  let freitextRuntime = null;
  let umfrageRuntime = null;
  let lastLoadedKey = '';
  let lastLoadedClassroom = null;
  let lastRuntimeSignature = '';
  let sheetLoadRequest = 0;

  let learner = null;
  let loginCode = '';
  let loginError = '';
  let loginLoading = false;
  let authReady = false;
  let classroomHint = null;

  const updateLueckeProgress = (next) => {
    lueckeProgress = next;
  };

  const updateTextdokumentProgress = (next) => {
    textdokumentProgress = next;
  };

  const updateFreitextProgress = (next) => {
    freitextProgress = next;
  };

  $: {
    const total =
      (lueckeProgress?.total ?? 0) +
      (textdokumentProgress?.total ?? 0) +
      (freitextProgress?.total ?? 0);
    const answered =
      (lueckeProgress?.answered ?? 0) +
      (textdokumentProgress?.answered ?? 0) +
      (freitextProgress?.answered ?? 0);
    progress = {
      total,
      answered,
      percent: total ? Math.round((answered / total) * 100) : 0
    };
  }

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
          const formatted = formatSwissTime(saveAt);
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

  const formatSheetTimestamp = (value) => formatSwissDateTime(value);

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

  const getUrlLearnerCode = () => {
    if (typeof window === 'undefined') return '';
    const params = new URL(window.location.href).searchParams;
    return (params.get('token') || params.get('code') || '').trim();
  };

  const clearLearnerCodeFromUrl = () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    url.searchParams.delete('code');
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  };

  const logoutLearner = () => {
    clearLearnerCodeFromUrl();
    persistLearner(null);
    if (typeof window !== 'undefined') {
      window.location.replace('/');
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

  const buildApiUrl = (path) => {
    const endpoint = `${apiBaseUrl}${path}`;
    const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
    return new URL(endpoint, base).toString();
  };

  const loginLearner = async (codeInput) => {
    loginError = '';
    loginLoading = true;
    try {
      const cleaned = (codeInput || '').replace(/\s+/g, '');
      const validated = await validateLearner(cleaned);
      if (!validated) {
        loginError = 'Code ungültig.';
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

  function destroyRuntimes() {
    lueckeRuntime?.destroy();
    textdokumentRuntime?.destroy();
    freitextRuntime?.destroy();
    umfrageRuntime?.destroy();
    lueckeRuntime = null;
    textdokumentRuntime = null;
    freitextRuntime = null;
    umfrageRuntime = null;
    lastRuntimeSignature = '';
  }

  async function fetchSheet(key, classId = null) {
    if (!apiBaseUrl) return;
    const requestId = ++sheetLoadRequest;
    loading = true;
    loadError = '';
    anonymousToken = '';
    anonymousSessionCode = '';
    destroyRuntimes();

    try {
      const url = new URL(buildApiUrl('sheet/public'));
      url.searchParams.set('key', key);
      if (classId) {
        url.searchParams.set('classroom', String(classId));
      }
      const res = await fetch(url.toString());
      const payload = await res.json().catch(() => ({}));
      if (requestId !== sheetLoadRequest) return;
      if (!res.ok) {
        loadError = payload?.warning || 'Sheet nicht gefunden';
        sheet = null;
        sheetHtml = '';
        assignmentForm = '';
        classroomSchoolCss = '';
        lueckeProgress = { percent: 0, answered: 0, total: 0 };
        textdokumentProgress = { percent: 0, answered: 0, total: 0 };
        freitextProgress = { percent: 0, answered: 0, total: 0 };
        loading = false;
        return;
      }
      sheet = payload?.data ?? null;
      sheetHtml = sheet?.content ?? '';
      assignmentForm = sheet?.assignment_form ?? '';
      classroomSchoolCss = typeof sheet?.school_css === 'string' ? sheet.school_css : '';
      lueckeProgress = { percent: 0, answered: 0, total: 0 };
      textdokumentProgress = { percent: 0, answered: 0, total: 0 };
      freitextProgress = { percent: 0, answered: 0, total: 0 };
      saveStatus = '';
      saveMessage = '';
      saveAt = 0;
      applyLearnerCi(learner);

      loading = false;
    } catch (err) {
      if (requestId !== sheetLoadRequest) return;
      loadError = err?.message ?? 'Sheet konnte nicht geladen werden';
      classroomSchoolCss = '';
      lueckeProgress = { percent: 0, answered: 0, total: 0 };
      textdokumentProgress = { percent: 0, answered: 0, total: 0 };
      freitextProgress = { percent: 0, answered: 0, total: 0 };
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
      ensureTextdokumentElements();
      ensureFreitextElements();
      ensureUmfrageElements();
    } catch (err) {
      configError = err?.message ?? 'config konnte nicht geladen werden';
      authReady = true;
      return;
    }
    if (typeof localStorage !== 'undefined') {
      let shouldUseStoredLearner = true;
      if (typeof window !== 'undefined') {
        const params = new URL(window.location.href).searchParams;
        const hadPersonalParam = params.has('personal');
        params.delete('personal');
        classroomHint = normalizeClassroomId(params.get('classroom'));
        const urlCode = getUrlLearnerCode();
        if (urlCode) {
          shouldUseStoredLearner = false;
          loginCode = urlCode;
          const validated = await validateLearner(urlCode.replace(/\s+/g, ''));
          clearLearnerCodeFromUrl();
          if (validated) {
            persistLearner(validated);
            loginCode = '';
            loginError = '';
          } else {
            persistLearner(null);
            loginError = 'Code ungültig.';
          }
        } else if (hadPersonalParam) {
          const newUrl =
            window.location.pathname +
            (params.toString() ? `?${params.toString()}` : '') +
            window.location.hash;
          window.history.replaceState({}, document.title, newUrl);
        }
      }
      if (shouldUseStoredLearner) {
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
    }
    authReady = true;
  });

  $: classroomId = learner?.classroom ?? classroomHint ?? null;

  $: {
    const nextKey = $page?.params?.key || '';
    sheetKey = nextKey;
    const nextClassroom = classroomId;
    if (
      nextKey &&
      apiBaseUrl &&
      authReady &&
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

    const signature = `${sheetKey}::${runtimeUser}::${runtimeClassroom ?? ''}::${assignmentForm}`;
    if (
      lueckeRuntime &&
      textdokumentRuntime &&
      freitextRuntime &&
      umfrageRuntime &&
      lastRuntimeSignature === signature
    ) {
      await lueckeRuntime.refresh();
      await textdokumentRuntime.refresh();
      await freitextRuntime.refresh();
      await umfrageRuntime.refresh();
      return;
    }
    lueckeRuntime?.destroy();
    textdokumentRuntime?.destroy();
    freitextRuntime?.destroy();
    umfrageRuntime?.destroy();
    lueckeRuntime = createLueckeRuntime({
      root: contentEl,
      apiBaseUrl,
      sheetKey,
      user: runtimeUser,
      classroom: runtimeClassroom,
      onProgress: updateLueckeProgress,
      onSaveState: updateSaveState
    });
    textdokumentRuntime = createTextdokumentRuntime({
      root: contentEl,
      apiBaseUrl,
      sheetKey,
      user: runtimeUser,
      classroom: runtimeClassroom,
      onProgress: updateTextdokumentProgress,
      onSaveState: updateSaveState
    });
    freitextRuntime = createFreitextRuntime({
      root: contentEl,
      apiBaseUrl,
      sheetKey,
      user: runtimeUser,
      classroom: runtimeClassroom,
      onProgress: updateFreitextProgress,
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
    await textdokumentRuntime.refresh();
    await freitextRuntime.refresh();
    await umfrageRuntime.refresh();
  };

  $: runtimeReady =
    Boolean(contentEl) &&
    Boolean(apiBaseUrl) &&
    Boolean(sheetKey) &&
    Boolean(sheet) &&
    authReady &&
    !loading &&
    !loadError &&
    (normalizeAssignmentForm(assignmentForm) === 'anonym'
      ? Boolean(classroomId)
      : Boolean(learner?.code));

  $: {
    if (runtimeReady) {
      void setupRuntime();
    }
  }

  onDestroy(() => {
    destroyRuntimes();
  });
</script>

<div class="page">
  <header class="hero">
    <div class="hero-text">
      <p class="eyebrow">ABU - Arbeitsblatt</p>
      <h1 class="ci-title">{sheet?.name || (sheetKey ? `Sheet ${sheetKey}` : 'Arbeitsblatt')}</h1>
      <p class="meta">
        Key: {sheetKey || '-'}
        {sheet?.updated_at ? `- Stand ${formatSheetTimestamp(sheet.updated_at)}` : ''}
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
      <div class="sheet-actions">
        {#if learner}
          <a class="sheet-action" href="/lernende/">Startseite</a>
          <button class="sheet-action sheet-action--danger" type="button" on:click={logoutLearner}>
            Ausloggen
          </button>
        {:else}
          <a class="sheet-action" href="/">Startseite</a>
        {/if}
      </div>
    </div>
  </header>

  {#if authReady && !learner && !isAnonymousDisplayMode()}
    <div class="login-card">
      <h2>Identifikationscode</h2>
      <p>Bitte geben Sie Ihren 12-stelligen Code ein, um Antworten zu speichern.</p>
      <p class="login-card__hint">Direktlinks mit `?token=123456789012` funktionieren ebenfalls.</p>
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
        Anonym geöffnet. Antworten werden anonym gespeichert.
        {anonymousSessionCode
          ? ` Ihr Session-Code: ${anonymousSessionCode} (lokal als Cookie gespeichert).`
          : ''}
      {:else if learner}
        Persönlich geöffnet als {learner.name || 'Lernende:r'}
        {learner.code ? ` (${learner.code})` : ''}.
      {:else}
        Bitte einloggen, damit Ihre Antworten gespeichert werden.
      {/if}
      Rückmeldungen werden beim Klick auf ? erstellt; Umfrage-Antworten werden direkt bei Auswahl gespeichert.
    </div>
  </footer>
</div>

<style>
  @import '../../../lib/check-btn.css';
  @import '../../../lib/textdokument.css';

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
    padding: 27px clamp(14px, 4vw, 48px) 54px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-family: var(--ci-font-body, 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif);
  }

  .hero {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
  }

  .eyebrow {
    margin: 0 0 7px;
    text-transform: uppercase;
    letter-spacing: 0.28em;
    font-size: 10px;
    color: #7a6f62;
  }

  h1 {
    margin: 0;
    font-size: clamp(26px, 4vw, 37px);
    letter-spacing: -0.02em;
  }

  .meta {
    margin: 7px 0 0;
    color: #6f6a60;
    font-size: 12px;
  }

  .progress-card {
    background: #fff;
    border-radius: 15px;
    padding: 15px 19px;
    border: 1px solid #eadfd3;
    box-shadow: 0 10px 22px rgba(26, 25, 23, 0.08);
    min-width: 187px;
    display: grid;
    gap: 7px;
  }

  .sheet-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 3px;
  }

  .sheet-action {
    min-height: 32px;
    padding: 7px 11px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #fff;
    color: #1c232f;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.1;
    text-decoration: none;
    cursor: pointer;
  }

  .sheet-action:hover,
  .sheet-action:focus-visible {
    border-color: #2f8f83;
    color: #25636a;
    text-decoration: none;
  }

  .sheet-action--danger {
    color: #8b3d3d;
  }

  .login-card {
    background: #fff;
    border-radius: 14px;
    padding: 15px 19px;
    border: 1px solid #eadfd3;
    box-shadow: 0 9px 19px rgba(26, 25, 23, 0.08);
    display: grid;
    gap: 9px;
    max-width: 442px;
  }

  .login-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .login-row input {
    flex: 1 1 220px;
    padding: 9px 10px;
    border-radius: 9px;
    border: 1px solid #cbd5e1;
    font-size: 14px;
  }

  .progress-label {
    text-transform: uppercase;
    letter-spacing: 0.2em;
    font-size: 10px;
    color: #7a6f62;
  }

  .progress-value {
    font-size: 24px;
    font-weight: 600;
  }

  .progress-meta {
    font-size: 11px;
    color: #6f6a60;
  }

  .progress-bar {
    height: 5px;
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
    font-size: 10px;
    color: #8a847b;
  }

  .save-state {
    font-size: 10px;
    color: #4d463d;
  }

  .save-state--error {
    color: #b42318;
  }

  .anonymous-symbol {
    width: 14px;
    height: 14px;
    display: inline-flex;
    vertical-align: text-bottom;
    margin-right: 3px;
    color: #6f6a60;
  }

  .anonymous-symbol svg {
    width: 12px;
    height: 12px;
  }

  .state {
    padding: 15px 17px;
    border-radius: 12px;
    background: #fff;
    border: 1px solid #e7dfd2;
    color: #5e554a;
    box-shadow: 0 10px 20px rgba(26, 25, 23, 0.06);
  }

  .state.error {
    border-color: #e2b2b2;
    color: #8b3d3d;
    background: #fff5f5;
  }

  .sheet {
    background: #fff;
    border-radius: 19px;
    padding: clamp(17px, 4vw, 29px);
    border: 1px solid #eadfd3;
    box-shadow: 0 15px 34px rgba(26, 25, 23, 0.1);
    line-height: 1.65;
  }

  .sheet :global(p) {
    margin: 0 0 0.85rem;
  }

  .sheet :global(h1),
  .sheet :global(h2),
  .sheet :global(h3) {
    margin: 0 0 0.72rem;
    color: #132238;
    font-family: var(--ci-font-title, 'Arial Black', Arial, sans-serif);
    font-weight: 800;
    line-height: 1.16;
    letter-spacing: 0;
  }

  .sheet :global(h1) {
    font-size: 1.7rem;
  }

  .sheet :global(h2) {
    font-size: 1.23rem;
    margin-top: 1.23rem;
  }

  .sheet :global(h3) {
    font-size: 0.95rem;
    margin-top: 1.02rem;
  }

  .sheet :global(freitext-block) {
    display: block;
    margin: 1.36rem 0;
  }

  .sheet :global(.freitext) {
    display: grid;
    gap: 12px;
    padding: 15px;
    border-radius: 15px;
    background: linear-gradient(180deg, #fffdf8 0%, #f7f1e7 100%);
    border: 1px solid #eadfd3;
  }

  .sheet :global(.freitext__intro) {
    display: grid;
    gap: 9px;
  }

  .sheet :global(.freitext__instruction) {
    display: grid;
    gap: 9px;
  }

  .sheet :global(.freitext__instruction > :first-child) {
    margin-top: 0;
  }

  .sheet :global(.freitext__instruction > :last-child) {
    margin-bottom: 0;
  }

  .sheet :global(.freitext__title) {
    margin: 0;
    font-size: 17px;
    line-height: 1.25;
  }

  .sheet :global(.freitext__task),
  .sheet :global(.freitext__meta) {
    margin: 0;
    color: #5e554a;
    font-size: 12px;
  }

  .sheet :global(.freitext__criteria-wrap) {
    display: grid;
    gap: 2px;
  }

  .sheet :global(.freitext__criteria-label) {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #7a6f62;
  }

  .sheet :global(.freitext__criteria) {
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0;
    list-style: none;
  }

  .sheet :global(.freitext__criterion) {
    display: grid;
    grid-template-columns: minmax(60px, 0.17fr) minmax(0, 0.48fr) minmax(0, 0.35fr);
    gap: 5px;
    align-items: start;
    padding: 2px 5px;
    border: 1px solid #eadfd3;
    border-radius: 0;
    background: #fffdf8;
  }

  .sheet :global(.freitext__criterion + .freitext__criterion) {
    border-top: 0;
  }

  .sheet :global(.freitext__criterion-label) {
    min-width: 0;
    font-weight: 700;
    color: #1c232f;
    overflow-wrap: anywhere;
  }

  .sheet :global(.freitext__criterion-description),
  .sheet :global(.freitext__criterion-example) {
    min-width: 0;
    color: #5e554a;
    font-size: 12px;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .sheet :global(.freitext__criterion-example) {
    color: #475569;
  }

  .sheet :global(.freitext__premises-wrap) {
    display: grid;
    gap: 2px;
  }

  .sheet :global(.freitext__premises) {
    display: grid;
    gap: 0;
  }

  .sheet :global(.freitext__premise) {
    display: grid;
    grid-template-columns: minmax(160px, 0.42fr) minmax(180px, 0.58fr);
    gap: 5px;
    align-items: center;
    padding: 2px 5px;
    border-radius: 0;
    border: 1px solid #eadfd3;
    background: #fffdf8;
  }

  .sheet :global(.freitext__premise + .freitext__premise) {
    border-top: 0;
  }

  .sheet :global(.freitext__premise-label) {
    min-width: 0;
    font-weight: 700;
    color: #1c232f;
    overflow-wrap: anywhere;
  }

  .sheet :global(.freitext__premise-hint) {
    min-width: 0;
    color: #5e554a;
    font-size: 11px;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .sheet :global(.freitext__premise-hint a) {
    color: #25636a;
    font-weight: 700;
  }

  .sheet :global(.freitext__premise-input-row) {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .sheet :global(.freitext__premise-input) {
    width: 100%;
    min-height: 34px;
    padding: 7px 9px;
    border-radius: 9px;
    border: 1px solid #d6cdc1;
    background: #fff;
    font: inherit;
  }

  .sheet :global(.freitext__premise-input:focus) {
    outline: 2px solid rgba(47, 143, 131, 0.18);
    border-color: #2f8f83;
  }

  .sheet :global(.freitext__premise-status) {
    display: inline-flex;
    align-items: center;
    width: 100%;
    min-height: 34px;
    padding: 7px 9px;
    border-radius: 9px;
    border: 1px solid #efd8b8;
    background: #fff8ed;
    color: #8a5a17;
    font: inherit;
    font-weight: 700;
  }

  .sheet :global(.freitext__premise-status--ready) {
    border-color: #b7dec8;
    background: #f0fdf4;
    color: #166534;
  }

  .sheet :global(.freitext__premise-status--warning) {
    border-color: #efd8b8;
    background: #fff8ed;
    color: #8a5a17;
  }

  .sheet :global(.freitext__premise-status--invalid) {
    border-color: #f0b4b4;
    background: #fff5f5;
    color: #991b1b;
  }

  .sheet :global(.freitext__textarea) {
    width: 100%;
    min-height: 187px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid #d6cdc1;
    background: #fff;
    font: inherit;
    line-height: 1.6;
    resize: vertical;
  }

  .sheet :global(.freitext__textarea:focus) {
    outline: 2px solid rgba(47, 143, 131, 0.18);
    border-color: #2f8f83;
  }

  .sheet :global(.freitext__textarea:disabled) {
    cursor: not-allowed;
    background: #f4eee5;
    color: #7a6f62;
  }

  .sheet :global(.freitext__question) {
    display: grid;
    gap: 5px;
    margin: 0;
  }

  .sheet :global(.freitext__question-label) {
    font-size: 11px;
    font-weight: 700;
    color: #5e554a;
  }

  .sheet :global(.freitext__question-field) {
    width: 100%;
    height: 34px;
    min-height: 34px;
    padding: 0 10px;
    border-radius: 10px;
    border: 1px solid #d6cdc1;
    background: #fff;
    font: inherit;
    line-height: 1.2;
    resize: none;
  }

  .sheet :global(.freitext__question-field:focus) {
    outline: 2px solid rgba(47, 143, 131, 0.18);
    border-color: #2f8f83;
  }

  .sheet :global(.freitext--richtig) {
    border-color: #1c8f4a;
    background: #f4fbf5;
  }

  .sheet :global(.freitext--teilweise) {
    border-color: #d98a1a;
    background: #fff9ef;
  }

  .sheet :global(.freitext--falsch) {
    border-color: #c33b3b;
    background: #fff5f5;
  }

  .sheet :global(.freitext__actions) {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 9px;
  }

  .sheet :global(.freitext__actions .check-btn) {
    width: 34px;
    height: 34px;
    margin-left: 0;
  }

  .sheet :global(.freitext__feedback) {
    display: block;
    min-width: 0;
  }

  .sheet :global(.freitext__action-hint) {
    display: none;
    font-size: 11px;
    color: #6f6a60;
  }

  .sheet :global(abu-block-prompt) {
    display: none !important;
  }

  @media (max-width: 640px) {
    .sheet :global(.freitext__criterion),
    .sheet :global(.freitext__premise) {
      grid-template-columns: 1fr;
    }
  }

  .sheet :global(.video-container) {
    position: relative;
    padding-bottom: 56.25%;
    height: 0;
    margin: 1.27rem 0;
    border-radius: 14px;
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
    margin-top: 1.49rem;
    padding-top: 1.06rem;
    border-top: 1px solid #e2d8cc;
    text-align: center;
  }

  .sheet :global(.next-step__link) {
    display: inline-block;
    padding: 0.55rem 0.85rem;
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
    border-radius: 12px;
    padding: 10px 14px;
    color: #6a6156;
    border: 1px solid #eadfd3;
    font-size: 11px;
    display: grid;
    gap: 5px;
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
    top: -12px;
    left: 2px;
    font-weight: 700;
    font-size: 14px;
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

  :global(luecke-gap[width='100%']) {
    position: relative;
    display: block;
    margin: 0.51rem 0 0.85rem;
  }

  :global(luecke-gap[width='100%'] .luecke) {
    display: block;
    width: 100%;
    min-width: 0;
    border: 1px solid #d6cdc1;
    border-radius: 9px;
    padding: 0.43rem 0.55rem;
    background: #fff;
  }

  :global(luecke-gap[width='100%'] .luecke--richtig) {
    border-color: #1c8f4a;
  }

  :global(luecke-gap[width='100%'] .luecke--teilweise) {
    border-color: #d98a1a;
  }

  :global(luecke-gap[width='100%'] .luecke--falsch) {
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
    max-width: min(23.8rem, 90vw);
    padding: 0.3rem 0.43rem;
    border-radius: 5px;
    border: 1px solid #e2e8f0;
    background: #fff;
    box-shadow: 0 9px 20px rgba(15, 23, 42, 0.12);
    font-size: 0.72rem;
    color: #4d463d;
    white-space: pre-wrap;
    opacity: 0;
    transform: translateY(-4px);
    transition: opacity 160ms ease, transform 160ms ease;
    pointer-events: none;
  }

  :global(.feedback:empty) {
    display: none;
  }

  :global(luecke-gap[width='100%'] .feedback) {
    left: 0;
    right: auto;
  }

  :global(.feedback::before),
  :global(.feedback::after) {
    content: '';
    position: absolute;
    top: -7px;
    right: 0.77rem;
    border-style: solid;
    border-color: transparent;
  }

  :global(.feedback::before) {
    border-width: 0 7px 8px 7px;
    border-bottom-color: #e2e8f0;
  }

  :global(.feedback::after) {
    top: -6px;
    border-width: 0 6px 7px 6px;
    border-bottom-color: #fff;
  }

  :global(luecke-gap[width='100%'] .feedback::before),
  :global(luecke-gap[width='100%'] .feedback::after) {
    right: auto;
    left: 0.77rem;
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

  :global(.feedback.feedback--structured) {
    max-width: min(31rem, 92vw);
    min-width: min(21rem, 86vw);
    padding: 0.55rem;
    white-space: normal;
    line-height: 1.35;
  }

  .sheet :global(.freitext .feedback) {
    position: static;
    inset: auto;
    z-index: auto;
    display: none;
    width: 100%;
    max-width: none;
    min-width: 0;
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }

  .sheet :global(.freitext .feedback--visible) {
    display: block;
    transform: none;
  }

  .sheet :global(.freitext .feedback::before),
  .sheet :global(.freitext .feedback::after) {
    display: none;
  }

  .sheet :global(.freitext .feedback.feedback--structured) {
    max-width: none;
    min-width: 0;
  }

  :global(.feedback .freitext-feedback) {
    display: grid;
    gap: 8px;
    color: #334155;
  }

  :global(.freitext-feedback__prompt),
  :global(.freitext-feedback__summary),
  :global(.freitext-feedback__group) {
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: rgba(255, 255, 255, 0.92);
  }

  :global(.freitext-feedback__prompt) {
    border-color: #bfdbfe;
    background: #eff6ff;
  }

  :global(.freitext-feedback__summary) {
    border-color: #cbd5e1;
    background: #f8fafc;
  }

  :global(.freitext-feedback__heading),
  :global(.freitext-feedback__group-title) {
    margin: 0 0 4px;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #475569;
  }

  :global(.freitext-feedback__prompt .freitext-feedback__heading) {
    color: #1d4ed8;
  }

  :global(.freitext-feedback__body) {
    color: #1f2937;
    overflow-wrap: anywhere;
  }

  :global(.freitext-feedback__groups) {
    display: grid;
    gap: 6px;
  }

  :global(.freitext-feedback__group--fulfilled) {
    border-color: #bbf7d0;
    background: #f0fdf4;
  }

  :global(.freitext-feedback__group--partial) {
    border-color: #fde68a;
    background: #fffbeb;
  }

  :global(.freitext-feedback__group--wrong) {
    border-color: #fecaca;
    background: #fff1f2;
  }

  :global(.freitext-feedback__group--missing) {
    border-color: #cbd5e1;
    background: #f8fafc;
  }

  :global(.freitext-feedback__group--fulfilled .freitext-feedback__group-title) {
    color: #15803d;
  }

  :global(.freitext-feedback__group--partial .freitext-feedback__group-title) {
    color: #b45309;
  }

  :global(.freitext-feedback__group--wrong .freitext-feedback__group-title) {
    color: #b91c1c;
  }

  :global(.freitext-feedback__group--missing .freitext-feedback__group-title) {
    color: #475569;
  }

  :global(.freitext-feedback__list) {
    margin: 0;
    padding-left: 1rem;
    color: #1f2937;
  }

  :global(.freitext-feedback__list li + li) {
    margin-top: 3px;
  }

  :global(umfrage-matrix) {
    display: block;
    margin: 1.27rem 0;
  }

  :global(umfrage-matrix .umfrage-matrix__scroll) {
    position: relative;
    overflow-x: auto;
  }

  :global(umfrage-matrix .umfrage-matrix__frame) {
    position: relative;
    display: inline-block;
    min-width: 100%;
    padding-right: 1.87rem;
    box-sizing: border-box;
  }

  :global(umfrage-matrix .umfrage-matrix__table) {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    min-width: 442px;
  }

  :global(umfrage-matrix .umfrage-matrix__col-statement) {
    min-width: 187px;
  }

  :global(umfrage-matrix th),
  :global(umfrage-matrix td) {
    border: 1px solid #e2d8cc;
    padding: 0.47rem 0.6rem;
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
    right: -1.06rem;
    min-width: 0.77rem;
    padding: 0;
    border: 0;
    background: transparent;
    text-align: center;
    font-size: 0.65rem;
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
    font-size: 0.85rem;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-label) {
    display: block;
    font-size: 0.65rem;
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
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: #2f8f83;
  }

  :global(umfrage-matrix .umfrage-matrix__option input:focus-visible) {
    outline: 2px solid rgba(47, 143, 131, 0.45);
    outline-offset: 2px;
  }

  @media (max-width: 720px) {
    :global(umfrage-matrix .umfrage-matrix__table) {
      min-width: 357px;
    }
  }

  @media (max-width: 720px) {
    .progress-card {
      width: 100%;
    }
  }
</style>
