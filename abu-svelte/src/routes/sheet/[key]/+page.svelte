<script context="module">
  export const ssr = false;
</script>

<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import { page } from '$app/stores';
  import { loadConfig } from '$lib/config';
  import { createLueckeRuntime, ensureLueckeElements } from '$lib/luecke';
  import { applySchoolCiCss } from '$lib/ci';

  const STORAGE_KEY = 'abu.learner';

  let apiBaseUrl = '';
  let configError = '';
  let loading = true;
  let loadError = '';

  let sheetKey = '';
  let sheet = null;
  let sheetHtml = '';

  let progress = { percent: 0, answered: 0, total: 0 };

  let contentEl;
  let runtime = null;
  let lastLoadedKey = '';
  let lastRuntimeUser = '';

  let learner = null;
  let loginCode = '';
  let loginError = '';
  let loginLoading = false;
  let authReady = false;

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
      await setupRuntime();
    } catch (err) {
      loginError = err?.message ?? 'Login fehlgeschlagen';
    } finally {
      loginLoading = false;
    }
  };

  const logoutLearner = () => {
    persistLearner(null);
    runtime?.destroy();
    runtime = null;
    lastRuntimeUser = '';
    progress = { percent: 0, answered: 0, total: 0 };
  };

  async function fetchSheet(key) {
    if (!apiBaseUrl) return;
    loading = true;
    loadError = '';

    try {
      const res = await fetch(
        `${apiBaseUrl}sheet/public?key=${encodeURIComponent(key)}`
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        loadError = payload?.warning || 'Sheet nicht gefunden';
        sheet = null;
        sheetHtml = '';
        loading = false;
        return;
      }
      sheet = payload?.data ?? null;
      sheetHtml = sheet?.content ?? '';

      loading = false;
      await tick();
      await setupRuntime();
    } catch (err) {
      loadError = err?.message ?? 'Sheet konnte nicht geladen werden';
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
    } catch (err) {
      configError = err?.message ?? 'config konnte nicht geladen werden';
    }
    authReady = true;
    if (typeof localStorage !== 'undefined') {
      if (typeof window !== 'undefined') {
        const params = new URL(window.location.href).searchParams;
        const urlCode = (params.get('code') || '').trim();
        if (urlCode) {
          const validated = await validateLearner(urlCode.replace(/\s+/g, ''));
          if (validated) {
            persistLearner(validated);
            params.delete('code');
            const newUrl =
              window.location.pathname +
              (params.toString() ? `?${params.toString()}` : '') +
              window.location.hash;
            window.history.replaceState({}, document.title, newUrl);
          }
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

  $: {
    const nextKey = $page?.params?.key || '';
    sheetKey = nextKey;
    if (nextKey && apiBaseUrl && nextKey !== lastLoadedKey) {
      lastLoadedKey = nextKey;
      fetchSheet(nextKey);
    }
  }

  const setupRuntime = async () => {
    if (!contentEl || !apiBaseUrl || !sheetKey || !learner?.code) return;
    if (runtime && lastRuntimeUser === learner.code) {
      await runtime.refresh();
      return;
    }
    runtime?.destroy();
    runtime = createLueckeRuntime({
      root: contentEl,
      apiBaseUrl,
      sheetKey,
      user: learner.code,
      onProgress: updateProgress
    });
    lastRuntimeUser = learner.code;
    await runtime.refresh();
  };

  onDestroy(() => {
    runtime?.destroy();
  });
</script>

<div class="page">
  <header class="hero">
    <div class="hero-text">
      <p class="eyebrow">ABU - Lueckentext</p>
      <h1>{sheet?.name || (sheetKey ? `Sheet ${sheetKey}` : 'Lueckentext')}</h1>
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
        {#if learner}
          Aktuell als {learner.name} ({learner.code})
        {:else}
          Bitte zuerst einloggen
        {/if}
      </span>
    </div>
  </header>

  {#if authReady && !learner}
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
      {#if learner}
        Antworten werden automatisch unter deinem Code gespeichert.
        <button class="ghost ci-btn-outline" on:click={logoutLearner}>Abmelden</button>
      {:else}
        Bitte einloggen, damit deine Antworten gespeichert werden.
      {/if}
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
    gap: 28px;
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
    font-family: 'Fraunces', serif;
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
    font-family: 'Fraunces', serif;
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

  @media (max-width: 720px) {
    .progress-card {
      width: 100%;
    }
  }
</style>
