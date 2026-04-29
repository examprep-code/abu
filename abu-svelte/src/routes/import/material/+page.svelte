<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { loadConfig } from '$lib/config';

  const AUTH_STORAGE_KEY = 'abu.auth';

  let apiBaseUrl = '';
  let token = '';
  let configError = '';
  let ready = false;

  let files = [];
  let loading = false;
  let errorText = '';
  let result = null;

  onMount(async () => {
    try {
      const config = await loadConfig();
      apiBaseUrl = config.apiBaseUrl.endsWith('/') ? config.apiBaseUrl : `${config.apiBaseUrl}/`;
    } catch (err) {
      configError = err?.message ?? 'config konnte nicht geladen werden';
    } finally {
      ready = true;
    }

    if (browser) {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          token = saved?.token ?? '';
        } catch {
          token = '';
        }
      }
    }
  });

  const readPayload = async (res) => {
    try {
      return await res.json();
    } catch {
      return { warning: 'Antwort ist kein JSON', data: {} };
    }
  };

  const onPickFiles = (event) => {
    const list = event?.currentTarget?.files;
    files = list ? Array.from(list) : [];
    errorText = '';
    result = null;
  };

  const submit = async () => {
    errorText = '';
    result = null;
    if (!token) {
      errorText = 'Bitte zuerst einloggen.';
      return;
    }
    if (!files.length) {
      errorText = 'Bitte .pdf oder .docx auswählen.';
      return;
    }

    loading = true;
    try {
      const form = new FormData();
      files.forEach((file) => form.append('files[]', file, file.name));

      const res = await fetch(`${apiBaseUrl}import/material`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form
      });

      const payload = await readPayload(res);
      if (!res.ok) {
        errorText = payload?.warning || 'Import fehlgeschlagen';
        result = payload?.data ?? null;
        return;
      }
      result = payload?.data ?? null;
    } catch (err) {
      errorText = err?.message ?? 'Import fehlgeschlagen';
    } finally {
      loading = false;
    }
  };
</script>

<svelte:head>
  <title>Material importieren</title>
</svelte:head>

<div class="app">
  <header class="topbar">
    <div>
      <p class="eyebrow">ABU</p>
      <h1>Material importieren</h1>
      <p class="hint">Lade .docx oder .pdf hoch und erzeuge automatisch ein Sheet mit Lücken.</p>
    </div>
    <div class="status">
      <a class="ghost" href="/">&larr; Zurück</a>
    </div>
  </header>

  {#if !ready}
    <div class="card">
      <p>Lade Konfiguration…</p>
    </div>
  {:else if configError}
    <div class="card error">
      <p>{configError}</p>
      <p class="hint">Bitte config.json prüfen.</p>
    </div>
  {:else if !token}
    <div class="card error">
      <p>Du bist nicht eingeloggt.</p>
      <p class="hint">Bitte gehe zur Startseite und logge dich ein.</p>
    </div>
  {:else}
    <div class="grid">
      <div class="card">
        <h2>Upload</h2>
        <label>
          <span>Dateien</span>
          <input type="file" multiple accept=".pdf,.docx" on:change={onPickFiles} />
        </label>
        {#if files.length}
          <p class="hint">{files.length} Datei(en) ausgewählt</p>
        {/if}
        {#if errorText}
          <p class="error-text">{errorText}</p>
        {/if}
        <button class="ci-btn-primary" type="button" on:click={submit} disabled={loading}>
          {loading ? 'Importiere…' : 'Import starten'}
        </button>
      </div>

      <div class="card">
        <h2>Ergebnis</h2>
        {#if !result}
          <p class="hint">Noch kein Import gestartet.</p>
        {:else}
          {#if result?.sheets?.length}
            <h3>Erzeugte Sheets</h3>
            <ul>
              {#each result.sheets as sheet (sheet.key)}
                <li>
                  <a href={`/?sheet=${encodeURIComponent(sheet.key)}`} target="_blank" rel="noreferrer">
                    {sheet.name || sheet.key}
                  </a>
                  <span class="hint">
                    {sheet.source_file ? ` — ${sheet.source_file}` : ''}
                  </span>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="hint">Keine Sheets erzeugt.</p>
          {/if}

          {#if result?.errors?.length}
            <h3>Fehler</h3>
            <ul>
              {#each result.errors as entry, index (index)}
                <li>
                  <strong>{entry.file || 'Datei'}</strong>: {entry.error || 'Fehler'}
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    background: radial-gradient(circle at top, #f8f1e9 0%, #f0f3fa 45%, #e6eef4 100%);
    color: #1c2333;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .app {
    min-height: 100vh;
    padding: 27px clamp(17px, 4vw, 41px) 41px;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 20px;
    margin-bottom: 27px;
  }

  .topbar h1 {
    margin: 0;
    font-family: 'Space Grotesk', sans-serif;
    font-size: clamp(24px, 4vw, 34px);
    letter-spacing: -0.02em;
  }

  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.24em;
    font-size: 10px;
    margin: 0 0 5px;
    color: #5c6370;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .hint {
    color: #6f7682;
    font-size: 12px;
  }

  .card {
    background: #ffffffcc;
    backdrop-filter: blur(10px);
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 10px 26px rgba(20, 24, 40, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.6);
  }

  .card.error {
    border-color: #f3b4b4;
  }

  .grid {
    display: grid;
    grid-template-columns: minmax(221px, 357px) minmax(221px, 1fr);
    gap: 20px;
  }

  label {
    display: grid;
    gap: 7px;
    margin-bottom: 14px;
    font-weight: 500;
  }

  input[type='file'] {
    width: 100%;
  }

  .error-text {
    color: #b82020;
    font-weight: 600;
  }

  ul {
    margin: 10px 0 0;
    padding-left: 15px;
  }

  h2 {
    margin-top: 0;
  }

  h3 {
    margin: 15px 0 7px;
  }
</style>
