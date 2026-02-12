<script context="module">
  export const ssr = false;
</script>

<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import { page } from '$app/stores';
  import { loadConfig } from '$lib/config';

  let apiBaseUrl = '';
  let configError = '';
  let loading = true;
  let loadError = '';
  let sheetKey = '';
  let sheet = null;
  let sheetHtml = '';
  let answers = [];
  let metaText = '';

  let contentEl;
  let lastLoadedKey = '';

  const escapeHtml = (str = '') =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const minutesAgo = (dateString) => {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const minutes = Math.max(0, Math.floor(diffMs / 60000));
    return `${minutes} min`;
  };

  const classifyLabel = (value) => {
    if (typeof value === 'number') {
      if (value >= 900) return 'RICHTIG';
      if (value >= 101) return 'TEILWEISE';
      return 'FALSCH';
    }
    const num = Number(value);
    if (!Number.isNaN(num)) {
      if (num >= 900) return 'RICHTIG';
      if (num >= 101) return 'TEILWEISE';
      return 'FALSCH';
    }
    const upper = (value || '').toString().toUpperCase();
    if (upper === 'RICHTIG') return 'RICHTIG';
    if (upper === 'TEILWEISE') return 'TEILWEISE';
    if (upper === 'FALSCH') return 'FALSCH';
    return null;
  };

  const transformGaps = (container) => {
    const gaps = Array.from(container.querySelectorAll('luecke-gap, luecke-gap-wide'));
    gaps.forEach((gap, idx) => {
      const key = gap.getAttribute('name') || `gap-${idx + 1}`;
      const solution = (gap.textContent || '').trim();
      const span = document.createElement('span');
      span.className = 'gap-slot';
      span.dataset.key = key;
      if (solution) span.dataset.solution = solution;
      gap.replaceWith(span);
    });
  };

  const renderAnswersIntoSlots = (container, list) => {
    const byKey = {};
    list.forEach((entry) => {
      if (!entry || !entry.key) return;
      if (!byKey[entry.key]) byKey[entry.key] = [];
      byKey[entry.key].push(entry);
    });

    Object.values(byKey).forEach((group) => {
      group.sort((a, b) => String(a.user || '').localeCompare(String(b.user || '')));
    });

    container.querySelectorAll('.gap-slot').forEach((slot) => {
      const key = slot.dataset.key;
      const group = byKey[key] || [];
      const counts = { RICHTIG: 0, TEILWEISE: 0, FALSCH: 0, UNKLAR: 0 };
      const detailItems = [];

      group.forEach((entry) => {
        const cls = classifyLabel(entry.classification);
        if (cls === 'RICHTIG' || cls === 'TEILWEISE' || cls === 'FALSCH') {
          counts[cls]++;
        } else {
          counts.UNKLAR++;
        }
        const value = escapeHtml(entry.value || '');
        const user = escapeHtml(entry.user || '-');
        const age = entry.updated_at ? minutesAgo(entry.updated_at) : '';
        const chipClass =
          cls === 'RICHTIG'
            ? 'gap-chip--richtig'
            : cls === 'TEILWEISE'
            ? 'gap-chip--teilweise'
            : cls === 'FALSCH'
            ? 'gap-chip--falsch'
            : '';
        const isActive = (score) => (cls === classifyLabel(score) ? 'is-active' : '');
        const idAttr = entry.id ? `data-id="${entry.id}"` : '';

        detailItems.push(
          `<span class="gap-tooltip__item ${chipClass}">
            <span>${value}</span>
            <span class="gap-tooltip__user">${user}</span>
            ${age ? `<span class="gap-tooltip__age">${age}</span>` : ''}
            ${
              entry.id
                ? `<span class="gap-tooltip__actions">
                    <button class="gap-action-btn ${isActive(1000)}" ${idAttr} data-score="1000" aria-label="RICHTIG setzen">R</button>
                    <button class="gap-action-btn ${isActive(500)}" ${idAttr} data-score="500" aria-label="TEILWEISE setzen">T</button>
                    <button class="gap-action-btn ${isActive(0)}" ${idAttr} data-score="0" aria-label="FALSCH setzen">F</button>
                  </span>`
                : ''
            }
          </span>`
        );
      });

      const solution = slot.dataset.solution ? escapeHtml(slot.dataset.solution) : '';

      slot.innerHTML = `
        ${solution ? `<span class="gap-solution">${solution}</span>` : ''}
        <span class="gap-wrapper" tabindex="0">
          <span class="gap-summary">
            <span class="gap-summary__count gap-summary__count--richtig">${counts.RICHTIG}</span>
            <span class="gap-summary__count gap-summary__count--teilweise">${counts.TEILWEISE}</span>
            <span class="gap-summary__count gap-summary__count--falsch">${counts.FALSCH}</span>
          </span>
          <div class="gap-tooltip">
            ${detailItems.join('')}
          </div>
        </span>
      `;
    });
  };

  const loadReviewData = async (key) => {
    if (!apiBaseUrl) return;
    loading = true;
    loadError = '';
    metaText = '';

    try {
      const [sheetRes, answersRes] = await Promise.all([
        fetch(`${apiBaseUrl}sheet/public?key=${encodeURIComponent(key)}`),
        fetch(`${apiBaseUrl}answer?sheet=${encodeURIComponent(key)}`)
      ]);

      const sheetPayload = await sheetRes.json().catch(() => ({}));
      if (!sheetRes.ok) {
        loadError = sheetPayload?.warning || 'Sheet nicht gefunden';
        sheet = null;
        sheetHtml = '';
        loading = false;
        return;
      }
      sheet = sheetPayload?.data ?? null;
      sheetHtml = sheet?.content ?? '';

      const answersPayload = await answersRes.json().catch(() => ({}));
      answers = answersPayload?.data?.answer ?? [];
      metaText = `Sheet: ${key} - Antworten geladen (${answers.length} Eintraege)`;

      loading = false;
      await tick();
      if (contentEl) {
        transformGaps(contentEl);
        renderAnswersIntoSlots(contentEl, answers);
      }
    } catch (err) {
      loadError = err?.message ?? 'Antworten konnten nicht geladen werden';
      loading = false;
    }
  };

  const updateClassification = async (id, score) => {
    if (!id) return;
    try {
      await fetch(`${apiBaseUrl}answer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, classification: score })
      });
      await loadReviewData(sheetKey);
    } catch (err) {
      loadError = 'Klassifizierung konnte nicht gespeichert werden';
    }
  };

  const handleActionClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('.gap-action-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const score = Number(btn.getAttribute('data-score'));
    if (!id || Number.isNaN(score)) return;
    updateClassification(id, score);
  };

  onMount(async () => {
    try {
      const config = await loadConfig();
      apiBaseUrl = config.apiBaseUrl.endsWith('/')
        ? config.apiBaseUrl
        : `${config.apiBaseUrl}/`;
    } catch (err) {
      configError = err?.message ?? 'config konnte nicht geladen werden';
    }
  });

  $: {
    const nextKey = $page?.params?.key || '';
    sheetKey = nextKey;
    if (nextKey && apiBaseUrl && nextKey !== lastLoadedKey) {
      lastLoadedKey = nextKey;
      loadReviewData(nextKey);
    }
  }

  onDestroy(() => {
    // nothing to clean up yet
  });
</script>

<div class="page" on:click={handleActionClick}>
  <header class="hero">
    <div class="hero-text">
      <p class="eyebrow">ABU - Korrekturansicht</p>
      <h1>{sheet?.name || (sheetKey ? `Sheet ${sheetKey}` : 'Korrektur')}</h1>
      <p class="meta">{metaText || `Sheet: ${sheetKey || '-'}`}</p>
    </div>
    <div class="hero-actions">
      {#if sheetKey}
        <a class="ghost-link ci-btn-outline" href={`/sheet/${sheetKey}`} target="_blank" rel="noreferrer">
          Zum Blatt
        </a>
      {/if}
    </div>
  </header>

  {#if configError}
    <div class="state error">{configError}</div>
  {:else if loading}
    <div class="state">Lade Antworten...</div>
  {:else if loadError}
    <div class="state error">{loadError}</div>
  {:else}
    <main class="sheet" bind:this={contentEl}>
      {@html sheetHtml}
    </main>
  {/if}
</div>

<style>
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

  .hero-actions {
    display: flex;
    gap: 12px;
  }

  .ghost-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 18px;
    border-radius: 999px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .ghost-link:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 18px rgba(15, 23, 42, 0.12);
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

  :global(.gap-wrapper) {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    margin: 3px 4px 3px 0;
    border-radius: 18px;
    background: #e2e8f0;
    border: 1px solid #cbd5e1;
    color: #0f172a;
    font-size: 14px;
    cursor: help;
    white-space: nowrap;
    position: relative;
  }

  :global(.gap-summary) {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  :global(.gap-summary__count) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
    background: #fff;
    border: 1px solid #cbd5e1;
  }

  :global(.gap-summary__count--richtig) {
    color: #0a7a0a;
    border-color: #0a7a0a;
  }

  :global(.gap-summary__count--teilweise) {
    color: #e69500;
    border-color: #e69500;
  }

  :global(.gap-summary__count--falsch) {
    color: #c62828;
    border-color: #c62828;
  }

  :global(.gap-slot) {
    position: relative;
    display: inline-block;
    min-width: 140px;
    min-height: 32px;
    vertical-align: middle;
    padding: 4px 6px;
    border-bottom: 2px dashed #cbd5e1;
  }

  :global(.gap-solution) {
    display: inline;
    color: #15803d;
    font-weight: 700;
    font-size: 14px;
  }

  :global(.gap-tooltip) {
    display: none;
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    padding: 10px;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
    z-index: 5;
    min-width: 260px;
    max-width: 420px;
    white-space: normal;
  }

  :global(.gap-slot:hover .gap-tooltip),
  :global(.gap-slot:focus-within .gap-tooltip),
  :global(.gap-slot .gap-tooltip:hover) {
    display: block;
  }

  :global(.gap-tooltip__item) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    margin: 4px 6px 0 0;
    border-radius: 14px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    font-size: 13px;
    color: #0f172a;
  }

  :global(.gap-chip--richtig) {
    background: #e7f6e7;
    border-color: #0a7a0a;
    color: #0a7a0a;
  }

  :global(.gap-chip--teilweise) {
    background: #fff4e0;
    border-color: #e69500;
    color: #e69500;
  }

  :global(.gap-chip--falsch) {
    background: #fde7e7;
    border-color: #c62828;
    color: #c62828;
  }

  :global(.gap-tooltip__user) {
    color: #475569;
    font-weight: 600;
  }

  :global(.gap-tooltip__age) {
    color: #6b7280;
    font-size: 12px;
  }

  :global(.gap-tooltip__actions) {
    display: inline-flex;
    gap: 6px;
    margin-left: 8px;
  }

  :global(.gap-action-btn) {
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #0f172a;
    padding: 4px 6px;
    border-radius: 6px;
    font-size: 11px;
    cursor: pointer;
  }

  :global(.gap-action-btn[data-score='1000']) {
    border-color: #0a7a0a;
    color: #0a7a0a;
  }

  :global(.gap-action-btn[data-score='500']) {
    border-color: #e69500;
    color: #e69500;
  }

  :global(.gap-action-btn[data-score='0']) {
    border-color: #c62828;
    color: #c62828;
  }

  :global(.gap-action-btn.is-active[data-score='1000']) {
    background: #e7f6e7;
  }

  :global(.gap-action-btn.is-active[data-score='500']) {
    background: #fff4e0;
  }

  :global(.gap-action-btn.is-active[data-score='0']) {
    background: #fde7e7;
  }

  :global(.gap-action-btn:hover) {
    text-decoration: none;
  }

  :global(.gap-action-btn.is-active) {
    text-decoration: none;
  }

  @media (max-width: 720px) {
    .hero {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
