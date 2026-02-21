<script context="module">
</script>

<script>
  import { onMount } from 'svelte';
  import { loadConfig } from '$lib/config';
  import { applySchoolCiCss } from '$lib/ci';

  const STORAGE_KEY = 'abu.learner';
  const ARCHIVED_STATUS = 'archiviert';

  let apiBaseUrl = '';
  let configError = '';
  let ready = false;

  let learner = null;
  let loginCode = '';
  let loginError = '';
  let loginLoading = false;

  let sheets = [];
  let loadingSheets = false;
  let sheetError = '';
  let sortedSheets = [];
  let currentSheets = [];
  let archivedSheets = [];

  const readPayload = async (res) => {
    try {
      return await res.json();
    } catch {
      return { warning: 'Antwort ist kein JSON', data: {} };
    }
  };

  const persistLearner = (nextLearner) => {
    learner = nextLearner;
    applySchoolCiCss(nextLearner?.school_css);
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

  const loadSheets = async () => {
    if (!apiBaseUrl) return;
    loadingSheets = true;
    sheetError = '';
    try {
      const codeParam = learner?.code ? `?code=${encodeURIComponent(learner.code)}` : '';
      const res = await fetch(`${apiBaseUrl}sheet/public-list${codeParam}`);
      const payload = await readPayload(res);
      if (!res.ok) {
        sheetError = payload?.warning || 'Sheets konnten nicht geladen werden';
        sheets = [];
        return;
      }
      sheets = payload?.data?.sheet ?? [];
    } catch (err) {
      sheetError = err?.message ?? 'Sheets konnten nicht geladen werden';
    } finally {
      loadingSheets = false;
    }
  };

  const loginLearner = async () => {
    loginError = '';
    loginLoading = true;
    try {
      const cleaned = (loginCode || '').replace(/\s+/g, '');
      const validated = await validateLearner(cleaned);
      if (!validated) {
        loginError = 'Code ungueltig.';
        return;
      }
      persistLearner(validated);
      loginCode = '';
      await loadSheets();
    } catch (err) {
      loginError = err?.message ?? 'Login fehlgeschlagen';
    } finally {
      loginLoading = false;
    }
  };

  const buildSheetHref = (sheetKey) => {
    const key = String(sheetKey ?? '').trim();
    if (!key) return '/lernende';
    const params = new URLSearchParams();
    const code = String(learner?.code ?? '').trim();
    if (code) params.set('code', code);
    const classroom = String(learner?.classroom ?? '').trim();
    if (classroom) params.set('classroom', classroom);
    const query = params.toString();
    return query ? `/sheet/${key}?${query}` : `/sheet/${key}`;
  };

  const normalizeStatus = (status) => String(status ?? '').trim().toLowerCase();
  const isAnonymousAssignment = (entry) =>
    String(entry?.assignment_form ?? '')
      .trim()
      .toLowerCase() === 'anonym';

  const summarizeSheet = (entry) => {
    const summary = String(entry?.summary ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (summary) return summary;
    const key = String(entry?.key ?? '').trim();
    return key ? `Key: ${key}` : 'Keine Zusammenfassung';
  };

  const sortSheetsByUpdate = (entries) =>
    [...entries].sort((a, b) => {
      const timeA = Date.parse(String(a?.updated_at ?? '')) || 0;
      const timeB = Date.parse(String(b?.updated_at ?? '')) || 0;
      if (timeB !== timeA) return timeB - timeA;
      const nameA = String(a?.name ?? a?.key ?? '').toLowerCase();
      const nameB = String(b?.name ?? b?.key ?? '').toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });

  $: sortedSheets = sortSheetsByUpdate(sheets);
  $: currentSheets = sortedSheets.filter(
    (entry) => normalizeStatus(entry?.assignment_status) !== ARCHIVED_STATUS
  );
  $: archivedSheets = sortedSheets.filter(
    (entry) => normalizeStatus(entry?.assignment_status) === ARCHIVED_STATUS
  );

  onMount(async () => {
    try {
      const config = await loadConfig();
      apiBaseUrl = config.apiBaseUrl.endsWith('/')
        ? config.apiBaseUrl
        : `${config.apiBaseUrl}/`;
    } catch (err) {
      configError = err?.message ?? 'config konnte nicht geladen werden';
    } finally {
      ready = true;
    }

    if (typeof localStorage !== 'undefined') {
      if (typeof window !== 'undefined') {
        const params = new URL(window.location.href).searchParams;
        const urlCode = (params.get('code') || '').replace(/\s+/g, '');
        if (urlCode) {
          const validated = await validateLearner(urlCode);
          params.delete('code');
          const newUrl =
            window.location.pathname +
            (params.toString() ? `?${params.toString()}` : '') +
            window.location.hash;
          window.history.replaceState({}, document.title, newUrl);
          if (validated) {
            persistLearner(validated);
            await loadSheets();
            return;
          }
          loginError = 'Code ungueltig.';
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
              await loadSheets();
              return;
            }
          }
        } catch {
          // ignore
        }
      }
    }
  });
</script>

<div class="page">
  <header class="hero">
    <div>
      <p class="eyebrow">ABU</p>
      <h1>Lernenden-Login</h1>
      <p class="meta">Arbeitsblaetter mit deinem Identifikationscode oeffnen.</p>
    </div>
    {#if learner}
      <div class="status-card">
        <strong>Eingeloggt als</strong>
        <span>{learner.name} ({learner.code})</span>
      </div>
    {/if}
  </header>

  {#if configError}
    <div class="state error">{configError}</div>
  {:else if !ready}
    <div class="state">Lade Konfiguration...</div>
  {:else}
    {#if !learner}
      <section class="login-card">
        <h2>Identifikationscode</h2>
        <p>Bitte gib deinen 12-stelligen Code ein.</p>
        <div class="login-row">
          <input
            type="text"
            inputmode="numeric"
            placeholder="123456789012"
            bind:value={loginCode}
          />
          <button class="primary" on:click={loginLearner} disabled={loginLoading}>
            {loginLoading ? '...' : 'Einloggen'}
          </button>
        </div>
        {#if loginError}
          <p class="state error">{loginError}</p>
        {/if}
      </section>
    {:else}
      <section class="sheet-section">
        <div class="section-head">
          <h2>Arbeitsblaetter</h2>
          <button
            class="icon-btn ci-btn-outline refresh-btn"
            on:click={loadSheets}
            disabled={loadingSheets}
            title="Sheets aktualisieren"
            aria-label="Sheets aktualisieren"
          >
            <svg class="refresh-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66M18 4v4h-4M6 20v-4h4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
        {#if loadingSheets}
          <p class="state">Lade Sheets...</p>
        {:else if sheetError}
          <p class="state error">{sheetError}</p>
        {:else if sheets.length === 0}
          <p class="state">Keine Arbeitsblaetter gefunden.</p>
        {:else}
          <div class="sheet-groups">
            <section class="sheet-group">
              <div class="group-head">
                <h3>Aktuell</h3>
                <span>{currentSheets.length}</span>
              </div>
              {#if currentSheets.length === 0}
                <p class="state">Keine aktuellen Arbeitsblaetter.</p>
              {:else}
                <div class="sheet-list">
                  {#each currentSheets as entry}
                    <a class="sheet-item" href={buildSheetHref(entry.key)}>
                      <span class="sheet-item__title">
                        {entry.name || `Sheet ${entry.key}`}
                        {#if isAnonymousAssignment(entry)}
                          <span
                            class="assignment-symbol"
                            title="Anonyme Zuweisung"
                            aria-label="Anonyme Zuweisung"
                          >
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
                        {/if}
                      </span>
                      <span class="sheet-item__summary">{summarizeSheet(entry)}</span>
                    </a>
                  {/each}
                </div>
              {/if}
            </section>
            <section class="sheet-group">
              <div class="group-head">
                <h3>Archiviert</h3>
                <span>{archivedSheets.length}</span>
              </div>
              {#if archivedSheets.length === 0}
                <p class="state">Keine archivierten Arbeitsblaetter.</p>
              {:else}
                <div class="sheet-list">
                  {#each archivedSheets as entry}
                    <a class="sheet-item sheet-item--archived" href={buildSheetHref(entry.key)}>
                      <span class="sheet-item__title">
                        {entry.name || `Sheet ${entry.key}`}
                        {#if isAnonymousAssignment(entry)}
                          <span
                            class="assignment-symbol"
                            title="Anonyme Zuweisung"
                            aria-label="Anonyme Zuweisung"
                          >
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
                        {/if}
                      </span>
                      <span class="sheet-item__summary">{summarizeSheet(entry)}</span>
                    </a>
                  {/each}
                </div>
              {/if}
            </section>
          </div>
        {/if}
      </section>
    {/if}
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: var(--ci-font-body, Arial, sans-serif);
    background: radial-gradient(circle at top, #f7f6f4 0%, #eef0f5 52%, #e4e8ee 100%);
    color: #1c232f;
  }

  .page {
    min-height: 100vh;
    padding: 32px clamp(16px, 4vw, 56px) 64px;
    display: grid;
    gap: 24px;
  }

  .hero {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
  }

  .eyebrow {
    margin: 0 0 8px;
    font-size: 11px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #7a6f62;
  }

  h1 {
    margin: 0;
    font-family: var(--ci-font-title);
    font-size: clamp(28px, 4vw, 42px);
  }

  .meta {
    margin: 6px 0 0;
    color: #6b7280;
  }

  .status-card {
    background: #fff;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    padding: 14px 18px;
    display: grid;
    gap: 6px;
    min-width: 220px;
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
  }

  .login-card {
    background: #fff;
    border-radius: 18px;
    padding: 22px;
    border: 1px solid #e2e8f0;
    max-width: 520px;
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
    display: grid;
    gap: 12px;
  }

  .login-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .login-row input {
    flex: 1 1 220px;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid #cbd5e1;
    font-size: 16px;
  }

  .primary {
    padding: 10px 16px;
    border-radius: 999px;
    border: 1px solid #0f172a;
    background: #0f172a;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
  }

  .primary:hover {
    background: #1f2937;
    color: #fff;
  }

  .icon-btn {
    padding: 8px 10px;
    border-radius: 10px;
    font-size: 12px;
    cursor: pointer;
  }

  .icon-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .refresh-btn {
    width: 38px;
    height: 38px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .refresh-icon {
    width: 18px;
    height: 18px;
  }

  .sheet-section {
    display: grid;
    gap: 16px;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .sheet-groups {
    display: grid;
    gap: 14px;
  }

  .sheet-group {
    display: grid;
    gap: 10px;
  }

  .group-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .group-head h3 {
    margin: 0;
    font-size: 16px;
  }

  .group-head span {
    min-width: 26px;
    text-align: center;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 12px;
    background: rgba(15, 23, 42, 0.08);
    color: #374151;
  }

  .sheet-list {
    display: grid;
    gap: 8px;
  }

  .sheet-item {
    background: rgba(255, 255, 255, 0.92);
    border-radius: 12px;
    border: 1px solid #dbe4ef;
    padding: 10px 12px;
    display: grid;
    gap: 4px;
    text-decoration: none;
    color: inherit;
    transition: border-color 120ms ease, background 120ms ease, transform 120ms ease;
  }

  .sheet-item:hover {
    border-color: #0f172a;
    background: #fff;
    transform: translateY(-1px);
  }

  .sheet-item--archived {
    opacity: 0.78;
  }

  .sheet-item__title {
    font-size: 14px;
    font-weight: 700;
    line-height: 1.25;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .assignment-symbol {
    width: 16px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #4b5563;
  }

  .assignment-symbol svg {
    width: 14px;
    height: 14px;
  }

  .sheet-item__summary {
    font-size: 12px;
    color: #4b5563;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .state {
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid #e2e8f0;
  }

  .state.error {
    border-color: #fecaca;
    color: #b91c1c;
    background: #fef2f2;
  }
</style>
