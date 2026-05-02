<script>
  import { onMount } from 'svelte';
  import { loadConfig } from '$lib/config';
  import { applySchoolCiCss } from '$lib/ci';

  const STORAGE_KEY = 'abu.learner';
  const ARCHIVED_STATUS = 'archiviert';

  let apiBaseUrl = '';
  let configError = '';
  let loading = true;
  let redirecting = false;

  let learner = null;
  let sheets = [];
  let loadingSheets = false;
  let sheetError = '';

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
    if (typeof localStorage === 'undefined') return;
    if (nextLearner) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextLearner));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const readLearnerCode = () => {
    let urlCode = '';
    if (typeof window !== 'undefined') {
      const params = new URL(window.location.href).searchParams;
      urlCode = (params.get('token') || params.get('code') || '').replace(/\s+/g, '');
    }
    if (urlCode) return urlCode;

    if (typeof localStorage === 'undefined') return '';
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const stored = raw ? JSON.parse(raw) : null;
      return (stored?.code || '').replace(/\s+/g, '');
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return '';
    }
  };

  const clearLearnerCodeFromUrl = () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    url.searchParams.delete('code');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  };

  const clearLearnerState = () => {
    persistLearner(null);
    sheets = [];
    sheetError = '';
    loadingSheets = false;
  };

  const redirectToHome = () => {
    clearLearnerState();
    redirecting = true;
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  };

  const showConfigError = () => {
    loading = false;
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
    if (!apiBaseUrl || !learner?.code) return;
    loadingSheets = true;
    sheetError = '';
    try {
      const res = await fetch(
        `${apiBaseUrl}sheet/public-list?code=${encodeURIComponent(learner.code)}`
      );
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

  const logoutLearner = () => {
    clearLearnerCodeFromUrl();
    redirectToHome();
  };

  const buildSheetHref = (sheetKey) => {
    const key = String(sheetKey ?? '').trim();
    if (!key) return '/lernende/';
    const params = new URLSearchParams();
    const code = String(learner?.code ?? '').trim();
    if (code) params.set('code', code);
    const classroom = String(learner?.classroom ?? '').trim();
    if (classroom) params.set('classroom', classroom);
    return `/sheet/${key}/?${params.toString()}`;
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
      const timeA = Date.parse(String(a?.updated_at ?? a?.created_at ?? '')) || 0;
      const timeB = Date.parse(String(b?.updated_at ?? b?.created_at ?? '')) || 0;
      if (timeB !== timeA) return timeB - timeA;
      const nameA = String(a?.name ?? a?.key ?? '').toLowerCase();
      const nameB = String(b?.name ?? b?.key ?? '').toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });

  $: sortedSheets = sortSheetsByUpdate(sheets);
  $: activeSheets = sortedSheets.filter(
    (entry) => normalizeStatus(entry?.assignment_status) !== ARCHIVED_STATUS
  );
  $: archivedSheets = sortedSheets.filter(
    (entry) => normalizeStatus(entry?.assignment_status) === ARCHIVED_STATUS
  );
  $: sheetGroups = [
    {
      title: 'Freigegeben',
      entries: activeSheets,
      emptyText: 'Keine freigegebenen Arbeitsblätter.'
    },
    {
      title: 'Archiviert',
      entries: archivedSheets,
      emptyText: 'Keine archivierten Arbeitsblätter.',
      archived: true
    }
  ];

  onMount(async () => {
    const code = readLearnerCode();
    if (!code) {
      redirectToHome();
      return;
    }

    try {
      const config = await loadConfig();
      apiBaseUrl = config.apiBaseUrl.endsWith('/')
        ? config.apiBaseUrl
        : `${config.apiBaseUrl}/`;
    } catch (err) {
      configError = err?.message ?? 'config konnte nicht geladen werden';
      showConfigError();
      return;
    }

    const validated = await validateLearner(code);
    clearLearnerCodeFromUrl();

    if (!validated) {
      redirectToHome();
      return;
    }

    persistLearner(validated);
    await loadSheets();
    loading = false;
  });
</script>

{#if redirecting}
  <div class="page">
    <div class="state">Weiterleitung zur Startseite...</div>
  </div>
{:else}
  <div class="page">
    <header class="hero">
      <div>
        <p class="eyebrow">ABU</p>
        <h1>Lernendenportal</h1>
        <p class="meta">Ihre freigegebenen Arbeitsblätter.</p>
      </div>
      {#if learner}
        <div class="status-card">
          <strong>Eingeloggt als</strong>
          <span>{learner.name} ({learner.code})</span>
          <button class="secondary" type="button" on:click={logoutLearner}>Ausloggen</button>
        </div>
      {/if}
    </header>

    {#if configError}
      <div class="state error">{configError}</div>
    {:else if loading}
      <div class="state">Lade Konfiguration...</div>
    {:else if !learner}
      <div class="state">Weiterleitung zur Startseite...</div>
    {:else}
      <section class="sheet-section">
        <div class="section-head">
          <h2>Arbeitsblätter</h2>
          <button
            class="icon-btn ci-btn-outline refresh-btn"
            type="button"
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
          <p class="state">Keine Arbeitsblätter gefunden.</p>
        {:else}
          <div class="sheet-groups">
            {#each sheetGroups as group}
              <section class="sheet-group">
                <div class="group-head">
                  <h3>{group.title}</h3>
                  <span>{group.entries.length}</span>
                </div>
                {#if group.entries.length === 0}
                  <p class="state">{group.emptyText}</p>
                {:else}
                  <div class="sheet-list">
                    {#each group.entries as entry}
                      <a
                        class="sheet-item"
                        class:sheet-item--archived={group.archived}
                        href={buildSheetHref(entry.key)}
                      >
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
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </div>
{/if}

<style>
  :global(body) {
    margin: 0;
    font-family: var(--ci-font-body, Arial, sans-serif);
    background: radial-gradient(circle at top, #f7f6f4 0%, #eef0f5 52%, #e4e8ee 100%);
    color: #1c232f;
  }

  .page {
    min-height: 100vh;
    padding: 27px clamp(14px, 4vw, 48px) 54px;
    display: grid;
    gap: 20px;
  }

  .hero {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 17px;
  }

  .eyebrow {
    margin: 0 0 7px;
    font-size: 10px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #7a6f62;
  }

  h1 {
    margin: 0;
    font-family: var(--ci-font-title);
    font-size: clamp(24px, 4vw, 36px);
  }

  .meta {
    margin: 5px 0 0;
    color: #6b7280;
  }

  .status-card {
    background: #fff;
    border-radius: 14px;
    border: 1px solid #e2e8f0;
    padding: 12px 15px;
    display: grid;
    gap: 7px;
    min-width: 187px;
    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
  }

  .secondary {
    width: fit-content;
    padding: 9px 12px;
    border-radius: 999px;
    border: 1px solid #cbd5e1;
    background: #fff;
    cursor: pointer;
    font: inherit;
    font-weight: 600;
  }

  .sheet-section {
    display: grid;
    gap: 14px;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .section-head h2 {
    margin: 0;
    font-size: 19px;
  }

  .icon-btn {
    padding: 7px 9px;
    border-radius: 9px;
    font-size: 10px;
    cursor: pointer;
  }

  .icon-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .refresh-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .refresh-icon {
    width: 15px;
    height: 15px;
  }

  .sheet-groups {
    display: grid;
    gap: 12px;
  }

  .sheet-group {
    display: grid;
    gap: 9px;
  }

  .group-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 7px;
  }

  .group-head h3 {
    margin: 0;
    font-size: 14px;
  }

  .group-head span {
    min-width: 22px;
    text-align: center;
    border-radius: 999px;
    padding: 2px 7px;
    font-size: 10px;
    background: rgba(15, 23, 42, 0.08);
    color: #374151;
  }

  .sheet-list {
    display: grid;
    gap: 7px;
  }

  .sheet-item {
    background: rgba(255, 255, 255, 0.92);
    border-radius: 10px;
    border: 1px solid #dbe4ef;
    padding: 9px 10px;
    display: grid;
    gap: 3px;
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
    font-size: 12px;
    font-weight: 700;
    line-height: 1.25;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .assignment-symbol {
    width: 14px;
    height: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #4b5563;
  }

  .assignment-symbol svg {
    width: 12px;
    height: 12px;
  }

  .sheet-item__summary {
    font-size: 10px;
    color: #4b5563;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .state {
    padding: 9px 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid #e2e8f0;
  }

  .state.error {
    border-color: #fecaca;
    color: #b91c1c;
    background: #fef2f2;
  }
</style>
