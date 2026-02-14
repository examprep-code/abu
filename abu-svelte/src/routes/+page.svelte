<script context="module">
</script>

<script>
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { loadConfig } from '$lib/config';
  import { tokenizeCss, tokenizeHtml } from '$lib/codeTokens';
  import { createLueckeRuntime, ensureLueckeElements } from '$lib/custom-elements/luecke';
  import { createUmfrageRuntime, ensureUmfrageElements } from '$lib/custom-elements/umfrage';
  import { legacySheets } from '$lib/legacySheets';
  import { applySchoolCiCss } from '$lib/ci';
  import ListTable from '$lib/components/ListTable.svelte';

  const showLegacyImport = false;

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
  let selectedKey = '';
  let editorContent = '';
  let editorName = '';
  let saving = false;
  let saveState = '';
  let sheetVersions = [];
  let versionsLoading = false;
  let versionsError = '';
  let selectedVersionId = '';
  let restoringVersion = false;
  let versionState = '';
  let selectedVersion = null;
  let isCurrentVersion = false;

  let creating = false;
  let deleting = false;
  let newSheetName = '';
  let newSheetKey = '';
  let sheetFilter = '';
  let sheetSort = 'updated_at_desc';
  let showCreateSheetModal = false;
  let activeTab = 'editor';
  let showTopbarMenu = false;
  let editorView = 'html';
  let topbarMenuEl = null;
  let sheetHtmlTokens = [];
  let sheetHtmlInput = null;
  let sheetHtmlHighlight = null;

  let importing = false;
  let importState = '';

  let adminCiSchoolId = '';
  let adminCiCss = '';

  let schools = [];
  let loadingSchools = false;
  let schoolError = '';
  let selectedSchoolId = null;
  let schoolName = '';
  let schoolCss = '';
  let newSchoolName = '';
  let newSchoolCss = '';
  let schoolCssTokens = [];
  let newSchoolCssTokens = [];
  let creatingSchool = false;
  let savingSchool = false;
  let deletingSchool = false;
  let schoolMap = new Map();
  let newSchoolCssInput = null;
  let newSchoolCssHighlight = null;
  let schoolCssInput = null;
  let schoolCssHighlight = null;

  let classes = [];
  let loadingClasses = false;
  let classError = '';
  let visibleClasses = [];
  let selectedClassId = null;
  let className = '';
  let classYear = '';
  let classProfession = '';
  let classNotes = '';
  let classSchoolId = '';
  let classSort = 'name_asc';
  let classDetailView = 'details';
  let newClassName = '';
  let newClassYear = '';
  let newClassProfession = '';
  let newClassNotes = '';
  let newClassSchoolId = '';
  let showClassModal = false;
  let creatingClass = false;
  let savingClass = false;
  let deletingClass = false;

  let learners = [];
  let loadingLearners = false;
  let learnerError = '';
  let selectedLearnerId = null;
  let selectedLearnerCode = '';
  let newLearnerName = '';
  let newLearnerEmail = '';
  let newLearnerNotes = '';
  let showLearnerModal = false;
  let learnerModalMode = 'create';
  let creatingLearner = false;
  let savingLearner = false;
  let deletingLearner = false;

  let planAssignments = [];
  let loadingPlan = false;
  let planError = '';
  let selectedPlanClassId = null;
  let planSaving = false;
  let planAssignmentMap = new Map();
  let planFormDraft = {};
  let planStatusDraft = {};

  let previewEl = null;
  let previewLueckeRuntime = null;
  let previewUmfrageRuntime = null;
  let previewPending = false;
  let previewUser = '';

  let visualBlocks = [];
  let visualSyncHtml = '';
  let visualPreviewEl = null;
  let visualBlockViews = [];
  let visualBlockHtmlInputs = [];
  let visualBlockEditors = [];
  let visualBlockSelections = [];
  let dragIndex = null;
  let dragOverIndex = null;
  let visualActiveBlock = 0;
  let blockInsertIndex = null;

  let agentPrompt = '';
  let agentStatus = '';
  let agentPending = false;
  let agentResponse = '';
  let agentHistory = [];
  let agentHistoryEl = null;

  let answersEl = null;
  let answers = [];
  let answersLoading = false;
  let answersError = '';
  let answersMeta = '';
  let answersPending = false;
  let answersKey = '';
  let answersClassFilter = '';
  let answersClassKey = null;
  let answersClassId = null;
  let answersContent = '';

  const PLAN_STATUS_OPTIONS = [
    { value: '', label: 'Nicht zugeordnet' },
    { value: 'aktiv', label: 'Aktiv' },
    { value: 'freiwillig', label: 'Freiwillig' },
    { value: 'archiviert', label: 'Archiviert' }
  ];
  const PLAN_FORM_OPTIONS = [
    { value: 'personal', label: 'Personenbezogen' },
    { value: 'anonym', label: 'Anonym' }
  ];
  const EDITOR_VIEWS = [
    { id: 'html', label: 'HTML' },
    { id: 'visual', label: 'Visuell' },
    { id: 'preview', label: 'Preview' },
    { id: 'answers', label: 'Antworten' }
  ];
  const SHEET_TABLE_COLUMNS =
    'minmax(120px, 0.9fr) minmax(180px, 1.1fr) minmax(220px, 2fr) minmax(160px, 0.9fr) minmax(160px, 0.9fr) minmax(90px, auto)';
  const CLASS_TABLE_COLUMNS =
    'minmax(160px, 1.2fr) minmax(90px, 0.6fr) minmax(160px, 1fr) minmax(160px, 1fr) minmax(220px, 1.4fr) minmax(90px, auto)';

  $: planAssignmentMap = new Map(
    planAssignments.map((entry) => [entry.sheet_key, entry])
  );

  $: answersClassId = normalizeClassId(answersClassFilter);
  $: ciSelectSize = Math.max(2, Math.min(6, schools.length + 1));
  $: ciLabel =
    adminCiSchoolId !== ''
      ? schools.find((school) => `${school.id}` === `${adminCiSchoolId}`)?.name ||
        `Schule #${adminCiSchoolId}`
      : 'Standard';
  $: schoolMap = new Map(schools.map((entry) => [String(entry.id), entry]));
  $: sheetFilterValue = sheetFilter.trim().toLowerCase();
  $: filteredSheets = sheetFilterValue
    ? sheets.filter((sheet) => {
        const name = (sheet.name ?? '').toString().toLowerCase();
        const key = (sheet.key ?? '').toString().toLowerCase();
        const content = stripHtml(sheet.content ?? '').toLowerCase();
        const created = (sheet.created_at ?? '').toString().toLowerCase();
        const updated = (sheet.updated_at ?? '').toString().toLowerCase();
        return `${name} ${key} ${content} ${created} ${updated}`.includes(
          sheetFilterValue
        );
      })
    : sheets;
  $: visibleSheets = [...filteredSheets].sort((a, b) => {
    const { field, dir } = parseSheetSort(sheetSort);
    const direction = dir === 'desc' ? -1 : 1;
    const valueA = getSheetSortValue(a, field);
    const valueB = getSheetSortValue(b, field);
    const normalizedA = valueA === null || valueA === undefined ? '' : String(valueA);
    const normalizedB = valueB === null || valueB === undefined ? '' : String(valueB);
    const result = normalizedA.localeCompare(normalizedB, undefined, {
      numeric: true,
      sensitivity: 'base'
    });
    if (result !== 0) {
      return result * direction;
    }
    const nameA = (a.name || a.key || '').toString();
    const nameB = (b.name || b.key || '').toString();
    const nameResult = nameA.localeCompare(nameB, undefined, {
      numeric: true,
      sensitivity: 'base'
    });
    if (nameResult !== 0) {
      return nameResult;
    }
    const keyA = (a.key || '').toString();
    const keyB = (b.key || '').toString();
    return keyA.localeCompare(keyB, undefined, { numeric: true, sensitivity: 'base' });
  });
  $: selectedVersion =
    sheetVersions.find((entry) => String(entry?.id) === String(selectedVersionId)) ?? null;
  $: isCurrentVersion = selectedVersion ? Number(selectedVersion.is_current) === 1 : false;

  $: {
    schoolMap;
    visibleClasses = [...classes].sort((a, b) => {
      const { field, dir } = parseClassSort(classSort);
      const direction = dir === 'desc' ? -1 : 1;
      const valueA = getClassSortValue(a, field);
      const valueB = getClassSortValue(b, field);
      const normalizedA = valueA === null || valueA === undefined ? '' : String(valueA);
      const normalizedB = valueB === null || valueB === undefined ? '' : String(valueB);
      const result = normalizedA.localeCompare(normalizedB, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
      if (result !== 0) {
        return result * direction;
      }
      const nameA = (a?.name || '').toString();
      const nameB = (b?.name || '').toString();
      return nameA.localeCompare(nameB, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    });
  }

  const sheetColumns = [
    {
      key: 'key',
      label: 'Key',
      sortable: true,
      onSort: () => toggleSheetSort('key'),
      sortHint: () => getSheetSortHint('key')
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      onSort: () => toggleSheetSort('name'),
      sortHint: () => getSheetSortHint('name'),
      className: 'sheet-cell--name',
      headerClass: 'sheet-cell--name'
    },
    {
      key: 'content',
      label: 'Inhalt',
      sortable: true,
      onSort: () => toggleSheetSort('content'),
      sortHint: () => getSheetSortHint('content'),
      value: (sheet) =>
        stripHtml(sheet?.content ?? '').slice(0, 120) || 'Leerer Inhalt'
    },
    {
      key: 'created_at',
      label: 'Erstellt',
      sortable: true,
      onSort: () => toggleSheetSort('created_at'),
      sortHint: () => getSheetSortHint('created_at')
    },
    {
      key: 'updated_at',
      label: 'Geaendert',
      sortable: true,
      onSort: () => toggleSheetSort('updated_at'),
      sortHint: () => getSheetSortHint('updated_at')
    }
  ];

  const classColumns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      onSort: () => toggleClassSort('name'),
      sortHint: () => getClassSortHint('name'),
      className: 'sheet-cell--name',
      headerClass: 'sheet-cell--name',
      value: (entry) => entry?.name || `Klasse #${entry?.id ?? ''}`
    },
    {
      key: 'year',
      label: 'Jahr',
      sortable: true,
      onSort: () => toggleClassSort('year'),
      sortHint: () => getClassSortHint('year'),
      value: (entry) => entry?.year || ''
    },
    {
      key: 'profession',
      label: 'Beruf',
      sortable: true,
      onSort: () => toggleClassSort('profession'),
      sortHint: () => getClassSortHint('profession'),
      value: (entry) => entry?.profession || ''
    },
    {
      key: 'school',
      label: 'Schule',
      sortable: true,
      onSort: () => toggleClassSort('school'),
      sortHint: () => getClassSortHint('school'),
      value: (entry) => getSchoolLabel(entry?.school) || ''
    },
    {
      key: 'notes',
      label: 'Notizen',
      sortable: true,
      onSort: () => toggleClassSort('notes'),
      sortHint: () => getClassSortHint('notes'),
      value: (entry) => formatClassNotes(entry?.notes)
    }
  ];

  const confirmDelete = (label = 'Eintrag') => {
    if (!browser) return true;
    return window.confirm(`${label} wirklich löschen?`);
  };

  const confirmRestore = (label = 'Version') => {
    if (!browser) return true;
    return window.confirm(`${label} wirklich wiederherstellen?`);
  };

  const buildCssTokens = (value = '') => tokenizeCss(value);
  const buildHtmlTokens = (value = '') => tokenizeHtml(value);

  $: schoolCssTokens = buildCssTokens(schoolCss);
  $: newSchoolCssTokens = buildCssTokens(newSchoolCss);
  $: sheetHtmlTokens = buildHtmlTokens(editorContent);

  const syncCodeScroll = (inputEl, highlightEl) => {
    if (!inputEl || !highlightEl) return;
    highlightEl.scrollTop = inputEl.scrollTop;
    highlightEl.scrollLeft = inputEl.scrollLeft;
  };

  const STORAGE_KEY = 'abu.auth';
  const ADMIN_CI_KEY = 'abu.admin.ci';

  onMount(() => {
    showTopbarMenu = false;

    const handlePointerDown = (event) => {
      if (!showTopbarMenu) return;
      if (!topbarMenuEl) {
        showTopbarMenu = false;
        return;
      }
      if (event?.target instanceof Node && topbarMenuEl.contains(event.target)) {
        return;
      }
      showTopbarMenu = false;
    };

    const handleKeyDown = (event) => {
      if (!showTopbarMenu) return;
      if (event?.key === 'Escape') {
        showTopbarMenu = false;
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  });

  onMount(() => {
    const handlePointerDown = (event) => {
      if (blockInsertIndex === null) return;
      if (!(event?.target instanceof Element)) {
        blockInsertIndex = null;
        return;
      }
      if (event.target.closest('.block-insert')) return;
      blockInsertIndex = null;
    };

    const handleKeyDown = (event) => {
      if (blockInsertIndex === null) return;
      if (event?.key === 'Escape') {
        blockInsertIndex = null;
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  });

  onMount(async () => {
    loadAdminCi();
    try {
      const config = await loadConfig();
      apiBaseUrl = config.apiBaseUrl.endsWith('/')
        ? config.apiBaseUrl
        : `${config.apiBaseUrl}/`;
      ensureLueckeElements();
      ensureUmfrageElements();
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

  const loadAdminCi = () => {
    if (!browser) return;
    const raw = localStorage.getItem(ADMIN_CI_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      adminCiSchoolId = saved?.schoolId ? String(saved.schoolId) : '';
      adminCiCss = saved?.css ?? '';
      applySchoolCiCss(adminCiCss);
    } catch {
      // ignore
    }
  };

  const persistAdminCi = (schoolId, css) => {
    adminCiSchoolId = schoolId ? String(schoolId) : '';
    adminCiCss = css ?? '';
    if (browser) {
      localStorage.setItem(
        ADMIN_CI_KEY,
        JSON.stringify({
          schoolId: adminCiSchoolId ? Number(adminCiSchoolId) : null,
          css: adminCiCss
        })
      );
    }
    applySchoolCiCss(adminCiCss);
  };

  const applyAdminCiSelection = (schoolId) => {
    const id = schoolId ? String(schoolId) : '';
    if (!id) {
      persistAdminCi('', '');
      return;
    }
    const match = schools.find((entry) => String(entry.id) === id);
    persistAdminCi(id, match?.ci_css ?? '');
  };

  const syncAdminCiFromSchools = (list) => {
    if (!adminCiSchoolId) return;
    const match = list.find((entry) => String(entry.id) === String(adminCiSchoolId));
    if (match) {
      persistAdminCi(adminCiSchoolId, match?.ci_css ?? '');
    } else {
      persistAdminCi('', '');
    }
  };

  function normalizeSchoolId(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'object') return value?.id ?? '';
    return value;
  }

  function getSchoolLabel(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'object') {
      if (value?.name) return value.name;
      if (value?.id !== undefined) {
        return schoolMap.get(String(value.id))?.name ?? '';
      }
      return '';
    }
    return schoolMap.get(String(value))?.name ?? '';
  }

  function normalizeClassId(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num;
  }

  function formatClassLabel(entry) {
    if (!entry) return 'Klasse';
    const parts = [];
    if (entry?.name) parts.push(String(entry.name));
    if (entry?.year) parts.push(String(entry.year));
    if (entry?.profession) parts.push(String(entry.profession));
    if (parts.length) return parts.join(' · ');
    if (entry?.id) return `Klasse ${entry.id}`;
    return 'Klasse';
  }

  function getAnswersClassLabel(classId) {
    if (!classId) return 'Alle Klassen';
    const match = classes.find((entry) => entry.id === classId);
    return match ? formatClassLabel(match) : `Klasse ${classId}`;
  }

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
        await fetchSchools();
        await fetchClasses();
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
      await fetchSchools();
      await fetchClasses();
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
    classes = [];
    selectedClassId = null;
    newClassName = '';
    newClassYear = '';
    newClassProfession = '';
    newClassNotes = '';
    learners = [];
    selectedLearnerId = null;
    selectedLearnerCode = '';
    newLearnerName = '';
    newLearnerEmail = '';
    newLearnerNotes = '';
    learnerModalMode = 'create';
    showLearnerModal = false;
    planAssignments = [];
    selectedPlanClassId = null;
    planError = '';
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
        let next = null;
        if (selectedKey) {
          next = list.find((sheet) => sheet.key === selectedKey);
        }
        if (!next && selectedId) {
          next = list.find((sheet) => sheet.id === selectedId);
        }
        if (next) {
          selectSheet(next.id);
        } else {
          closeEditor();
        }
      } else {
        closeEditor();
      }
    } catch (err) {
      sheetError = err?.message ?? 'Sheets konnten nicht geladen werden';
    } finally {
      loadingSheets = false;
    }
  };

  const resetSheetVersions = () => {
    sheetVersions = [];
    versionsLoading = false;
    versionsError = '';
    selectedVersionId = '';
    versionState = '';
    restoringVersion = false;
  };

  const fetchSheetVersions = async (key) => {
    if (!token || !key) {
      resetSheetVersions();
      return;
    }
    versionsLoading = true;
    versionsError = '';
    versionState = '';
    try {
      const res = await apiFetch(`sheet?key=${encodeURIComponent(key)}`);
      const payload = await readPayload(res);
      if (!res.ok) {
        versionsError = payload?.warning || 'Versionen konnten nicht geladen werden';
        return;
      }
      const list = payload?.data?.sheet ?? [];
      sheetVersions = list;
      const current =
        list.find((entry) => Number(entry.is_current) === 1) ?? list[0] ?? null;
      selectedVersionId = current ? String(current.id) : '';
    } catch (err) {
      versionsError = err?.message ?? 'Versionen konnten nicht geladen werden';
    } finally {
      versionsLoading = false;
    }
  };

  const selectSheet = (id) => {
    selectedId = id;
    const current = sheets.find((sheet) => sheet.id === id);
    editorContent = current?.content ?? '';
    editorName = current?.name ?? '';
    selectedKey = current?.key ?? '';
    saveState = '';
    editorView = 'html';
    resetSheetVersions();
    answers = [];
    answersError = '';
    answersMeta = '';
    answersKey = '';
    answersClassFilter = '';
    answersClassKey = null;
    answersContent = '';
    agentPrompt = '';
    agentStatus = '';
    agentPending = false;
    agentResponse = '';
    agentHistory = [];
    visualActiveBlock = 0;
    if (current?.key) {
      fetchSheetVersions(current.key);
    }
  };

  const closeEditor = () => {
    selectedId = null;
    selectedKey = '';
    editorContent = '';
    editorName = '';
    saveState = '';
    editorView = 'html';
    resetSheetVersions();
    previewLueckeRuntime?.destroy();
    previewUmfrageRuntime?.destroy();
    previewLueckeRuntime = null;
    previewUmfrageRuntime = null;
    previewUser = '';
    answers = [];
    answersError = '';
    answersMeta = '';
    answersKey = '';
    answersClassFilter = '';
    answersClassKey = null;
    answersContent = '';
    agentPrompt = '';
    agentStatus = '';
    agentPending = false;
    agentResponse = '';
    agentHistory = [];
    visualActiveBlock = 0;
    blockInsertIndex = null;
  };

  const createSheet = async () => {
    creating = true;
    sheetError = '';
    try {
      const trimmedKey = newSheetKey.trim();
      const trimmedName = newSheetName.trim();
      const res = await apiFetch('sheet', {
        method: 'POST',
        body: JSON.stringify({
          content: '',
          name: trimmedName || 'Neues Sheet',
          key: trimmedKey
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        sheetError = payload?.warning || 'Sheet konnte nicht erstellt werden';
        return false;
      }
      if (payload?.data?.id) {
        selectedId = payload.data.id;
        if (trimmedKey) {
          selectedKey = trimmedKey;
        } else {
          selectedKey = '';
        }
      }
      newSheetName = '';
      newSheetKey = '';
      await fetchSheets();
      return true;
    } catch (err) {
      sheetError = err?.message ?? 'Sheet konnte nicht erstellt werden';
      return false;
    } finally {
      creating = false;
    }
  };

  const handleCreateSheet = async () => {
    const ok = await createSheet();
    if (ok) {
      showCreateSheetModal = false;
    }
  };

  const saveSheet = async () => {
    if (!selectedId) return;
    saving = true;
    saveState = '';
    try {
      const res = await apiFetch('sheet', {
        method: 'PATCH',
        body: JSON.stringify({
          id: selectedId,
          content: editorContent,
          name: editorName
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        saveState = payload?.warning || 'Speichern fehlgeschlagen';
        return;
      }
      await fetchSheets();
      saveState = 'Gespeichert';
    } catch (err) {
      saveState = err?.message ?? 'Speichern fehlgeschlagen';
    } finally {
      saving = false;
    }
  };

  const restoreSheetVersion = async () => {
    if (!selectedVersionId) return;
    const target = sheetVersions.find(
      (entry) => String(entry?.id) === String(selectedVersionId)
    );
    if (!target) return;
    if (Number(target.is_current) === 1) {
      versionState = 'Version ist bereits aktuell.';
      return;
    }
    const label = describeVersion(target);
    if (!confirmRestore(`Version ${label}`)) return;
    restoringVersion = true;
    versionsError = '';
    versionState = '';
    const keepView = editorView;
    try {
      const res = await apiFetch('sheet', {
        method: 'PATCH',
        body: JSON.stringify({
          id: target.id,
          is_current: 1
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        versionsError = payload?.warning || 'Wiederherstellen fehlgeschlagen';
        return;
      }
      await fetchSheets();
      if (selectedKey) {
        await fetchSheetVersions(selectedKey);
      }
      if (selectedId) {
        editorView = keepView;
      }
      versionState = 'Version wiederhergestellt.';
    } catch (err) {
      versionsError = err?.message ?? 'Wiederherstellen fehlgeschlagen';
    } finally {
      restoringVersion = false;
    }
  };

  const deleteSheet = async (id = null) => {
    const targetId = id ?? selectedId;
    if (!targetId) return;
    const current = sheets.find((sheet) => sheet.id === targetId);
    const sheetTitle =
      current?.name || current?.key || (targetId ? `Sheet #${targetId}` : '');
    const sheetLabel = sheetTitle ? `Sheet "${sheetTitle}"` : 'Sheet';
    if (!confirmDelete(sheetLabel)) return;
    deleting = true;
    try {
      const res = await apiFetch('sheet', {
        method: 'DELETE',
        body: JSON.stringify({ id: targetId })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        sheetError = payload?.warning || 'Sheet konnte nicht geloescht werden';
        return;
      }
      sheets = sheets.filter((sheet) => sheet.id !== targetId);
      if (selectedId === targetId) {
        closeEditor();
      }
    } catch (err) {
      sheetError = err?.message ?? 'Sheet konnte nicht geloescht werden';
    } finally {
      deleting = false;
    }
  };

  const importLegacySheet = async (legacy) => {
    if (!token) return;
    importing = true;
    importState = '';
    try {
      const res = await apiFetch('sheet', {
        method: 'POST',
        body: JSON.stringify({
          key: legacy.key,
          name: legacy.name,
          content: legacy.content
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        importState = payload?.warning || `Import fehlgeschlagen (${legacy.key})`;
        return;
      }
      importState = `Importiert: ${legacy.key}`;
      await fetchSheets();
    } catch (err) {
      importState = err?.message ?? `Import fehlgeschlagen (${legacy.key})`;
    } finally {
      importing = false;
    }
  };

  const importAllLegacy = async () => {
    if (!token) return;
    importing = true;
    importState = '';
    const results = [];
    for (const legacy of legacySheets) {
      try {
        const res = await apiFetch('sheet', {
          method: 'POST',
          body: JSON.stringify({
            key: legacy.key,
            name: legacy.name,
            content: legacy.content
          })
        });
        const payload = await readPayload(res);
        if (!res.ok) {
          results.push(`${legacy.key}: ${payload?.warning || 'Fehler'}`);
        } else {
          results.push(`${legacy.key}: OK`);
        }
      } catch (err) {
        results.push(`${legacy.key}: Fehler`);
      }
    }
    importState = results.join(' | ');
    importing = false;
    await fetchSheets();
  };

  const fetchSchools = async () => {
    if (!token) return;
    loadingSchools = true;
    schoolError = '';
    try {
      const res = await apiFetch('school');
      const payload = await readPayload(res);
      if (!res.ok) {
        schoolError = payload?.warning || 'Schulen konnten nicht geladen werden';
        schools = [];
        return;
      }
      const list = payload?.data?.school ?? [];
      schools = list;
      syncAdminCiFromSchools(list);
      if (selectedSchoolId) {
        const keep = list.find((entry) => entry.id === selectedSchoolId);
        if (keep) {
          schoolName = keep?.name ?? '';
          schoolCss = keep?.ci_css ?? '';
        } else {
          selectedSchoolId = null;
          schoolName = '';
          schoolCss = '';
        }
      }
    } catch (err) {
      schoolError = err?.message ?? 'Schulen konnten nicht geladen werden';
    } finally {
      loadingSchools = false;
    }
  };

  const selectSchool = (id) => {
    selectedSchoolId = id;
    const current = schools.find((entry) => entry.id === id);
    schoolName = current?.name ?? '';
    schoolCss = current?.ci_css ?? '';
  };

  const createSchool = async () => {
    if (!token) return;
    creatingSchool = true;
    schoolError = '';
    try {
      const res = await apiFetch('school', {
        method: 'POST',
        body: JSON.stringify({
          name: newSchoolName,
          ci_css: newSchoolCss
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        schoolError = payload?.warning || 'Schule konnte nicht erstellt werden';
        return;
      }
      newSchoolName = '';
      newSchoolCss = '';
      await fetchSchools();
    } catch (err) {
      schoolError = err?.message ?? 'Schule konnte nicht erstellt werden';
    } finally {
      creatingSchool = false;
    }
  };

  const updateSchool = async () => {
    if (!selectedSchoolId) return;
    savingSchool = true;
    schoolError = '';
    try {
      const res = await apiFetch('school', {
        method: 'PATCH',
        body: JSON.stringify({
          id: selectedSchoolId,
          name: schoolName,
          ci_css: schoolCss
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        schoolError = payload?.warning || 'Schule konnte nicht gespeichert werden';
        return;
      }
      await fetchSchools();
    } catch (err) {
      schoolError = err?.message ?? 'Schule konnte nicht gespeichert werden';
    } finally {
      savingSchool = false;
    }
  };

  const deleteSchool = async (id = null) => {
    const targetId = id ?? selectedSchoolId;
    if (!targetId) return;
    const current = schoolMap.get(String(targetId));
    const schoolLabel = current?.name ? `Schule "${current.name}"` : 'Schule';
    if (!confirmDelete(schoolLabel)) return;
    deletingSchool = true;
    schoolError = '';
    try {
      const res = await apiFetch('school', {
        method: 'DELETE',
        body: JSON.stringify({ id: targetId })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        schoolError = payload?.warning || 'Schule konnte nicht geloescht werden';
        return;
      }
      if (selectedSchoolId === targetId) {
        selectedSchoolId = null;
        schoolName = '';
        schoolCss = '';
      }
      await fetchSchools();
      await fetchClasses();
    } catch (err) {
      schoolError = err?.message ?? 'Schule konnte nicht geloescht werden';
    } finally {
      deletingSchool = false;
    }
  };

  const fetchClasses = async () => {
    if (!token) return;
    loadingClasses = true;
    classError = '';
    try {
      const res = await apiFetch('classroom');
      const payload = await readPayload(res);
      if (!res.ok) {
        classError = payload?.warning || 'Klassen konnten nicht geladen werden';
        return;
      }
      const list = payload?.data?.classroom ?? [];
      classes = list;
      if (list.length) {
        const keep = selectedClassId
          ? list.find((entry) => entry.id === selectedClassId)
          : null;
        const next = keep || list[0];
        selectClass(next.id);
      } else {
        selectedClassId = null;
        className = '';
        classYear = '';
        classProfession = '';
        classNotes = '';
        classSchoolId = '';
        learners = [];
        selectedLearnerId = null;
      }
      if (selectedPlanClassId) {
        const keepPlan = list.find((entry) => entry.id === selectedPlanClassId);
        if (!keepPlan) {
          selectedPlanClassId = null;
          planAssignments = [];
        }
      }
    } catch (err) {
      classError = err?.message ?? 'Klassen konnten nicht geladen werden';
    } finally {
      loadingClasses = false;
    }
  };

  const selectClass = (id, view = 'details') => {
    selectedClassId = id;
    classDetailView = view;
    const current = classes.find((entry) => entry.id === id);
    className = current?.name ?? '';
    classYear = current?.year ?? '';
    classProfession = current?.profession ?? '';
    classNotes = current?.notes ?? '';
    const normalizedSchoolId = normalizeSchoolId(current?.school);
    classSchoolId = normalizedSchoolId ? String(normalizedSchoolId) : '';
    selectedLearnerId = null;
    newLearnerName = '';
    newLearnerEmail = '';
    newLearnerNotes = '';
    learnerModalMode = 'create';
    if (id) {
      fetchLearners(id);
    }
  };

  const openLearnersForClass = async (id = null) => {
    const targetId = id ?? selectedClassId;
    if (!targetId) return;
    if (id && id !== selectedClassId) {
      selectClass(id, 'learners');
      return;
    }
    classDetailView = 'learners';
    await fetchLearners(targetId);
  };

  const openAssignmentsForClass = async (id) => {
    const targetId = id ?? selectedClassId;
    if (!targetId) return;
    classDetailView = 'assignments';
    selectedPlanClassId = targetId;
    if (!sheets.length && !loadingSheets) {
      await fetchSheets();
    }
    await fetchPlanAssignments(targetId);
  };

  const openClassAssignments = async (id) => {
    selectClass(id);
    await openAssignmentsForClass(id);
  };

  const createClass = async () => {
    if (!token) return;
    creatingClass = true;
    classError = '';
    try {
      const schoolId = newClassSchoolId ? Number(newClassSchoolId) : null;
      const res = await apiFetch('classroom', {
        method: 'POST',
        body: JSON.stringify({
          name: newClassName,
          year: newClassYear,
          profession: newClassProfession,
          notes: newClassNotes,
          school: schoolId
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        classError = payload?.warning || 'Klasse konnte nicht erstellt werden';
        return;
      }
      newClassName = '';
      newClassYear = '';
      newClassProfession = '';
      newClassNotes = '';
      await fetchClasses();
    } catch (err) {
      classError = err?.message ?? 'Klasse konnte nicht erstellt werden';
    } finally {
      creatingClass = false;
    }
  };

  const updateClass = async () => {
    if (!selectedClassId) return;
    savingClass = true;
    classError = '';
    try {
      const schoolId = classSchoolId ? Number(classSchoolId) : null;
      const res = await apiFetch('classroom', {
        method: 'PATCH',
        body: JSON.stringify({
          id: selectedClassId,
          name: className,
          year: classYear,
          profession: classProfession,
          notes: classNotes,
          school: schoolId
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        classError = payload?.warning || 'Klasse konnte nicht gespeichert werden';
        return;
      }
      await fetchClasses();
    } catch (err) {
      classError = err?.message ?? 'Klasse konnte nicht gespeichert werden';
    } finally {
      savingClass = false;
    }
  };

  const deleteClass = async (id = null) => {
    const targetId = id ?? selectedClassId;
    if (!targetId) return;
    const current = classes.find((entry) => entry.id === targetId);
    const classLabel = current?.name ? `Klasse "${current.name}"` : 'Klasse';
    if (!confirmDelete(classLabel)) return;
    deletingClass = true;
    classError = '';
    try {
      const res = await apiFetch('classroom', {
        method: 'DELETE',
        body: JSON.stringify({ id: targetId })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        classError = payload?.warning || 'Klasse konnte nicht geloescht werden';
        return;
      }
      if (selectedClassId === targetId) {
        selectedClassId = null;
        classSchoolId = '';
      }
      learners = [];
      await fetchClasses();
    } catch (err) {
      classError = err?.message ?? 'Klasse konnte nicht geloescht werden';
    } finally {
      deletingClass = false;
    }
  };

  const fetchLearners = async (classId) => {
    if (!token || !classId) return;
    loadingLearners = true;
    learnerError = '';
    try {
      const res = await apiFetch(`learner?classroom=${classId}`);
      const payload = await readPayload(res);
      if (!res.ok) {
        learnerError = payload?.warning || 'Lernende konnten nicht geladen werden';
        learners = [];
        return;
      }
      learners = payload?.data?.learner ?? [];
      if (selectedLearnerId) {
        const keep = learners.find((entry) => entry.id === selectedLearnerId);
        if (!keep) {
          selectedLearnerId = null;
          selectedLearnerCode = '';
          newLearnerName = '';
          newLearnerEmail = '';
          newLearnerNotes = '';
          learnerModalMode = 'create';
        }
      }
    } catch (err) {
      learnerError = err?.message ?? 'Lernende konnten nicht geladen werden';
    } finally {
      loadingLearners = false;
    }
  };

  const selectLearner = (id) => {
    selectedLearnerId = id;
    const current = learners.find((entry) => entry.id === id);
    newLearnerName = current?.name ?? '';
    newLearnerEmail = current?.email ?? '';
    newLearnerNotes = current?.notes ?? '';
    selectedLearnerCode = current?.code ?? '';
    learnerModalMode = 'edit';
    showLearnerModal = true;
  };

  const createLearner = async () => {
    if (!selectedClassId) return;
    creatingLearner = true;
    learnerError = '';
    try {
      const res = await apiFetch('learner', {
        method: 'POST',
        body: JSON.stringify({
          classroom: selectedClassId,
          name: newLearnerName,
          email: newLearnerEmail,
          notes: newLearnerNotes
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        learnerError = payload?.warning || 'Lernende konnten nicht erstellt werden';
        return;
      }
      newLearnerName = '';
      newLearnerNotes = '';
      await fetchLearners(selectedClassId);
    } catch (err) {
      learnerError = err?.message ?? 'Lernende konnten nicht erstellt werden';
    } finally {
      creatingLearner = false;
    }
  };

  const updateLearner = async () => {
    if (!selectedLearnerId) return;
    savingLearner = true;
    learnerError = '';
    try {
      const res = await apiFetch('learner', {
        method: 'PATCH',
        body: JSON.stringify({
          id: selectedLearnerId,
          name: newLearnerName,
          notes: newLearnerNotes
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        learnerError = payload?.warning || 'Lernende konnten nicht gespeichert werden';
        return;
      }
      newLearnerName = '';
      newLearnerNotes = '';
      selectedLearnerCode = '';
      learnerModalMode = 'create';
      await fetchLearners(selectedClassId);
    } catch (err) {
      learnerError = err?.message ?? 'Lernende konnten nicht gespeichert werden';
    } finally {
      savingLearner = false;
    }
  };

  const deleteLearnerById = async (id) => {
    if (!id) return;
    const current = learners.find((entry) => entry.id === id);
    const learnerLabel = current?.name ? `Lernende "${current.name}"` : 'Lernende';
    if (!confirmDelete(learnerLabel)) return;
    deletingLearner = true;
    learnerError = '';
    try {
      const res = await apiFetch('learner', {
        method: 'DELETE',
        body: JSON.stringify({ id })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        learnerError = payload?.warning || 'Lernende konnten nicht geloescht werden';
        return;
      }
      if (selectedLearnerId === id) {
        selectedLearnerId = null;
        selectedLearnerCode = '';
        newLearnerName = '';
        newLearnerNotes = '';
        learnerModalMode = 'create';
      }
      await fetchLearners(selectedClassId);
    } catch (err) {
      learnerError = err?.message ?? 'Lernende konnten nicht geloescht werden';
    } finally {
      deletingLearner = false;
    }
  };

  const fetchPlanAssignments = async (classId) => {
    if (!token || !classId) return;
    loadingPlan = true;
    planError = '';
    try {
      const res = await apiFetch(`plan?classroom=${classId}`);
      const payload = await readPayload(res);
      if (!res.ok) {
        planError = payload?.warning || 'Planung konnte nicht geladen werden';
        planAssignments = [];
        return;
      }
      planAssignments = payload?.data?.classroom_sheet ?? [];
    } catch (err) {
      planError = err?.message ?? 'Planung konnte nicht geladen werden';
    } finally {
      loadingPlan = false;
    }
  };

  const resetClassSelection = () => {
    selectedClassId = null;
    classDetailView = 'details';
    classSchoolId = '';
    learners = [];
    selectedLearnerId = null;
    newLearnerName = '';
    newLearnerNotes = '';
    learnerModalMode = 'create';
  };

  const resetSchoolSelection = () => {
    selectedSchoolId = null;
    schoolName = '';
    schoolCss = '';
  };

  const switchTab = async (tab) => {
    if (activeTab === tab) return;
    activeTab = tab;
    if (tab === 'editor') {
      closeEditor();
    } else if (tab === 'classes') {
      resetClassSelection();
    } else if (tab === 'schools') {
      resetSchoolSelection();
    } else if (tab === 'settings') {
      if (!token || loadingSchools) return;
      if (!schools.length) {
        await fetchSchools();
      }
    }
  };

  const selectTopbarTab = async (tab) => {
    showTopbarMenu = false;
    await switchTab(tab);
  };

  const openSettings = async () => {
    showTopbarMenu = false;
    await switchTab('settings');
  };

  const getNextLueckeIndex = () => {
    const matches = Array.from(editorContent.matchAll(/name="luecke(\d+)"/g));
    const max = matches.reduce((acc, match) => {
      const value = parseInt(match[1], 10);
      return Number.isFinite(value) ? Math.max(acc, value) : acc;
    }, 0);
    return max + 1;
  };

  const getNextUmfrageIndex = () => {
    const matches = Array.from(editorContent.matchAll(/name="umfrage(\d+)"/g));
    const max = matches.reduce((acc, match) => {
      const value = parseInt(match[1], 10);
      return Number.isFinite(value) ? Math.max(acc, value) : acc;
    }, 0);
    return max + 1;
  };

  const pushBlockHtml = (blocks, html) => {
    const content = (html || '').trim();
    if (content === '') return;
    blocks.push(content);
  };

  const appendNodesAsBlock = (doc, blocks, nodes) => {
    if (!nodes.length) return;
    const container = doc.createElement('div');
    nodes.forEach((node) => container.appendChild(node.cloneNode(true)));
    pushBlockHtml(blocks, container.innerHTML);
  };

  const BLOCK_LEVEL_TAGS = new Set([
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'div',
    'section',
    'article',
    'table',
    'ul',
    'ol',
    'blockquote',
    'pre',
    'hr',
    'figure',
    'header',
    'footer',
    'nav',
    'umfrage-matrix'
  ]);

  const isBlockHtml = (value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return false;
    const match = trimmed.match(/^<\s*([a-z0-9-]+)/i);
    if (!match) return false;
    return BLOCK_LEVEL_TAGS.has(match[1].toLowerCase());
  };

  const renderBlockHtml = (block) => {
    const trimmed = (block || '').trim();
    if (!trimmed) return '<p></p>';
    return isBlockHtml(trimmed) ? trimmed : `<p>${block}</p>`;
  };

  const extractParagraphBlocks = (html) => {
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    const blocks = [];

    const extractFromParagraph = (pEl) => {
      const childNodes = Array.from(pEl.childNodes);
      let buffer = [];
      const flush = () => {
        appendNodesAsBlock(doc, blocks, buffer);
        buffer = [];
      };
      childNodes.forEach((node) => {
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          node.tagName &&
          node.tagName.toLowerCase() === 'p'
        ) {
          flush();
          extractFromParagraph(node);
          return;
        }
        buffer.push(node);
      });
      flush();
    };

    const walkNodes = (nodes) => {
      let buffer = [];
      const flush = () => {
        appendNodesAsBlock(doc, blocks, buffer);
        buffer = [];
      };
      nodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          if ((node.nodeValue || '').trim() === '') return;
          buffer.push(node);
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
          return;
        }
        const el = node;
        if (el.tagName.toLowerCase() === 'p') {
          flush();
          extractFromParagraph(el);
          return;
        }
        if (el.querySelector && el.querySelector('p')) {
          flush();
          walkNodes(Array.from(el.childNodes));
          return;
        }
        buffer.push(el);
      });
      flush();
    };

    walkNodes(Array.from(doc.body.childNodes));
    if (!blocks.length) {
      blocks.push('');
    }
    return blocks;
  };

  const blocksToHtml = (blocks) =>
    blocks.map((block) => renderBlockHtml(block)).join('\n');

  const renderVisualPreviewFromBlocks = (blocks) => {
    if (!visualPreviewEl) return;
    const html = blocks
      .map(
        (block, idx) =>
          `<div class="visual-block" data-abu-idx="${idx}">${renderBlockHtml(block)}</div>`
      )
      .join('\n');
    visualPreviewEl.innerHTML = html;
  };

  const normalizeVisualBlockViews = (views, length) => {
    const next = Array.from({ length }, (_, idx) => views[idx] || 'html');
    return next;
  };

  const syncVisualPreviewFromHtml = () => {
    const blocks = extractParagraphBlocks(editorContent || '');
    visualBlocks = blocks;
    visualBlockViews = normalizeVisualBlockViews(visualBlockViews, blocks.length);
    const normalized = blocksToHtml(blocks);
    editorContent = normalized;
    visualSyncHtml = normalized;
    renderVisualPreviewFromBlocks(blocks);
  };

  const normalizeBlockContent = (value) =>
    (value || '').replace(/<\/?p\b[^>]*>/gi, '');

  const commitVisualBlocks = () => {
    const normalized = visualBlocks.map((block) => normalizeBlockContent(block));
    const hasChanges = normalized.some((block, idx) => block !== visualBlocks[idx]);
    if (hasChanges) {
      visualBlocks = normalized;
    }
    const nextBlocks = hasChanges ? normalized : visualBlocks;
    const nextHtml = blocksToHtml(nextBlocks);
    editorContent = nextHtml;
    visualSyncHtml = nextHtml;
    renderVisualPreviewFromBlocks(nextBlocks);
  };

  const updateVisualBlock = (index, value) => {
    const next = [...visualBlocks];
    next[index] = normalizeBlockContent(value);
    visualBlocks = next;
    commitVisualBlocks();
  };

  const deleteVisualBlockAt = (index) => {
    const next = [...visualBlocks];
    next.splice(index, 1);
    if (!next.length) next.push('');
    visualBlocks = next;
    const nextViews = [...visualBlockViews];
    nextViews.splice(index, 1);
    visualBlockViews = normalizeVisualBlockViews(nextViews, next.length);
    commitVisualBlocks();
  };

  const moveVisualBlock = (from, to) => {
    if (from === null || to === null || from === to) return;
    const next = [...visualBlocks];
    const [item] = next.splice(from, 1);
    const adjusted = from < to ? to - 1 : to;
    next.splice(adjusted, 0, item);
    visualBlocks = next;
    const nextViews = [...visualBlockViews];
    const [view] = nextViews.splice(from, 1);
    nextViews.splice(adjusted, 0, view ?? 'html');
    visualBlockViews = normalizeVisualBlockViews(nextViews, next.length);
    commitVisualBlocks();
  };

  const isEditableDragTarget = (event) => {
    const target = event?.target;
    if (!target || !(target instanceof Element)) return false;
    return Boolean(target.closest('input, textarea, [contenteditable="true"]'));
  };

  const handleBlockDragStart = (event, index) => {
    if (isEditableDragTarget(event)) {
      event.preventDefault();
      return;
    }
    dragIndex = index;
    dragOverIndex = null;
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
  };

  const handleInsertDragOver = (event, index) => {
    event.preventDefault();
    dragOverIndex = index;
    if (event?.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  };

  const handleInsertDrop = (event, index) => {
    event.preventDefault();
    const fromRaw =
      dragIndex ?? (event?.dataTransfer ? parseInt(event.dataTransfer.getData('text/plain'), 10) : NaN);
    const from = Number.isFinite(fromRaw) ? fromRaw : null;
    moveVisualBlock(from, index);
    dragIndex = null;
    dragOverIndex = null;
    blockInsertIndex = null;
  };

  const handleBlockDragEnd = () => {
    dragIndex = null;
    dragOverIndex = null;
  };

  const setVisualBlockView = (index, view) => {
    const next = [...visualBlockViews];
    next[index] = view;
    visualBlockViews = normalizeVisualBlockViews(next, visualBlocks.length);
  };

  const buildLueckeSnippet = (variant = 'gap') => {
    const index = getNextLueckeIndex();
    const tag = variant === 'wide' ? 'luecke-gap-wide' : 'luecke-gap';
    return `<${tag} name="luecke${index}">Antwort</${tag}>`;
  };

  const buildUmfrageSnippet = () => {
    const index = getNextUmfrageIndex();
    return `<umfrage-matrix name="umfrage${index}" scale="1 trifft gar nicht zu;2 trifft eher nicht zu;3 teils/teils;4 trifft eher zu;5 trifft voll und ganz zu">
  Aussage 1
  Aussage 2
  Aussage 3
</umfrage-matrix>`;
  };

  const BLOCK_TEMPLATES = [
    {
      id: 'text',
      label: 'Textblock',
      meta: 'Visuell bearbeiten',
      view: 'visual',
      getHtml: () => ''
    },
    {
      id: 'html',
      label: 'HTML-Block',
      meta: 'Quelltext',
      view: 'html',
      getHtml: () => ''
    },
    {
      id: 'umfrage',
      label: 'Antwortmatrix',
      meta: 'Skalenumfrage',
      view: 'visual',
      getHtml: buildUmfrageSnippet
    }
  ];

  const extractQuotedText = (value = '') => {
    const match = value.match(/"([^"]+)"|'([^']+)'/);
    return match ? (match[1] || match[2]).trim() : '';
  };

  const normalizePrompt = (value = '') =>
    value
      .toLowerCase()
      .replace(/\u00e4/g, 'ae')
      .replace(/\u00f6/g, 'oe')
      .replace(/\u00fc/g, 'ue')
      .replace(/\u00df/g, 'ss');

  const extractPromptPayload = (value = '') => {
    const quoted = extractQuotedText(value);
    if (quoted) return quoted;
    const parts = value.split(':');
    if (parts.length > 1) return parts.slice(1).join(':').trim();
    const lower = value.toLowerCase();
    const mitIndex = lower.indexOf(' mit ');
    if (mitIndex !== -1) return value.slice(mitIndex + 5).trim();
    return '';
  };

  const extractListItems = (value = '') => {
    const raw = (value || '').trim();
    if (!raw) return [];
    const parts = raw
      .split(/[\n;,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return parts.length ? parts : [];
  };

  const parseTableSize = (value = '') => {
    const lower = value.toLowerCase();
    let cols = 3;
    let rows = 3;
    const sizeMatch = lower.match(/(\d+)\s*[x\u00d7]\s*(\d+)/);
    if (sizeMatch) {
      cols = parseInt(sizeMatch[1], 10);
      rows = parseInt(sizeMatch[2], 10);
    } else {
      const colMatch = lower.match(/(\d+)\s*(spalte|spalten|columns?)/);
      const rowMatch = lower.match(/(\d+)\s*(zeile|zeilen|rows?)/);
      if (colMatch) cols = parseInt(colMatch[1], 10);
      if (rowMatch) rows = parseInt(rowMatch[1], 10);
    }
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    return {
      cols: clamp(Number.isFinite(cols) ? cols : 3, 2, 6),
      rows: clamp(Number.isFinite(rows) ? rows : 3, 2, 8)
    };
  };

  const extractUrl = (value = '') => {
    const match = value.match(/https?:\/\/[^\s)]+/i);
    return match ? match[0] : '';
  };

  const buildAgentSnippet = (prompt, context) => {
    const trimmed = (prompt || '').trim();
    if (!trimmed) return null;
    const lower = normalizePrompt(trimmed);
    const payload = extractPromptPayload(trimmed);

    if (lower.includes('luecke') || lower.includes('gap')) {
      const variant = lower.includes('breit') || lower.includes('wide') ? 'wide' : 'gap';
      return {
        html: buildLueckeSnippet(variant),
        blockLevel: false,
        label: 'Luecke',
        view: 'visual'
      };
    }

    if (lower.includes('umfrage') || lower.includes('survey') || lower.includes('likert')) {
      return {
        html: buildUmfrageSnippet(),
        blockLevel: true,
        label: 'Umfrage',
        view: 'visual'
      };
    }

    if (
      lower.includes('ueberschrift') ||
      lower.includes('headline') ||
      lower.includes('titel') ||
      /\bh[1-6]\b/.test(lower)
    ) {
      const match = lower.match(/\bh([1-6])\b/);
      const level = match ? parseInt(match[1], 10) : lower.includes('titel') ? 1 : 2;
      const text = payload || 'Ueberschrift';
      return {
        html: `<h${level}>${escapeHtml(text)}</h${level}>`,
        blockLevel: true,
        label: 'Ueberschrift',
        view: 'visual'
      };
    }

    if (
      lower.includes('liste') ||
      lower.includes('aufzaehl') ||
      lower.includes('bullet') ||
      lower.includes('ul') ||
      lower.includes('ol')
    ) {
      const ordered = lower.includes('nummer') || lower.includes('ol') || lower.includes('geordnet');
      const listSource =
        payload ||
        trimmed.replace(/^(liste|aufzaehlung|aufzaehl|bullet|ul|ol)\b\s*:?\s*/i, '');
      const items = extractListItems(listSource);
      const listItems = items.length ? items : ordered ? ['Erstens', 'Zweitens', 'Drittens'] : ['Punkt 1', 'Punkt 2', 'Punkt 3'];
      const tag = ordered ? 'ol' : 'ul';
      return {
        html: `<${tag}>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`,
        blockLevel: true,
        label: 'Liste',
        view: 'html'
      };
    }

    if (lower.includes('tabelle') || lower.includes('table')) {
      const { cols, rows } = parseTableSize(lower);
      const headers = Array.from({ length: cols }, (_, idx) => `Spalte ${idx + 1}`);
      const bodyRows = Array.from({ length: rows }, (_, rowIdx) =>
        `<tr>${headers.map((_, colIdx) => `<td>Zeile ${rowIdx + 1}.${colIdx + 1}</td>`).join('')}</tr>`
      ).join('');
      return {
        html: `<table><thead><tr>${headers
          .map((header) => `<th>${escapeHtml(header)}</th>`)
          .join('')}</tr></thead><tbody>${bodyRows}</tbody></table>`,
        blockLevel: true,
        label: 'Tabelle',
        view: 'html'
      };
    }

    if (lower.includes('bild') || lower.includes('image') || lower.includes('img')) {
      const alt = payload || 'Bild';
      return {
        html: `<figure><img src="https://placehold.co/600x400" alt="${escapeHtml(
          alt
        )}" /><figcaption>${escapeHtml(alt)}</figcaption></figure>`,
        blockLevel: true,
        label: 'Bild',
        view: 'html'
      };
    }

    if (lower.includes('link')) {
      const url = extractUrl(trimmed);
      const linkText = payload || (url ? url.replace(/^https?:\/\//, '') : 'Link');
      const href = url && /^https?:\/\//i.test(url) ? url : '#';
      return {
        html: `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(
          linkText
        )}</a>`,
        blockLevel: false,
        label: 'Link',
        view: 'visual'
      };
    }

    if (lower.includes('button') || lower.includes('knopf')) {
      const text = payload || 'Button';
      return {
        html: `<button type="button">${escapeHtml(text)}</button>`,
        blockLevel: false,
        label: 'Button',
        view: 'visual'
      };
    }

    if (lower.includes('checkbox')) {
      const text = payload || 'Option';
      return {
        html: `<label><input type="checkbox" /> ${escapeHtml(text)}</label>`,
        blockLevel: false,
        label: 'Checkbox',
        view: 'visual'
      };
    }

    if (lower.includes('radio')) {
      const optionSource =
        payload || trimmed.replace(/^(radio)\b\s*:?\s*/i, '');
      const options = extractListItems(optionSource).length
        ? extractListItems(optionSource)
        : ['Option 1', 'Option 2'];
      const name = `auswahl-${Math.random().toString(36).slice(2, 8)}`;
      return {
        html: options
          .map(
            (option) =>
              `<label><input type="radio" name="${name}" /> ${escapeHtml(option)}</label>`
          )
          .join('<br />'),
        blockLevel: false,
        label: 'Radio',
        view: 'html'
      };
    }

    if (
      lower.includes('select') ||
      lower.includes('dropdown') ||
      lower.includes('auswahl')
    ) {
      const optionSource =
        payload || trimmed.replace(/^(select|dropdown|auswahl)\b\s*:?\s*/i, '');
      const options = extractListItems(optionSource).length
        ? extractListItems(optionSource)
        : ['Option 1', 'Option 2', 'Option 3'];
      return {
        html: `<select>${options
          .map((option) => `<option>${escapeHtml(option)}</option>`)
          .join('')}</select>`,
        blockLevel: false,
        label: 'Auswahl',
        view: 'visual'
      };
    }

    if (lower.includes('eingabe') || lower.includes('input') || lower.includes('textfeld')) {
      const placeholder = payload || 'Eingabe';
      return {
        html: `<input type="text" placeholder="${escapeHtml(placeholder)}" />`,
        blockLevel: false,
        label: 'Eingabe',
        view: 'visual'
      };
    }

    if (lower.includes('trennlinie') || lower.includes('hr') || lower.includes('linie')) {
      return {
        html: '<hr />',
        blockLevel: true,
        label: 'Trennlinie',
        view: 'html'
      };
    }

    if (lower.includes('zitat') || lower.includes('quote')) {
      const text = payload || 'Zitat';
      return {
        html: `<blockquote>${escapeHtml(text)}</blockquote>`,
        blockLevel: true,
        label: 'Zitat',
        view: 'html'
      };
    }

    if (lower.includes('code') || lower.includes('snippet')) {
      const text = payload || 'Code';
      return {
        html: `<pre><code>${escapeHtml(text)}</code></pre>`,
        blockLevel: true,
        label: 'Code',
        view: 'html'
      };
    }

    const fallbackText = payload || trimmed;
    if (context === 'html') {
      return {
        html: `<p>${escapeHtml(fallbackText)}</p>`,
        blockLevel: true,
        label: 'Text',
        view: 'html'
      };
    }
    return {
      html: escapeHtml(fallbackText),
      blockLevel: false,
      label: 'Text',
      view: 'visual'
    };
  };

  const insertHtmlAtCursor = async (html) => {
    const textarea = sheetHtmlInput;
    const value = editorContent || '';
    const hasFocus =
      textarea && typeof document !== 'undefined' && document.activeElement === textarea;
    const start =
      hasFocus && Number.isFinite(textarea?.selectionStart)
        ? textarea.selectionStart
        : value.length;
    const end =
      hasFocus && Number.isFinite(textarea?.selectionEnd) ? textarea.selectionEnd : start;
    const nextValue = value.slice(0, start) + html + value.slice(end);
    editorContent = nextValue;
    await tick();
    if (textarea) {
      const cursor = start + html.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    }
  };

  const appendVisualBlock = async (html, view = 'visual') => {
    const normalized = normalizeBlockContent(html);
    const nextBlocks = [...visualBlocks, normalized];
    visualBlocks = nextBlocks;
    const nextViews = [...visualBlockViews, view];
    visualBlockViews = normalizeVisualBlockViews(nextViews, nextBlocks.length);
    commitVisualBlocks();
    await tick();
    visualActiveBlock = Math.max(0, nextBlocks.length - 1);
    const target =
      view === 'visual'
        ? visualBlockEditors[visualActiveBlock]
        : visualBlockHtmlInputs[visualActiveBlock];
    target?.focus?.();
  };

  const insertVisualBlockAt = async (index, html = '', view = 'visual') => {
    const normalized = normalizeBlockContent(html);
    const nextBlocks = [...visualBlocks];
    const clampedIndex = Math.max(0, Math.min(index, nextBlocks.length));
    nextBlocks.splice(clampedIndex, 0, normalized);
    visualBlocks = nextBlocks;
    const nextViews = [...visualBlockViews];
    nextViews.splice(clampedIndex, 0, view);
    visualBlockViews = normalizeVisualBlockViews(nextViews, nextBlocks.length);
    commitVisualBlocks();
    await tick();
    visualActiveBlock = clampedIndex;
    const target =
      view === 'visual'
        ? visualBlockEditors[clampedIndex]
        : visualBlockHtmlInputs[clampedIndex];
    target?.focus?.();
  };

  const toggleBlockInsert = (index) => {
    blockInsertIndex = blockInsertIndex === index ? null : index;
  };

  const insertBlockTemplateAt = async (index, template) => {
    blockInsertIndex = null;
    const html = template?.getHtml ? template.getHtml() : '';
    const view = template?.view || 'visual';
    await insertVisualBlockAt(index, html, view);
  };

  const recordAgentHistory = async ({ prompt, message, status }) => {
    const trimmedPrompt = (prompt || '').trim();
    const response = message || status || '';
    if (!trimmedPrompt || !response) return;
    agentHistory = [
      ...agentHistory,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        prompt: trimmedPrompt,
        message: message || '',
        status: status || ''
      }
    ];
    await tick();
    if (agentHistoryEl) {
      agentHistoryEl.scrollTop = agentHistoryEl.scrollHeight;
    }
  };

  const buildAgentContext = (context) => {
    const payload = {
      html: editorContent ?? '',
      view: context
    };
    if (context === 'visual') {
      payload.activeBlockIndex = visualActiveBlock;
      payload.activeBlockHtml = visualBlocks[visualActiveBlock] ?? '';
      payload.blockCount = visualBlocks.length;
    }
    return payload;
  };

  const applyAgentInsertion = async (context, html, blockLevel = false, view = 'html') => {
    if (context === 'html') {
      await insertHtmlAtCursor(html);
      return 'inline';
    }

    const targetIndex = Math.min(
      Math.max(0, visualActiveBlock),
      Math.max(visualBlocks.length - 1, 0)
    );
    const shouldAppend = !visualBlocks.length || blockLevel;

    if (shouldAppend) {
      await appendVisualBlock(html, view === 'visual' ? 'visual' : 'html');
      return 'append';
    }

    if (visualBlockViews[targetIndex] === 'visual') {
      insertHtmlIntoVisualBlock(targetIndex, html);
    } else {
      await insertHtmlSelection(targetIndex, { prefix: html, suffix: '' });
    }
    return 'inline';
  };

  const applyAgentPrompt = async (context) => {
    const prompt = agentPrompt.trim();
    agentStatus = '';
    agentResponse = '';
    if (!prompt) {
      agentStatus = 'Bitte einen Prompt eingeben.';
      return;
    }
    if (agentPending) {
      return;
    }
    if (!apiBaseUrl) {
      agentStatus = 'API Base URL fehlt.';
      return;
    }
    if (!token) {
      agentStatus = 'Bitte zuerst einloggen.';
      return;
    }

    agentPending = true;
    agentStatus = 'Agent arbeitet…';
    const promptText = prompt;
    const finalizeSuccess = async (status, message = '') => {
      agentStatus = status;
      if (message) {
        agentResponse = message;
      }
      agentPrompt = '';
      await recordAgentHistory({ prompt: promptText, message, status });
    };
    try {
      const res = await apiFetch('agent', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          context: buildAgentContext(context)
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        const status = payload?.warning || 'Agent-Aufruf fehlgeschlagen';
        agentStatus = status;
        await recordAgentHistory({ prompt: promptText, status });
        return;
      }

      const result = payload?.data ?? {};
      const action = String(result.action || '');
      const html = typeof result.html === 'string' ? result.html : '';
      const message = typeof result.message === 'string' ? result.message : '';
      const blockLevel = Boolean(result.block_level ?? result.blockLevel);
      const view = result.view === 'visual' ? 'visual' : 'html';

      if (message) {
        agentResponse = message;
      }

      if ((action === 'replace_html' || action === 'replace') && html) {
        editorContent = html;
        await finalizeSuccess('Uebung aktualisiert.', message);
        return;
      }

      if (action === 'insert_html' && html) {
        const applied = await applyAgentInsertion(context, html, blockLevel, view);
        await finalizeSuccess(
          applied === 'append'
            ? 'Inhalt als neuer Block eingefuegt.'
            : 'Inhalt eingefuegt.',
          message
        );
        return;
      }

      if (!action && html) {
        editorContent = html;
        await finalizeSuccess('Uebung aktualisiert.', message);
        return;
      }

      if (message) {
        await finalizeSuccess('Antwort erhalten.', message);
        return;
      }

      await finalizeSuccess('Keine Aenderung erhalten.', message);
    } catch (err) {
      const status = err?.message ?? 'Agent-Aufruf fehlgeschlagen';
      agentStatus = status;
      await recordAgentHistory({ prompt: promptText, status });
    } finally {
      agentPending = false;
    }
  };

  const handleAgentKeydown = (event, context) => {
    if (event?.key !== 'Enter' || agentPending) return;
    event.preventDefault();
    applyAgentPrompt(context);
  };

  const insertHtmlSelection = async (index, snippet, options = {}) => {
    const textarea = visualBlockHtmlInputs[index];
    const fallbackValue = visualBlocks[index] || '';
    const value = textarea?.value ?? fallbackValue;
    const start = Number.isFinite(textarea?.selectionStart) ? textarea.selectionStart : value.length;
    const end = Number.isFinite(textarea?.selectionEnd) ? textarea.selectionEnd : start;
    const selection = value.slice(start, end);
    const inner = selection || options.placeholder || '';
    const nextValue = value.slice(0, start) + snippet.prefix + inner + snippet.suffix + value.slice(end);
    updateVisualBlock(index, nextValue);
    await tick();
    const nextTextarea = visualBlockHtmlInputs[index];
    if (nextTextarea) {
      const cursorStart = start + snippet.prefix.length;
      const cursorEnd = cursorStart + inner.length;
      nextTextarea.focus();
      nextTextarea.setSelectionRange(cursorStart, cursorEnd);
    }
  };

  const wrapHtmlSelection = (index, prefix, suffix, placeholder = '') =>
    insertHtmlSelection(index, { prefix, suffix }, { placeholder });

  const getVisualSelectionOffsets = (el) => {
    const selection = window?.getSelection ? window.getSelection() : null;
    if (!el || !selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return null;
    const preRange = range.cloneRange();
    preRange.selectNodeContents(el);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;
    preRange.setEnd(range.endContainer, range.endOffset);
    const end = preRange.toString().length;
    return { start, end };
  };

  const resolveOffsetInElement = (el, offset) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    let remaining = Math.max(0, offset || 0);
    let lastText = null;
    while (node) {
      const length = node.textContent ? node.textContent.length : 0;
      if (remaining <= length) {
        return { node, offset: remaining };
      }
      remaining -= length;
      lastText = node;
      node = walker.nextNode();
    }
    if (lastText) {
      return {
        node: lastText,
        offset: lastText.textContent ? lastText.textContent.length : 0
      };
    }
    return { node: el, offset: el.childNodes.length };
  };

  const restoreVisualSelection = (index) => {
    const el = visualBlockEditors[index];
    if (!el) return null;
    const selection = window?.getSelection ? window.getSelection() : null;
    if (!selection) return null;
    const offsets = visualBlockSelections[index];
    let range = null;
    if (offsets && typeof offsets.start === 'number' && typeof offsets.end === 'number') {
      const start = resolveOffsetInElement(el, offsets.start);
      const end = resolveOffsetInElement(el, offsets.end);
      range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
    }
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    return range;
  };

  const captureVisualSelection = (index) => {
    const el = visualBlockEditors[index];
    const offsets = getVisualSelectionOffsets(el);
    if (!offsets) return;
    visualBlockSelections[index] = offsets;
  };

  const handleVisualInput = async (index, event) => {
    const el = event?.currentTarget;
    if (!el) return;
    captureVisualSelection(index);
    updateVisualBlock(index, el.innerHTML);
    await tick();
    if (visualBlockViews[index] === 'visual' && visualActiveBlock === index) {
      restoreVisualSelection(index);
    }
  };

  const insertHtmlIntoVisualBlock = (index, html) => {
    const el = visualBlockEditors[index];
    if (!el) return;
    el.focus();
    const range = restoreVisualSelection(index);
    if (!range) return;
    const fragment = range.createContextualFragment(html);
    range.deleteContents();
    range.insertNode(fragment);
    range.collapse(false);
    const selection = window?.getSelection ? window.getSelection() : null;
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    updateVisualBlock(index, el.innerHTML);
    captureVisualSelection(index);
  };

  const wrapVisualSelection = (index, prefix, suffix, placeholder = '') => {
    const el = visualBlockEditors[index];
    if (!el) return;
    el.focus();
    const range = restoreVisualSelection(index);
    if (!range) return;
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());
    const inner = container.innerHTML || placeholder || '';
    const html = `${prefix}${inner}${suffix}`;
    insertHtmlIntoVisualBlock(index, html);
  };

  const applyVisualCommand = (index, command) => {
    const el = visualBlockEditors[index];
    if (!el) return;
    el.focus();
    restoreVisualSelection(index);
    if (document?.execCommand) {
      document.execCommand(command, false, null);
    }
    updateVisualBlock(index, el.innerHTML);
    captureVisualSelection(index);
  };

  const applyInlineFormat = (index, format) => {
    if (visualBlockViews[index] === 'visual') {
      if (format === 'bold') return applyVisualCommand(index, 'bold');
      if (format === 'italic') return applyVisualCommand(index, 'italic');
      if (format === 'underline') return applyVisualCommand(index, 'underline');
      return;
    }
    if (format === 'bold') return wrapHtmlSelection(index, '<strong>', '</strong>');
    if (format === 'italic') return wrapHtmlSelection(index, '<em>', '</em>');
    if (format === 'underline') return wrapHtmlSelection(index, '<u>', '</u>');
  };

  const applyBlockFontSize = (index, event) => {
    const value = event?.currentTarget?.value || '';
    if (!value) return;
    if (visualBlockViews[index] === 'visual') {
      wrapVisualSelection(index, `<span style="font-size: ${value};">`, '</span>', 'Text');
    } else {
      wrapHtmlSelection(index, `<span style="font-size: ${value};">`, '</span>');
    }
    event.currentTarget.value = '';
  };

  const applyBlockFontFamily = (index, event) => {
    const value = event?.currentTarget?.value || '';
    if (!value) return;
    if (visualBlockViews[index] === 'visual') {
      wrapVisualSelection(index, `<span style="font-family: ${value};">`, '</span>', 'Text');
    } else {
      wrapHtmlSelection(index, `<span style="font-family: ${value};">`, '</span>');
    }
    event.currentTarget.value = '';
  };

  const insertSnippetIntoBlock = (index, variant = 'gap') => {
    const snippet = buildLueckeSnippet(variant);
    if (visualBlockViews[index] === 'visual') {
      return insertHtmlIntoVisualBlock(index, snippet);
    }
    return insertHtmlSelection(index, { prefix: snippet, suffix: '' });
  };

  const insertUmfrageBlockAt = (index) => {
    const snippet = buildUmfrageSnippet();
    const current = (visualBlocks[index] || '').trim();
    if (!current) {
      updateVisualBlock(index, snippet);
      setVisualBlockView(index, 'visual');
      return;
    }
    insertVisualBlockAt(index + 1, snippet, 'visual');
  };

  $: if (activeTab === 'editor' && editorView === 'visual') {
    editorContent;
    if (editorContent !== visualSyncHtml || visualBlocks.length === 0) {
      syncVisualPreviewFromHtml();
    }
  }

  $: if (activeTab === 'editor' && editorView === 'preview' && previewEl && apiBaseUrl) {
    editorContent;
    selectedKey;
    schedulePreviewRefresh();
  }

  $: if (activeTab === 'editor' && editorView === 'answers' && answersEl && apiBaseUrl) {
    editorContent;
    selectedKey;
    answersClassId;
    scheduleAnswersRefresh();
  }

  $: if (
    (activeTab !== 'editor' || editorView !== 'preview') &&
    (previewLueckeRuntime || previewUmfrageRuntime)
  ) {
    previewLueckeRuntime?.destroy();
    previewUmfrageRuntime?.destroy();
    previewLueckeRuntime = null;
    previewUmfrageRuntime = null;
    previewUser = '';
  }

  const schedulePreviewRefresh = async () => {
    if (previewPending) return;
    previewPending = true;
    await tick();
    previewPending = false;

    if (!previewEl || !apiBaseUrl || activeTab !== 'editor' || editorView !== 'preview') return;
    ensureLueckeElements();
    ensureUmfrageElements();

    const nextUser = `preview:${selectedKey || 'draft'}`;
    previewLueckeRuntime?.destroy();
    previewUmfrageRuntime?.destroy();
    previewLueckeRuntime = createLueckeRuntime({
      root: previewEl,
      apiBaseUrl,
      sheetKey: selectedKey || 'draft',
      user: nextUser
    });
    previewUmfrageRuntime = createUmfrageRuntime({
      root: previewEl,
      apiBaseUrl,
      sheetKey: selectedKey || 'draft',
      user: nextUser
    });
    previewUser = nextUser;
    await previewLueckeRuntime.refresh();
    await previewUmfrageRuntime.refresh();
  };

  const escapeHtml = (str = '') =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const formatVersionDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatVersionLabel = (version) => {
    if (!version) return '';
    const state = Number(version.is_current) === 1 ? 'Aktuell' : 'Version';
    const stamp = formatVersionDate(version.updated_at || version.created_at);
    const id = version?.id ? `#${version.id}` : '';
    return [state, stamp, id].filter(Boolean).join(' · ');
  };

  const describeVersion = (version) => {
    if (!version) return 'Version';
    const stamp = formatVersionDate(version.updated_at || version.created_at);
    const id = version?.id ? `#${version.id}` : '';
    return [stamp, id].filter(Boolean).join(' · ') || 'Version';
  };

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

  const fetchAnswers = async (key, classId = null) => {
    if (!key) {
      answersError = 'Kein Sheet-Key vorhanden.';
      answers = [];
      answersMeta = '';
      return;
    }
    answersLoading = true;
    answersError = '';
    answersMeta = '';
    try {
      const params = new URLSearchParams({ sheet: key });
      if (classId) {
        params.set('classroom', String(classId));
      }
      const res = await apiFetch(`answer?${params.toString()}`);
      const payload = await readPayload(res);
      if (!res.ok) {
        answersError = payload?.warning || 'Antworten konnten nicht geladen werden';
        answers = [];
        return;
      }
      answers = payload?.data?.answer ?? [];
      const classLabel = getAnswersClassLabel(classId);
      answersMeta = `Sheet: ${key} · ${classLabel} · Antworten geladen (${answers.length} Eintraege)`;
      answersKey = key;
      answersClassKey = classId;
    } catch (err) {
      answersError = err?.message ?? 'Antworten konnten nicht geladen werden';
      answers = [];
    } finally {
      answersLoading = false;
    }
  };

  const refreshAnswers = async () => {
    if (!selectedKey) {
      answersError = 'Kein Sheet-Key vorhanden.';
      return;
    }
    await fetchAnswers(selectedKey, answersClassId);
    await tick();
    if (answersEl && activeTab === 'editor' && editorView === 'answers') {
      transformGaps(answersEl);
      renderAnswersIntoSlots(answersEl, answers);
    }
  };

  const updateAnswerClassification = async (id, score) => {
    if (!id) return;
    try {
      await apiFetch('answer', {
        method: 'PUT',
        body: JSON.stringify({ id, classification: score })
      });
      await refreshAnswers();
    } catch (err) {
      answersError = 'Klassifizierung konnte nicht gespeichert werden';
    }
  };

  const handleAnswersClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('.gap-action-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const score = Number(btn.getAttribute('data-score'));
    if (!id || Number.isNaN(score)) return;
    updateAnswerClassification(id, score);
  };

  const scheduleAnswersRefresh = async () => {
    if (answersPending) return;
    answersPending = true;
    await tick();
    answersPending = false;

    if (!answersEl || !apiBaseUrl || activeTab !== 'editor' || editorView !== 'answers') return;

    if (!selectedKey) {
      answersError = 'Kein Sheet-Key vorhanden.';
      answers = [];
      answersMeta = '';
      answersKey = '';
      answersClassKey = null;
      answersLoading = false;
      return;
    }

    const shouldFetch =
      selectedKey && (selectedKey !== answersKey || answersClassId !== answersClassKey);
    if (shouldFetch) {
      await fetchAnswers(selectedKey, answersClassId);
    } else if (!answers.length && !answersLoading && !answersError && selectedKey) {
      await fetchAnswers(selectedKey, answersClassId);
    }

    if (editorContent !== answersContent || shouldFetch) {
      answersContent = editorContent;
    }

    await tick();
    if (answersEl) {
      transformGaps(answersEl);
      renderAnswersIntoSlots(answersEl, answers);
    }
  };

  const setPlanStatus = async (sheetKey, status) => {
    if (!selectedPlanClassId || !sheetKey) return;
    const existing = planAssignmentMap.get(sheetKey);
    if (!status && !existing?.id) {
      if (planStatusDraft[sheetKey] !== undefined) {
        const { [sheetKey]: _, ...rest } = planStatusDraft;
        planStatusDraft = rest;
      }
      return;
    }
    if (!status) {
      const label = sheetKey ? `Zuordnung "${sheetKey}"` : 'Zuordnung';
      if (!confirmDelete(label)) {
        if (planStatusDraft[sheetKey] !== undefined) {
          const { [sheetKey]: _, ...rest } = planStatusDraft;
          planStatusDraft = rest;
        }
        return;
      }
    }
    planStatusDraft = { ...planStatusDraft, [sheetKey]: status };
    planSaving = true;
    planError = '';
    const existingForm = existing?.assignment_form ?? planFormDraft[sheetKey] ?? 'personal';
    let saved = false;
    try {
      if (!status) {
        if (!existing?.id) return;
        const res = await apiFetch('plan', {
          method: 'DELETE',
          body: JSON.stringify({ id: existing.id })
        });
        const payload = await readPayload(res);
        if (!res.ok) {
          planError = payload?.warning || 'Zuordnung konnte nicht entfernt werden';
          return;
        }
        planAssignments = planAssignments.filter((entry) => entry.id !== existing.id);
        saved = true;
        return;
      }

      if (existing?.id) {
        const res = await apiFetch('plan', {
          method: 'PATCH',
          body: JSON.stringify({ id: existing.id, status })
        });
        const payload = await readPayload(res);
        if (!res.ok) {
          planError = payload?.warning || 'Status konnte nicht gespeichert werden';
          return;
        }
        planAssignments = planAssignments.map((entry) =>
          entry.id === existing.id ? { ...entry, status } : entry
        );
        saved = true;
        return;
      }

      const res = await apiFetch('plan', {
        method: 'POST',
        body: JSON.stringify({
          classroom: selectedPlanClassId,
          sheet_key: sheetKey,
          status,
          assignment_form: existingForm
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        planError = payload?.warning || 'Zuordnung fehlgeschlagen';
        return;
      }
      const newId = payload?.data?.id;
      if (newId) {
        planAssignments = [
          ...planAssignments,
          {
            id: newId,
            classroom: selectedPlanClassId,
            sheet_key: sheetKey,
            status,
            assignment_form: existingForm
          }
        ];
        saved = true;
        if (planFormDraft[sheetKey]) {
          const { [sheetKey]: _, ...rest } = planFormDraft;
          planFormDraft = rest;
        }
      } else {
        await fetchPlanAssignments(selectedPlanClassId);
        saved = true;
      }
    } catch (err) {
      planError = err?.message ?? 'Zuordnung fehlgeschlagen';
    } finally {
      planSaving = false;
      if (saved || planError) {
        if (planStatusDraft[sheetKey] !== undefined) {
          const { [sheetKey]: _, ...rest } = planStatusDraft;
          planStatusDraft = rest;
        }
      }
    }
  };

  const setPlanForm = async (sheetKey, form) => {
    if (!selectedPlanClassId || !sheetKey) return;
    planSaving = true;
    planError = '';
    const existing = planAssignmentMap.get(sheetKey);
    if (!existing?.id) {
      planSaving = false;
      return;
    }
    try {
      const res = await apiFetch('plan', {
        method: 'PATCH',
        body: JSON.stringify({ id: existing.id, assignment_form: form })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        planError = payload?.warning || 'Zuordnungsform konnte nicht gespeichert werden';
        return;
      }
      planAssignments = planAssignments.map((entry) =>
        entry.id === existing.id ? { ...entry, assignment_form: form } : entry
      );
    } catch (err) {
      planError = err?.message ?? 'Zuordnungsform konnte nicht gespeichert werden';
    } finally {
      planSaving = false;
    }
  };

  const handlePlanFormChange = async (sheetKey, form) => {
    if (!sheetKey) return;
    const existing = planAssignmentMap.get(sheetKey);
    if (existing?.id) {
      await setPlanForm(sheetKey, form);
      return;
    }
    planFormDraft = { ...planFormDraft, [sheetKey]: form };
  };

  function stripHtml(input) {
    return (
      input
        ?.replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim() ?? ''
    );
  }

  function formatClassNotes(value) {
    const notes = (value ?? '').toString().trim();
    if (!notes) return 'Keine Notizen';
    return notes.length > 120 ? notes.slice(0, 120) : notes;
  }

  function parseSheetSort(value) {
    const raw = value || 'updated_at_desc';
    const lastUnderscore = raw.lastIndexOf('_');
    if (lastUnderscore === -1) {
      return { field: raw, dir: 'asc' };
    }
    const field = raw.slice(0, lastUnderscore);
    const dir = raw.slice(lastUnderscore + 1) === 'desc' ? 'desc' : 'asc';
    return { field, dir };
  }

  function parseClassSort(value) {
    const raw = value || 'name_asc';
    const lastUnderscore = raw.lastIndexOf('_');
    if (lastUnderscore === -1) {
      return { field: raw, dir: 'asc' };
    }
    const field = raw.slice(0, lastUnderscore);
    const dir = raw.slice(lastUnderscore + 1) === 'desc' ? 'desc' : 'asc';
    return { field, dir };
  }

  function getSheetSortValue(sheet, field) {
    switch (field) {
      case 'key':
        return sheet.key ?? '';
      case 'name':
        return sheet.name ?? '';
      case 'content':
        return stripHtml(sheet.content ?? '');
      case 'created_at':
        return sheet.created_at ?? '';
      case 'updated_at':
        return sheet.updated_at ?? '';
      default:
        return sheet.updated_at ?? '';
    }
  }

  function getClassSortValue(entry, field) {
    switch (field) {
      case 'name':
        return entry?.name ?? '';
      case 'year':
        return entry?.year ?? '';
      case 'profession':
        return entry?.profession ?? '';
      case 'school':
        return getSchoolLabel(entry?.school) ?? '';
      case 'notes':
        return entry?.notes ?? '';
      default:
        return entry?.name ?? '';
    }
  }

  function toggleSheetSort(field) {
    const { field: currentField, dir } = parseSheetSort(sheetSort);
    if (currentField === field) {
      sheetSort = `${field}_${dir === 'asc' ? 'desc' : 'asc'}`;
      return;
    }
    const defaultDir = field === 'updated_at' ? 'desc' : 'asc';
    sheetSort = `${field}_${defaultDir}`;
  }

  function toggleClassSort(field) {
    const { field: currentField, dir } = parseClassSort(classSort);
    if (currentField === field) {
      classSort = `${field}_${dir === 'asc' ? 'desc' : 'asc'}`;
      return;
    }
    classSort = `${field}_asc`;
  }

  function getSheetSortNextDir(field) {
    const { field: currentField, dir } = parseSheetSort(sheetSort);
    const defaultDir = field === 'updated_at' ? 'desc' : 'asc';
    if (currentField === field) {
      return dir === 'asc' ? 'desc' : 'asc';
    }
    return defaultDir;
  }

  function getClassSortNextDir(field) {
    const { field: currentField, dir } = parseClassSort(classSort);
    if (currentField === field) {
      return dir === 'asc' ? 'desc' : 'asc';
    }
    return 'asc';
  }

  function getSheetSortHint(field) {
    const nextDir = getSheetSortNextDir(field);
    return nextDir === 'asc' ? 'Aufsteigend sortieren' : 'Absteigend sortieren';
  }

  function getClassSortHint(field) {
    const nextDir = getClassSortNextDir(field);
    return nextDir === 'asc' ? 'Aufsteigend sortieren' : 'Absteigend sortieren';
  }
</script>

<svelte:head>
  <title>Abu Sheets</title>
</svelte:head>

<div class="app">
  <header class="topbar">
    <div class="brand-block">
      <p class="eyebrow">ABU TOOL</p>
      <div class="brand-logo">
        <img src="/zag_logo.png" alt="ZAG Logo" />
      </div>
    </div>
    {#if token}
      <div class="tabs topbar-tabs">
        <button
          class="ci-tab"
          class:selected={activeTab === 'editor'}
          on:click={() => switchTab('editor')}
          type="button"
        >
          Inhalt
        </button>
        <button
          class="ci-tab"
          class:selected={activeTab === 'classes'}
          on:click={() => switchTab('classes')}
          type="button"
        >
          Klassen
        </button>
        <button
          class="ci-tab"
          class:selected={activeTab === 'schools'}
          on:click={() => switchTab('schools')}
          type="button"
        >
          Schulen
        </button>
      </div>
      <div class="topbar-menu" data-open={showTopbarMenu} bind:this={topbarMenuEl}>
        <button
          class="ghost ci-btn-outline topbar-menu-btn"
          type="button"
          aria-label="Navigation"
          aria-expanded={showTopbarMenu}
          aria-controls="topbar-menu-panel"
          on:click={() => (showTopbarMenu = !showTopbarMenu)}
        >
          <span class="topbar-menu-icon" aria-hidden="true"></span>
        </button>
        <div
          id="topbar-menu-panel"
          class="topbar-menu-panel"
          class:is-open={showTopbarMenu}
          role="menu"
          hidden={!showTopbarMenu}
        >
          <button
            class="topbar-menu-item"
            class:is-active={activeTab === 'editor'}
            role="menuitemradio"
            aria-checked={activeTab === 'editor'}
            type="button"
            on:click={() => selectTopbarTab('editor')}
          >
            Inhalt
          </button>
          <button
            class="topbar-menu-item"
            class:is-active={activeTab === 'classes'}
            role="menuitemradio"
            aria-checked={activeTab === 'classes'}
            type="button"
            on:click={() => selectTopbarTab('classes')}
          >
            Klassen
          </button>
          <button
            class="topbar-menu-item"
            class:is-active={activeTab === 'schools'}
            role="menuitemradio"
            aria-checked={activeTab === 'schools'}
            type="button"
            on:click={() => selectTopbarTab('schools')}
          >
            Schulen
          </button>
        </div>
      </div>
    {/if}
    <div class="status">
      {#if token}
        <div class="status-user">
          <p class="label">Angemeldet</p>
          <p class="value">{userEmail || 'User'}</p>
        </div>
        <button
          class="ghost ci-btn-outline settings-btn"
          type="button"
          aria-label="Einstellungen"
          aria-pressed={activeTab === 'settings'}
          title="Einstellungen"
          on:click={openSettings}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="3.25" fill="none" stroke="currentColor" stroke-width="1.7" />
            <path
              d="M19.4 15a1.7 1.7 0 0 0 .35 1.87l.05.05a2 2 0 0 1-2.83 2.83l-.05-.05a1.7 1.7 0 0 0-1.87-.35 1.7 1.7 0 0 0-1.04 1.55V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.04-1.55 1.7 1.7 0 0 0-1.87.35l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1.04H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.55-1.04 1.7 1.7 0 0 0-.35-1.87l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10.04 3.05V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1.04 1.55 1.7 1.7 0 0 0 1.87-.35l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1.04H21a2 2 0 0 1 0 4h-.1A1.7 1.7 0 0 0 19.4 15Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button class="ghost ci-btn-outline" on:click={logout}>Logout</button>
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
          <button class="ci-btn-primary" type="submit" disabled={loginLoading}>
            {loginLoading ? 'Login…' : 'Login'}
          </button>
        </form>
        <div class="link-row">
          <a href="/register">Kein Account? Registriere dich hier</a>
        </div>
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
    {#if activeTab === 'editor'}
    {#if !selectedId}
    <div class="workspace single">
      <section class="panel">
        <div class="panel-header sheet-header">
          <div>
            <h2>Deine Sheets</h2>
            <p class="hint">{visibleSheets.length} / {sheets.length} Eintraege</p>
          </div>
          <div class="sheet-toolbar">
            <label class="sheet-filter">
              <span>Suchen</span>
              <input
                type="text"
                bind:value={sheetFilter}
                placeholder="Name, Key oder Inhalt"
              />
            </label>
            <button
              class="ci-btn-primary"
              on:click={() => {
                newSheetName = '';
                newSheetKey = '';
                showCreateSheetModal = true;
              }}
            >
              Neues Sheet
            </button>
          </div>
        </div>
        {#if loadingSheets}
          <p class="hint">Lade Sheets…</p>
        {:else if sheetError}
          <p class="error-text">{sheetError}</p>
        {:else if sheets.length === 0}
          <p class="hint">Noch keine Sheets vorhanden.</p>
        {:else if visibleSheets.length === 0}
          <p class="hint">Keine Treffer fuer den Filter.</p>
        {:else}
          <ListTable
            columns={sheetColumns}
            rows={visibleSheets}
            columnsTemplate={SHEET_TABLE_COLUMNS}
            rowKey={(sheet) => sheet.id}
            onRowClick={(sheet) => selectSheet(sheet.id)}
            rowAriaLabel={(sheet) => `Sheet ${sheet.name || sheet.key || sheet.id} oeffnen`}
            actionsLabel="Aktion"
          >
            <svelte:fragment slot="actions" let:row>
              <button
                class="icon-btn ci-btn-outline"
                title="Sheet loeschen"
                aria-label="Sheet loeschen"
                on:click|stopPropagation={() => deleteSheet(row.id)}
                disabled={deleting}
                type="button"
              >
                <svg class="trash-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    d="M4 7h16M9 7v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M10 11v6M14 11v6M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </svelte:fragment>
          </ListTable>
        {/if}
      </section>
    </div>
    {:else}
    <div class="workspace single">
      <main class="panel editor">
        <div class="editor-header">
          <div>
            <button class="ghost ci-btn-outline" on:click={closeEditor}>&larr; Liste</button>
            <h2>{editorName || `Sheet #${selectedId}`}</h2>
            <p class="hint">HTML direkt bearbeiten. Speichern erzeugt eine neue Version.</p>
          </div>
          <div class="actions">
            <div class="editor-tabs">
              {#each EDITOR_VIEWS as view}
                <button
                  class="ci-tab"
                  class:selected={editorView === view.id}
                  on:click={() => (editorView = view.id)}
                  type="button"
                >
                  {view.label}
                </button>
              {/each}
            </div>
            <button class="ci-btn-primary editor-action-btn" on:click={saveSheet} disabled={saving}>
              {saving ? 'Speichere…' : 'Speichern'}
            </button>
          </div>
        </div>
        {#if saveState}
          <p class:success={saveState === 'Gespeichert'} class="hint">{saveState}</p>
        {/if}
        <div class="editor-body">
          {#if editorView === 'html' || editorView === 'visual'}
            <div class="fields">
              <div class="editor-meta">
                <div class="editor-meta-row">
                  <label class="editor-meta-name">
                    <span>Name</span>
                    <input type="text" bind:value={editorName} placeholder="Name" />
                  </label>
                  <div class="editor-version">
                    <label class="editor-version-select">
                      <span>Versionen</span>
                      <select
                        bind:value={selectedVersionId}
                        disabled={versionsLoading || sheetVersions.length === 0}
                        on:change={() => {
                          versionState = '';
                          versionsError = '';
                        }}
                      >
                        {#if versionsLoading}
                          <option value="">Lade Versionen…</option>
                        {:else if sheetVersions.length === 0}
                          <option value="">Keine Versionen</option>
                        {:else}
                          {#each sheetVersions as version}
                            <option value={String(version.id)}>
                              {formatVersionLabel(version)}
                            </option>
                          {/each}
                        {/if}
                      </select>
                    </label>
                    <button
                      class="icon-btn ci-btn-outline version-restore-btn"
                      type="button"
                      on:click={restoreSheetVersion}
                      disabled={restoringVersion || !selectedVersionId || isCurrentVersion}
                      aria-label="Version wiederherstellen"
                      title={isCurrentVersion
                        ? 'Version ist bereits aktuell'
                        : 'Ausgewaehlte Version wiederherstellen'}
                    >
                      <svg class="restore-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path
                          d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66M18 4v4h-4"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.8"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                {#if versionsLoading}
                  <p class="hint">Lade Versionen…</p>
                {:else if versionsError}
                  <p class="error-text">{versionsError}</p>
                {:else if versionState}
                  <p class="hint" class:success={versionState}>{versionState}</p>
                {/if}
              </div>
              <div class="editor-columns">
                <div class="editor-main">
                  {#if editorView === 'html'}
                    <div class="code-editor" aria-label="Sheet HTML Editor">
                      <pre class="code-highlight" aria-hidden="true" bind:this={sheetHtmlHighlight}>{#each sheetHtmlTokens as token}<span class={`token token-${token.type}`}>{token.value}</span>{/each}</pre>
                      <textarea
                        class="code-input code-input--overlay"
                        bind:value={editorContent}
                        bind:this={sheetHtmlInput}
                        spellcheck="false"
                        aria-label="Sheet HTML"
                        on:scroll={() => syncCodeScroll(sheetHtmlInput, sheetHtmlHighlight)}
                      ></textarea>
                    </div>
                  {:else}
                    <div class="visual-layout">
                      <div class="visual-edit-panel">
                        <div class="block-editors">
                          <div
                            class="block-insert-row"
                            class:drag-over={dragOverIndex === 0}
                            on:dragover={(event) => handleInsertDragOver(event, 0)}
                            on:drop={(event) => handleInsertDrop(event, 0)}
                          >
                            <div class="block-insert">
                              <button
                                class="block-insert-btn"
                                type="button"
                                on:click={() => toggleBlockInsert(0)}
                                aria-label="Block einfuegen"
                                aria-haspopup="menu"
                                aria-expanded={blockInsertIndex === 0}
                              >
                                +
                              </button>
                              {#if blockInsertIndex === 0}
                                <div class="block-insert-menu" role="menu">
                                  {#each BLOCK_TEMPLATES as template (template.id)}
                                    <button
                                      class="block-insert-option"
                                      type="button"
                                      role="menuitem"
                                      on:click={() => insertBlockTemplateAt(0, template)}
                                    >
                                      <span class="block-insert-option__label">{template.label}</span>
                                      <span class="block-insert-option__meta">{template.meta}</span>
                                    </button>
                                  {/each}
                                </div>
                              {/if}
                            </div>
                          </div>
                          {#each visualBlocks as block, idx}
                            <div
                              class="block-editor"
                              draggable="true"
                              on:dragstart={(event) => handleBlockDragStart(event, idx)}
                              on:dragend={handleBlockDragEnd}
                            >
                              <div class="block-format-tools">
                                <button
                                  class="ghost ci-btn-outline tool-btn"
                                  type="button"
                                  title="Fett"
                                  aria-label="Fett"
                                  on:mousedown|preventDefault
                                  on:click={() => applyInlineFormat(idx, 'bold')}
                                >
                                  <span class="tool-icon tool-icon--bold">B</span>
                                </button>
                                <button
                                  class="ghost ci-btn-outline tool-btn"
                                  type="button"
                                  title="Kursiv"
                                  aria-label="Kursiv"
                                  on:mousedown|preventDefault
                                  on:click={() => applyInlineFormat(idx, 'italic')}
                                >
                                  <span class="tool-icon tool-icon--italic">I</span>
                                </button>
                                <button
                                  class="ghost ci-btn-outline tool-btn"
                                  type="button"
                                  title="Unterstrichen"
                                  aria-label="Unterstrichen"
                                  on:mousedown|preventDefault
                                  on:click={() => applyInlineFormat(idx, 'underline')}
                                >
                                  <span class="tool-icon tool-icon--underline">U</span>
                                </button>
                                <div class="tool-divider" aria-hidden="true"></div>
                                <select
                                  class="ghost ci-btn-outline tool-select"
                                  aria-label="Textgroesse"
                                  on:change={(event) => applyBlockFontSize(idx, event)}
                                >
                                  <option value="">A#</option>
                                  <option value="0.85em">0.85em</option>
                                  <option value="1em">1.0em</option>
                                  <option value="1.2em">1.2em</option>
                                  <option value="1.5em">1.5em</option>
                                </select>
                                <select
                                  class="ghost ci-btn-outline tool-select"
                                  aria-label="Schriftart"
                                  on:change={(event) => applyBlockFontFamily(idx, event)}
                                >
                                  <option value="">Aa</option>
                                  <option value="'Helvetica Neue', Arial, sans-serif">Aa Sans</option>
                                  <option value="'Georgia', 'Times New Roman', serif">Aa Serif</option>
                                  <option value="'Courier New', Courier, monospace">Aa Mono</option>
                                </select>
                                <button
                                  class="ghost ci-btn-outline tool-btn"
                                  type="button"
                                  title="Luecke einfuegen"
                                  aria-label="Luecke einfuegen"
                                  on:mousedown|preventDefault
                                  on:click={() => insertSnippetIntoBlock(idx, 'gap')}
                                >
                                  <span class="tool-icon tool-icon--gap">[]</span>
                                </button>
                                <button
                                  class="ghost ci-btn-outline tool-btn"
                                  type="button"
                                  title="Luecke breit"
                                  aria-label="Luecke breit"
                                  on:mousedown|preventDefault
                                  on:click={() => insertSnippetIntoBlock(idx, 'wide')}
                                >
                                  <span class="tool-icon tool-icon--gap-wide">[ ]</span>
                                </button>
                                <button
                                  class="ghost ci-btn-outline tool-btn"
                                  type="button"
                                  title="Umfrage-Block"
                                  aria-label="Umfrage-Block"
                                  on:mousedown|preventDefault
                                  on:click={() => insertUmfrageBlockAt(idx)}
                                >
                                  <span class="tool-icon tool-icon--survey">1-5</span>
                                </button>
                                <div class="tool-divider" aria-hidden="true"></div>
                                <button
                                  class="ghost ci-btn-outline tool-btn"
                                  class:active={visualBlockViews[idx] === 'html'}
                                  type="button"
                                  on:click={() => setVisualBlockView(idx, 'html')}
                                  title="HTML-Ansicht"
                                  aria-label="HTML-Ansicht"
                                >
                                  <svg
                                    class="toggle-icon"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    focusable="false"
                                  >
                                    <path
                                      d="M8 9l-4 3 4 3M16 9l4 3-4 3"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-width="1.8"
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                    />
                                  </svg>
                                </button>
                                <button
                                  class="ghost ci-btn-outline tool-btn"
                                  class:active={visualBlockViews[idx] === 'visual'}
                                  type="button"
                                  on:click={() => setVisualBlockView(idx, 'visual')}
                                  title="Visuelle Ansicht"
                                  aria-label="Visuelle Ansicht"
                                >
                                  <svg
                                    class="toggle-icon"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    focusable="false"
                                  >
                                    <path
                                      d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-width="1.8"
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                    />
                                    <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8" />
                                  </svg>
                                </button>
                                <button
                                  class="ghost ci-btn-outline tool-btn tool-btn--danger"
                                  type="button"
                                  title="Block loeschen"
                                  aria-label="Block loeschen"
                                  on:click={() =>
                                    confirmDelete('Block') && deleteVisualBlockAt(idx)}
                                >
                                  <svg
                                    class="toggle-icon"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    focusable="false"
                                  >
                                    <path
                                      d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-width="1.8"
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                    />
                                    <path
                                      d="M10 11v5M14 11v5"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-width="1.8"
                                      stroke-linecap="round"
                                    />
                                  </svg>
                                </button>
                              </div>
                              {#if visualBlockViews[idx] === 'visual'}
                                <div
                                  class="block-editor__visual"
                                  contenteditable="true"
                                  spellcheck="false"
                                bind:this={visualBlockEditors[idx]}
                                on:focus={() => (visualActiveBlock = idx)}
                                on:input={(event) => handleVisualInput(idx, event)}
                                on:mouseup={() => captureVisualSelection(idx)}
                                on:keyup={() => captureVisualSelection(idx)}
                              >
                                  {@html block}
                                </div>
                              {:else}
                                <textarea
                                  spellcheck="false"
                                  value={block}
                                  bind:this={visualBlockHtmlInputs[idx]}
                                  on:focus={() => (visualActiveBlock = idx)}
                                  on:input={(event) => updateVisualBlock(idx, event.target.value)}
                                ></textarea>
                              {/if}
                            </div>
                          <div
                            class="block-insert-row"
                            class:drag-over={dragOverIndex === idx + 1}
                            on:dragover={(event) => handleInsertDragOver(event, idx + 1)}
                            on:drop={(event) => handleInsertDrop(event, idx + 1)}
                          >
                            <div class="block-insert">
                              <button
                                class="block-insert-btn"
                                type="button"
                                on:click={() => toggleBlockInsert(idx + 1)}
                                aria-label="Block einfuegen"
                                aria-haspopup="menu"
                                aria-expanded={blockInsertIndex === idx + 1}
                              >
                                +
                              </button>
                              {#if blockInsertIndex === idx + 1}
                                <div class="block-insert-menu" role="menu">
                                  {#each BLOCK_TEMPLATES as template (template.id)}
                                    <button
                                      class="block-insert-option"
                                      type="button"
                                      role="menuitem"
                                      on:click={() => insertBlockTemplateAt(idx + 1, template)}
                                    >
                                      <span class="block-insert-option__label">{template.label}</span>
                                      <span class="block-insert-option__meta">{template.meta}</span>
                                    </button>
                                  {/each}
                                </div>
                              {/if}
                            </div>
                          </div>
                          {/each}
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>
                <aside class="agent-sidebar" aria-label="KI Kontext">
                  <div class="agent-panel">
                    <div class="agent-row">
                      <input
                        class="agent-input"
                        type="text"
                        bind:value={agentPrompt}
                        placeholder="Agent: z.B. Ueberschrift: Thema, Liste: A, B, C"
                        disabled={agentPending}
                        on:input={() => {
                          agentStatus = '';
                          agentResponse = '';
                        }}
                        on:keydown={(event) => handleAgentKeydown(event, editorView)}
                      />
                      <button
                        class="ghost ci-btn-outline"
                        type="button"
                        on:click={() => applyAgentPrompt(editorView)}
                        disabled={agentPending}
                      >
                        {agentPending ? 'Arbeite…' : 'Ausfuehren'}
                      </button>
                    </div>
                    <div class="agent-row agent-row--meta">
                      <span class="hint">Beispiele: Tabelle 3x2, Button: Start, Link: https://...</span>
                      {#if agentStatus}
                        <span class="agent-status">{agentStatus}</span>
                      {/if}
                    </div>
                    {#if agentResponse}
                      <div class="agent-response">{agentResponse}</div>
                    {/if}
                    <div class="agent-history">
                      <div class="agent-history-title">Chatverlauf</div>
                      <div class="agent-history-list" bind:this={agentHistoryEl}>
                        {#if agentHistory.length}
                          {#each agentHistory as entry (entry.id)}
                            <div class="agent-history-item">
                              <div class="agent-history-line">
                                <span class="agent-history-label">Du</span>
                                <span class="agent-history-text">{entry.prompt}</span>
                              </div>
                              <div class="agent-history-line">
                                <span class="agent-history-label">KI</span>
                                <span class="agent-history-text">{entry.message || entry.status}</span>
                              </div>
                              {#if entry.message && entry.status}
                                <div class="agent-history-meta">{entry.status}</div>
                              {/if}
                            </div>
                          {/each}
                        {:else}
                          <div class="agent-history-empty hint">Noch kein Verlauf.</div>
                        {/if}
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          {:else if editorView === 'preview'}
            <div class="preview">
              <div class="preview-header">Preview</div>
              <div class="preview-body" bind:this={previewEl}>
                {@html editorContent}
              </div>
            </div>
          {:else if editorView === 'answers'}
            <div class="preview answers">
              <div class="preview-header">Antworten</div>
              <div class="answers-meta-row">
                <p class="hint">
                  {answersMeta || (selectedKey ? `Sheet: ${selectedKey}` : 'Kein Sheet ausgewaehlt')}
                </p>
                <div class="answers-meta-controls">
                  <label class="answers-class-select">
                    <span>Klasse</span>
                    <select bind:value={answersClassFilter} disabled={loadingClasses}>
                      <option value="">Alle Klassen</option>
                      {#each classes as classItem}
                        <option value={classItem.id}>{formatClassLabel(classItem)}</option>
                      {/each}
                    </select>
                  </label>
                  <button
                    class="icon-btn ci-btn-outline refresh-btn"
                    on:click={refreshAnswers}
                    disabled={answersLoading || !selectedKey}
                    type="button"
                    title="Antworten aktualisieren"
                    aria-label="Antworten aktualisieren"
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
              </div>
              {#if answersError}
                <p class="error-text answers-error">{answersError}</p>
              {/if}
              <div class="preview-body answers-body" bind:this={answersEl} on:click={handleAnswersClick}>
                {#if answersLoading}
                  <p class="hint">Lade Antworten...</p>
                {/if}
                {@html editorContent}
              </div>
            </div>
          {/if}
        </div>
      </main>
    </div>
    {/if}

    {#if showLegacyImport}
      <section class="panel full">
        <div class="panel-header">
          <div>
            <h2>Legacy-Import</h2>
            <p class="hint">Alte Arbeitsblaetter als Sheets importieren.</p>
          </div>
          <button class="ci-btn-primary" on:click={importAllLegacy} disabled={importing}>
            {importing ? 'Importiere...' : 'Alle importieren'}
          </button>
        </div>
        <div class="import-grid">
          {#each legacySheets as legacy}
            <div class="import-card">
              <div class="import-title">{legacy.name}</div>
              <div class="import-meta">Key: {legacy.key}</div>
              <button class="ghost ci-btn-outline" on:click={() => importLegacySheet(legacy)} disabled={importing}>
                Importieren
              </button>
            </div>
          {/each}
        </div>
        {#if importState}
          <p class="hint">{importState}</p>
        {/if}
      </section>
    {/if}

    {/if}

    {#if activeTab === 'classes'}
    <section class="panel full">
      {#if !selectedClassId}
        <div class="panel-header">
          <div>
            <h2>Klassen</h2>
            <p class="hint">Waehle eine Klasse, um Details zu sehen.</p>
          </div>
          <div class="row-actions">
            <button
              class="icon-btn ci-btn-outline refresh-btn"
              on:click={fetchClasses}
              disabled={loadingClasses}
              title="Klassen aktualisieren"
              aria-label="Klassen aktualisieren"
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
            <button class="ci-btn-primary" on:click={() => (showClassModal = true)}>Neue Klasse</button>
          </div>
        </div>

        <div class="manage-card">
          {#if loadingClasses}
            <p class="hint">Lade Klassen...</p>
          {:else if classes.length === 0}
            <p class="hint">Keine Klassen vorhanden.</p>
          {:else}
            <ListTable
              columns={classColumns}
              rows={visibleClasses}
              columnsTemplate={CLASS_TABLE_COLUMNS}
              rowKey={(entry) => entry.id}
              onRowClick={(entry) => selectClass(entry.id)}
              rowAriaLabel={(entry) =>
                `Klasse ${entry.name || entry.id} oeffnen`
              }
              actionsLabel="Aktion"
            >
              <svelte:fragment slot="actions" let:row>
                <button
                  class="icon-btn ci-btn-outline"
                  title="Arbeitsblaetter zuweisen"
                  aria-label="Arbeitsblaetter zuweisen"
                  on:click|stopPropagation={() => openClassAssignments(row.id)}
                  type="button"
                >
                  Arbeitsblaetter
                </button>
                <button
                  class="icon-btn ci-btn-outline"
                  title="Studierende anzeigen"
                  aria-label="Studierende anzeigen"
                  on:click|stopPropagation={() => openLearnersForClass(row.id)}
                  type="button"
                >
                  Studierende
                </button>
                <button
                  class="icon-btn ci-btn-outline"
                  title="Klasse loeschen"
                  aria-label="Klasse loeschen"
                  on:click|stopPropagation={() => deleteClass(row.id)}
                  disabled={deletingClass}
                  type="button"
                >
                  <svg class="trash-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      d="M4 7h16M9 7v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M10 11v6M14 11v6M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </svelte:fragment>
            </ListTable>
          {/if}
          {#if classError}
            <p class="error-text">{classError}</p>
          {/if}
        </div>
      {:else}
        <div class="panel-header">
          <div>
            <button class="ghost ci-btn-outline" on:click={() => {
              resetClassSelection();
            }}>
              Zurueck
            </button>
            <h2>
              {classDetailView === 'assignments'
                ? 'Arbeitsblaetter'
                : classDetailView === 'learners'
                ? 'Studierende'
                : 'Klasse'}
            </h2>
            <p class="hint">
              {className || 'Klasse'} {classYear || ''} {classProfession || ''}
              {getSchoolLabel(classSchoolId) ? ` · ${getSchoolLabel(classSchoolId)}` : ''}
            </p>
          </div>
          <div class="row-actions">
            <button
              class="ci-tab"
              class:selected={classDetailView === 'details'}
              on:click={() => (classDetailView = 'details')}
              type="button"
            >
              Details
            </button>
            <button
              class="ci-tab"
              class:selected={classDetailView === 'learners'}
              on:click={() => openLearnersForClass()}
              type="button"
            >
              Studierende
            </button>
            <button
              class="ci-tab"
              class:selected={classDetailView === 'assignments'}
              on:click={() => openAssignmentsForClass()}
              type="button"
            >
              Arbeitsblaetter
            </button>
            {#if classDetailView === 'learners'}
              <button
                class="icon-btn ci-btn-outline refresh-btn"
                on:click={() => fetchLearners(selectedClassId)}
                disabled={loadingLearners}
                title="Lernende aktualisieren"
                aria-label="Lernende aktualisieren"
                type="button"
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
              <button
                class="ci-btn-primary"
                on:click={() => {
                  learnerModalMode = 'create';
                  newLearnerName = '';
                  newLearnerNotes = '';
                  selectedLearnerCode = '';
                  showLearnerModal = true;
                }}
                type="button"
              >
                Neue Lernende
              </button>
            {:else if classDetailView === 'assignments'}
              <button
                class="icon-btn ci-btn-outline refresh-btn"
                on:click={() => openAssignmentsForClass()}
                disabled={loadingPlan}
                title="Arbeitsblaetter aktualisieren"
                aria-label="Arbeitsblaetter aktualisieren"
                type="button"
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
            {/if}
          </div>
        </div>

        {#if classDetailView === 'assignments'}
          <div class="manage-card">
            <h3>Arbeitsblaetter zuweisen</h3>
            {#if loadingPlan}
              <p class="hint">Lade Zuordnungen...</p>
            {:else if sheets.length === 0}
              <p class="hint">Noch keine Sheets vorhanden.</p>
            {:else}
              <p class="hint">{planAssignments.length} zugeordnet</p>
              <div class="assignment-list">
                {#each sheets as sheet}
                  {@const assignment = sheet.key ? planAssignmentMap.get(sheet.key) : null}
                  {@const statusDraft = sheet.key && planStatusDraft[sheet.key] !== undefined
                    ? planStatusDraft[sheet.key]
                    : undefined}
                  {@const currentStatus = statusDraft !== undefined ? statusDraft : assignment?.status ?? ''}
                  {@const baseForm = assignment?.assignment_form ?? 'personal'}
                  {@const currentForm = sheet.key && planFormDraft[sheet.key] ? planFormDraft[sheet.key] : baseForm}
                  <label class="assignment-row">
                    <div class="assignment-info">
                      <div class="list-title">{sheet.name || sheet.key || `Sheet #${sheet.id}`}</div>
                      <div class="assignment-key">{sheet.key || 'Key fehlt'}</div>
                    </div>
                    <div class="assignment-controls">
                      <select
                        class="status-select"
                        value={currentStatus}
                        on:change={(event) => setPlanStatus(sheet.key, event.currentTarget.value)}
                        disabled={planSaving || !sheet.key}
                      >
                        {#each PLAN_STATUS_OPTIONS as option}
                          <option value={option.value}>{option.label}</option>
                        {/each}
                      </select>
                      <select
                        class="status-select form-select"
                        value={currentForm}
                        on:change={(event) => handlePlanFormChange(sheet.key, event.currentTarget.value)}
                        disabled={planSaving || !sheet.key}
                      >
                        {#each PLAN_FORM_OPTIONS as option}
                          <option value={option.value}>{option.label}</option>
                        {/each}
                      </select>
                    </div>
                  </label>
                {/each}
              </div>
            {/if}
            {#if planError}
              <p class="error-text">{planError}</p>
            {/if}
          </div>
        {:else if classDetailView === 'details'}
          <div class="manage-card">
            <h3>Klasse bearbeiten</h3>
            <div class="form-grid">
              <label>
                <span>Name</span>
                <input type="text" bind:value={className} placeholder="Klassenname" />
              </label>
              <label>
                <span>Jahr</span>
                <input type="text" bind:value={classYear} placeholder="2025/26" />
              </label>
              <label>
                <span>Beruf</span>
                <input type="text" bind:value={classProfession} placeholder="Beruf" />
              </label>
              <label>
                <span>Schule</span>
                <select bind:value={classSchoolId}>
                  <option value="">Keine Schule</option>
                  {#each schools as school}
                    <option value={String(school.id)}>
                      {school.name || `Schule #${school.id}`}
                    </option>
                  {/each}
                </select>
              </label>
              <label>
                <span>Notizen</span>
                <textarea rows="3" bind:value={classNotes} placeholder="Notizen"></textarea>
              </label>
            </div>
            <div class="row-actions">
              <button class="ci-btn-primary" on:click={updateClass} disabled={savingClass} type="button">
                {savingClass ? 'Speichere...' : 'Speichern'}
              </button>
            </div>
          </div>
        {:else}
          <div class="manage-card">
            <h3>Studierende</h3>
            {#if loadingLearners}
              <p class="hint">Lade Lernende...</p>
            {:else if learners.length === 0}
              <p class="hint">Noch keine Lernenden.</p>
            {:else}
              <div class="list">
                {#each learners as entry}
                  <div class="list-row">
                    <button class="ci-btn-soft" on:click={() => selectLearner(entry.id)}>
                      <div class="list-title">{entry.name || `Lernende #${entry.id}`}</div>
                      <div class="list-preview">
                        {entry.code ? `Code: ${entry.code}` : ''}
                        {entry.notes ? ` ${entry.notes}` : ''}
                      </div>
                    </button>
                    <button
                      class="icon-btn ci-btn-outline"
                      title="Lernende loeschen"
                      on:click={() => deleteLearnerById(entry.id)}
                      disabled={deletingLearner}
                      type="button"
                    >
                      Loeschen
                    </button>
                  </div>
                {/each}
              </div>
            {/if}

            {#if learnerError}
              <p class="error-text">{learnerError}</p>
            {/if}
          </div>
        {/if}
      {/if}
    </section>
    {/if}

    {#if activeTab === 'schools'}
    <section class="panel full">
      {#if !selectedSchoolId}
        <div class="panel-header">
          <div>
            <h2>Schulen</h2>
            <p class="hint">CI CSS pro Schule definieren.</p>
          </div>
          <div class="row-actions">
            <button
              class="icon-btn ci-btn-outline refresh-btn"
              on:click={fetchSchools}
              disabled={loadingSchools}
              title="Schulen aktualisieren"
              aria-label="Schulen aktualisieren"
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
        </div>

        <div class="manage-card">
          <h3>Neue Schule</h3>
          <div class="form-grid">
            <label>
              <span>Name</span>
              <input type="text" bind:value={newSchoolName} placeholder="Schulname" />
            </label>
            <label>
              <span>CI CSS</span>
              <div class="code-editor" aria-label="CI CSS Editor">
                <pre class="code-highlight" aria-hidden="true" bind:this={newSchoolCssHighlight}>{#each newSchoolCssTokens as token}<span class={`token token-${token.type}`}>{token.value}</span>{/each}</pre>
                <textarea
                  class="code-input code-input--overlay"
                  rows="10"
                  bind:value={newSchoolCss}
                  bind:this={newSchoolCssInput}
                  placeholder="CSS fuer diese Schule"
                  spellcheck="false"
                  on:scroll={() => syncCodeScroll(newSchoolCssInput, newSchoolCssHighlight)}
                ></textarea>
              </div>
            </label>
          </div>
          <div class="row-actions">
            <button class="ci-btn-primary" on:click={createSchool} disabled={creatingSchool}>
              {creatingSchool ? 'Erstelle...' : 'Schule erstellen'}
            </button>
          </div>
        </div>

        <div class="manage-card">
          {#if loadingSchools}
            <p class="hint">Lade Schulen...</p>
          {:else if schools.length === 0}
            <p class="hint">Keine Schulen vorhanden.</p>
          {:else}
            <div class="list">
              {#each schools as entry}
                <div class="list-row">
                  <button class="ci-btn-soft" on:click={() => selectSchool(entry.id)}>
                    <div class="list-title">{entry.name || `Schule #${entry.id}`}</div>
                    <div class="list-preview">{entry.ci_css ? 'CI vorhanden' : 'Kein CI gespeichert'}</div>
                  </button>
                  <button
                    class="icon-btn ci-btn-outline"
                    title="Schule loeschen"
                    on:click={() => deleteSchool(entry.id)}
                    disabled={deletingSchool}
                  >
                    Loeschen
                  </button>
                </div>
              {/each}
            </div>
          {/if}
          {#if schoolError}
            <p class="error-text">{schoolError}</p>
          {/if}
        </div>
      {:else}
        <div class="panel-header">
          <div>
            <button class="ghost ci-btn-outline" on:click={() => {
              resetSchoolSelection();
            }}>
              Zurueck
            </button>
            <h2>Schule bearbeiten</h2>
            <p class="hint">{schoolName || 'Schule'}</p>
          </div>
          <div class="row-actions">
            <button
              class="icon-btn ci-btn-outline refresh-btn"
              on:click={fetchSchools}
              disabled={loadingSchools}
              title="Schulen aktualisieren"
              aria-label="Schulen aktualisieren"
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
            <button
              class="ghost ci-btn-outline"
              on:click={() => deleteSchool(selectedSchoolId)}
              disabled={deletingSchool}
            >
              {deletingSchool ? 'Loesche...' : 'Loeschen'}
            </button>
          </div>
        </div>

        <div class="manage-card">
          <h3>CI CSS</h3>
          <div class="form-grid">
            <label>
              <span>Name</span>
              <input type="text" bind:value={schoolName} placeholder="Schulname" />
            </label>
            <label>
              <span>CI CSS</span>
              <div class="code-editor" aria-label="CI CSS Editor">
                <pre class="code-highlight" aria-hidden="true" bind:this={schoolCssHighlight}>{#each schoolCssTokens as token}<span class={`token token-${token.type}`}>{token.value}</span>{/each}</pre>
                <textarea
                  class="code-input code-input--overlay"
                  rows="12"
                  bind:value={schoolCss}
                  bind:this={schoolCssInput}
                  placeholder="CSS fuer diese Schule"
                  spellcheck="false"
                  on:scroll={() => syncCodeScroll(schoolCssInput, schoolCssHighlight)}
                ></textarea>
              </div>
            </label>
          </div>
          <div class="row-actions">
            <button class="ci-btn-primary" on:click={updateSchool} disabled={savingSchool}>
              {savingSchool ? 'Speichere...' : 'Speichern'}
            </button>
          </div>
          {#if schoolError}
            <p class="error-text">{schoolError}</p>
          {/if}
        </div>
      {/if}
    </section>
    {/if}

    {#if activeTab === 'settings'}
    <section class="panel full">
      <div class="panel-header">
        <div>
          <h2>Einstellungen</h2>
          <p class="hint">Admin-Ansicht konfigurieren.</p>
        </div>
        <div class="row-actions">
          <button
            class="icon-btn ci-btn-outline refresh-btn"
            on:click={fetchSchools}
            disabled={loadingSchools}
            title="Schulen aktualisieren"
            aria-label="Schulen aktualisieren"
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
      </div>

      <div class="manage-card settings-card">
        <h3>CI Auswahl</h3>
        <p class="hint">Waehle, welche CI in der Admin-Ansicht aktiv sein soll.</p>

        <div class="settings-grid">
          <div class="settings-current">
            <p class="settings-label">Aktuell</p>
            <p class="settings-value">{ciLabel}</p>
          </div>
          <label>
            <span>CI</span>
            <select
              class="settings-select"
              size={ciSelectSize}
              bind:value={adminCiSchoolId}
              on:change={(event) => applyAdminCiSelection(event.currentTarget.value)}
            >
              <option value="">Standard</option>
              {#each schools as school}
                <option value={school.id}>{school.name || `Schule #${school.id}`}</option>
              {/each}
            </select>
          </label>
        </div>

        {#if loadingSchools}
          <p class="hint">Lade Schulen...</p>
        {:else if schools.length === 0}
          <p class="hint">Noch keine Schulen vorhanden. Lege sie im Tab "Schulen" an.</p>
        {/if}

        {#if schoolError}
          <p class="error-text">{schoolError}</p>
        {/if}
      </div>
    </section>
    {/if}

  {/if}
</div>

{#if showCreateSheetModal}
  <div class="modal-backdrop" on:click={() => (showCreateSheetModal = false)}>
    <div class="modal-card" on:click|stopPropagation>
      <h3>Neues Sheet</h3>
      <form class="create-form" on:submit|preventDefault={handleCreateSheet}>
        <label>
          <span>Name</span>
          <input type="text" bind:value={newSheetName} placeholder="Neues Sheet" />
        </label>
        <label>
          <span>Key (optional)</span>
          <input
            type="text"
            bind:value={newSheetKey}
            placeholder="z. B. abi-geschichte-1"
          />
        </label>
        {#if sheetError}
          <p class="error-text">{sheetError}</p>
        {/if}
        <div class="row-actions">
          <button class="ghost ci-btn-outline" type="button" on:click={() => (showCreateSheetModal = false)}>
            Abbrechen
          </button>
          <button class="ci-btn-primary" type="submit" disabled={creating}>
            {creating ? 'Erstelle…' : 'Erstellen'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if showClassModal}
  <div class="modal-backdrop" on:click={() => (showClassModal = false)}>
    <div class="modal-card" on:click|stopPropagation>
      <h3>Neue Klasse</h3>
      <div class="form-grid">
        <label>
          <span>Name</span>
          <input type="text" bind:value={newClassName} placeholder="z. B. ABU 2A" />
        </label>
        <label>
          <span>Jahrgang</span>
          <input type="text" bind:value={newClassYear} placeholder="z. B. 2025/26" />
        </label>
        <label>
          <span>Beruf</span>
          <input type="text" bind:value={newClassProfession} placeholder="z. B. FaGe" />
        </label>
        <label>
          <span>Schule</span>
          <select bind:value={newClassSchoolId}>
            <option value="">Keine Schule</option>
            {#each schools as school}
              <option value={String(school.id)}>
                {school.name || `Schule #${school.id}`}
              </option>
            {/each}
          </select>
        </label>
        <label>
          <span>Notizen</span>
          <textarea rows="3" bind:value={newClassNotes}></textarea>
        </label>
      </div>
      <div class="row-actions">
        <button class="ghost ci-btn-outline" on:click={() => (showClassModal = false)}>Abbrechen</button>
        <button
          class="ci-btn-primary"
          on:click={() => {
            createClass();
            showClassModal = false;
          }}
          disabled={creatingClass}
        >
          {creatingClass ? 'Erstelle...' : 'Speichern'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showLearnerModal}
  <div class="modal-backdrop" on:click={() => (showLearnerModal = false)}>
    <div class="modal-card" on:click|stopPropagation>
      <h3>{learnerModalMode === 'edit' ? 'Lernende bearbeiten' : 'Neue Lernende'}</h3>
      <div class="form-grid">
        {#if learnerModalMode === 'edit'}
          <label>
            <span>Identifikationscode</span>
            <input type="text" value={selectedLearnerCode} readonly />
          </label>
        {/if}
        <label>
          <span>Name</span>
          <input type="text" bind:value={newLearnerName} placeholder="Name" />
        </label>
        <label>
          <span>Notizen</span>
          <textarea rows="3" bind:value={newLearnerNotes}></textarea>
        </label>
      </div>
      <div class="row-actions">
        <button class="ghost ci-btn-outline" on:click={() => (showLearnerModal = false)}>Abbrechen</button>
        <button
          class="ci-btn-primary"
          on:click={() => {
            if (learnerModalMode === 'edit') {
              updateLearner();
            } else {
              createLearner();
            }
            showLearnerModal = false;
          }}
          disabled={learnerModalMode === 'edit' ? savingLearner : creatingLearner}
        >
          {(learnerModalMode === 'edit' ? savingLearner : creatingLearner) ? 'Speichere...' : 'Speichern'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  @import '../lib/check-btn.css';

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
    align-items: center;
    flex-wrap: nowrap;
    gap: 24px;
    margin-bottom: 32px;
  }

  .brand-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .brand-logo img {
    height: 44px;
    width: auto;
    object-fit: contain;
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

  .brand-logo {
    display: flex;
    align-items: center;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: nowrap;
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

  .settings-btn {
    width: 40px;
    height: 40px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .settings-btn svg {
    width: 18px;
    height: 18px;
  }

  .settings-btn[aria-pressed="true"] {
    background: #ec5a8f;
    border-color: #ec5a8f;
    color: #ffffff;
  }

  .settings-grid {
    display: grid;
    gap: 16px;
  }

  .settings-current {
    display: grid;
    gap: 6px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid #d9dee7;
    background: #f8fafc;
  }

  .settings-label {
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: #6f7682;
  }

  .settings-value {
    margin: 0;
    font-weight: 600;
  }

  .settings-select {
    min-height: 140px;
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

  .tabs {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
  }

  .topbar-tabs {
    margin-bottom: 0;
    flex: 1 1 360px;
    justify-content: center;
  }

  .topbar-tabs .ci-tab {
    white-space: nowrap;
  }

  .topbar-menu {
    position: relative;
    display: none;
    align-items: center;
  }

  .topbar-menu-btn {
    width: 42px;
    height: 42px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .topbar-menu-icon,
  .topbar-menu-icon::before,
  .topbar-menu-icon::after {
    display: block;
    width: 20px;
    height: 2px;
    border-radius: 999px;
    background: #1c2333;
    transition: transform 0.2s ease, opacity 0.2s ease;
  }

  .topbar-menu-icon {
    position: relative;
  }

  .topbar-menu-icon::before,
  .topbar-menu-icon::after {
    content: '';
    position: absolute;
    left: 0;
  }

  .topbar-menu-icon::before {
    top: -6px;
  }

  .topbar-menu-icon::after {
    top: 6px;
  }

  .topbar-menu[data-open='true'] .topbar-menu-icon {
    background: transparent;
  }

  .topbar-menu[data-open='true'] .topbar-menu-icon::before {
    transform: translateY(6px) rotate(45deg);
  }

  .topbar-menu[data-open='true'] .topbar-menu-icon::after {
    transform: translateY(-6px) rotate(-45deg);
  }

  .topbar-menu-panel {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    min-width: 200px;
    background: #ffffff;
    border: 1px solid #d9dee7;
    border-radius: 16px;
    padding: 8px;
    display: none;
    gap: 6px;
    box-shadow: 0 16px 30px rgba(15, 23, 42, 0.16);
    z-index: 20;
  }

  .topbar-menu-panel.is-open {
    display: grid;
  }

  .topbar-menu-item {
    width: 100%;
    text-align: left;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid transparent;
    background: transparent;
    font-weight: 600;
  }

  .topbar-menu-item:hover {
    background: #eff6f4;
    border-color: #cfe6e1;
    transform: none;
    box-shadow: none;
  }

  .topbar-menu-item.is-active {
    background: #1f7a6e;
    border-color: #1f7a6e;
    color: #ffffff;
  }

  .topbar-menu-item.is-active:hover {
    transform: none;
    box-shadow: none;
  }

  .tabs button {
    border-radius: 999px;
    padding: 10px 16px;
    font-weight: 600;
    cursor: pointer;
  }

  .tabs button.selected {
    font-weight: 600;
  }

  label {
    display: grid;
    gap: 8px;
    margin-bottom: 16px;
    font-weight: 500;
  }

  input,
  textarea,
  select {
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

  .code-input {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
      'Courier New', monospace;
    font-size: 12px;
    line-height: 1.6;
    background: #f8fafc;
    color: #0f172a;
    border-color: #e2e8f0;
  }

  .code-input::placeholder {
    color: #94a3b8;
  }

  .code-editor {
    position: relative;
    border-radius: 14px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    overflow: hidden;
  }

  .code-highlight,
  .code-input--overlay {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
      'Courier New', monospace;
    font-size: 12px;
    line-height: 1.6;
    padding: 14px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .code-highlight {
    position: absolute;
    inset: 0;
    margin: 0;
    color: #0f172a;
    pointer-events: none;
    overflow: auto;
    scrollbar-width: none;
  }

  .code-highlight::-webkit-scrollbar {
    display: none;
  }

  .code-input--overlay {
    position: relative;
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: transparent;
    caret-color: #0f172a;
    resize: vertical;
  }

  .code-input--overlay::placeholder {
    color: #94a3b8;
    opacity: 1;
  }

  .code-editor:focus-within {
    border-color: #cbd5f5;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  .token-comment {
    color: #94a3b8;
    font-style: italic;
  }

  .token-string {
    color: #b45309;
  }

  .token-number {
    color: #0ea5e9;
  }

  .token-atrule {
    color: #7c3aed;
  }

  .token-property {
    color: #0f766e;
  }

  .token-selector {
    color: #1d4ed8;
  }

  .token-tag {
    color: #7c3aed;
  }

  .token-attr {
    color: #0f766e;
  }

  .token-entity {
    color: #0ea5e9;
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

  button.ghost {
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

  .error-text {
    color: #b23a3a;
    font-weight: 500;
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

  .workspace {
    display: grid;
    grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
    gap: 24px;
  }

  .workspace.single {
    grid-template-columns: minmax(0, 1fr);
  }

  .panel {
    background: #ffffffcc;
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 12px 30px rgba(20, 24, 40, 0.12);
  }

  .panel.full {
    margin-top: 24px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .sheet-toolbar {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }

  .sheet-filter {
    margin-bottom: 0;
    display: grid;
    gap: 6px;
    min-width: 220px;
  }

  .list {
    display: grid;
    gap: 12px;
  }

  .create-form {
    display: grid;
    gap: 12px;
    margin-bottom: 16px;
  }

  .create-form button {
    justify-self: start;
  }

  .list button {
    text-align: left;
    border-radius: 14px;
    padding: 14px;
  }

  .list button.selected {
    border-style: solid;
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

  .manage-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 20px;
  }

  .import-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  .import-card {
    background: #f5f7fa;
    border-radius: 16px;
    padding: 14px;
    border: 1px solid #e2e8f0;
    display: grid;
    gap: 10px;
  }

  .import-title {
    font-weight: 600;
  }

  .import-meta {
    font-size: 12px;
    color: #6f7682;
  }

  .manage-card {
    background: #f5f7fa;
    border-radius: 16px;
    padding: 16px;
    border: 1px solid #e2e8f0;
    display: grid;
    gap: 12px;
  }

  .manage-card h3 {
    margin: 0;
    font-size: 18px;
  }

  .manage-card h4 {
    margin: 0;
    font-size: 15px;
    color: #4d5565;
  }

  .assignment-list {
    display: grid;
    gap: 10px;
  }

  .assignment-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #fff;
    cursor: pointer;
  }

  .assignment-info {
    display: grid;
    gap: 4px;
  }

  .assignment-key {
    font-size: 12px;
    color: #6f7682;
  }

  .status-select {
    font: inherit;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid #d9dee7;
    background: #f8fafc;
  }

  .assignment-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .form-select {
    min-width: 160px;
  }

  .form-grid {
    display: grid;
    gap: 12px;
  }

  .form-grid textarea {
    min-height: 72px;
  }

  .row-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .list-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
  }

  .icon-btn {
    padding: 8px 10px;
    border-radius: 10px;
    font-size: 12px;
    cursor: pointer;
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

  .trash-icon {
    width: 18px;
    height: 18px;
  }

  .icon-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 720px) {
    .sheet-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .sheet-toolbar {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
    }
  }

  @media (max-width: 760px) {
    .status-user {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .brand-logo {
      display: none;
    }
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    padding: 24px;
  }

  .modal-card {
    width: min(520px, 100%);
    background: #fff;
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.2);
    display: grid;
    gap: 16px;
  }

  .divider {
    height: 1px;
    background: #d9dee7;
    margin: 8px 0;
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
    gap: 16px;
    align-items: stretch;
  }

  .editor-tabs {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .editor-tabs button {
    border-radius: 999px;
    padding: 8px 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .editor-action-btn {
    padding: 8px 14px;
  }

  .fields {
    display: grid;
    gap: 12px;
    align-content: start;
  }

  .editor-meta {
    display: grid;
    gap: 8px;
  }

  .editor-meta-row {
    display: grid;
    gap: 12px;
    align-items: end;
  }

  .editor-meta-row label {
    margin: 0;
  }

  .editor-version {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: end;
    justify-self: end;
  }

  .editor-version label {
    margin: 0;
  }

  .editor-version-select {
    min-width: min(240px, 100%);
  }

  .editor-version button {
    white-space: nowrap;
  }

  .version-restore-btn {
    width: 42px;
    height: 42px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .restore-icon {
    width: 18px;
    height: 18px;
  }

  .editor-meta .hint,
  .editor-meta .error-text {
    margin: 0;
  }

  .fields textarea {
    min-height: 320px;
  }

  .editor-columns {
    display: grid;
    gap: 16px;
    align-items: start;
  }

  .editor-main {
    display: grid;
    gap: 12px;
    align-content: start;
  }

  .agent-sidebar {
    display: grid;
    gap: 12px;
    min-height: 0;
    align-self: start;
  }

  .agent-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-radius: 14px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    min-height: 0;
  }

  .agent-row {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .agent-row--meta {
    justify-content: space-between;
    gap: 12px;
  }

  .agent-input {
    flex: 1 1 260px;
    min-width: 220px;
  }

  .agent-status {
    font-size: 12px;
    color: #1f7a6e;
    font-weight: 600;
  }

  .agent-response {
    margin-top: 8px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    font-size: 13px;
    line-height: 1.5;
    color: #1f2937;
    white-space: pre-wrap;
  }

  .agent-history {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 8px;
    min-height: 0;
    flex: 1 1 auto;
  }

  .agent-history-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: #6f7682;
  }

  .agent-history-list {
    display: grid;
    gap: 10px;
    overflow: auto;
    padding-right: 4px;
    min-height: 0;
  }

  .agent-history-item {
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    padding: 10px 12px;
    display: grid;
    gap: 8px;
  }

  .agent-history-line {
    display: grid;
    gap: 4px;
  }

  .agent-history-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #94a3b8;
    font-weight: 600;
  }

  .agent-history-text {
    font-size: 13px;
    line-height: 1.5;
    color: #1f2937;
    white-space: pre-wrap;
  }

  .agent-history-meta {
    font-size: 11px;
    color: #64748b;
  }

  .agent-history-empty {
    font-size: 12px;
    color: #94a3b8;
  }

  @media (min-width: 900px) {
    .editor-meta-row {
      grid-template-columns: minmax(0, 1fr) minmax(240px, 360px);
    }
  }

  @media (min-width: 1100px) {
    .editor-columns {
      grid-template-columns: minmax(0, 1fr) minmax(260px, 360px);
    }

    .agent-sidebar {
      position: sticky;
      top: 16px;
      max-height: calc(100vh - 180px);
    }

    .agent-panel {
      height: 100%;
    }
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

  :global(umfrage-matrix) {
    display: block;
    margin: 1.2rem 0;
  }

  :global(umfrage-matrix .umfrage-matrix__scroll) {
    overflow-x: auto;
  }

  :global(umfrage-matrix .umfrage-matrix__table) {
    width: 100%;
    border-collapse: collapse;
    min-width: 520px;
  }

  :global(umfrage-matrix th),
  :global(umfrage-matrix td) {
    border: 1px solid #d9dee7;
    padding: 0.45rem 0.6rem;
    text-align: center;
  }

  :global(umfrage-matrix th) {
    background: #f5f7fa;
    color: #556070;
    font-weight: 600;
  }

  :global(umfrage-matrix .umfrage-matrix__statement) {
    text-align: left;
    background: #fff;
    color: #1c2333;
    font-weight: 500;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-value) {
    display: block;
    font-size: 0.95rem;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-label) {
    display: block;
    font-size: 0.72rem;
    color: #6f7682;
    margin-top: 2px;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-editor) {
    display: grid;
    gap: 6px;
    justify-items: center;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-input) {
    width: min(160px, 100%);
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    padding: 4px 6px;
    font-size: 11px;
    text-align: center;
    background: #fff;
    color: #1f2937;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-input:focus-visible) {
    outline: 2px solid #2f8f83;
    outline-offset: 2px;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-actions) {
    display: inline-flex;
    gap: 6px;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-btn) {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #2f8f83;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-btn:hover) {
    background: #eef9f7;
    border-color: #2f8f83;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-btn--remove) {
    color: #c33b3b;
    border-color: #e2c8c8;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-btn--remove:hover) {
    background: #fde7e7;
    border-color: #c33b3b;
  }

  :global(umfrage-matrix .umfrage-matrix__option) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    border: 1px solid #cbd5e1;
    background: #fff;
    cursor: pointer;
    position: relative;
  }

  :global(umfrage-matrix .umfrage-matrix__option input) {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  :global(umfrage-matrix .umfrage-matrix__dot) {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    border: 2px solid #8793a1;
    background: transparent;
    transition: all 0.15s ease;
  }

  :global(umfrage-matrix .umfrage-matrix__option input:checked + .umfrage-matrix__dot) {
    background: #2f8f83;
    border-color: #2f8f83;
  }

  :global(umfrage-matrix .umfrage-matrix__option input:focus-visible + .umfrage-matrix__dot) {
    box-shadow: 0 0 0 3px rgba(47, 143, 131, 0.25);
  }

  @media (max-width: 720px) {
    :global(umfrage-matrix .umfrage-matrix__table) {
      min-width: 420px;
    }
  }

  .visual-layout {
    display: grid;
    gap: 16px;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }

  .visual-edit-panel {
    border-radius: 14px;
    border: 1px solid #d9dee7;
    background: #ffffff;
    padding: 14px;
    display: grid;
    gap: 10px;
  }

  .visual-edit-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }


  .block-editors {
    display: grid;
    gap: 16px;
  }

  .block-editor {
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    padding: 12px;
    display: grid;
    gap: 10px;
  }

  .block-editor.drag-over {
    border-color: #2f8f83;
    background: #eef9f7;
  }

  .block-editor textarea {
    min-height: 140px;
  }

  .block-format-tools {
    display: flex;
    gap: 6px;
    flex-wrap: nowrap;
    align-items: center;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tool-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
  }

  .tool-btn.active {
    background: #0f172a;
    color: #fff;
    border-color: #0f172a;
  }

  .tool-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
  }

  .tool-icon--italic {
    font-style: italic;
    font-weight: 600;
  }

  .tool-icon--underline {
    text-decoration: underline;
  }

  .tool-icon--gap,
  .tool-icon--gap-wide {
    font-weight: 600;
    font-size: 11px;
    letter-spacing: -0.4px;
  }

  .tool-icon--survey {
    font-weight: 700;
    font-size: 9px;
    letter-spacing: -0.2px;
  }

  .tool-select {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid #d9dee7;
    background: #fff;
    color: #0f172a;
    font-weight: 600;
    height: 32px;
    font-size: 12px;
  }

  .tool-select option {
    color: #0f172a;
  }

  .tool-divider {
    width: 1px;
    height: 20px;
    background: #d9dee7;
    margin: 0 2px;
  }

  .tool-btn--danger {
    color: #b23a3a;
    border-color: #f1c7c7;
  }

  .block-editor__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .block-editor__actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .block-view-toggle {
    display: flex;
    gap: 4px;
  }

  .block-view-toggle button {
    width: 32px;
    height: 32px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .block-view-toggle .toggle-icon {
    width: 18px;
    height: 18px;
  }

  .block-view-toggle button.active {
    background: #0f172a;
    color: #fff;
    border-color: #0f172a;
  }

  .block-editor__visual {
    min-height: 140px;
    border-radius: 10px;
    border: 1px solid #d9dee7;
    background: #fff;
    padding: 10px 12px;
    outline: none;
  }

  .block-editor__visual:focus {
    border-color: #2f8f83;
    box-shadow: 0 0 0 2px rgba(47, 143, 131, 0.15);
  }

  .block-insert-row {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    margin: 6px 0;
    border-radius: 999px;
  }

  .block-insert-row::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: #d9dee7;
  }

  .block-insert {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .block-insert-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: #ffffff;
    border: 1px solid #d9dee7;
    border-radius: 12px;
    padding: 6px;
    display: grid;
    gap: 4px;
    min-width: 190px;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
    z-index: 5;
  }

  .block-insert-option {
    border: 1px solid transparent;
    background: #fff;
    border-radius: 10px;
    padding: 8px 10px;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 2px;
    cursor: pointer;
    color: #1f2937;
    font-size: 13px;
  }

  .block-insert-option:hover,
  .block-insert-option:focus-visible {
    background: #f5f7fa;
    border-color: #c7d0db;
  }

  .block-insert-option__label {
    font-weight: 600;
  }

  .block-insert-option__meta {
    font-size: 11px;
    color: #6f7682;
  }

  .block-insert-btn {
    position: relative;
    z-index: 1;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid #c7d0db;
    background: #fff;
    color: #2f8f83;
    font-size: 18px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .block-insert-btn:hover {
    background: #eef9f7;
    border-color: #2f8f83;
    color: #216b61;
  }

  .block-insert-btn:focus-visible {
    outline: 2px solid #2f8f83;
    outline-offset: 2px;
  }

  .block-insert-row.drag-over {
    background: #eef9f7;
    outline: 1px dashed #2f8f83;
    outline-offset: 2px;
  }

  @media (max-width: 980px) {
    .visual-layout {
      grid-template-columns: 1fr;
    }
  }

  .answers-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid #d9dee7;
    background: #fff;
    flex-wrap: wrap;
  }

  .answers-meta-row .hint {
    margin: 0;
  }

  .answers-meta-row button {
    text-transform: none;
  }

  .answers-meta-controls {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .answers-class-select {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid #d9dee7;
    background: #f8fafc;
    font-size: 13px;
    color: #475569;
  }

  .answers-class-select span {
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-size: 10px;
    color: #7a6f62;
  }

  .answers-class-select select {
    border: none;
    background: transparent;
    font-weight: 600;
    color: #1c232f;
    padding: 2px 4px;
  }

  .answers-class-select select:focus {
    outline: none;
  }

  .answers-error {
    margin: 0 14px 10px;
  }

  .empty {
    text-align: center;
    padding: 40px 20px;
  }

  .actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
  }

  .success {
    color: #1f7a6e;
  }

  .answers :global(.gap-wrapper) {
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

  .answers :global(.gap-summary) {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .answers :global(.gap-summary__count) {
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

  .answers :global(.gap-summary__count--richtig) {
    color: #0a7a0a;
    border-color: #0a7a0a;
  }

  .answers :global(.gap-summary__count--teilweise) {
    color: #e69500;
    border-color: #e69500;
  }

  .answers :global(.gap-summary__count--falsch) {
    color: #c62828;
    border-color: #c62828;
  }

  .answers :global(.gap-slot) {
    position: relative;
    display: inline-block;
    min-width: 140px;
    min-height: 32px;
    vertical-align: middle;
    padding: 4px 6px;
    border-bottom: 2px dashed #cbd5e1;
  }

  .answers :global(.gap-solution) {
    display: inline;
    color: #15803d;
    font-weight: 700;
    font-size: 14px;
  }

  .answers :global(.gap-tooltip) {
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

  .answers :global(.gap-slot:hover .gap-tooltip),
  .answers :global(.gap-slot:focus-within .gap-tooltip),
  .answers :global(.gap-slot .gap-tooltip:hover) {
    display: block;
  }

  .answers :global(.gap-tooltip__item) {
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

  .answers :global(.gap-chip--richtig) {
    background: #e7f6e7;
    border-color: #0a7a0a;
    color: #0a7a0a;
  }

  .answers :global(.gap-chip--teilweise) {
    background: #fff4e0;
    border-color: #e69500;
    color: #e69500;
  }

  .answers :global(.gap-chip--falsch) {
    background: #fde7e7;
    border-color: #c62828;
    color: #c62828;
  }

  .answers :global(.gap-tooltip__user) {
    color: #475569;
    font-weight: 600;
  }

  .answers :global(.gap-tooltip__age) {
    color: #6b7280;
    font-size: 12px;
  }

  .answers :global(.gap-tooltip__actions) {
    display: inline-flex;
    gap: 6px;
    margin-left: 8px;
  }

  .answers :global(.gap-action-btn) {
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #0f172a;
    padding: 4px 6px;
    border-radius: 6px;
    font-size: 11px;
    cursor: pointer;
  }

  .answers :global(.gap-action-btn:hover) {
    text-decoration: none;
  }

  .answers :global(.gap-action-btn.is-active) {
    text-decoration: none;
  }

  .answers :global(.gap-action-btn[data-score='1000']) {
    border-color: #0a7a0a;
    color: #0a7a0a;
  }

  .answers :global(.gap-action-btn[data-score='500']) {
    border-color: #e69500;
    color: #e69500;
  }

  .answers :global(.gap-action-btn[data-score='0']) {
    border-color: #c62828;
    color: #c62828;
  }

  .answers :global(.gap-action-btn.is-active[data-score='1000']) {
    background: #e7f6e7;
  }

  .answers :global(.gap-action-btn.is-active[data-score='500']) {
    background: #fff4e0;
  }

  .answers :global(.gap-action-btn.is-active[data-score='0']) {
    background: #fde7e7;
  }

  @media (max-width: 900px) {
    .topbar {
      gap: 16px;
    }

    .topbar-tabs {
      display: none;
    }

    .topbar-menu {
      display: inline-flex;
    }

    .login {
      grid-template-columns: 1fr;
    }

    .workspace {
      grid-template-columns: 1fr;
    }

  }
</style>
