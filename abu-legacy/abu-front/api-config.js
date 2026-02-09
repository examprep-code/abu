(function () {
  // Zentrale API-Konfiguration für Frontend und Tests
  window.API_CONFIG = window.API_CONFIG || {};

  function loadEnvFile(path) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', path, false);
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        return xhr.responseText || '';
      }
    } catch (err) {
      // Ignorieren: Fallbacks werden weiter unten genutzt
    }
    return '';
  }

  function parseEnv(content) {
    const result = {};
    (content || '').split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (key) result[key] = value;
    });
    return result;
  }

  // Versuche .env im aktuellen Verzeichnis, dann eine Ebene höher zu laden
  const envContent = loadEnvFile('./.env') || loadEnvFile('../.env');
  const env = parseEnv(envContent);

  const origin = window.location.origin || '';
  const defaultBackend = origin ? new URL('../abu-back/', window.location.href).toString() : '';
  const defaultFrontend = origin ? new URL('../abu-front/', window.location.href).toString() : '';

  window.API_CONFIG.backendBaseUrl =
    window.API_CONFIG.backendBaseUrl || env.BACKEND_BASE_URL || defaultBackend;
  window.API_CONFIG.frontendBaseUrl =
    window.API_CONFIG.frontendBaseUrl || env.FRONTEND_BASE_URL || defaultFrontend;
  window.API_CONFIG.defaultSheet =
    window.API_CONFIG.defaultSheet || env.DEFAULT_SHEET || 'index.html';
  window.API_CONFIG.defaultUser =
    window.API_CONFIG.defaultUser || env.DEFAULT_USER || 'dummywert';
})();
