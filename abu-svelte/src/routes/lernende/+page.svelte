<script context="module">
</script>

<script>
  import { onMount } from 'svelte';
  import { loadConfig } from '$lib/config';
  import { applySchoolCiCss } from '$lib/ci';

  const STORAGE_KEY = 'abu.learner';

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

  const logoutLearner = () => {
    persistLearner(null);
  };

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
        <button class="ghost" on:click={logoutLearner}>Abmelden</button>
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
          <div class="sheet-grid">
            {#each sheets as entry}
              <article class="sheet-card">
                <h3>{entry.name || `Sheet ${entry.key}`}</h3>
                <p>Key: {entry.key}</p>
                <a class="sheet-link" href={`/sheet/${entry.key}`}>Oeffnen</a>
              </article>
            {/each}
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
    font-family: var(--ci-font-title, 'Arial Black', Arial, sans-serif);
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

  .primary,
  .ghost {
    padding: 10px 16px;
    border-radius: 999px;
    border: 1px solid #0f172a;
    background: #0f172a;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
  }

  .ghost {
    background: #fff;
    color: #0f172a;
  }

  .primary:hover,
  .ghost:hover {
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

  .sheet-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  .sheet-card {
    background: #fff;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    padding: 16px;
    display: grid;
    gap: 8px;
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
  }

  .sheet-link {
    align-self: flex-start;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid #0f172a;
    text-decoration: none;
    color: #0f172a;
    font-weight: 600;
  }

  .sheet-link:hover {
    background: #0f172a;
    color: #fff;
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
