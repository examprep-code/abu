<script>
  export const ssr = false;

  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { loadConfig } from '$lib/config';

  let apiBaseUrl = '';
  let configError = '';
  let ready = false;

  let token = '';
  let userEmail = '';

  let loginEmail = '';
  let loginPassword = '';
  let loginLoading = false;
  let loginError = '';

  let sheets = [];
  let loadingSheets = false;
  let sheetError = '';

  let selectedId = null;
  let editorContent = '';
  let saving = false;
  let saveState = '';

  let creating = false;
  let deleting = false;

  const STORAGE_KEY = 'abu.auth';

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

    if (browser) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (saved?.token) {
            await validateToken(saved.token);
          }
        } catch (err) {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
  });

  const apiFetch = async (path, options = {}) => {
    if (!apiBaseUrl) {
      throw new Error('API Base URL fehlt');
    }
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  };

  const readPayload = async (res) => {
    try {
      return await res.json();
    } catch {
      return { warning: 'Antwort ist kein JSON', data: {} };
    }
  };

  const persistAuth = (newToken, email) => {
    token = newToken;
    userEmail = email;
    if (browser) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token: newToken, email })
      );
    }
  };

  const clearAuth = () => {
    token = '';
    userEmail = '';
    if (browser) {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const validateToken = async (existingToken) => {
    if (!apiBaseUrl) return;
    try {
      const res = await fetch(
        `${apiBaseUrl}user/login//${encodeURIComponent(existingToken)}`
      );
      const payload = await readPayload(res);
      if (res.ok && payload?.data?.valid) {
        persistAuth(existingToken, payload?.data?.user?.email ?? '');
        await fetchSheets();
      } else {
        clearAuth();
      }
    } catch {
      clearAuth();
    }
  };

  const login = async () => {
    loginError = '';
    loginLoading = true;
    try {
      const res = await apiFetch('user/login', {
        method: 'POST',
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        })
      });
      const payload = await readPayload(res);
      if (!res.ok || !payload?.data?.token) {
        loginError = payload?.warning || 'Login fehlgeschlagen';
        return;
      }
      persistAuth(payload.data.token, payload?.data?.user?.email ?? '');
      loginPassword = '';
      await fetchSheets();
    } catch (err) {
      loginError = err?.message ?? 'Login fehlgeschlagen';
    } finally {
      loginLoading = false;
    }
  };

  const logout = async () => {
    try {
      await apiFetch('user/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    clearAuth();
    sheets = [];
    selectedId = null;
    editorContent = '';
  };

  const fetchSheets = async () => {
    if (!token) return;
    loadingSheets = true;
    sheetError = '';
    try {
      const res = await apiFetch('sheet');
      const payload = await readPayload(res);
      if (!res.ok) {
        sheetError = payload?.warning || 'Sheets konnten nicht geladen werden';
        return;
      }
      const list = payload?.data?.sheet ?? [];
      sheets = list;
      if (list.length) {
        const nextId = selectedId ?? list[0].id;
        selectSheet(nextId);
      } else {
        selectedId = null;
        editorContent = '';
      }
    } catch (err) {
      sheetError = err?.message ?? 'Sheets konnten nicht geladen werden';
    } finally {
      loadingSheets = false;
    }
  };

  const selectSheet = (id) => {
    selectedId = id;
    const current = sheets.find((sheet) => sheet.id === id);
    editorContent = current?.content ?? '';
    saveState = '';
  };

  const createSheet = async () => {
    creating = true;
    try {
      const res = await apiFetch('sheet', {
        method: 'POST',
        body: JSON.stringify({ content: '' })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        sheetError = payload?.warning || 'Sheet konnte nicht erstellt werden';
        return;
      }
      await fetchSheets();
      if (payload?.data?.id) {
        selectSheet(payload.data.id);
      }
    } catch (err) {
      sheetError = err?.message ?? 'Sheet konnte nicht erstellt werden';
    } finally {
      creating = false;
    }
  };

  const saveSheet = async () => {
    if (!selectedId) return;
    saving = true;
    saveState = '';
    try {
      const res = await apiFetch('sheet', {
        method: 'PATCH',
        body: JSON.stringify({ id: selectedId, content: editorContent })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        saveState = payload?.warning || 'Speichern fehlgeschlagen';
        return;
      }
      const updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
      sheets = sheets.map((sheet) =>
        sheet.id === selectedId
          ? { ...sheet, content: editorContent, updated_at: updatedAt }
          : sheet
      );
      saveState = 'Gespeichert';
    } catch (err) {
      saveState = err?.message ?? 'Speichern fehlgeschlagen';
    } finally {
      saving = false;
    }
  };

  const deleteSheet = async () => {
    if (!selectedId) return;
    deleting = true;
    try {
      const res = await apiFetch('sheet', {
        method: 'DELETE',
        body: JSON.stringify({ id: selectedId })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        sheetError = payload?.warning || 'Sheet konnte nicht geloescht werden';
        return;
      }
      const nextSheets = sheets.filter((sheet) => sheet.id !== selectedId);
      sheets = nextSheets;
      if (nextSheets.length) {
        selectSheet(nextSheets[0].id);
      } else {
        selectedId = null;
        editorContent = '';
      }
    } catch (err) {
      sheetError = err?.message ?? 'Sheet konnte nicht geloescht werden';
    } finally {
      deleting = false;
    }
  };

  const stripHtml = (input) =>
    input
      ?.replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim() ?? '';
</script>

<svelte:head>
  <title>Abu Sheets</title>
</svelte:head>

<div class="app">
  <header class="topbar">
    <div>
      <p class="eyebrow">Abu</p>
      <h1>Sheets Studio</h1>
    </div>
    <div class="status">
      {#if token}
        <div>
          <p class="label">Angemeldet</p>
          <p class="value">{userEmail || 'User'}</p>
        </div>
        <button class="ghost" on:click={logout}>Logout</button>
      {:else}
        <span class="hint">Bitte einloggen, um loszulegen.</span>
      {/if}
    </div>
  </header>

  {#if !ready}
    <div class="card">
      <p>Lade Konfiguration…</p>
    </div>
  {:else if configError}
    <div class="card error">
      <p>{configError}</p>
      <p class="hint">Bitte config.json pruefen.</p>
    </div>
  {:else if !token}
    <div class="login">
      <div class="card">
        <h2>Login</h2>
        <p class="hint">Nutze deine Zugangsdaten, um deine Arbeitsblaetter zu sehen.</p>
        <form on:submit|preventDefault={login}>
          <label>
            <span>Email</span>
            <input type="email" bind:value={loginEmail} placeholder="you@school.ch" />
          </label>
          <label>
            <span>Password</span>
            <input type="password" bind:value={loginPassword} placeholder="••••••••" />
          </label>
          {#if loginError}
            <p class="error-text">{loginError}</p>
          {/if}
          <button type="submit" disabled={loginLoading}>
            {loginLoading ? 'Login…' : 'Login'}
          </button>
        </form>
      </div>
      <div class="card highlight">
        <h3>Was du hier kannst</h3>
        <ul>
          <li>Arbeitsblaetter in HTML bearbeiten</li>
          <li>Mehrere Sheets verwalten</li>
          <li>Schnelles Preview im Browser</li>
        </ul>
      </div>
    </div>
  {:else}
    <div class="workspace">
      <aside class="panel">
        <div class="panel-header">
          <div>
            <h2>Deine Sheets</h2>
            <p class="hint">{sheets.length} Eintraege</p>
          </div>
          <button on:click={createSheet} disabled={creating}>
            {creating ? 'Neu…' : 'Neues Sheet'}
          </button>
        </div>
        {#if loadingSheets}
          <p class="hint">Lade Sheets…</p>
        {:else if sheetError}
          <p class="error-text">{sheetError}</p>
        {:else if sheets.length === 0}
          <p class="hint">Noch keine Sheets vorhanden.</p>
        {:else}
          <div class="list">
            {#each sheets as sheet}
              <button
                class:selected={sheet.id === selectedId}
                on:click={() => selectSheet(sheet.id)}
              >
                <div class="list-title">Sheet #{sheet.id}</div>
                <div class="list-preview">
                  {stripHtml(sheet.content).slice(0, 80) || 'Leerer Inhalt'}
                </div>
                <div class="list-meta">
                  {sheet.updated_at ? `Zuletzt: ${sheet.updated_at}` : ''}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </aside>

      <main class="panel editor">
        {#if !selectedId}
          <div class="empty">
            <h2>Kein Sheet gewaehlt</h2>
            <p>Erstelle ein neues Sheet oder waehle links eines aus.</p>
          </div>
        {:else}
          <div class="editor-header">
            <div>
              <h2>Sheet #{selectedId}</h2>
              <p class="hint">HTML direkt bearbeiten. Speichern erzeugt eine neue Version.</p>
            </div>
            <div class="actions">
              <button class="ghost" on:click={deleteSheet} disabled={deleting}>
                {deleting ? 'Loeschen…' : 'Loeschen'}
              </button>
              <button on:click={saveSheet} disabled={saving}>
                {saving ? 'Speichere…' : 'Speichern'}
              </button>
            </div>
          </div>
          {#if saveState}
            <p class:success={saveState === 'Gespeichert'} class="hint">{saveState}</p>
          {/if}
          <div class="editor-body">
            <textarea bind:value={editorContent} spellcheck="false"></textarea>
            <div class="preview">
              <div class="preview-header">Preview</div>
              <div class="preview-body">
                {@html editorContent}
              </div>
            </div>
          </div>
        {/if}
      </main>
    </div>
  {/if}
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600&family=IBM+Plex+Sans:wght@400;500&display=swap');

  :global(body) {
    margin: 0;
    font-family: 'IBM Plex Sans', sans-serif;
    background: radial-gradient(circle at top, #f8f1e9 0%, #f0f3fa 45%, #e6eef4 100%);
    color: #1c2333;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .app {
    min-height: 100vh;
    padding: 32px clamp(20px, 4vw, 48px) 48px;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 24px;
    margin-bottom: 32px;
  }

  .topbar h1 {
    margin: 0;
    font-family: 'Space Grotesk', sans-serif;
    font-size: clamp(28px, 4vw, 40px);
    letter-spacing: -0.02em;
  }

  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.24em;
    font-size: 12px;
    margin: 0 0 6px;
    color: #5c6370;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .status .label {
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: #6f7682;
  }

  .status .value {
    margin: 0;
    font-weight: 600;
  }

  .hint {
    color: #6f7682;
    font-size: 14px;
  }

  .card {
    background: #ffffffcc;
    backdrop-filter: blur(12px);
    padding: 24px;
    border-radius: 18px;
    box-shadow: 0 12px 30px rgba(20, 24, 40, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.6);
  }

  .card.highlight {
    background: linear-gradient(140deg, #1f7a6e 0%, #2d9d8f 60%, #3bb6a7 100%);
    color: #f4f7f6;
  }

  .card.highlight h3 {
    margin-top: 0;
  }

  .card.highlight ul {
    margin: 0;
    padding-left: 18px;
  }

  .card.error {
    border-color: #f3b4b4;
  }

  .login {
    display: grid;
    grid-template-columns: minmax(260px, 360px) minmax(260px, 1fr);
    gap: 24px;
  }

  label {
    display: grid;
    gap: 8px;
    margin-bottom: 16px;
    font-weight: 500;
  }

  input,
  textarea {
    font: inherit;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid #d9dee7;
    background: #ffffff;
  }

  textarea {
    min-height: 360px;
    width: 100%;
    resize: vertical;
    font-family: 'IBM Plex Sans', sans-serif;
  }

  button {
    border: none;
    padding: 12px 18px;
    border-radius: 999px;
    font-weight: 600;
    background: #1f7a6e;
    color: white;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  button:hover:enabled {
    transform: translateY(-1px);
    box-shadow: 0 10px 18px rgba(31, 122, 110, 0.25);
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  button.ghost {
    background: transparent;
    color: #1f7a6e;
    border: 1px solid #b8d7d2;
  }

  .error-text {
    color: #b23a3a;
    font-weight: 500;
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
    gap: 24px;
  }

  .panel {
    background: #ffffffcc;
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 12px 30px rgba(20, 24, 40, 0.12);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .list {
    display: grid;
    gap: 12px;
  }

  .list button {
    text-align: left;
    background: #f5f7fa;
    color: #1c2333;
    border-radius: 14px;
    padding: 14px;
    border: 1px solid transparent;
  }

  .list button.selected {
    border-color: #1f7a6e;
    background: #e6f3f1;
  }

  .list-title {
    font-weight: 600;
    margin-bottom: 6px;
  }

  .list-preview {
    font-size: 13px;
    color: #4d5565;
  }

  .list-meta {
    font-size: 12px;
    color: #8a909c;
    margin-top: 6px;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .editor-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px;
    align-items: stretch;
  }

  .preview {
    border-radius: 14px;
    border: 1px solid #d9dee7;
    overflow: hidden;
    background: white;
    display: flex;
    flex-direction: column;
  }

  .preview-header {
    padding: 10px 14px;
    background: #f5f7fa;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: #6f7682;
  }

  .preview-body {
    padding: 16px;
    overflow: auto;
  }

  .empty {
    text-align: center;
    padding: 40px 20px;
  }

  .actions {
    display: flex;
    gap: 12px;
  }

  .success {
    color: #1f7a6e;
  }

  @media (max-width: 900px) {
    .topbar {
      flex-direction: column;
      align-items: flex-start;
    }

    .login {
      grid-template-columns: 1fr;
    }

    .workspace {
      grid-template-columns: 1fr;
    }

    .editor-body {
      grid-template-columns: 1fr;
    }
  }
</style>
