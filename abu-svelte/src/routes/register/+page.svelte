<script context="module">
  export const ssr = false;
</script>

<script>
  import { onMount } from 'svelte';
  import { loadConfig } from '$lib/config';

  let apiBaseUrl = '';
  let configError = '';
  let ready = false;

  let email = '';
  let password = '';
  let registerLoading = false;
  let registerError = '';
  let registerSuccess = '';

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
  });

  const readPayload = async (res) => {
    try {
      return await res.json();
    } catch {
      return { warning: 'Antwort ist kein JSON', data: {} };
    }
  };

  const register = async () => {
    registerError = '';
    registerSuccess = '';
    registerLoading = true;
    try {
      const res = await fetch(`${apiBaseUrl}user/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        registerError = payload?.warning || 'Registrierung fehlgeschlagen';
        return;
      }
      registerSuccess = 'Registrierung erfolgreich. Du kannst dich jetzt einloggen.';
      password = '';
    } catch (err) {
      registerError = err?.message ?? 'Registrierung fehlgeschlagen';
    } finally {
      registerLoading = false;
    }
  };
</script>

<svelte:head>
  <title>Registrieren</title>
</svelte:head>

<div class="app">
  <header class="topbar">
    <div>
      <p class="eyebrow">Abu</p>
      <h1>Account erstellen</h1>
    </div>
    <div class="status">
      <a class="ghost" href="/">Zum Login</a>
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
  {:else}
    <div class="register">
      <div class="card">
        <h2>Registrierung</h2>
        <p class="hint">Erstelle einen Account, um deine Sheets zu verwalten.</p>
        <form on:submit|preventDefault={register}>
          <label>
            <span>Email</span>
            <input type="email" bind:value={email} placeholder="you@school.ch" />
          </label>
          <label>
            <span>Password</span>
            <input type="password" bind:value={password} placeholder="mind. 8 Zeichen" />
          </label>
          {#if registerError}
            <p class="error-text">{registerError}</p>
          {/if}
          {#if registerSuccess}
            <p class="success-text">{registerSuccess}</p>
          {/if}
          <button class="ci-btn-primary" type="submit" disabled={registerLoading}>
            {registerLoading ? 'Registriere…' : 'Registrieren'}
          </button>
        </form>
        <div class="link-row">
          <a href="/">Schon einen Account? Zum Login</a>
        </div>
      </div>
      <div class="card highlight">
        <h3>Hinweise</h3>
        <ul>
          <li>Deine Daten bleiben lokal in deiner DB.</li>
          <li>Passwort wird sicher gehasht gespeichert.</li>
          <li>Nach der Registrierung kannst du dich sofort einloggen.</li>
        </ul>
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

  .register {
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

  input {
    font: inherit;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid #d9dee7;
    background: #ffffff;
  }

  button {
    padding: 12px 18px;
    border-radius: 999px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  button:hover:enabled {
    transform: translateY(-1px);
    box-shadow: 0 10px 18px rgba(15, 23, 42, 0.16);
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  a.ghost {
    display: inline-flex;
    align-items: center;
    padding: 10px 16px;
    border-radius: 999px;
    font-weight: 600;
    text-decoration: none;
  }

  .error-text {
    color: #b23a3a;
    font-weight: 500;
  }

  .success-text {
    color: #1f7a6e;
    font-weight: 600;
  }

  .link-row {
    margin-top: 16px;
  }

  .link-row a {
    color: #1f7a6e;
    font-weight: 600;
    text-decoration: none;
  }

  .link-row a:hover {
    text-decoration: underline;
  }

  @media (max-width: 900px) {
    .topbar {
      flex-direction: column;
      align-items: flex-start;
    }

    .register {
      grid-template-columns: 1fr;
    }
  }
</style>
