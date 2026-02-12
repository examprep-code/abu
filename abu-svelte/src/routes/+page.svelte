<script context="module">
  export const ssr = false;
</script>

<script>
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { loadConfig } from '$lib/config';
  import { tokenizeCss, tokenizeHtml } from '$lib/codeTokens';
  import { createLueckeRuntime, ensureLueckeElements } from '$lib/luecke';
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

  let creating = false;
  let deleting = false;
  let newSheetName = '';
  let newSheetKey = '';
  let sheetFilter = '';
  let sheetSort = 'updated_at_desc';
  let showCreateSheetModal = false;
  let activeTab = 'editor';
  let editorView = 'html';
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

  let previewEl = null;
  let previewRuntime = null;
  let previewPending = false;
  let previewUser = '';

  let visualBlocks = [];
  let visualSyncHtml = '';
  let visualPreviewEl = null;
  let visualBlockViews = [];
  let dragIndex = null;
  let dragOverIndex = null;

  let answersEl = null;
  let answers = [];
  let answersLoading = false;
  let answersError = '';
  let answersMeta = '';
  let answersPending = false;
  let answersKey = '';
  let answersContent = '';

  const PLAN_STATUS_OPTIONS = [
    { value: '', label: 'Nicht zugeordnet' },
    { value: 'aktiv', label: 'Aktiv' },
    { value: 'freiwillig', label: 'Freiwillig' },
    { value: 'archiviert', label: 'Archiviert' }
  ];
  const EDITOR_VIEWS = [
    { id: 'html', label: 'HTML' },
    { id: 'visual', label: 'Visuell' },
    { id: 'preview', label: 'Preview' },
    { id: 'answers', label: 'Antworten' }
  ];
  const SHEET_TABLE_COLUMNS =
    'minmax(120px, 0.9fr) minmax(180px, 1.1fr) minmax(220px, 2fr) minmax(160px, 0.9fr) minmax(160px, 0.9fr) auto';
  const CLASS_TABLE_COLUMNS =
    'minmax(160px, 1.2fr) minmax(90px, 0.6fr) minmax(160px, 1fr) minmax(160px, 1fr) minmax(220px, 1.4fr) auto';

  $: planAssignmentMap = new Map(
    planAssignments.map((entry) => [entry.sheet_key, entry])
  );
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

  onMount(async () => {
    loadAdminCi();
    try {
      const config = await loadConfig();
      apiBaseUrl = config.apiBaseUrl.endsWith('/')
        ? config.apiBaseUrl
        : `${config.apiBaseUrl}/`;
      ensureLueckeElements();
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

  function getSchoolLabel(schoolId) {
    return schoolId ? schoolMap.get(String(schoolId))?.name ?? '' : '';
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

  const selectSheet = (id) => {
    selectedId = id;
    const current = sheets.find((sheet) => sheet.id === id);
    editorContent = current?.content ?? '';
    editorName = current?.name ?? '';
    selectedKey = current?.key ?? '';
    saveState = '';
    editorView = 'html';
    answers = [];
    answersError = '';
    answersMeta = '';
    answersKey = '';
    answersContent = '';
  };

  const closeEditor = () => {
    selectedId = null;
    selectedKey = '';
    editorContent = '';
    editorName = '';
    saveState = '';
    editorView = 'html';
    previewRuntime?.destroy();
    previewRuntime = null;
    previewUser = '';
    answers = [];
    answersError = '';
    answersMeta = '';
    answersKey = '';
    answersContent = '';
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

  const refreshPlanData = async () => {
    if (!token) return;
    await Promise.all([fetchClasses(), fetchSheets()]);
  };

  const selectClass = (id) => {
    selectedClassId = id;
    const current = classes.find((entry) => entry.id === id);
    className = current?.name ?? '';
    classYear = current?.year ?? '';
    classProfession = current?.profession ?? '';
    classNotes = current?.notes ?? '';
    classSchoolId = current?.school ? String(current.school) : '';
    selectedLearnerId = null;
    newLearnerName = '';
    newLearnerEmail = '';
    newLearnerNotes = '';
    learnerModalMode = 'create';
    if (id) {
      fetchLearners(id);
    }
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

  const selectPlanClass = (id) => {
    selectedPlanClassId = id;
    if (id) {
      fetchPlanAssignments(id);
    } else {
      planAssignments = [];
    }
  };

  const openPlanTab = () => {
    activeTab = 'plan';
    if (classes.length) {
      selectPlanClass(selectedPlanClassId ?? classes[0].id);
    } else {
      selectedPlanClassId = null;
      planAssignments = [];
    }
  };

  const openSettings = async () => {
    activeTab = 'settings';
    if (!token || loadingSchools) return;
    if (!schools.length) {
      await fetchSchools();
    }
  };

  const getNextLueckeIndex = () => {
    const matches = Array.from(editorContent.matchAll(/name="luecke(\d+)"/g));
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
    blocks.map((block) => `<p>${block}</p>`).join('\n');

  const renderVisualPreviewFromBlocks = (blocks) => {
    if (!visualPreviewEl) return;
    const html = blocks
      .map(
        (block, idx) =>
          `<div class="visual-block" data-abu-idx="${idx}"><p>${block}</p></div>`
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

  const insertVisualBlockAt = (index, value) => {
    const next = [...visualBlocks];
    next.splice(index, 0, normalizeBlockContent(value));
    visualBlocks = next;
    const nextViews = [...visualBlockViews];
    nextViews.splice(index, 0, 'html');
    visualBlockViews = normalizeVisualBlockViews(nextViews, next.length);
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

  const insertVisualBlock = (variant = 'gap') => {
    const index = getNextLueckeIndex();
    const tag = variant === 'wide' ? 'luecke-gap-wide' : 'luecke-gap';
    const snippet = `<${tag} name="luecke${index}">Antwort</${tag}>`;
    insertVisualBlockAt(visualBlocks.length, snippet);
  };

  const insertVisualParagraph = () => {
    insertVisualBlockAt(visualBlocks.length, 'Neuer Block');
  };

  $: if (activeTab === 'editor' && editorView === 'visual' && visualPreviewEl) {
    editorContent;
    if (editorContent !== visualSyncHtml) {
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
    scheduleAnswersRefresh();
  }

  $: if ((activeTab !== 'editor' || editorView !== 'preview') && previewRuntime) {
    previewRuntime.destroy();
    previewRuntime = null;
    previewUser = '';
  }

  const schedulePreviewRefresh = async () => {
    if (previewPending) return;
    previewPending = true;
    await tick();
    previewPending = false;

    if (!previewEl || !apiBaseUrl || activeTab !== 'editor' || editorView !== 'preview') return;
    ensureLueckeElements();

    const nextUser = `preview:${selectedKey || 'draft'}`;
    previewRuntime?.destroy();
    previewRuntime = createLueckeRuntime({
      root: previewEl,
      apiBaseUrl,
      sheetKey: selectedKey || 'draft',
      user: nextUser
    });
    previewUser = nextUser;
    await previewRuntime.refresh();
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

  const fetchAnswers = async (key) => {
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
      const res = await apiFetch(`answer?sheet=${encodeURIComponent(key)}`);
      const payload = await readPayload(res);
      if (!res.ok) {
        answersError = payload?.warning || 'Antworten konnten nicht geladen werden';
        answers = [];
        return;
      }
      answers = payload?.data?.answer ?? [];
      answersMeta = `Antworten geladen (${answers.length} Eintraege)`;
      answersKey = key;
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
    await fetchAnswers(selectedKey);
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
      answersLoading = false;
      return;
    }

    const shouldFetch = selectedKey && selectedKey !== answersKey;
    if (shouldFetch) {
      await fetchAnswers(selectedKey);
    } else if (!answers.length && !answersLoading && !answersError && selectedKey) {
      await fetchAnswers(selectedKey);
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
    planSaving = true;
    planError = '';
    const existing = planAssignmentMap.get(sheetKey);
    try {
      if (!status) {
        if (!existing?.id) return;
        const label = sheetKey ? `Zuordnung "${sheetKey}"` : 'Zuordnung';
        if (!confirmDelete(label)) return;
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
        return;
      }

      const res = await apiFetch('plan', {
        method: 'POST',
        body: JSON.stringify({
          classroom: selectedPlanClassId,
          sheet_key: sheetKey,
          status
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
          { id: newId, classroom: selectedPlanClassId, sheet_key: sheetKey, status }
        ];
      } else {
        await fetchPlanAssignments(selectedPlanClassId);
      }
    } catch (err) {
      planError = err?.message ?? 'Zuordnung fehlgeschlagen';
    } finally {
      planSaving = false;
    }
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
          on:click={() => (activeTab = 'editor')}
          type="button"
        >
          Inhalt
        </button>
        <button
          class="ci-tab"
          class:selected={activeTab === 'plan'}
          on:click={openPlanTab}
          type="button"
        >
          Zuweisen
        </button>
        <button
          class="ci-tab"
          class:selected={activeTab === 'classes'}
          on:click={() => (activeTab = 'classes')}
          type="button"
        >
          Klassen
        </button>
        <button
          class="ci-tab"
          class:selected={activeTab === 'schools'}
          on:click={() => (activeTab = 'schools')}
          type="button"
        >
          Schulen
        </button>
      </div>
    {/if}
    <div class="status">
      {#if token}
        <div>
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
          {#if editorView === 'html'}
            <div class="fields">
              <label>
                <span>Name</span>
                <input type="text" bind:value={editorName} placeholder="Name" />
              </label>
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
            </div>
          {:else if editorView === 'visual'}
            <div class="fields">
              <label>
                <span>Name</span>
                <input type="text" bind:value={editorName} placeholder="Name" />
              </label>
              <div class="visual-layout">
                <div class="visual-edit-panel">
                  <div class="visual-edit-header">
                    <div class="list-title">Bloecke bearbeiten</div>
                    <div class="hint">{visualBlocks.length} Bloecke</div>
                  </div>
                  <div class="visual-toolbar">
                    <button class="ghost ci-btn-outline" type="button" on:click={insertVisualParagraph}>
                      + Block
                    </button>
                    <button
                      class="ghost ci-btn-outline"
                      type="button"
                      on:click={() => insertVisualBlock('gap')}
                    >
                      + Luecke
                    </button>
                    <button
                      class="ghost ci-btn-outline"
                      type="button"
                      on:click={() => insertVisualBlock('wide')}
                    >
                      + Luecke breit
                    </button>
                    <button class="ghost ci-btn-outline" type="button" on:click={syncVisualPreviewFromHtml}>
                      HTML neu laden
                    </button>
                  </div>
                  <div class="block-editors">
                    {#if dragIndex !== null}
                      <div
                        class="block-insert-row"
                        class:drag-over={dragOverIndex === 0}
                        on:dragover={(event) => handleInsertDragOver(event, 0)}
                        on:drop={(event) => handleInsertDrop(event, 0)}
                      >
                        <button
                          class="ghost ci-btn-outline block-insert-btn"
                          type="button"
                          on:click={() => insertVisualBlockAt(0, 'Neuer Block')}
                          title="Block einfuegen"
                          aria-label="Block einfuegen"
                        >
                          +
                        </button>
                      </div>
                    {/if}
                    {#each visualBlocks as block, idx}
                      <div
                        class="block-editor"
                        draggable="true"
                        on:dragstart={(event) => handleBlockDragStart(event, idx)}
                        on:dragend={handleBlockDragEnd}
                      >
                        <div class="block-editor__header" draggable="true">
                          <div class="list-title" draggable="true">
                            {visualBlockViews[idx] === 'visual' ? 'Visuell' : 'HTML'}
                          </div>
                          <div class="block-editor__actions">
                            <div class="block-view-toggle">
                              <button
                                class="ghost ci-btn-outline"
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
                                class="ghost ci-btn-outline"
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
                            </div>
                            <button
                              class="ghost ci-btn-outline"
                              type="button"
                              on:click={() =>
                                confirmDelete('Block') && deleteVisualBlockAt(idx)}
                            >
                              Loeschen
                            </button>
                          </div>
                        </div>
                        {#if visualBlockViews[idx] === 'visual'}
                          <div
                            class="block-editor__visual"
                            contenteditable="true"
                            spellcheck="false"
                            on:input={(event) =>
                              updateVisualBlock(idx, event.currentTarget.innerHTML)}
                          >
                            {@html block}
                          </div>
                          <p class="hint">
                            Visuell bearbeiten. HTML wird direkt im Block angepasst.
                          </p>
                        {:else}
                          <textarea
                            spellcheck="false"
                            value={block}
                            on:input={(event) => updateVisualBlock(idx, event.target.value)}
                          ></textarea>
                        {/if}
                      </div>
                      {#if idx < visualBlocks.length - 1}
                        <div
                          class="block-insert-row"
                          class:drag-over={dragOverIndex === idx + 1}
                          on:dragover={(event) => handleInsertDragOver(event, idx + 1)}
                          on:drop={(event) => handleInsertDrop(event, idx + 1)}
                        >
                          <button
                            class="ghost ci-btn-outline block-insert-btn"
                            type="button"
                            on:click={() => insertVisualBlockAt(idx + 1, 'Neuer Block')}
                            title="Block einfuegen"
                            aria-label="Block einfuegen"
                          >
                            +
                          </button>
                        </div>
                      {/if}
                    {/each}
                    {#if dragIndex !== null}
                      <div
                        class="block-insert-row"
                        class:drag-over={dragOverIndex === visualBlocks.length}
                        on:dragover={(event) => handleInsertDragOver(event, visualBlocks.length)}
                        on:drop={(event) => handleInsertDrop(event, visualBlocks.length)}
                      >
                        <button
                          class="ghost ci-btn-outline block-insert-btn"
                          type="button"
                          on:click={() => insertVisualBlockAt(visualBlocks.length, 'Neuer Block')}
                          title="Block einfuegen"
                          aria-label="Block einfuegen"
                        >
                          +
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>
                <div class="visual-pane">
                  <div class="visual-preview-header">
                    <div class="list-title">HTML-Elemente</div>
                    <div class="hint">Vorschau</div>
                  </div>
                  <div class="visual-preview" bind:this={visualPreviewEl}></div>
                  <p class="hint">
                    Rechts siehst du die enthaltenen HTML-Elemente (z.B. Luecken). Bearbeitung links.
                  </p>
                </div>
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
            <p class="hint">Waehle eine Klasse, um die Lernenden zu sehen.</p>
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
              selectedClassId = null;
              classSchoolId = '';
              learners = [];
              selectedLearnerId = null;
              newLearnerName = '';
              newLearnerNotes = '';
              learnerModalMode = 'create';
            }}>
              Zurueck
            </button>
            <h2>Lernende</h2>
            <p class="hint">
              {className || 'Klasse'} {classYear || ''} {classProfession || ''}
              {getSchoolLabel(classSchoolId) ? ` · ${getSchoolLabel(classSchoolId)}` : ''}
            </p>
          </div>
          <div class="row-actions">
            <button
              class="icon-btn ci-btn-outline refresh-btn"
              on:click={() => fetchLearners(selectedClassId)}
              disabled={loadingLearners}
              title="Lernende aktualisieren"
              aria-label="Lernende aktualisieren"
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
            >
              Neue Lernende
            </button>
          </div>
        </div>

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
                  <option value={school.id}>{school.name || `Schule #${school.id}`}</option>
                {/each}
              </select>
            </label>
            <label>
              <span>Notizen</span>
              <textarea rows="3" bind:value={classNotes} placeholder="Notizen"></textarea>
            </label>
          </div>
          <div class="row-actions">
            <button class="ci-btn-primary" on:click={updateClass} disabled={savingClass}>
              {savingClass ? 'Speichere...' : 'Speichern'}
            </button>
          </div>
        </div>

        <div class="manage-card">
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
              selectedSchoolId = null;
              schoolName = '';
              schoolCss = '';
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

    {#if activeTab === 'plan'}
    <section class="panel full">
      <div class="panel-header">
        <div>
          <h2>Planen</h2>
          <p class="hint">Arbeitsblaetter den Klassen zuordnen.</p>
        </div>
        <div class="row-actions">
          <button
            class="icon-btn ci-btn-outline refresh-btn"
            on:click={refreshPlanData}
            disabled={loadingClasses || loadingSheets}
            title="Klassen und Sheets aktualisieren"
            aria-label="Klassen und Sheets aktualisieren"
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

      <div class="plan-grid">
        <div class="plan-card">
          <h3>Klassen</h3>
          {#if loadingClasses}
            <p class="hint">Lade Klassen...</p>
          {:else if classes.length === 0}
            <p class="hint">Keine Klassen vorhanden.</p>
          {:else}
            <div class="list">
              {#each classes as entry}
                <button
                  class="ci-btn-soft"
                  class:selected={selectedPlanClassId === entry.id}
                  on:click={() => selectPlanClass(entry.id)}
                >
                  <div class="list-title">{entry.name || `Klasse #${entry.id}`}</div>
                  <div class="list-preview">
                    {entry.year || ''} {entry.profession || ''}
                    {getSchoolLabel(entry.school) ? ` · ${getSchoolLabel(entry.school)}` : ''}
                  </div>
                </button>
              {/each}
            </div>
          {/if}
          {#if classError}
            <p class="error-text">{classError}</p>
          {/if}
        </div>

        <div class="plan-card">
          <h3>Arbeitsblaetter</h3>
          {#if !selectedPlanClassId}
            <p class="hint">Bitte eine Klasse auswaehlen.</p>
          {:else if loadingPlan}
            <p class="hint">Lade Zuordnungen...</p>
          {:else if sheets.length === 0}
            <p class="hint">Noch keine Sheets vorhanden.</p>
          {:else}
            <p class="hint">{planAssignments.length} zugeordnet</p>
            <div class="assignment-list">
              {#each sheets as sheet}
                {@const assignment = sheet.key ? planAssignmentMap.get(sheet.key) : null}
                {@const currentStatus = assignment?.status ?? ''}
                <label class="assignment-row">
                  <div class="assignment-info">
                    <div class="list-title">{sheet.name || sheet.key || `Sheet #${sheet.id}`}</div>
                    <div class="assignment-key">{sheet.key || 'Key fehlt'}</div>
                  </div>
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
                </label>
              {/each}
            </div>
          {/if}
          {#if sheetError}
            <p class="error-text">{sheetError}</p>
          {/if}
          {#if planError}
            <p class="error-text">{planError}</p>
          {/if}
        </div>
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
              <option value={school.id}>{school.name || `Schule #${school.id}`}</option>
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
    flex-wrap: wrap;
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
    flex-wrap: wrap;
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

  .plan-grid {
    display: grid;
    grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
    gap: 20px;
  }

  .plan-card {
    background: #f5f7fa;
    border-radius: 16px;
    padding: 16px;
    border: 1px solid #e2e8f0;
    display: grid;
    gap: 12px;
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

  .fields textarea {
    min-height: 320px;
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

  .visual-toolbar {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .visual-layout {
    display: grid;
    gap: 16px;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
    align-items: start;
  }

  .visual-pane {
    display: grid;
    gap: 10px;
  }

  .visual-preview {
    min-height: 320px;
    border-radius: 14px;
    border: 1px solid #d9dee7;
    background: #ffffff;
    padding: 16px;
    overflow: auto;
  }

  .visual-preview :global(.visual-block) {
    border-radius: 12px;
    padding: 10px 12px;
    border: 1px dashed #e2e8f0;
    margin-bottom: 12px;
  }

  .visual-preview :global(.visual-block > p) {
    margin: 0;
  }

  .visual-preview :global(.visual-block:last-child) {
    margin-bottom: 0;
  }

  .visual-preview :global(iframe) {
    pointer-events: none;
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

  .visual-preview-header {
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
    display: flex;
    justify-content: center;
    padding: 2px 0;
  }

  .block-insert-row.drag-over .block-insert-btn {
    border-color: #2f8f83;
    background: #eef9f7;
    color: #0f172a;
  }

  .block-insert-btn {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    font-weight: 700;
    line-height: 1;
    padding: 0;
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
      flex-direction: column;
      align-items: flex-start;
    }

    .login {
      grid-template-columns: 1fr;
    }

    .workspace {
      grid-template-columns: 1fr;
    }

    .plan-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
