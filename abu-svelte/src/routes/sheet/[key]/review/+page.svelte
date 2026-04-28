<script context="module">
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
  let classrooms = [];
  let selectedClassroom = '';
  let selectedClassroomId = null;
  let classOptionsLoading = false;
  let classOptionsError = '';
  let authToken = '';

  let contentEl;
  let lastLoadedKey = '';
  let lastLoadedClassroom = null;
  let lastClassroomKey = '';
  let lastClassroomAuth = '';

  const AUTH_STORAGE_KEY = 'abu.auth';

  const apiFetch = async (path, options = {}) => {
    if (!apiBaseUrl) {
      throw new Error('API Base URL fehlt');
    }
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
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

  const extractStoredAnswerText = (value = '') => {
    const raw = String(value || '');
    if (!raw.trim().startsWith('{')) return raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.answer === 'string' && parsed.answer.trim()) return parsed.answer;
        if (typeof parsed.text === 'string' && parsed.text.trim()) return parsed.text;
        const premiseValues =
          parsed.premise_values && typeof parsed.premise_values === 'object'
            ? parsed.premise_values
            : parsed.premises && typeof parsed.premises === 'object'
              ? parsed.premises
              : null;
        if (premiseValues) {
          return Object.entries(premiseValues)
            .map(([key, entryValue]) => `${key}: ${entryValue ?? ''}`)
            .join('; ');
        }
      }
    } catch {
      // keep raw value
    }
    return raw;
  };

  const summarizeAnswerValue = (value = '', max = 180) => {
    const normalized = extractStoredAnswerText(value).replace(/\s+/g, ' ').trim();
    if (normalized.length <= max) return normalized;
    return `${normalized.slice(0, Math.max(0, max - 3))}...`;
  };

  const normalizeClassroomId = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num;
  };

  const formatClassroomLabel = (entry) => {
    const parts = [];
    if (entry?.name) parts.push(String(entry.name));
    if (entry?.year) parts.push(String(entry.year));
    if (entry?.profession) parts.push(String(entry.profession));
    if (parts.length) return parts.join(' · ');
    if (entry?.id) return `Klasse ${entry.id}`;
    return 'Klasse';
  };

  const resolveClassroomLabel = (id) => {
    if (!id) return 'Alle Klassen';
    const match = classrooms.find((entry) => entry.id === id);
    return match?.label ?? `Klasse ${id}`;
  };

  const mergeClassroomsFromAnswers = (list) => {
    const ids = new Set();
    list.forEach((entry) => {
      const id = normalizeClassroomId(entry?.classroom);
      if (id) ids.add(id);
    });
    if (!ids.size) return;
    const existing = new Set(classrooms.map((entry) => entry.id));
    const merged = [...classrooms];
    ids.forEach((id) => {
      if (!existing.has(id)) {
        merged.push({ id, label: `Klasse ${id}`, source: 'answers' });
      }
    });
    if (merged.length !== classrooms.length) {
      merged.sort((a, b) => a.label.localeCompare(b.label, 'de'));
      classrooms = merged;
    }
  };

  const transformGaps = (container) => {
    const gaps = Array.from(container.querySelectorAll('luecke-gap, freitext-block'));
    gaps.forEach((gap, idx) => {
      const key = gap.getAttribute('name') || `gap-${idx + 1}`;
      const tag = gap.tagName.toLowerCase();
      const solutionEl =
        tag === 'freitext-block'
          ? gap.querySelector('textarea.freitext__textarea')
          : gap.querySelector('input.luecke');
      const solutionSource = solutionEl?.dataset?.solution;
      const solution =
        tag === 'freitext-block' ? '' : (solutionSource || gap.textContent || '').trim();
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
        const value = escapeHtml(summarizeAnswerValue(entry.value || ''));
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

  const loadReviewData = async (key, classroomId = null) => {
    if (!apiBaseUrl) return;
    loading = true;
    loadError = '';
    metaText = '';

    try {
      const sheetParams = new URLSearchParams({ key });
      if (classroomId) {
        sheetParams.set('classroom', String(classroomId));
      }
      const answerParams = new URLSearchParams({ sheet: key });
      if (classroomId) {
        answerParams.set('classroom', String(classroomId));
      }
      const [sheetRes, answersRes] = await Promise.all([
        apiFetch(`sheet/public?${sheetParams.toString()}`),
        apiFetch(`answer?${answerParams.toString()}`)
      ]);

      const sheetPayload = await readPayload(sheetRes);
      if (!sheetRes.ok) {
        loadError = sheetPayload?.warning || 'Sheet nicht gefunden';
        sheet = null;
        sheetHtml = '';
        loading = false;
        return;
      }
      sheet = sheetPayload?.data ?? null;
      sheetHtml = sheet?.content ?? '';

      const answersPayload = await readPayload(answersRes);
      answers = answersPayload?.data?.answer ?? [];
      mergeClassroomsFromAnswers(answers);

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

  const loadClassroomsForSheet = async (key) => {
    if (!authToken || !apiBaseUrl || !key) return;
    classOptionsLoading = true;
    classOptionsError = '';
    try {
      const [classRes, planRes] = await Promise.all([
        apiFetch('classroom'),
        apiFetch(`plan?sheet_key=${encodeURIComponent(key)}`)
      ]);

      let allowedIds = null;
      if (planRes.ok) {
        const planPayload = await readPayload(planRes);
        const planList = planPayload?.data?.classroom_sheet ?? [];
        if (planList.length) {
          allowedIds = new Set(
            planList
              .map((entry) => normalizeClassroomId(entry?.classroom))
              .filter((id) => id)
          );
        }
      }

      const classPayload = await readPayload(classRes);
      if (!classRes.ok) {
        classOptionsError = classPayload?.warning || 'Klassen konnten nicht geladen werden';
        return;
      }
      let list = classPayload?.data?.classroom ?? [];
      if (allowedIds && allowedIds.size) {
        list = list.filter((entry) => allowedIds.has(normalizeClassroomId(entry?.id)));
      }

      classrooms = list
        .map((entry) => ({
          id: normalizeClassroomId(entry?.id),
          label: formatClassroomLabel(entry),
          source: 'api'
        }))
        .filter((entry) => entry.id)
        .sort((a, b) => a.label.localeCompare(b.label, 'de'));
      if (answers.length) {
        mergeClassroomsFromAnswers(answers);
      }
    } catch (err) {
      classOptionsError = err?.message ?? 'Klassen konnten nicht geladen werden';
    } finally {
      classOptionsLoading = false;
    }
  };

  const updateClassification = async (id, score) => {
    if (!id) return;
    try {
      await apiFetch('answer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, classification: score })
      });
      await loadReviewData(sheetKey, selectedClassroomId);
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
      if (typeof localStorage !== 'undefined') {
        try {
          const raw = localStorage.getItem(AUTH_STORAGE_KEY);
          if (raw) {
            const stored = JSON.parse(raw);
            if (stored?.token) {
              authToken = stored.token;
            }
          }
        } catch {
          authToken = '';
        }
      }
    } catch (err) {
      configError = err?.message ?? 'config konnte nicht geladen werden';
    }
  });

  $: selectedClassroomId = normalizeClassroomId(selectedClassroom);

  $: sheetKey = $page?.params?.key || '';

  $: {
    if (!loading && !loadError && sheetKey) {
      const label = resolveClassroomLabel(selectedClassroomId);
      metaText = `Sheet: ${sheetKey} - ${label} - Antworten geladen (${answers.length} Eintraege)`;
    }
  }

  $: {
    if (sheetKey && apiBaseUrl && sheetKey !== lastClassroomKey) {
      lastClassroomKey = sheetKey;
      classrooms = [];
      selectedClassroom = '';
      if (authToken) {
        lastClassroomAuth = authToken;
        loadClassroomsForSheet(sheetKey);
      }
    }
  }

  $: {
    const hasApiClasses = classrooms.some((entry) => entry.source === 'api');
    if (
      authToken &&
      sheetKey &&
      apiBaseUrl &&
      authToken !== lastClassroomAuth &&
      !hasApiClasses
    ) {
      lastClassroomAuth = authToken;
      loadClassroomsForSheet(sheetKey);
    }
  }

  $: {
    const nextKey = sheetKey;
    const nextClassroom = selectedClassroomId;
    if (
      nextKey &&
      apiBaseUrl &&
      (nextKey !== lastLoadedKey || nextClassroom !== lastLoadedClassroom)
    ) {
      lastLoadedKey = nextKey;
      lastLoadedClassroom = nextClassroom;
      loadReviewData(nextKey, nextClassroom);
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
      <label class="class-select" title={classOptionsError || ''}>
        <span>Klasse</span>
        <select bind:value={selectedClassroom} disabled={classOptionsLoading}>
          <option value="">Alle Klassen</option>
          {#each classrooms as classroom}
            <option value={classroom.id}>{classroom.label}</option>
          {/each}
        </select>
      </label>
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
    padding: 27px clamp(14px, 4vw, 48px) 54px;
    display: flex;
    flex-direction: column;
    gap: 12px;
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
    font-family: 'Fraunces', serif;
    font-size: clamp(26px, 4vw, 37px);
    letter-spacing: -0.02em;
  }

  .meta {
    margin: 7px 0 0;
    color: #6f6a60;
    font-size: 12px;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .ghost-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 9px 15px;
    border-radius: 999px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .ghost-link:hover {
    transform: translateY(-1px);
    box-shadow: 0 9px 15px rgba(15, 23, 42, 0.12);
  }

  .class-select {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 5px 12px;
    border-radius: 999px;
    border: 1px solid #eadfd3;
    background: #fff;
    box-shadow: 0 7px 14px rgba(15, 23, 42, 0.08);
    font-size: 12px;
    color: #5e554a;
  }

  .class-select span {
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-size: 10px;
    color: #7a6f62;
  }

  .class-select select {
    border: none;
    background: transparent;
    font-size: 12px;
    color: #1c232f;
    font-weight: 600;
    padding: 3px 2px;
  }

  .class-select select:focus {
    outline: none;
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
    margin: 1.27rem 0;
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

  :global(.gap-wrapper) {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 9px;
    margin: 3px 3px 3px 0;
    border-radius: 15px;
    background: #e2e8f0;
    border: 1px solid #cbd5e1;
    color: #0f172a;
    font-size: 12px;
    cursor: help;
    white-space: nowrap;
    position: relative;
  }

  :global(.gap-summary) {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }

  :global(.gap-summary__count) {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 5px;
    border-radius: 9px;
    font-size: 10px;
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
    min-width: 119px;
    min-height: 27px;
    vertical-align: middle;
    padding: 3px 5px;
    border-bottom: 2px dashed #cbd5e1;
  }

  :global(.gap-solution) {
    display: inline;
    color: #15803d;
    font-weight: 700;
    font-size: 12px;
  }

  :global(.gap-tooltip) {
    display: none;
    position: absolute;
    top: calc(100% + 7px);
    left: 0;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 9px;
    padding: 9px;
    box-shadow: 0 9px 26px rgba(15, 23, 42, 0.15);
    z-index: 5;
    min-width: 221px;
    max-width: 357px;
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
    gap: 5px;
    padding: 5px 9px;
    margin: 3px 5px 0 0;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    font-size: 11px;
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
    font-size: 10px;
  }

  :global(.gap-tooltip__actions) {
    display: inline-flex;
    gap: 5px;
    margin-left: 7px;
  }

  :global(.gap-action-btn) {
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #0f172a;
    padding: 3px 5px;
    border-radius: 5px;
    font-size: 10px;
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
