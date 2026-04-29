<script context="module">
</script>

<script>
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { loadConfig } from '$lib/config';
  import { tokenizeCss, tokenizeHtml } from '$lib/codeTokens';
  import { createLueckeRuntime, ensureLueckeElements } from '$lib/custom-elements/luecke';
  import { createFreitextRuntime, ensureFreitextElements } from '$lib/custom-elements/freitext';
  import { createUmfrageRuntime, ensureUmfrageElements } from '$lib/custom-elements/umfrage';
  import { applySchoolCiCss } from '$lib/ci';
  import { formatSwissDateTime } from '$lib/date';
  import {
    describeAgentContext,
    resolveAgentContext,
    resolveAgentNavigationIntent
  } from '$lib/agent/router';
  import { createAgentConversation } from '$lib/agent/conversation';
  import { createDefaultAgentProvider } from '$lib/agent/provider';
  import { createAgentScopeState, createEmptyAgentDraft } from '$lib/agent/session';
  import {
    BLOCK_LEVEL_TAG_NAMES,
    BLOCK_TEMPLATE_DEFINITIONS,
    TITEL_LEVEL_OPTIONS,
    detectWorksheetBlockType,
    getWorksheetElementType
  } from '$lib/worksheet-elements';
  import ListTable from '$lib/components/ListTable.svelte';
  import ShopMockup from '$lib/components/ShopMockup.svelte';

  let apiBaseUrl = '';
  let configError = '';
  let ready = false;

  let token = '';
  let userId = null;
  let userRole = 1;
  let userRoleLabel = 'Aktiviert';
  let isAdmin = false;
  let isActivatedUser = true;
  let sheetReadOnly = false;
  let classReadOnly = false;
  let userEmail = '';
  let userAiUsage = {
    requests: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    prompt_cost_usd: 0,
    completion_cost_usd: 0,
    total_cost_usd: 0
  };

  let loginEmail = '';
  let loginPassword = '';
  let loginLoading = false;
  let loginError = '';
  let learnerLoginToken = '';
  let learnerLoginLoading = false;
  let learnerLoginError = '';

  let sheets = [];
  let loadingSheets = false;
  let sheetError = '';

  let collections = [];
  let loadingCollections = false;
  let collectionError = '';
  let collectionLinks = [];
  let loadingCollectionLinks = false;
  let collectionLinkError = '';
  let selectedCollectionId = null;
  let selectedCollectionUserId = null;
  let collectionName = '';
  let collectionDescription = '';
  let collectionFilter = '';
  let collectionSheetFilter = '';
  let collectionSort = 'updated_at_desc';
  let showCollectionModal = false;
  let collectionDescriptionOpen = false;
  let creatingCollection = false;
  let savingCollection = false;
  let deletingCollection = false;
  let collectionLinkSaving = false;
  let newCollectionName = '';
  let newCollectionDescription = '';
  let newSheetCollectionId = '';

  let selectedId = null;
  let selectedKey = '';
  let editorContent = '';
  let editorName = '';
  let editorPrompt = '';
  let editorCollectionId = '';
  let saving = false;
  let sheetSaveStatus = 'idle';
  let sheetHasUnsavedChanges = false;
  let sheetSaveButtonSaved = false;
  let sheetSaveButtonLabel = 'Speichern';
  let saveState = '';
  let lastSavedSheetId = null;
  let lastSavedSheetName = '';
  let lastSavedSheetContent = '';
  let lastSavedSheetPrompt = '';
  let lastSavedSheetCollectionId = '';
  let sheetAutosaveTimer = null;
  let sheetVersions = [];
  let versionsLoading = false;
  let versionsError = '';
  let selectedVersionId = '';
  let restoringVersion = false;
  let versionRestoreStatus = 'idle';
  let versionRestoreButtonRestored = false;
  let selectedVersion = null;
  let isCurrentVersion = false;
  let sheetVersionNumbers = new Map();
  let selectedSheetUserId = null;

  let creating = false;
  let deleting = false;
  let newSheetName = '';
  let newSheetKey = '';
  let sheetFilter = '';
  let sheetSort = 'updated_at_desc';
  let showCreateSheetModal = false;
  let activeTab = 'collections';
  let editorReturnTab = 'collections';
  let showTopbarMenu = false;
  let editorView = 'visual';
  let lueckeInsertWidth = '25ch';
  let topbarMenuEl = null;
  let sheetHtmlTokens = [];
  let sheetHtmlHighlightContent = '';
  let sheetHtmlHighlightTimer = null;
  let sheetHtmlInput = null;
  let sheetHtmlHighlight = null;
  let pendingSaveFocusSnapshot = null;

  let adminCiSchoolId = '';
  let adminCiCss = '';
  let selectedCiSchoolName = '';
  let isCiSchoolZag = false;

  let schools = [];
  let loadingSchools = false;
  let schoolError = '';
  let selectedSchoolId = null;
  let schoolName = '';
  let schoolCss = '';
  let schoolPrompt = '';
  let newSchoolName = '';
  let newSchoolCss = '';
  let newSchoolPrompt = '';
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
  let selectedClassUserId = null;
  let className = '';
  let classYear = '';
  let classProfession = '';
  let classNotes = '';
  let classPrompt = '';
  let classSchoolId = '';
  let classSort = 'name_asc';
  let classSchoolFilter = '';
  let classDetailView = 'details';
  let newClassName = '';
  let newClassYear = '';
  let newClassProfession = '';
  let newClassNotes = '';
  let newClassPrompt = '';
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
  let newLearnerPrompt = '';
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
  let planPromptDraft = {};
  let planPromptOpenKey = '';

  let previewEl = null;
  let previewLueckeRuntime = null;
  let previewFreitextRuntime = null;
  let previewUmfrageRuntime = null;
  let previewPending = false;
  let previewUser = '';

  let visualBlocks = [];
  let visualBlockIds = [];
  let visualBlockIdCounter = 0;
  let visualSyncHtml = '';
  let visualPreviewEl = null;
  let visualBlockViews = [];
  let visualBlockPromptOpen = [];
  let visualBlockHtmlInputs = [];
  let visualBlockHtmlHighlights = [];
  let visualBlockHtmlTokens = [];
  let visualBlockHtmlHighlightContents = [];
  let visualBlockHtmlHighlightTimer = null;
  let visualBlockEditors = [];
  let visualBlockSelections = [];
  let visualBlockInputRevisions = [];
  let visualInputCommitVersion = 0;
  let blockDragImageEl = null;
  let dragIndex = null;
  let dragOverIndex = null;
  let visualActiveBlock = null;
  let visibleBlockInsertIndexes = new Set();
  let blockInsertIndex = null;
  let lueckeEditorOpen = false;
  let lueckeEditorBlockIndex = null;
  let lueckeEditorName = '';
  let lueckeEditorSolution = '';
  let lueckeEditorPrompt = '';
  let lueckeEditorWidth = '25ch';
  let lueckeEditorError = '';
  let lueckeSolutionInputEl = null;
  const VISUAL_HISTORY_LIMIT = 200;
  const VISUAL_HISTORY_CHUNK_MS = 900;
  const VISUAL_INPUT_COMMIT_DELAY_MS = 650;
  const CODE_HIGHLIGHT_DELAY_MS = 350;
  const VISUAL_TERMINAL_CARET_TEXT = '\u200b';
  const VISUAL_TERMINAL_CARET_TEXT_PATTERN = /\u200b/g;
  const AGENT_HISTORY_CONTEXT_MAX_TURNS = 5;
  const AGENT_HISTORY_CONTEXT_MIN_TURNS = 2;
  const AGENT_HISTORY_CONTEXT_MAX_TOTAL_CHARS = 7000;
  const LUECKE_WIDTH_OPTIONS = [
    { value: '15ch', label: 'Schmal' },
    { value: '25ch', label: 'Mittel' },
    { value: '40ch', label: 'Breit' },
    { value: '100%', label: 'Ganze Zeile' }
  ];
  const LUECKE_DEFAULT_WIDTH = '25ch';
  const isLueckeWidthOption = (value = '') => {
    const normalized = String(value || '').trim();
    return LUECKE_WIDTH_OPTIONS.some((option) => option.value === normalized);
  };
  const normalizeLueckeWidth = (value = '') => {
    const normalized = String(value || '').trim();
    if (!normalized) return LUECKE_DEFAULT_WIDTH;
    return normalized;
  };
  const getLueckeWidthSelectValue = (value = '') =>
    isLueckeWidthOption(value) ? String(value || '').trim() : 'custom';
  const setLueckeEditorWidthFromPreset = (event) => {
    const value = event?.currentTarget?.value || '';
    if (value && value !== 'custom') {
      lueckeEditorWidth = value;
    }
  };
  const AGENT_HISTORY_CONTEXT_MAX_PROMPT_CHARS = 520;
  const AGENT_HISTORY_CONTEXT_MAX_RESPONSE_CHARS = 850;
  const AGENT_HISTORY_CONTEXT_MAX_SUMMARY_CHARS = 1400;
  const AGENT_HISTORY_CONTEXT_MAX_SUMMARY_ITEMS = 8;
  const AGENT_HISTORY_CONTEXT_MAX_SUMMARY_ITEM_CHARS = 180;
  let visualHistoryPast = [];
  let visualHistoryFuture = [];
  let visualHistoryApplying = false;
  let visualHistoryChunk = null;

  let agentPrompt = '';
  let agentStatus = '';
  let agentPending = false;
  let agentHistory = [];
  let agentHistoryEl = null;
  let agentInputEl = null;
  let agentContext = 'app';
  const agentScopeState = createAgentScopeState();
  let agentScopeVersion = 0;
  let agentSidebarOpen = false;
  let agentActiveScope = 'app';
  let agentActiveDraft = createEmptyAgentDraft();
  let agentDraftChangeItems = [];
  let agentDraftUiVisible = false;

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
  let answersLearners = [];
  let answersLearnersLoading = false;
  let answersLearnersError = '';
  let answersLearnersClassKey = null;
  let answersLearnersRequestId = 0;
  let answersUserFilter = '';
  let answersUserKey = '';
  let answersContent = '';
  let answersRenderMode = 'aggregate';
  let answersRenderKey = 0;
  let answersLueckeRuntime = null;
  let answersFreitextRuntime = null;
  let answersUmfrageRuntime = null;
  let answersCiCss = '';
  let answersCiClassId = null;
  let answersCiRequestId = 0;

  const PLAN_STATUS_OPTIONS = [
    { value: '', label: 'Nicht zugeordnet' },
    { value: 'aktiv', label: 'Aktiv' },
    { value: 'freiwillig', label: 'Freiwillig' },
    { value: 'vergangen', label: 'Vergangen' },
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
  const COLLECTION_TABLE_COLUMNS =
    'minmax(0, 1.15fr) minmax(0, 2fr) minmax(0, 0.65fr) minmax(0, 0.95fr) minmax(88px, auto)';
  const SHEET_TABLE_COLUMNS =
    'minmax(0, 1.8fr) minmax(0, 2fr) minmax(0, 0.9fr) minmax(0, 0.9fr) minmax(88px, auto)';
  const CLASS_TABLE_COLUMNS =
    'minmax(0, 1.2fr) minmax(0, 0.42fr) minmax(0, 0.72fr) minmax(0, 0.84fr) minmax(0, 0.92fr) minmax(280px, 1.45fr)';

  const getUserRoleLabel = (role) => {
    if (role >= 3) return 'Admin';
    if (role >= 1) return 'Aktiviert';
    if (role === 0) return 'Wartet auf Aktivierung';
    return `Rolle ${role}`;
  };

  $: planAssignmentMap = new Map(
    planAssignments.map((entry) => [entry.sheet_key, entry])
  );
  $: collectionCountMap = new Map();
  $: {
    const next = new Map();
    collectionLinks.forEach((entry) => {
      const collectionId = normalizeCollectionId(entry?.collection);
      if (!collectionId) return;
      next.set(collectionId, (next.get(collectionId) ?? 0) + 1);
    });
    collectionCountMap = next;
  }
  $: selectedCollectionEntries = [...collectionLinks]
    .filter((entry) => normalizeCollectionId(entry?.collection) === selectedCollectionId)
    .sort((a, b) => {
      const posA = Number(a?.position) || 0;
      const posB = Number(b?.position) || 0;
      if (posA !== posB) return posA - posB;
      const keyA = String(a?.sheet_key ?? '').toLowerCase();
      const keyB = String(b?.sheet_key ?? '').toLowerCase();
      return keyA.localeCompare(keyB, undefined, { numeric: true, sensitivity: 'base' });
    });
  $: selectedCollectionEntryMap = new Map(
    selectedCollectionEntries.map((entry) => [String(entry?.sheet_key ?? ''), entry])
  );
  $: sheetCollectionEntryMap = new Map(
    collectionLinks.map((entry) => [getSheetLookupKey(entry?.user, entry?.sheet_key), entry])
  );
  $: sheetByOwnerKeyMap = new Map(
    sheets.map((sheet) => [getSheetLookupKey(sheet?.user, sheet?.key), sheet])
  );
  $: selectedSheetCollectionEntry =
    selectedKey && selectedSheetUserId !== null
      ? sheetCollectionEntryMap.get(getSheetLookupKey(selectedSheetUserId, selectedKey)) ?? null
      : null;
  $: editableCollections =
    isAdmin && userId !== null
      ? collections.filter((entry) => normalizeUserId(entry?.user) === userId)
      : collections;
  $: collectionFilterValue = collectionFilter.trim().toLowerCase();
  $: filteredCollections = collectionFilterValue
    ? collections.filter((entry) => {
        const name = String(entry?.name ?? '').toLowerCase();
        const description = String(entry?.description ?? '').toLowerCase();
        const created = `${entry?.created_at ?? ''} ${formatSwissDateTime(entry?.created_at)}`.toLowerCase();
        const updated = `${entry?.updated_at ?? ''} ${formatSwissDateTime(entry?.updated_at)}`.toLowerCase();
        return `${name} ${description} ${created} ${updated}`.includes(collectionFilterValue);
      })
    : collections;
  $: visibleCollections = [...filteredCollections].sort((a, b) => {
    const { field, dir } = parseCollectionSort(collectionSort);
    const direction = dir === 'desc' ? -1 : 1;
    const valueA = getCollectionSortValue(a, field);
    const valueB = getCollectionSortValue(b, field);
    const normalizedA = valueA === null || valueA === undefined ? '' : String(valueA);
    const normalizedB = valueB === null || valueB === undefined ? '' : String(valueB);
    const result = normalizedA.localeCompare(normalizedB, undefined, {
      numeric: true,
      sensitivity: 'base'
    });
    if (result !== 0) {
      return result * direction;
    }
    const nameA = String(a?.name ?? '');
    const nameB = String(b?.name ?? '');
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });
  $: collectionSheetFilterValue = collectionSheetFilter.trim().toLowerCase();
  $: collectionSheetOwnerId = selectedCollectionUserId;
  $: collectionManageRows = sheets
    .filter((sheet) => {
      if (collectionSheetOwnerId === null) return true;
      return normalizeUserId(sheet?.user) === collectionSheetOwnerId;
    })
    .filter((sheet) => {
      if (!collectionSheetFilterValue) return true;
      const name = String(sheet?.name ?? '').toLowerCase();
      const key = String(sheet?.key ?? '').toLowerCase();
      const content = stripHtml(sheet?.content ?? '').toLowerCase();
      return `${name} ${key} ${content}`.includes(collectionSheetFilterValue);
    })
    .map((sheet) => ({
      ...sheet,
      assignment: selectedCollectionEntryMap.get(String(sheet?.key ?? '')) ?? null
    }))
    .sort((a, b) => {
      const assignmentA = a?.assignment ?? null;
      const assignmentB = b?.assignment ?? null;
      if (assignmentA && !assignmentB) return -1;
      if (!assignmentA && assignmentB) return 1;
      if (assignmentA && assignmentB) {
        const posA = Number(assignmentA?.position) || 0;
        const posB = Number(assignmentB?.position) || 0;
        if (posA !== posB) return posA - posB;
      }
      const nameA = String(a?.name ?? a?.key ?? '').toLowerCase();
      const nameB = String(b?.name ?? b?.key ?? '').toLowerCase();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
  $: selectedCollectionVisibleSheets = visibleSheets.filter((sheet) => {
    const entry = sheetCollectionEntryMap.get(getSheetLookupKey(sheet?.user, sheet?.key)) ?? null;
    return normalizeCollectionId(entry?.collection) === selectedCollectionId;
  });

  $: answersClassId = normalizeClassId(answersClassFilter);
  $: ciSelectSize = Math.max(2, Math.min(6, schools.length + 1));
  $: ciLabel =
    adminCiSchoolId !== ''
      ? schools.find((school) => `${school.id}` === `${adminCiSchoolId}`)?.name ||
        `Schule #${adminCiSchoolId}`
      : 'Standard';
  $: selectedCiSchoolName =
    adminCiSchoolId !== ''
      ? schools.find((school) => `${school.id}` === `${adminCiSchoolId}`)?.name ?? ''
      : '';
  $: isCiSchoolZag = /\bzag\b/i.test(selectedCiSchoolName);
  $: {
    agentPrompt;
    resizeAgentInput();
  }
  $: schoolMap = new Map(schools.map((entry) => [String(entry.id), entry]));
  $: {
    activeTab;
    editorView;
    answersUserFilter;
    answersClassId;
    answersCiClassId;
    answersCiCss;
    classes;
    schoolMap;
    adminCiCss;
    applyEffectiveCi();
  }
  $: sheetFilterValue = sheetFilter.trim().toLowerCase();
  $: filteredSheets = sheetFilterValue
    ? sheets.filter((sheet) => {
        const name = (sheet.name ?? '').toString().toLowerCase();
        const key = (sheet.key ?? '').toString().toLowerCase();
        const content = stripHtml(sheet.content ?? '').toLowerCase();
        const created = `${sheet.created_at ?? ''} ${formatSwissDateTime(sheet.created_at)}`.toLowerCase();
        const updated = `${sheet.updated_at ?? ''} ${formatSwissDateTime(sheet.updated_at)}`.toLowerCase();
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
  $: sheetVersionNumbers = buildVersionNumberMap(sheetVersions);

  $: {
    schoolMap;
    if (
      classSchoolFilter &&
      !schools.some((school) => String(school.id) === String(classSchoolFilter))
    ) {
      classSchoolFilter = '';
    }
    const filteredClasses = classSchoolFilter
      ? classes.filter(
          (entry) =>
            String(normalizeSchoolId(entry?.school)) === String(classSchoolFilter)
        )
      : classes;
    visibleClasses = [...filteredClasses].sort((a, b) => {
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
      key: 'name',
      label: 'Titel',
      sortable: true,
      onSort: () => toggleSheetSort('name'),
      sortHint: () => getSheetSortHint('name'),
      compactVisible: true,
      className: 'sheet-cell--name',
      headerClass: 'sheet-cell--name'
    },
    {
      key: 'content',
      label: 'Inhalt',
      sortable: true,
      onSort: () => toggleSheetSort('content'),
      sortHint: () => getSheetSortHint('content'),
      compactVisible: true,
      className: 'sheet-cell--text-preview',
      value: (sheet) =>
        stripHtml(sheet?.content ?? '').slice(0, 360) || 'Leerer Inhalt'
    },
    {
      key: 'created_at',
      label: 'Erstellt',
      sortable: true,
      onSort: () => toggleSheetSort('created_at'),
      sortHint: () => getSheetSortHint('created_at'),
      value: (sheet) => formatSwissDateTime(sheet?.created_at)
    },
    {
      key: 'updated_at',
      label: 'Geändert',
      sortable: true,
      onSort: () => toggleSheetSort('updated_at'),
      sortHint: () => getSheetSortHint('updated_at'),
      value: (sheet) => formatSwissDateTime(sheet?.updated_at)
    }
  ];

  const classColumns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      onSort: () => toggleClassSort('name'),
      sortHint: () => getClassSortHint('name'),
      compactVisible: true,
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
      className: 'sheet-cell--class-year',
      headerClass: 'sheet-cell--class-year',
      value: (entry) => entry?.year || ''
    },
    {
      key: 'profession',
      label: 'Beruf',
      sortable: true,
      onSort: () => toggleClassSort('profession'),
      sortHint: () => getClassSortHint('profession'),
      className: 'sheet-cell--class-profession',
      headerClass: 'sheet-cell--class-profession',
      value: (entry) => entry?.profession || ''
    },
    {
      key: 'school',
      label: 'Schule',
      sortable: true,
      onSort: () => toggleClassSort('school'),
      sortHint: () => getClassSortHint('school'),
      className: 'sheet-cell--class-school',
      headerClass: 'sheet-cell--class-school',
      value: (entry) => getSchoolLabel(entry?.school) || ''
    },
    {
      key: 'notes',
      label: 'Notizen',
      sortable: true,
      onSort: () => toggleClassSort('notes'),
      sortHint: () => getClassSortHint('notes'),
      className: 'sheet-cell--class-notes',
      headerClass: 'sheet-cell--class-notes',
      value: (entry) => formatClassNotes(entry?.notes)
    }
  ];

  const collectionColumns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      onSort: () => toggleCollectionSort('name'),
      sortHint: () => getCollectionSortHint('name'),
      compactVisible: true,
      className: 'sheet-cell--name',
      headerClass: 'sheet-cell--name',
      value: (entry) => entry?.name || `Sammlung #${entry?.id ?? ''}`
    },
    {
      key: 'description',
      label: 'Beschreibung',
      sortable: true,
      onSort: () => toggleCollectionSort('description'),
      sortHint: () => getCollectionSortHint('description'),
      compactVisible: true,
      className: 'sheet-cell--text-preview',
      value: (entry) => formatCollectionDescription(entry?.description)
    },
    {
      key: 'sheet_count',
      label: 'Blätter',
      sortable: true,
      onSort: () => toggleCollectionSort('sheet_count'),
      sortHint: () => getCollectionSortHint('sheet_count'),
      value: (entry) => String(getCollectionCount(entry?.id))
    },
    {
      key: 'updated_at',
      label: 'Geändert',
      sortable: true,
      onSort: () => toggleCollectionSort('updated_at'),
      sortHint: () => getCollectionSortHint('updated_at'),
      value: (entry) => formatSwissDateTime(entry?.updated_at)
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

  const clearSheetAutosaveTimer = () => {
    if (!browser || sheetAutosaveTimer === null) return;
    window.clearTimeout(sheetAutosaveTimer);
    sheetAutosaveTimer = null;
  };

  const EMPTY_FREITEXT_PREMISE_PLACEHOLDER =
    /[ \t]*<freitext-(prämisse|praemisse)\b(?=[^>]*\blabel\s*=\s*(["'])(?:Prämisse|Praemisse)\s+1\2)(?![^>]*\b(?:key|name|source-key|answer-key|target|ref|source|href|url|source-label|link-label|type|required|optional)\s*=)[^>]*(?:\/\s*>|>\s*<\/freitext-\1\s*>)[ \t]*(?:\r?\n)?/gi;

  const sanitizeSheetContent = (content = '') =>
    String(content ?? '')
      .replace(EMPTY_FREITEXT_PREMISE_PLACEHOLDER, '')
      .replace(/\n[ \t]*\n[ \t]*\n/g, '\n\n');

  const rememberSavedSheetState = () => {
    lastSavedSheetId = selectedId;
    lastSavedSheetName = editorName ?? '';
    lastSavedSheetContent = editorContent ?? '';
    lastSavedSheetPrompt = editorPrompt ?? '';
    lastSavedSheetCollectionId = editorCollectionId ?? '';
  };

  const resetSavedSheetState = () => {
    lastSavedSheetId = null;
    lastSavedSheetName = '';
    lastSavedSheetContent = '';
    lastSavedSheetPrompt = '';
    lastSavedSheetCollectionId = '';
  };

  const hasUnsavedSheetChanges = () => {
    if (!selectedId) return false;
    if (lastSavedSheetId !== selectedId) return true;
    if (visualInputCommitQueue?.size) return true;
    return (
      (editorName ?? '') !== (lastSavedSheetName ?? '') ||
      (editorContent ?? '') !== (lastSavedSheetContent ?? '') ||
      (editorPrompt ?? '') !== (lastSavedSheetPrompt ?? '') ||
      (editorCollectionId ?? '') !== (lastSavedSheetCollectionId ?? '')
    );
  };

  const scheduleSheetAutosave = () => {
    clearSheetAutosaveTimer();
    if (!browser || !selectedId || saving || !hasUnsavedSheetChanges()) return;
    sheetAutosaveTimer = window.setTimeout(() => {
      sheetAutosaveTimer = null;
      saveSheet({ refreshSheetList: false });
    }, SHEET_AUTOSAVE_DELAY_MS);
  };

  const maybeWarnAndSaveBeforeLeavingEditor = async (targetLabel = 'anderer Bereich') => {
    if (!hasUnsavedSheetChanges()) return true;
    if (!browser) return true;
    const shouldSaveAndLeave = window.confirm(
      `Ungelespeicherte Änderungen erkannt.\n\nZiel: ${targetLabel}\n\nOK: Jetzt speichern und wechseln.\nAbbrechen: Im Editor bleiben.`
    );
    if (!shouldSaveAndLeave) return false;
    const saved = await saveSheet({ refreshSheetList: false });
    if (saved) return true;
    return window.confirm(
      'Speichern ist fehlgeschlagen. Ohne Speichern wechseln und Änderungen verwerfen?'
    );
  };

  const buildCssTokens = (value = '') => tokenizeCss(value);
  const buildHtmlTokens = (value = '') => tokenizeHtml(value);

  $: schoolCssTokens = buildCssTokens(schoolCss);
  $: newSchoolCssTokens = buildCssTokens(newSchoolCss);
  $: sheetHtmlTokens = editorView === 'html' ? buildHtmlTokens(sheetHtmlHighlightContent) : [];
  $: if (editorContent) {
    const sanitizedEditorContent = sanitizeSheetContent(editorContent);
    const sheetHtmlFocused =
      browser && typeof document !== 'undefined' && document.activeElement === sheetHtmlInput;
    if (!sheetHtmlFocused && sanitizedEditorContent !== editorContent) {
      editorContent = sanitizedEditorContent;
    }
  }
  $: visualBlockHtmlTokens = visualBlocks.map((block, idx) =>
    visualActiveBlock === idx && visualBlockViews[idx] === 'html'
      ? buildHtmlTokens(visualBlockHtmlHighlightContents[idx] ?? block ?? '')
      : []
  );
  $: if (
    editorView === 'html' &&
    !(browser && typeof document !== 'undefined' && document.activeElement === sheetHtmlInput) &&
    sheetHtmlHighlightContent !== (editorContent || '')
  ) {
    sheetHtmlHighlightContent = editorContent || '';
  }
  $: if (editorView !== 'html' && sheetHtmlHighlightContent) {
    sheetHtmlHighlightContent = '';
  }
  $: {
    const activeHtmlIndex =
      Number.isInteger(visualActiveBlock) && visualBlockViews[visualActiveBlock] === 'html'
        ? visualActiveBlock
        : null;
    if (activeHtmlIndex !== null) {
      const focused =
        browser &&
        typeof document !== 'undefined' &&
        document.activeElement === visualBlockHtmlInputs[activeHtmlIndex];
      const activeHtml = visualBlocks[activeHtmlIndex] || '';
      if (!focused && (visualBlockHtmlHighlightContents[activeHtmlIndex] ?? '') !== activeHtml) {
        const next = [...visualBlockHtmlHighlightContents];
        next[activeHtmlIndex] = activeHtml;
        visualBlockHtmlHighlightContents = next.slice(0, Math.max(next.length, visualBlocks.length));
      }
    }
  }
  $: {
    selectedId;
    editorName;
    editorContent;
    editorPrompt;
    editorCollectionId;
    saving;
    lastSavedSheetId;
    lastSavedSheetName;
    lastSavedSheetContent;
    lastSavedSheetPrompt;
    lastSavedSheetCollectionId;
    visualInputCommitVersion;
    sheetHasUnsavedChanges = hasUnsavedSheetChanges();
    if (selectedId && !saving && sheetHasUnsavedChanges) {
      scheduleSheetAutosave();
    } else {
      clearSheetAutosaveTimer();
    }
  }
  $: sheetSaveButtonSaved =
    sheetSaveStatus === 'saved' && !saving && !sheetHasUnsavedChanges;
  $: sheetSaveButtonLabel = saving
    ? 'Speichere…'
    : sheetSaveButtonSaved
      ? 'Gespeichert'
      : 'Speichern';
  $: if (sheetSaveStatus === 'saved' && sheetHasUnsavedChanges) {
    sheetSaveStatus = 'idle';
  }
  $: versionRestoreButtonRestored =
    versionRestoreStatus === 'restored' && !restoringVersion && !sheetHasUnsavedChanges;
  $: if (versionRestoreStatus === 'restored' && sheetHasUnsavedChanges) {
    versionRestoreStatus = 'idle';
  }

  $: userRoleLabel = getUserRoleLabel(userRole);
  $: isAdmin = userRole >= 3;
  $: isActivatedUser = userRole >= 1;
  $: sheetReadOnly =
    isAdmin &&
    selectedSheetUserId !== null &&
    userId !== null &&
    selectedSheetUserId !== userId;
  $: classReadOnly =
    isAdmin &&
    selectedClassUserId !== null &&
    userId !== null &&
    selectedClassUserId !== userId;
  $: collectionReadOnly =
    isAdmin &&
    selectedCollectionUserId !== null &&
    userId !== null &&
    selectedCollectionUserId !== userId;

  const syncCodeScroll = (inputEl, highlightEl) => {
    if (!inputEl || !highlightEl) return;
    highlightEl.scrollTop = inputEl.scrollTop;
    highlightEl.scrollLeft = inputEl.scrollLeft;
  };

  const clearSheetHtmlHighlightTimer = () => {
    if (sheetHtmlHighlightTimer === null) return;
    window.clearTimeout(sheetHtmlHighlightTimer);
    sheetHtmlHighlightTimer = null;
  };

  const scheduleSheetHtmlHighlight = (value) => {
    if (!browser) {
      sheetHtmlHighlightContent = String(value ?? '');
      return;
    }
    clearSheetHtmlHighlightTimer();
    sheetHtmlHighlightTimer = window.setTimeout(() => {
      sheetHtmlHighlightTimer = null;
      sheetHtmlHighlightContent = String(value ?? '');
    }, CODE_HIGHLIGHT_DELAY_MS);
  };

  const clearVisualBlockHtmlHighlightTimer = () => {
    if (visualBlockHtmlHighlightTimer === null) return;
    window.clearTimeout(visualBlockHtmlHighlightTimer);
    visualBlockHtmlHighlightTimer = null;
  };

  const setVisualBlockHtmlHighlight = (index, value) => {
    if (!Number.isInteger(index)) return;
    const next = [...visualBlockHtmlHighlightContents];
    next[index] = String(value ?? '');
    visualBlockHtmlHighlightContents = next.slice(0, Math.max(next.length, visualBlocks.length));
  };

  const scheduleVisualBlockHtmlHighlight = (index, value) => {
    if (!browser) {
      setVisualBlockHtmlHighlight(index, value);
      return;
    }
    clearVisualBlockHtmlHighlightTimer();
    visualBlockHtmlHighlightTimer = window.setTimeout(() => {
      visualBlockHtmlHighlightTimer = null;
      setVisualBlockHtmlHighlight(index, value);
    }, CODE_HIGHLIGHT_DELAY_MS);
  };

  const syncEditableHtml = (node, params) => {
    const apply = (nextParams) => {
      if (!node) return;
      const html = typeof nextParams === 'string' ? nextParams : (nextParams?.html ?? '');
      const freezeWhileFocused = Boolean(nextParams?.freezeWhileFocused);
      const isFocused =
        typeof document !== 'undefined' &&
        (document.activeElement === node || node.contains(document.activeElement));
      if (freezeWhileFocused && isFocused) return;
      if (node.innerHTML !== html) node.innerHTML = html;
    };

    apply(params);
    return { update: apply };
  };

  const getTextInputSelectionSnapshot = (node) => {
    if (!node) return null;
    try {
      if (typeof node.selectionStart !== 'number' || typeof node.selectionEnd !== 'number') {
        return null;
      }
      return {
        start: node.selectionStart,
        end: node.selectionEnd,
        direction: node.selectionDirection || 'none',
        scrollTop: node.scrollTop || 0,
        scrollLeft: node.scrollLeft || 0
      };
    } catch (err) {
      return null;
    }
  };

  const restoreTextInputSelectionSnapshot = (node, selection) => {
    if (!node || !selection) return;
    try {
      node.setSelectionRange(selection.start, selection.end, selection.direction || 'none');
      node.scrollTop = selection.scrollTop || 0;
      node.scrollLeft = selection.scrollLeft || 0;
    } catch (err) {
      // Some input types do not expose text selection.
    }
  };

  const getActiveEditorElement = () => {
    if (!browser || typeof document === 'undefined') return null;
    const active = document.activeElement;
    if (!(active instanceof Element)) return null;
    if (!active.closest('.editor')) return null;
    if (active.closest('.editor-action-btn')) return null;
    return active;
  };

  const captureEditorFocusSnapshot = () => {
    const active = getActiveEditorElement();
    if (!active) return null;

    const htmlBlockIndex = visualBlockHtmlInputs.findIndex((node) => node === active);
    if (htmlBlockIndex >= 0) {
      return {
        type: 'visual-block-html',
        index: htmlBlockIndex,
        selection: getTextInputSelectionSnapshot(active)
      };
    }

    if (active === sheetHtmlInput) {
      return {
        type: 'sheet-html',
        selection: getTextInputSelectionSnapshot(active)
      };
    }

    const visualBlockIndex = visualBlockEditors.findIndex(
      (node) => node && (node === active || node.contains(active))
    );
    if (visualBlockIndex >= 0) {
      captureVisualSelection(visualBlockIndex);
      return {
        type: 'visual-block-visual',
        index: visualBlockIndex
      };
    }

    return {
      type: 'element',
      node: active,
      selection: getTextInputSelectionSnapshot(active)
    };
  };

  const shouldRestoreEditorFocusSnapshot = (target) => {
    if (!browser || typeof document === 'undefined' || !target) return false;
    const active = document.activeElement;
    if (!active || active === document.body) return true;
    if (target === active || target.contains?.(active)) return false;
    if (active instanceof Element && active.closest('.editor-action-btn')) return true;
    return false;
  };

  const restoreEditorFocusSnapshot = async (snapshot) => {
    if (!snapshot || !browser) return;
    if (snapshot.type === 'visual-block-html') {
      if (snapshot.index < 0 || snapshot.index >= visualBlocks.length) return;
      visualActiveBlock = snapshot.index;
      if (visualBlockViews[snapshot.index] !== 'html') {
        setVisualBlockView(snapshot.index, 'html');
      }
      await tick();
      const target = visualBlockHtmlInputs[snapshot.index];
      if (shouldRestoreEditorFocusSnapshot(target)) {
        target?.focus?.({ preventScroll: true });
      }
      restoreTextInputSelectionSnapshot(target, snapshot.selection);
      return;
    }

    if (snapshot.type === 'sheet-html') {
      await tick();
      const target = sheetHtmlInput;
      if (shouldRestoreEditorFocusSnapshot(target)) {
        target?.focus?.({ preventScroll: true });
      }
      restoreTextInputSelectionSnapshot(target, snapshot.selection);
      return;
    }

    if (snapshot.type === 'visual-block-visual') {
      if (snapshot.index < 0 || snapshot.index >= visualBlocks.length) return;
      visualActiveBlock = snapshot.index;
      await tick();
      const target = visualBlockEditors[snapshot.index];
      if (shouldRestoreEditorFocusSnapshot(target)) {
        await focusVisualBlockEditor(snapshot.index, 'visual');
      } else {
        restoreVisualSelection(snapshot.index);
      }
      return;
    }

    if (snapshot.type === 'element') {
      await tick();
      const target = snapshot.node;
      if (!target?.isConnected) return;
      if (shouldRestoreEditorFocusSnapshot(target)) {
        target.focus?.({ preventScroll: true });
      }
      restoreTextInputSelectionSnapshot(target, snapshot.selection);
    }
  };

  const captureSaveFocusSnapshot = () => {
    const snapshot = captureEditorFocusSnapshot();
    if (snapshot) {
      pendingSaveFocusSnapshot = snapshot;
    }
  };

  const handleSaveButtonClick = () => {
    const focusSnapshot = pendingSaveFocusSnapshot || captureEditorFocusSnapshot();
    pendingSaveFocusSnapshot = null;
    saveSheet({ focusSnapshot });
  };

  const STORAGE_KEY = 'abu.auth';
  const LEARNER_STORAGE_KEY = 'abu.learner';
  const ADMIN_CI_KEY = 'abu.admin.ci';
  const SHEET_AUTOSAVE_DELAY_MS = 60 * 1000;
  const usageNumberFormatter = new Intl.NumberFormat('de-CH');
  const usageUsdFormatter = new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6
  });

  const normalizeAiUsage = (value) => {
    const entry = value && typeof value === 'object' ? value : {};
    const requests = Math.max(0, Number(entry.requests) || 0);
    const promptTokens = Math.max(0, Number(entry.prompt_tokens) || 0);
    const completionTokens = Math.max(0, Number(entry.completion_tokens) || 0);
    const totalTokensRaw = Math.max(0, Number(entry.total_tokens) || 0);
    const totalTokens = Math.max(totalTokensRaw, promptTokens + completionTokens);
    const promptCost = Math.max(0, Number(entry.prompt_cost_usd) || 0);
    const completionCost = Math.max(0, Number(entry.completion_cost_usd) || 0);
    const totalCostRaw = Math.max(0, Number(entry.total_cost_usd) || 0);
    const totalCost = Math.max(totalCostRaw, promptCost + completionCost);
    return {
      requests,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      prompt_cost_usd: promptCost,
      completion_cost_usd: completionCost,
      total_cost_usd: totalCost
    };
  };

  const extractAiUsageFromPayload = (payload) =>
    normalizeAiUsage(payload?.data?.ai_usage ?? payload?.data?.user?.ai_usage ?? null);

  const formatUsageCount = (value) => usageNumberFormatter.format(Math.max(0, Number(value) || 0));
  const formatUsageUsd = (value) =>
    usageUsdFormatter.format(Math.max(0, Number(value) || 0));

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

  onMount(() => {
    if (!browser) return undefined;
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedSheetChanges()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      clearSheetAutosaveTimer();
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
      ensureFreitextElements();
      ensureUmfrageElements();
    } catch (err) {
      configError = err?.message ?? 'config konnte nicht geladen werden';
    } finally {
      ready = true;
    }

    if (browser) {
      const params = new URLSearchParams(window.location.search || '');
      const sheetParam = (params.get('sheet') ?? '').trim();
      if (sheetParam) {
        const asNumber = Number(sheetParam);
        if (Number.isFinite(asNumber) && asNumber > 0) {
          selectedId = asNumber;
        } else {
          selectedKey = sheetParam;
        }
      }
    }

    if (browser) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (saved?.ai_usage) {
            userAiUsage = normalizeAiUsage(saved.ai_usage);
          }
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

  const persistAuth = (newToken, email, usage = null, meta = {}) => {
    token = newToken;
    userId = normalizeClassId(meta?.id) ?? null;
    const roleNum = Number(meta?.role);
    userRole = Number.isFinite(roleNum) ? roleNum : 1;
    userEmail = email;
    userAiUsage = normalizeAiUsage(usage);
    if (browser) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token: newToken, email, id: userId, role: userRole, ai_usage: userAiUsage })
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
      applyEffectiveCi();
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
    applyEffectiveCi();
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

  function normalizeCollectionId(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'object') {
      return normalizeClassId(value?.id ?? null);
    }
    return normalizeClassId(value);
  }

  function normalizeUserId(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'object') {
      return normalizeClassId(value?.id ?? null);
    }
    return normalizeClassId(value);
  }

  function getSheetLookupKey(ownerId, sheetKey) {
    const normalizedOwnerId = normalizeUserId(ownerId);
    return `${normalizedOwnerId ?? ''}:${String(sheetKey ?? '')}`;
  }

  function getPreferredEditableCollectionId() {
    const currentId = normalizeCollectionId(selectedCollectionId);
    if (
      currentId !== null &&
      editableCollections.some((entry) => normalizeCollectionId(entry?.id) === currentId)
    ) {
      return String(currentId);
    }
    const firstEditable = editableCollections[0] ?? null;
    return firstEditable ? String(firstEditable.id) : '';
  }

  function buildLearnerPortalHref(learnerEntry) {
    const code = (learnerEntry?.code ?? '').toString().trim();
    if (!code) return '/lernende';
    const params = new URLSearchParams();
    params.set('code', code);
    const classId = normalizeClassId(learnerEntry?.classroom ?? selectedClassId);
    if (classId) {
      params.set('classroom', String(classId));
    }
    return `/lernende?${params.toString()}`;
  }

  function isLearnerAnswersViewActive() {
    return activeTab === 'editor' && editorView === 'answers' && !!(answersUserFilter || '').trim();
  }

  const fetchAnswersClassSchoolIdFromDb = async (classId) => {
    const normalizedClassId = normalizeClassId(classId);
    if (!normalizedClassId || !token) return null;
    const classRes = await apiFetch(`classroom/${normalizedClassId}`);
    const classPayload = await readPayload(classRes);
    if (!classRes.ok) return null;
    const schoolId = normalizeClassId(normalizeSchoolId(classPayload?.data?.school));
    return schoolId || null;
  };

  const fetchSchoolCiCssByIdFromDb = async (schoolId) => {
    const normalizedSchoolId = normalizeClassId(schoolId);
    if (!normalizedSchoolId || !token) return '';
    const schoolRes = await apiFetch(`school/${normalizedSchoolId}`);
    const schoolPayload = await readPayload(schoolRes);
    if (!schoolRes.ok) return '';
    return typeof schoolPayload?.data?.ci_css === 'string' ? schoolPayload.data.ci_css : '';
  };

  const fetchAnswersCiCssFromDb = async (classId) => {
    const schoolId = await fetchAnswersClassSchoolIdFromDb(classId);
    if (!schoolId) return '';
    return fetchSchoolCiCssByIdFromDb(schoolId);
  };

  const ensureAnswersCiCss = async (classId) => {
    const normalizedClassId = normalizeClassId(classId);
    if (!normalizedClassId) {
      answersCiClassId = null;
      answersCiCss = '';
      return '';
    }
    if (answersCiClassId === normalizedClassId && answersCiCss) {
      return answersCiCss;
    }
    const requestId = ++answersCiRequestId;
    answersCiClassId = normalizedClassId;
    answersCiCss = '';

    try {
      const ciCss = await fetchAnswersCiCssFromDb(normalizedClassId);
      if (requestId !== answersCiRequestId) return '';
      answersCiCss = ciCss;
      return ciCss;
    } catch {
      if (requestId === answersCiRequestId) {
        answersCiCss = '';
      }
      return '';
    }
  };

  function applyEffectiveCi() {
    if (isLearnerAnswersViewActive()) {
      const activeClassId = normalizeClassId(answersClassId);
      const loadedClassId = normalizeClassId(answersCiClassId);
      const learnerClassCiCss =
        activeClassId && loadedClassId === activeClassId ? answersCiCss : '';
      applySchoolCiCss(learnerClassCiCss || adminCiCss);
      return;
    }
    applySchoolCiCss(adminCiCss);
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

  function formatAnswersLearnerLabel(entry) {
    if (!entry) return 'Lernende';
    const name = (entry?.name ?? '').toString().trim();
    if (name) return name;
    if (entry?.id) return `Lernende ${entry.id}`;
    return 'Lernende';
  }

  function getCollectionCount(collectionId) {
    const normalizedId = normalizeCollectionId(collectionId);
    if (!normalizedId) return 0;
    return collectionCountMap.get(normalizedId) ?? 0;
  }

  function formatCollectionDescription(value) {
    const description = (value ?? '').toString().trim();
    if (!description) return 'Keine Beschreibung';
    return description.length > 360 ? `${description.slice(0, 360)}...` : description;
  }

  function getAnswersUserLabel(user) {
    if (!user) return 'Alle Antworten';
    const match = answersLearners.find(
      (entry) => String(entry?.code ?? '') === String(user)
    );
    return match ? formatAnswersLearnerLabel(match) : user;
  }

  const clearAuth = () => {
    token = '';
    userId = null;
    userRole = 1;
    userEmail = '';
    userAiUsage = normalizeAiUsage(null);
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
        const role = payload?.data?.user?.role ?? 1;
        const id = payload?.data?.user?.id ?? null;
        persistAuth(
          existingToken,
          payload?.data?.user?.email ?? '',
          extractAiUsageFromPayload(payload),
          { role, id }
        );
        if (Number(role) >= 1) {
          await fetchSheets();
          await fetchCollections();
          await fetchCollectionLinks();
          await fetchSchools();
          await fetchClasses();
        }
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
      const role = payload?.data?.user?.role ?? 1;
      const id = payload?.data?.user?.id ?? null;
      persistAuth(
        payload.data.token,
        payload?.data?.user?.email ?? '',
        extractAiUsageFromPayload(payload),
        { role, id }
      );
      loginPassword = '';
      if (Number(role) >= 1) {
        await fetchSheets();
        await fetchCollections();
        await fetchCollectionLinks();
        await fetchSchools();
        await fetchClasses();
      }
    } catch (err) {
      loginError = err?.message ?? 'Login fehlgeschlagen';
    } finally {
      loginLoading = false;
    }
  };

  const loginLearner = async () => {
    learnerLoginError = '';
    learnerLoginLoading = true;
    try {
      const cleaned = (learnerLoginToken || '').replace(/\s+/g, '');
      if (!cleaned) {
        learnerLoginError = 'Token fehlt.';
        return;
      }
      const res = await fetch(`${apiBaseUrl}learner-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleaned })
      });
      const payload = await readPayload(res);
      const learnerEntry = payload?.data?.learner ?? null;
      const learnerCode = learnerEntry?.code ?? '';
      if (!res.ok || !learnerCode) {
        learnerLoginError = payload?.warning || 'Token ungültig.';
        return;
      }
      learnerLoginToken = '';
      if (browser) {
        localStorage.setItem(LEARNER_STORAGE_KEY, JSON.stringify(learnerEntry));
        window.location.href = `/lernende?token=${encodeURIComponent(learnerCode)}`;
      }
    } catch (err) {
      learnerLoginError = err?.message ?? 'Login fehlgeschlagen';
    } finally {
      learnerLoginLoading = false;
    }
  };

  const resetAppAfterLogout = () => {
    sheets = [];
    collections = [];
    collectionLinks = [];
    selectedCollectionId = null;
    selectedCollectionUserId = null;
    collectionName = '';
    collectionDescription = '';
    collectionError = '';
    collectionLinkError = '';
    collectionFilter = '';
    collectionSheetFilter = '';
    showCollectionModal = false;
    collectionDescriptionOpen = false;
    newSheetCollectionId = '';
    editorReturnTab = 'collections';
    selectedId = null;
    selectedKey = '';
    editorContent = '';
    editorName = '';
    editorPrompt = '';
    editorCollectionId = '';
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
    answers = [];
    answersError = '';
    answersMeta = '';
    answersKey = '';
    answersClassFilter = '';
    answersClassKey = null;
    answersLearners = [];
    answersLearnersLoading = false;
    answersLearnersError = '';
    answersLearnersClassKey = null;
    answersLearnersRequestId = 0;
    answersUserFilter = '';
    answersUserKey = '';
    answersContent = '';
    answersRenderMode = 'aggregate';
    answersRenderKey = 0;
    agentPrompt = '';
    agentStatus = '';
    agentPending = false;
    agentHistory = [];
    agentScopeState.reset();
    agentScopeVersion += 1;
    destroyAnswersRuntime();
  };

  const requestLogout = async (logoutToken) => {
    if (!apiBaseUrl || !logoutToken) return;
    try {
      await fetch(`${apiBaseUrl}user/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${logoutToken}`
        },
        keepalive: true
      });
    } catch {
      // ignore
    }
  };

  const logout = async () => {
    const canLeave = await maybeWarnAndSaveBeforeLeavingEditor('Logout');
    if (!canLeave) return;
    clearSheetAutosaveTimer();
    resetSavedSheetState();
    const logoutToken = token;
    clearAuth();
    if (browser) {
      await tick();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
    resetAppAfterLogout();
    void requestLogout(logoutToken);
  };

  const fetchSheets = async ({ preserveOpenEditor = false } = {}) => {
	    if (!token || !isActivatedUser) return;
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
	      const warningText = typeof payload?.warning === 'string' ? payload.warning.trim() : '';
	      if (warningText.startsWith('SQL error:')) {
	        sheetError = warningText;
	      }
	      sheets = list;
	      if (list.length) {
	        let next = null;
	        if (selectedId) {
	          next = list.find((sheet) => sheet.id === selectedId);
        }
        if (!next && selectedKey) {
          next = list.find((sheet) => sheet.key === selectedKey);
        }
	        if (next) {
	          const keepOpenEditor =
	            preserveOpenEditor &&
	            activeTab === 'editor' &&
	            selectedId &&
	            String(next.id) === String(selectedId);
	          if (keepOpenEditor) {
	            const ownerId = normalizeUserId(next?.user);
	            const readOnly =
	              isAdmin && ownerId !== null && userId !== null && ownerId !== userId;
	            selectedSheetUserId = ownerId;
	            selectedKey = next?.key ?? selectedKey;
	            if (next?.key && !readOnly) {
	              resetSheetVersions();
	              fetchSheetVersions(next.key);
	            }
	          } else {
	            selectSheet(next.id, { preserveView: true });
	          }
	        } else {
	          await closeEditor({ force: true });
	          if (activeTab === 'editor') {
	            activeTab = editorReturnTab === 'editor' ? 'collections' : editorReturnTab;
	          }
	        }
	      } else {
	        await closeEditor({ force: true });
	        if (activeTab === 'editor') {
	          activeTab = editorReturnTab === 'editor' ? 'collections' : editorReturnTab;
	        }
	      }
    } catch (err) {
      sheetError = err?.message ?? 'Sheets konnten nicht geladen werden';
    } finally {
      loadingSheets = false;
    }
  };

  const fetchCollections = async ({ autoSelect = false } = {}) => {
    if (!token || !isActivatedUser) return;
    loadingCollections = true;
    collectionError = '';
    try {
      const res = await apiFetch('collection');
      const payload = await readPayload(res);
      if (!res.ok) {
        collectionError = payload?.warning || 'Sammlungen konnten nicht geladen werden';
        return;
      }
      const list = payload?.data?.collection ?? [];
      collections = list;
      if (selectedCollectionId) {
        const keep = list.find(
          (entry) => normalizeCollectionId(entry?.id) === selectedCollectionId
        );
        if (keep) {
          selectCollection(keep.id);
        } else {
          resetCollectionSelection();
        }
      } else if (autoSelect && list.length) {
        const next =
          isAdmin && userId !== null
            ? list.find((entry) => normalizeUserId(entry?.user) === userId) ?? list[0]
            : list[0];
        if (next) {
          selectCollection(next.id);
        }
      }
    } catch (err) {
      collectionError = err?.message ?? 'Sammlungen konnten nicht geladen werden';
    } finally {
      loadingCollections = false;
    }
  };

  const fetchCollectionLinks = async () => {
    if (!token || !isActivatedUser) return;
    loadingCollectionLinks = true;
    collectionLinkError = '';
    try {
      const res = await apiFetch('collection_sheet');
      const payload = await readPayload(res);
      if (!res.ok) {
        collectionLinkError =
          payload?.warning || 'Sammlungs-Zuordnungen konnten nicht geladen werden';
        return;
      }
      collectionLinks = payload?.data?.collection_sheet ?? [];
    } catch (err) {
      collectionLinkError =
        err?.message ?? 'Sammlungs-Zuordnungen konnten nicht geladen werden';
    } finally {
      loadingCollectionLinks = false;
    }
  };

  const resetCollectionSelection = () => {
    selectedCollectionId = null;
    selectedCollectionUserId = null;
    collectionName = '';
    collectionDescription = '';
    collectionSheetFilter = '';
    collectionDescriptionOpen = false;
  };

  const selectCollection = (id) => {
    selectedCollectionId = normalizeCollectionId(id);
    const current = collections.find(
      (entry) => normalizeCollectionId(entry?.id) === selectedCollectionId
    );
    selectedCollectionUserId = normalizeUserId(current?.user);
    collectionName = current?.name ?? '';
    collectionDescription = current?.description ?? '';
    collectionDescriptionOpen = false;
  };

  const createCollection = async () => {
    if (!isActivatedUser) return false;
    creatingCollection = true;
    collectionError = '';
    try {
      const res = await apiFetch('collection', {
        method: 'POST',
        body: JSON.stringify({
          name: newCollectionName.trim() || 'Neue Sammlung',
          description: newCollectionDescription.trim()
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        collectionError = payload?.warning || 'Sammlung konnte nicht erstellt werden';
        return false;
      }
      newCollectionName = '';
      newCollectionDescription = '';
      await fetchCollections();
      await fetchCollectionLinks();
      const nextId = normalizeCollectionId(payload?.data?.id);
      if (nextId) {
        selectCollection(nextId);
      }
      return true;
    } catch (err) {
      collectionError = err?.message ?? 'Sammlung konnte nicht erstellt werden';
      return false;
    } finally {
      creatingCollection = false;
    }
  };

  const handleCreateCollection = async () => {
    const ok = await createCollection();
    if (ok) {
      showCollectionModal = false;
    }
  };

  const saveCollection = async () => {
    if (!selectedCollectionId || savingCollection || collectionReadOnly) return false;
    savingCollection = true;
    collectionError = '';
    try {
      const res = await apiFetch('collection', {
        method: 'PATCH',
        body: JSON.stringify({
          id: selectedCollectionId,
          name: collectionName,
          description: collectionDescription
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        collectionError = payload?.warning || 'Sammlung konnte nicht gespeichert werden';
        return false;
      }
      await fetchCollections();
      return true;
    } catch (err) {
      collectionError = err?.message ?? 'Sammlung konnte nicht gespeichert werden';
      return false;
    } finally {
      savingCollection = false;
    }
  };

  const deleteCollection = async (id = null) => {
    const targetId = normalizeCollectionId(id ?? selectedCollectionId);
    if (!targetId) return;
    const current = collections.find((entry) => normalizeCollectionId(entry?.id) === targetId);
    if (isAdmin && normalizeUserId(current?.user) !== userId) {
      collectionError = 'Admin: Fremde Sammlungen können hier nicht gelöscht werden.';
      return;
    }
    const collectionTitle =
      current?.name || (targetId ? `Sammlung #${targetId}` : 'Sammlung');
    if (!confirmDelete(`Sammlung "${collectionTitle}"`)) return;
    deletingCollection = true;
    collectionError = '';
    try {
      const res = await apiFetch('collection', {
        method: 'DELETE',
        body: JSON.stringify({ id: targetId })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        collectionError = payload?.warning || 'Sammlung konnte nicht gelöscht werden';
        return;
      }
      collections = collections.filter(
        (entry) => normalizeCollectionId(entry?.id) !== targetId
      );
      collectionLinks = collectionLinks.filter(
        (entry) => normalizeCollectionId(entry?.collection) !== targetId
      );
      if (selectedCollectionId === targetId) {
        resetCollectionSelection();
      }
    } catch (err) {
      collectionError = err?.message ?? 'Sammlung konnte nicht gelöscht werden';
    } finally {
      deletingCollection = false;
    }
  };

  const addSheetToCollection = async (sheetKey) => {
    if (!selectedCollectionId || !sheetKey || collectionReadOnly) return;
    collectionLinkSaving = true;
    collectionLinkError = '';
    try {
      const res = await apiFetch('collection_sheet', {
        method: 'POST',
        body: JSON.stringify({
          collection: selectedCollectionId,
          sheet_key: sheetKey
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        collectionLinkError =
          payload?.warning || 'Sheet konnte nicht zur Sammlung hinzugefügt werden';
        return;
      }
      await fetchCollectionLinks();
    } catch (err) {
      collectionLinkError =
        err?.message ?? 'Sheet konnte nicht zur Sammlung hinzugefügt werden';
    } finally {
      collectionLinkSaving = false;
    }
  };

  const removeSheetFromCollection = async (assignmentId) => {
    const normalizedId = normalizeCollectionId(assignmentId);
    if (!normalizedId || collectionReadOnly) return;
    collectionLinkSaving = true;
    collectionLinkError = '';
    try {
      const res = await apiFetch('collection_sheet', {
        method: 'DELETE',
        body: JSON.stringify({ id: normalizedId })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        collectionLinkError =
          payload?.warning || 'Sheet konnte nicht aus der Sammlung entfernt werden';
        return;
      }
      await fetchCollectionLinks();
    } catch (err) {
      collectionLinkError =
        err?.message ?? 'Sheet konnte nicht aus der Sammlung entfernt werden';
    } finally {
      collectionLinkSaving = false;
    }
  };

  const setCollectionSheetPosition = async (assignmentId, rawValue) => {
    const normalizedId = normalizeCollectionId(assignmentId);
    const nextPosition = Number(rawValue);
    if (!normalizedId || !Number.isFinite(nextPosition) || nextPosition <= 0 || collectionReadOnly) {
      return;
    }
    collectionLinkSaving = true;
    collectionLinkError = '';
    try {
      const res = await apiFetch('collection_sheet', {
        method: 'PATCH',
        body: JSON.stringify({
          id: normalizedId,
          position: nextPosition
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        collectionLinkError =
          payload?.warning || 'Reihenfolge konnte nicht gespeichert werden';
        return;
      }
      await fetchCollectionLinks();
    } catch (err) {
      collectionLinkError =
        err?.message ?? 'Reihenfolge konnte nicht gespeichert werden';
    } finally {
      collectionLinkSaving = false;
    }
  };

  const saveSheetCollectionAssignment = async (sheetKey, nextCollectionId, currentAssignment = null) => {
    const normalizedCollectionId = normalizeCollectionId(nextCollectionId);
    const currentCollectionId = normalizeCollectionId(currentAssignment?.collection);
    if (!sheetKey) {
      return false;
    }
    if (!normalizedCollectionId) {
      saveState = 'Bitte eine Sammlung wählen.';
      return false;
    }
    if (currentAssignment?.id && currentCollectionId === normalizedCollectionId) {
      if (editorReturnTab === 'collections') {
        selectCollection(normalizedCollectionId);
      }
      return true;
    }
    try {
      const payload = currentAssignment?.id
        ? {
            id: currentAssignment.id,
            collection: normalizedCollectionId
          }
        : {
            collection: normalizedCollectionId,
            sheet_key: sheetKey
          };
      const res = await apiFetch('collection_sheet', {
        method: currentAssignment?.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      const responsePayload = await readPayload(res);
      if (!res.ok) {
        saveState = responsePayload?.warning || 'Sammlung konnte nicht gespeichert werden';
        return false;
      }
      await fetchCollectionLinks();
      if (editorReturnTab === 'collections') {
        selectCollection(normalizedCollectionId);
      }
      return true;
    } catch (err) {
      saveState = err?.message ?? 'Sammlung konnte nicht gespeichert werden';
      return false;
    }
  };

  const resetSheetVersions = () => {
    sheetVersions = [];
    versionsLoading = false;
    versionsError = '';
    selectedVersionId = '';
    versionRestoreStatus = 'idle';
    restoringVersion = false;
  };

  const fetchSheetVersions = async (key) => {
    if (!token || !key) {
      resetSheetVersions();
      return;
    }
    versionsLoading = true;
    versionsError = '';
    try {
      const res = await apiFetch(`sheet?key=${encodeURIComponent(key)}&summary=1`);
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

  const selectSheet = (id, options = {}) => {
    const { preserveView = false } = options;
    clearSheetAutosaveTimer();
    selectedId = id;
    const current = sheets.find((sheet) => sheet.id === id);
    const ownerId = normalizeUserId(current?.user);
    const collectionEntry =
      sheetCollectionEntryMap.get(getSheetLookupKey(ownerId, current?.key)) ?? null;
    selectedSheetUserId = ownerId;
    const readOnly =
      isAdmin && ownerId !== null && userId !== null && ownerId !== userId;
    editorContent = sanitizeSheetContent(current?.content ?? '');
    editorName = current?.name ?? '';
    editorPrompt = current?.prompt ?? '';
    selectedKey = current?.key ?? '';
    editorCollectionId = String(normalizeCollectionId(collectionEntry?.collection) ?? '');
    sheetSaveStatus = 'idle';
    saveState = '';
    if (!preserveView) {
      editorView = 'visual';
    }
    resetSheetVersions();
    answers = [];
    answersError = '';
    answersMeta = '';
    answersKey = '';
    answersClassFilter = '';
    answersClassKey = null;
    answersLearners = [];
    answersLearnersLoading = false;
    answersLearnersError = '';
    answersLearnersClassKey = null;
    answersLearnersRequestId = 0;
    answersUserFilter = '';
    answersUserKey = '';
    answersContent = '';
    answersRenderMode = 'aggregate';
    answersRenderKey = 0;
    destroyAnswersRuntime();
    visualActiveBlock = null;
    visualBlocks = [];
    visualBlockIds = [];
    visualBlockViews = [];
    visualBlockPromptOpen = [];
    visualBlockSelections = [];
    visualBlockInputRevisions = [];
    blockInsertIndex = null;
    dragOverIndex = null;
    dragIndex = null;
    resetVisualHistory();
    rememberSavedSheetState();
    if (current?.key && !readOnly) {
      fetchSheetVersions(current.key);
    }
  };

  const closeEditor = async ({ force = false, targetLabel = 'Liste' } = {}) => {
    if (!force) {
      const canLeave = await maybeWarnAndSaveBeforeLeavingEditor(targetLabel);
      if (!canLeave) return false;
    }
    clearSheetAutosaveTimer();
    selectedId = null;
    selectedKey = '';
    selectedSheetUserId = null;
    editorContent = '';
    editorName = '';
    editorPrompt = '';
    editorCollectionId = '';
    sheetSaveStatus = 'idle';
    saveState = '';
    editorView = 'visual';
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
    answersLearners = [];
    answersLearnersLoading = false;
    answersLearnersError = '';
    answersLearnersClassKey = null;
    answersLearnersRequestId = 0;
    answersUserFilter = '';
    answersUserKey = '';
    answersContent = '';
    answersRenderMode = 'aggregate';
    answersRenderKey = 0;
    destroyAnswersRuntime();
    visualActiveBlock = null;
    visualBlocks = [];
    visualBlockIds = [];
    visualBlockViews = [];
    visualBlockPromptOpen = [];
    visualBlockSelections = [];
    visualBlockInputRevisions = [];
    resetVisualHistory();
    blockInsertIndex = null;
    resetSavedSheetState();
    return true;
  };

	  const createSheet = async () => {
	    if (!isActivatedUser) return null;
	    creating = true;
	    sheetError = '';
	    try {
      const trimmedKey = newSheetKey.trim();
      const trimmedName = newSheetName.trim();
      const targetCollectionId = normalizeCollectionId(newSheetCollectionId);
      if (!targetCollectionId) {
        sheetError = 'Bitte eine Sammlung wählen.';
        return null;
      }
	      const res = await apiFetch('sheet', {
	        method: 'POST',
	        body: JSON.stringify({
	          content: '',
	          name: trimmedName || 'Neues Sheet',
	          key: trimmedKey,
	          prompt: ''
	        })
	      });
	      const payload = await readPayload(res);
	      if (!res.ok || payload?.warning) {
	        sheetError = payload?.warning || 'Sheet konnte nicht erstellt werden';
	        return null;
	      }
	      const createdId = normalizeClassId(payload?.data?.id);
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
      newSheetCollectionId = '';
      await fetchSheets();
      const createdSheet =
        sheets.find((entry) => normalizeClassId(entry?.id) === createdId) ?? null;
      const createdSheetKey = createdSheet?.key ?? trimmedKey;
      if (!createdSheetKey) {
        sheetError = 'Sheet wurde erstellt, konnte aber keiner Sammlung zugeordnet werden.';
        return null;
      }
      const assigned = await saveSheetCollectionAssignment(createdSheetKey, targetCollectionId, null);
      if (!assigned) {
        return null;
      }
	      return {
          id: createdId,
          key: createdSheetKey,
          collectionId: targetCollectionId
        };
	    } catch (err) {
	      sheetError = err?.message ?? 'Sheet konnte nicht erstellt werden';
	      return null;
	    } finally {
	      creating = false;
	    }
	  };

	  const handleCreateSheet = async () => {
	    const created = await createSheet();
	    if (created?.collectionId) {
        selectCollection(created.collectionId);
      }
	    if (created?.id) {
	      showCreateSheetModal = false;
        await openShopSheet(created.id, 'visual');
	    }
	  };

  const saveSheet = async (options = {}) => {
    flushVisualInputCommits();
    flushSheetHtmlInputWork();
    const saveOptions =
      options && typeof options === 'object' && ('refreshSheetList' in options || 'focusSnapshot' in options)
        ? options
        : {};
    const { focusSnapshot = null } = saveOptions;
    const restoreSavedFocus = async () => {
      if (focusSnapshot) {
        await restoreEditorFocusSnapshot(focusSnapshot);
      }
    };
    if (!selectedId || saving) {
      await restoreSavedFocus();
      return false;
    }
    if (sheetReadOnly) {
      sheetSaveStatus = 'error';
      saveState = 'Admin: Fremde Sheets sind schreibgeschützt.';
      await restoreSavedFocus();
      return false;
    }
    const sanitizedEditorContent = sanitizeSheetContent(editorContent);
    if (sanitizedEditorContent !== editorContent) {
      editorContent = sanitizedEditorContent;
    }
    if (!hasUnsavedSheetChanges()) {
      await restoreSavedFocus();
      return true;
    }
    const targetId = selectedId;
    const nextContent = editorContent;
    const nextName = editorName;
    const nextPrompt = editorPrompt;
    const nextCollectionId = normalizeCollectionId(editorCollectionId);
    const currentCollectionAssignment =
      sheetCollectionEntryMap.get(getSheetLookupKey(selectedSheetUserId, selectedKey)) ?? null;
    const hasDocumentChanges =
      (nextName ?? '') !== (lastSavedSheetName ?? '') ||
      (nextContent ?? '') !== (lastSavedSheetContent ?? '') ||
      (nextPrompt ?? '') !== (lastSavedSheetPrompt ?? '');
    clearSheetAutosaveTimer();
    saving = true;
    sheetSaveStatus = 'saving';
    saveState = '';
    await restoreSavedFocus();
    try {
      if (hasDocumentChanges) {
        const res = await apiFetch('sheet', {
          method: 'PATCH',
          body: JSON.stringify({
            id: targetId,
            content: nextContent,
            name: nextName,
            prompt: nextPrompt
          })
        });
        const payload = await readPayload(res);
        if (!res.ok) {
          sheetSaveStatus = 'error';
          saveState = payload?.warning || 'Speichern fehlgeschlagen';
          return false;
        }
      }
      const collectionSaved = await saveSheetCollectionAssignment(
        selectedKey,
        nextCollectionId,
        currentCollectionAssignment
      );
      if (!collectionSaved) {
        sheetSaveStatus = 'error';
        return false;
      }
      if (hasDocumentChanges) {
        sheets = sheets.map((entry) =>
          entry.id === targetId
            ? {
                    ...entry,
                    content: nextContent,
                    name: nextName,
                    prompt: nextPrompt
                  }
                : entry
            );
      }
      if (selectedId === targetId) {
        rememberSavedSheetState();
      }
      sheetSaveStatus = 'saved';
      saveState = '';
      return true;
    } catch (err) {
      sheetSaveStatus = 'error';
      saveState = err?.message ?? 'Speichern fehlgeschlagen';
      return false;
    } finally {
      saving = false;
      if (hasUnsavedSheetChanges()) {
        scheduleSheetAutosave();
      }
      await restoreSavedFocus();
    }
  };

  const restoreSheetVersion = async () => {
    if (sheetReadOnly) return;
    if (!selectedVersionId) return;
    const target = sheetVersions.find(
      (entry) => String(entry?.id) === String(selectedVersionId)
    );
    if (!target) return;
    const label = describeVersion(target);
    if (!confirmRestore(`Version ${label}`)) return;
    restoringVersion = true;
    versionsError = '';
    versionRestoreStatus = 'restoring';
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
        versionRestoreStatus = 'idle';
        return;
      }
      await fetchSheets();
      if (selectedKey) {
        await fetchSheetVersions(selectedKey);
      }
      if (selectedId) {
        editorView = keepView;
      }
      versionRestoreStatus = 'restored';
    } catch (err) {
      versionsError = err?.message ?? 'Wiederherstellen fehlgeschlagen';
      versionRestoreStatus = 'idle';
    } finally {
      restoringVersion = false;
    }
  };

  const deleteSheet = async (id = null) => {
    const targetId = id ?? selectedId;
    if (!targetId) return;
    const current = sheets.find((sheet) => sheet.id === targetId);
    if (isAdmin) {
      const ownerId = normalizeUserId(current?.user);
      if (ownerId !== null && userId !== null && ownerId !== userId) {
        sheetError = 'Admin: Fremde Sheets können hier nicht gelöscht werden.';
        return;
      }
    }
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
        sheetError = payload?.warning || 'Sheet konnte nicht gelöscht werden';
        return;
      }
      sheets = sheets.filter((sheet) => sheet.id !== targetId);
      if (selectedId === targetId) {
        closeEditor({ force: true });
      }
    } catch (err) {
      sheetError = err?.message ?? 'Sheet konnte nicht gelöscht werden';
    } finally {
      deleting = false;
    }
  };

  const fetchSchools = async () => {
    if (!token || !isActivatedUser) return;
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
          schoolPrompt = keep?.prompt ?? '';
        } else {
          selectedSchoolId = null;
          schoolName = '';
          schoolCss = '';
          schoolPrompt = '';
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
    schoolPrompt = current?.prompt ?? '';
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
          ci_css: newSchoolCss,
          prompt: newSchoolPrompt
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        schoolError = payload?.warning || 'Schule konnte nicht erstellt werden';
        return;
      }
      newSchoolName = '';
      newSchoolCss = '';
      newSchoolPrompt = '';
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
          ci_css: schoolCss,
          prompt: schoolPrompt
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
        schoolError = payload?.warning || 'Schule konnte nicht gelöscht werden';
        return;
      }
      if (selectedSchoolId === targetId) {
        selectedSchoolId = null;
        schoolName = '';
        schoolCss = '';
        schoolPrompt = '';
      }
      await fetchSchools();
      await fetchClasses();
    } catch (err) {
      schoolError = err?.message ?? 'Schule konnte nicht gelöscht werden';
    } finally {
      deletingSchool = false;
    }
  };

  const fetchClasses = async ({ autoSelect = true } = {}) => {
    if (!token || !isActivatedUser) return;
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
        const keep = autoSelect && selectedClassId
          ? list.find((entry) => entry.id === selectedClassId)
          : null;
        let next = keep;
        if (!next && autoSelect) {
          if (isAdmin && userId !== null) {
            next = list.find((entry) => normalizeUserId(entry?.user) === userId) ?? null;
          }
        }
        if (!next && autoSelect) next = list[0];
        if (next) {
          selectClass(next.id);
        }
      } else {
        selectedClassId = null;
        selectedClassUserId = null;
        className = '';
        classYear = '';
        classProfession = '';
        classNotes = '';
        classPrompt = '';
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
    const current = classes.find((entry) => entry.id === id);
    const ownerId = normalizeUserId(current?.user);
    selectedClassUserId = ownerId;
    const readOnly =
      isAdmin && ownerId !== null && userId !== null && ownerId !== userId;
    classDetailView = readOnly ? 'details' : view;
    className = current?.name ?? '';
    classYear = current?.year ?? '';
    classProfession = current?.profession ?? '';
    classNotes = current?.notes ?? '';
    classPrompt = current?.prompt ?? '';
    const normalizedSchoolId = normalizeSchoolId(current?.school);
    classSchoolId = normalizedSchoolId ? String(normalizedSchoolId) : '';
    selectedLearnerId = null;
    newLearnerName = '';
    newLearnerEmail = '';
    newLearnerNotes = '';
    newLearnerPrompt = '';
    learnerModalMode = 'create';
    if (id && !readOnly) {
      fetchLearners(id);
    } else {
      learners = [];
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
    if (!classReadOnly) {
      await fetchLearners(targetId);
    } else {
      learners = [];
    }
  };

  const openAssignmentsForClass = async (id) => {
    const targetId = id ?? selectedClassId;
    if (!targetId) return;
    classDetailView = 'assignments';
    selectedPlanClassId = targetId;
    if (classReadOnly) {
      planAssignments = [];
      return;
    }
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
    if (!token || !isActivatedUser) return;
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
          prompt: newClassPrompt,
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
      newClassPrompt = '';
      newClassSchoolId = '';
      await fetchClasses();
    } catch (err) {
      classError = err?.message ?? 'Klasse konnte nicht erstellt werden';
    } finally {
      creatingClass = false;
    }
  };

  const updateClass = async () => {
    if (!selectedClassId) return;
    if (classReadOnly) {
      classError = 'Admin: Fremde Klassen sind schreibgeschützt.';
      return;
    }
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
          prompt: classPrompt,
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
    if (isAdmin) {
      const ownerId = normalizeUserId(current?.user);
      if (ownerId !== null && userId !== null && ownerId !== userId) {
        classError = 'Admin: Fremde Klassen können hier nicht gelöscht werden.';
        return;
      }
    }
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
        classError = payload?.warning || 'Klasse konnte nicht gelöscht werden';
        return;
      }
      if (selectedClassId === targetId) {
        selectedClassId = null;
        classSchoolId = '';
      }
      learners = [];
      await fetchClasses();
    } catch (err) {
      classError = err?.message ?? 'Klasse konnte nicht gelöscht werden';
    } finally {
      deletingClass = false;
    }
  };

  const fetchLearners = async (classId) => {
    if (!token || !isActivatedUser || !classId || classReadOnly) return;
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
    newLearnerPrompt = current?.prompt ?? '';
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
          notes: newLearnerNotes,
          prompt: newLearnerPrompt
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        learnerError = payload?.warning || 'Lernende konnten nicht erstellt werden';
        return;
      }
      newLearnerName = '';
      newLearnerNotes = '';
      newLearnerPrompt = '';
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
          notes: newLearnerNotes,
          prompt: newLearnerPrompt
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        learnerError = payload?.warning || 'Lernende konnten nicht gespeichert werden';
        return;
      }
      newLearnerName = '';
      newLearnerNotes = '';
      newLearnerPrompt = '';
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
        learnerError = payload?.warning || 'Lernende konnten nicht gelöscht werden';
        return;
      }
      if (selectedLearnerId === id) {
        selectedLearnerId = null;
        selectedLearnerCode = '';
        newLearnerName = '';
        newLearnerNotes = '';
        newLearnerPrompt = '';
        learnerModalMode = 'create';
      }
      await fetchLearners(selectedClassId);
    } catch (err) {
      learnerError = err?.message ?? 'Lernende konnten nicht gelöscht werden';
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
    classPrompt = '';
  };

  const resetSchoolSelection = () => {
    selectedSchoolId = null;
    schoolName = '';
    schoolCss = '';
    schoolPrompt = '';
  };

  const getTabSwitchLabel = (tab) => {
    if (tab === 'collections') return 'Material';
    if (tab === 'classes') return 'Klassenliste';
    if (tab === 'schools') return 'Schulliste';
    if (tab === 'shop') return 'Bibliothek';
    if (tab === 'settings') return 'Einstellungen';
    return 'anderer Bereich';
  };

  const getEditorReturnLabel = () => {
    if (editorReturnTab === 'classes') return 'Klassen';
    if (editorReturnTab === 'schools') return 'Schulen';
    if (editorReturnTab === 'shop') return 'Bibliothek';
    if (editorReturnTab === 'settings') return 'Einstellungen';
    return 'Material';
  };

  const switchTab = async (tab) => {
    if (activeTab === tab) return;
    const currentTab = activeTab;
    if (currentTab === 'editor' && selectedId && tab !== 'editor') {
      const canLeave = await maybeWarnAndSaveBeforeLeavingEditor(getTabSwitchLabel(tab));
      if (!canLeave) return;
    }
    if (tab === 'editor' && currentTab !== 'editor') {
      editorReturnTab = currentTab || 'collections';
    }
    activeTab = tab;
    if (tab === 'editor') {
      closeEditor({ force: true });
    } else if (tab === 'collections') {
      if (token && isActivatedUser && !collections.length) {
        await fetchCollections();
        await fetchCollectionLinks();
      }
    } else if (tab === 'classes') {
      if (!(currentTab === 'editor' && editorReturnTab === 'classes')) {
        resetClassSelection();
      }
    } else if (tab === 'schools') {
      if (!(currentTab === 'editor' && editorReturnTab === 'schools')) {
        resetSchoolSelection();
      }
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

  const openShopSheet = async (id, view = 'visual') => {
    const target = sheets.find((sheet) => String(sheet?.id) === String(id));
    if (!target?.id) return false;
    if (activeTab !== 'editor') {
      await switchTab('editor');
      if (activeTab !== 'editor') return false;
    }
    selectSheet(target.id, { preserveView: true });
    editorView =
      view === 'html' || view === 'preview' || view === 'answers' ? view : 'visual';
    return true;
  };

  const openCollectionSheet = async (sheetKey, view = 'visual') => {
    const target =
      sheetByOwnerKeyMap.get(getSheetLookupKey(selectedCollectionUserId, sheetKey)) ?? null;
    if (!target?.id) return false;
    return openShopSheet(target.id, view);
  };

  const getNextLueckeIndex = () => {
    const matches = Array.from(editorContent.matchAll(/name="luecke(\d+)"/g));
    const max = matches.reduce((acc, match) => {
      const value = parseInt(match[1], 10);
      return Number.isFinite(value) ? Math.max(acc, value) : acc;
    }, 0);
    return max + 1;
  };

  const getNextLueckeName = () => {
    const source = `${editorContent || ''}\n${visualBlocks.join('\n')}`;
    const names = new Set(
      Array.from(source.matchAll(/<\s*luecke-gap\b[^>]*\bname="([^"]+)"/gi))
        .map((match) => match[1])
        .filter(Boolean)
    );
    let index = getNextLueckeIndex();
    while (names.has(`luecke${index}`)) index += 1;
    return `luecke${index}`;
  };

  const getNextUmfrageIndex = () => {
    const matches = Array.from(editorContent.matchAll(/name="umfrage(\d+)"/g));
    const max = matches.reduce((acc, match) => {
      const value = parseInt(match[1], 10);
      return Number.isFinite(value) ? Math.max(acc, value) : acc;
    }, 0);
    return max + 1;
  };

  const getNextFreitextIndex = () => {
    const matches = Array.from(editorContent.matchAll(/name="freitext(\d+)"/g));
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

  const FREITEXT_BLOCK_TAG_NAMES = ['freitext-block'];
  const FREITEXT_BLOCK_SELECTOR = FREITEXT_BLOCK_TAG_NAMES.join(',');

  const STANDALONE_BLOCK_TAGS = new Set([
    'umfrage-matrix',
    ...FREITEXT_BLOCK_TAG_NAMES
  ]);
  const STANDALONE_BLOCK_SELECTOR = Array.from(STANDALONE_BLOCK_TAGS).join(',');

  const isStandaloneBlockNode = (node) =>
    node &&
    node.nodeType === Node.ELEMENT_NODE &&
    node.tagName &&
    STANDALONE_BLOCK_TAGS.has(node.tagName.toLowerCase());

  const appendNodesAsBlock = (doc, blocks, nodes) => {
    if (!nodes.length) return;
    let buffer = [];
    const flush = () => {
      if (!buffer.length) return;
      const container = doc.createElement('div');
      buffer.forEach((node) => container.appendChild(node.cloneNode(true)));
      pushBlockHtml(blocks, container.innerHTML);
      buffer = [];
    };

    nodes.forEach((node) => {
      if (isStandaloneBlockNode(node)) {
        flush();
        const container = doc.createElement('div');
        container.appendChild(node.cloneNode(true));
        pushBlockHtml(blocks, container.innerHTML);
        return;
      }
      buffer.push(node);
    });

    flush();
  };

  const BLOCK_LEVEL_TAGS = new Set(BLOCK_LEVEL_TAG_NAMES);

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

  const isUmfrageMatrixBlock = (block) => detectWorksheetBlockType(block).id === 'umfrage';
  const isFreitextBlock = (block) => {
    const id = detectWorksheetBlockType(block).id;
    return id === 'freitext';
  };
  const isTitelBlock = (block) => detectWorksheetBlockType(block).id === 'titel';

  const getTitelLevelFromBlock = (block = '') => {
    const match = String(block || '').match(/^\s*<\s*h([1-3])\b/i);
    return match ? match[1] : '1';
  };

  const buildTitelSnippet = (level = 1, text = '') => {
    const normalizedLevel = [1, 2, 3].includes(Number(level)) ? Number(level) : 1;
    const fallback =
      normalizedLevel === 1
        ? 'Titel'
        : normalizedLevel === 2
          ? 'Untertitel'
          : 'Unteruntertitel';
    return `<h${normalizedLevel}>${escapeHtml(text || fallback)}</h${normalizedLevel}>`;
  };

  const extractParagraphBlocks = (html) => {
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    const blocks = [];

    const isBlockLevelElement = (node) => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
      const tag = node.tagName ? node.tagName.toLowerCase() : '';
      if (!tag) return false;
      return BLOCK_LEVEL_TAGS.has(tag);
    };

    const isStructuralWrapper = (node) => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
      const tag = node.tagName ? node.tagName.toLowerCase() : '';
      return tag === 'div' || tag === 'section' || tag === 'article';
    };

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
        if (isStandaloneBlockNode(node)) {
          flush();
          appendNodesAsBlock(doc, blocks, [node]);
          return;
        }
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          node.querySelector &&
          node.querySelector(STANDALONE_BLOCK_SELECTOR)
        ) {
          flush();
          walkNodes(Array.from(node.childNodes));
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
        if (isStandaloneBlockNode(el)) {
          flush();
          appendNodesAsBlock(doc, blocks, [el]);
          return;
        }
        if (el.querySelector && el.querySelector(STANDALONE_BLOCK_SELECTOR)) {
          flush();
          walkNodes(Array.from(el.childNodes));
          return;
        }
        if (el.querySelector && el.querySelector('p')) {
          flush();
          walkNodes(Array.from(el.childNodes));
          return;
        }
        if (isStructuralWrapper(el) && el.childNodes && el.childNodes.length > 1) {
          flush();
          walkNodes(Array.from(el.childNodes));
          return;
        }
        if (isBlockLevelElement(el)) {
          flush();
          appendNodesAsBlock(doc, blocks, [el]);
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

  const getDefaultVisualBlockView = (block = '') => {
    const type = detectWorksheetBlockType(block);
    return type.defaultView || 'visual';
  };

  const normalizeVisualBlockViews = (views, length, blocks = []) => {
    const next = Array.from({ length }, (_, idx) => {
      const view = views[idx];
      return view === 'html' || view === 'visual'
        ? view
        : getDefaultVisualBlockView(blocks[idx] || '');
    });
    return next;
  };

  const createVisualBlockId = () => {
    visualBlockIdCounter += 1;
    return `visual-block-${visualBlockIdCounter}`;
  };

  const normalizeVisualBlockIds = (ids, length) => {
    const seen = new Set();
    return Array.from({ length }, (_, idx) => {
      const existing = typeof ids[idx] === 'string' ? ids[idx] : '';
      const id = existing && !seen.has(existing) ? existing : createVisualBlockId();
      seen.add(id);
      return id;
    });
  };

  const normalizeVisualBlockPromptOpen = (open, length) => {
    const next = Array.from({ length }, (_, idx) => Boolean(open[idx]));
    return next;
  };

  const moveIndexedEntry = (entries, from, to, fallback = undefined) => {
    const next = [...entries];
    const [entry] = next.splice(from, 1);
    next.splice(to, 0, entry ?? fallback);
    return next;
  };

  const cloneVisualHistoryState = () => {
    visualBlockIds = normalizeVisualBlockIds(visualBlockIds, visualBlocks.length);
    return {
      blocks: [...visualBlocks],
      ids: [...visualBlockIds],
      views: [...visualBlockViews],
      activeBlock: Number.isFinite(visualActiveBlock) ? visualActiveBlock : null
    };
  };

  const isSameVisualHistoryState = (a, b) => {
    if (!a || !b) return false;
    if ((a.activeBlock ?? null) !== (b.activeBlock ?? null)) return false;
    const aBlocks = Array.isArray(a.blocks) ? a.blocks : [];
    const bBlocks = Array.isArray(b.blocks) ? b.blocks : [];
    if (aBlocks.length !== bBlocks.length) return false;
    for (let idx = 0; idx < aBlocks.length; idx += 1) {
      if ((aBlocks[idx] ?? '') !== (bBlocks[idx] ?? '')) return false;
    }
    const aViews = Array.isArray(a.views) ? a.views : [];
    const bViews = Array.isArray(b.views) ? b.views : [];
    if (aViews.length !== bViews.length) return false;
    for (let idx = 0; idx < aViews.length; idx += 1) {
      if ((aViews[idx] ?? 'visual') !== (bViews[idx] ?? 'visual')) return false;
    }
    return true;
  };

  const resetVisualHistory = () => {
    visualHistoryPast = [];
    visualHistoryFuture = [];
    visualHistoryChunk = null;
  };

  const pushVisualHistorySnapshot = (options = {}) => {
    if (visualHistoryApplying) return;
    const now = Date.now();
    const coalesce = Boolean(options?.coalesce);
    const chunkKey = typeof options?.chunkKey === 'string' ? options.chunkKey : '';
    const windowMs = Number.isFinite(options?.windowMs)
      ? Number(options.windowMs)
      : VISUAL_HISTORY_CHUNK_MS;
    if (
      coalesce &&
      chunkKey &&
      visualHistoryChunk?.key === chunkKey &&
      now - Number(visualHistoryChunk?.at || 0) <= windowMs
    ) {
      visualHistoryChunk = { key: chunkKey, at: now };
      visualHistoryFuture = [];
      return;
    }
    const snapshot = cloneVisualHistoryState();
    const last = visualHistoryPast[visualHistoryPast.length - 1];
    if (last && isSameVisualHistoryState(last, snapshot)) return;
    visualHistoryPast = [...visualHistoryPast, snapshot].slice(-VISUAL_HISTORY_LIMIT);
    visualHistoryFuture = [];
    visualHistoryChunk = coalesce && chunkKey ? { key: chunkKey, at: now } : null;
  };

  const getVisualInputHistoryOptions = (index, event, mode = 'visual') => {
    const inputType = (event?.inputType || '').toLowerCase();
    if (inputType.startsWith('history')) {
      return {};
    }
    if (inputType.startsWith('delete')) {
      return {
        coalesce: true,
        chunkKey: `block:${index}:${mode}:delete`
      };
    }
    if (inputType.startsWith('insert')) {
      return {
        coalesce: true,
        chunkKey: `block:${index}:${mode}:insert`
      };
    }
    return {};
  };

  const applyVisualHistoryState = async (state) => {
    if (!state) return false;
    visualHistoryApplying = true;
    visualHistoryChunk = null;
    try {
      const nextBlocks = Array.isArray(state.blocks) && state.blocks.length ? [...state.blocks] : [''];
      visualBlocks = nextBlocks;
      visualBlockIds = normalizeVisualBlockIds(
        Array.isArray(state.ids) ? state.ids : [],
        nextBlocks.length
      );
      visualBlockViews = normalizeVisualBlockViews(
        Array.isArray(state.views) ? state.views : [],
        nextBlocks.length,
        nextBlocks
      );
      visualBlockPromptOpen = normalizeVisualBlockPromptOpen([], nextBlocks.length);
      const nextActiveBlock = Number.isFinite(state.activeBlock) ? state.activeBlock : null;
      visualActiveBlock =
        nextActiveBlock === null ? null : Math.max(0, Math.min(nextActiveBlock, nextBlocks.length - 1));
      commitVisualBlocks();
      await tick();
      if (visualActiveBlock !== null) {
        const activeIndex = Math.min(
          Math.max(0, visualActiveBlock),
          Math.max(visualBlocks.length - 1, 0)
        );
        const target =
          visualBlockViews[activeIndex] === 'visual'
            ? visualBlockEditors[activeIndex]
            : visualBlockHtmlInputs[activeIndex];
        target?.focus?.();
      }
      return true;
    } finally {
      visualHistoryApplying = false;
    }
  };

  const undoVisualChange = async () => {
    if (!visualHistoryPast.length) return false;
    visualHistoryChunk = null;
    const previous = visualHistoryPast[visualHistoryPast.length - 1];
    const current = cloneVisualHistoryState();
    visualHistoryPast = visualHistoryPast.slice(0, -1);
    const nextFuture = [...visualHistoryFuture, current];
    visualHistoryFuture = nextFuture.slice(-VISUAL_HISTORY_LIMIT);
    return applyVisualHistoryState(previous);
  };

  const redoVisualChange = async () => {
    if (!visualHistoryFuture.length) return false;
    visualHistoryChunk = null;
    const next = visualHistoryFuture[visualHistoryFuture.length - 1];
    const current = cloneVisualHistoryState();
    visualHistoryFuture = visualHistoryFuture.slice(0, -1);
    visualHistoryPast = [...visualHistoryPast, current].slice(-VISUAL_HISTORY_LIMIT);
    return applyVisualHistoryState(next);
  };

  const isUndoShortcut = (event) => {
    const key = (event?.key || '').toLowerCase();
    const hasModifier = Boolean(event?.metaKey || event?.ctrlKey);
    if (!hasModifier || event?.altKey) return false;
    return key === 'z' && !event.shiftKey;
  };

  const isRedoShortcut = (event) => {
    const key = (event?.key || '').toLowerCase();
    if (event?.altKey) return false;
    const isCmdShiftZ = Boolean(event?.metaKey || event?.ctrlKey) && key === 'z' && event.shiftKey;
    const isCtrlY = Boolean(event?.ctrlKey) && !event?.metaKey && key === 'y';
    return isCmdShiftZ || isCtrlY;
  };

  const syncVisualPreviewFromHtml = () => {
    if (!visualHistoryApplying) {
      resetVisualHistory();
    }
    const blocks = mergeInstructionBlocksIntoFreitextBlocks(
      extractParagraphBlocks(editorContent || '')
    );
    visualBlocks = blocks;
    visualBlockIds = normalizeVisualBlockIds(visualBlockIds, blocks.length);
    visualBlockViews = normalizeVisualBlockViews([], blocks.length, blocks).map(
      (view, idx) => {
        if (isTitelBlock(blocks[idx]) || isFreitextBlock(blocks[idx])) return 'visual';
        return getDefaultVisualBlockView(blocks[idx]) === 'html' ? 'html' : view;
      }
    );
    visualBlockPromptOpen = normalizeVisualBlockPromptOpen([], blocks.length);
    const normalized = blocksToHtml(blocks);
    editorContent = normalized;
    visualSyncHtml = normalized;
    renderVisualPreviewFromBlocks(blocks);
  };

  const isFreitextBlockHtml = (value = '') =>
    /^\s*<\s*freitext-block\b/i.test(value || '');

  const stripLueckeEditorOnlyAttributes = (value = '') =>
    String(value || '').replace(/<\s*luecke-gap\b[^>]*>/gi, (tag) =>
      tag.replace(/\scontenteditable\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    );

  const stripVisualTerminalCaretText = (value = '') =>
    String(value || '').replace(VISUAL_TERMINAL_CARET_TEXT_PATTERN, '');

  const normalizeBlockContent = (value) => {
    const html = stripVisualTerminalCaretText(
      stripLueckeEditorOnlyAttributes(value || '')
    );
    if (isFreitextBlockHtml(html)) return html.trim();
    return html.replace(/<\/?p\b[^>]*>/gi, '');
  };

  const parseHtmlFragment = (html = '') => {
    if (!browser) return { doc: null, container: null };
    const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
    const container = doc.body.firstElementChild;
    return { doc, container };
  };

  const FREITEXT_INSTRUCTION_SELECTOR = 'freitext-anweisung, freitext-instruction';
  const FREITEXT_CRITERION_SELECTOR = 'freitext-teil, freitext-part, freitext-kriterium';
  const FREITEXT_PREMISE_SELECTOR =
    'freitext-prämisse, freitext-praemisse, freitext-premise, freitext-wert, freitext-value';
  const FREITEXT_REFERENCE_SELECTOR =
    'freitext-ref, freitext-reference, freitext-verknuepfung, freitext-abhaengigkeit';
  const FREITEXT_REFERENCE_PROMPT_SELECTOR = 'freitext-ref-prompt, freitext-reference-prompt';

  const normalizeFreitextAnswerSourceType = (value = '') => {
    const type = String(value || '').trim().toLowerCase();
    if (type === 'gap' || type === 'luecke') return 'luecke';
    if (type === 'free-text' || type === 'freitext') return 'freitext';
    return '';
  };

  const parseFreitextPremiseRequired = (entry) => {
    if (entry?.hasAttribute?.('optional')) return false;
    const raw = (entry?.getAttribute?.('required') || '').trim().toLowerCase();
    return !(raw === '0' || raw === 'false' || raw === 'nein' || raw === 'no');
  };

  const normalizeFreitextPremiseType = (value = '') => {
    const type = String(value || '').trim().toLowerCase();
    return ['date', 'email', 'number', 'text', 'url'].includes(type) ? type : 'text';
  };

  const parseFreitextReferenceThreshold = (entry) => {
    const raw = String(
      entry?.getAttribute?.('min-classification') ||
        entry?.getAttribute?.('min-score') ||
        entry?.getAttribute?.('threshold') ||
        entry?.getAttribute?.('min') ||
        ''
    )
      .trim()
      .toLowerCase();
    if (!raw) return 900;
    if (raw === 'any' || raw === 'answered' || raw === 'eingetragen' || raw === 'vorhanden') return 0;
    if (raw === 'richtig' || raw === 'correct') return 900;
    if (raw === 'teilweise' || raw === 'partial') return 101;
    if (raw === 'falsch' || raw === 'false') return 0;
    const numeric = Number(raw);
    return Number.isNaN(numeric) ? 900 : Math.max(0, Math.min(1000, Math.floor(numeric)));
  };

  const normalizeFreitextReferenceThreshold = (value) => {
    const raw = Number(value);
    if (!Number.isFinite(raw)) return 900;
    if (raw >= 900) return 900;
    if (raw >= 101) return 101;
    return 0;
  };

  const setOptionalAttribute = (node, name, value) => {
    const normalized = String(value ?? '').trim();
    if (normalized) node.setAttribute(name, normalized);
  };

  const getFreitextInstructionHtmlFromString = (html = '') => {
    const match = String(html || '').match(
      /<\s*(freitext-anweisung|freitext-instruction)\b[^>]*>([\s\S]*?)<\/\s*\1\s*>/i
    );
    return (match?.[2] || '').trim();
  };

  const getFreitextOpeningTagFromString = (html = '') =>
    String(html || '').match(/<\s*freitext-block\b[^>]*>/i)?.[0] || '';

  const getHtmlAttributeFromString = (tag = '', name = '') => {
    const escapedName = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\s${escapedName}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
    const match = String(tag || '').match(pattern);
    return (match?.[2] ?? match?.[3] ?? match?.[4] ?? '').trim();
  };

  const buildLegacyFreitextInstructionHtmlFromString = (html = '') => {
    const openingTag = getFreitextOpeningTagFromString(html);
    if (!openingTag) return '';
    const title = getHtmlAttributeFromString(openingTag, 'title');
    const task =
      getHtmlAttributeFromString(openingTag, 'task') ||
      getHtmlAttributeFromString(openingTag, 'instruction');
    const minLength = getHtmlAttributeFromString(openingTag, 'min-length');
    const maxLength = getHtmlAttributeFromString(openingTag, 'max-length');
    const parts = [];
    if (title) parts.push(`<h2>${escapeHtml(title)}</h2>`);
    if (task) parts.push(`<p>${escapeHtml(task)}</p>`);
    if (minLength || maxLength) {
      const limits = [];
      if (minLength) limits.push(`mind. ${minLength} Zeichen`);
      if (maxLength) limits.push(`max. ${maxLength} Zeichen`);
      parts.push(`<p><em>${escapeHtml(limits.join(' · '))}</em></p>`);
    }
    return parts.join('\n');
  };

  const getFreitextElementFromContainer = (container) =>
    container?.querySelector?.(FREITEXT_BLOCK_SELECTOR) ?? null;

  const getFreitextInstructionNode = (freitext) =>
    freitext?.querySelector?.(FREITEXT_INSTRUCTION_SELECTOR) ?? null;

  const hasFreitextInstructionHtml = (html = '') => {
    const { container } = parseHtmlFragment(html);
    const freitext = getFreitextElementFromContainer(container);
    return Boolean((getFreitextInstructionNode(freitext)?.innerHTML || '').trim());
  };

  const getFreitextInstructionHtml = (html = '') => {
    const explicitFromString = getFreitextInstructionHtmlFromString(html);
    if (explicitFromString) return explicitFromString;
    const { container } = parseHtmlFragment(html);
    const freitext = getFreitextElementFromContainer(container);
    const instruction = getFreitextInstructionNode(freitext);
    return (instruction?.innerHTML || '').trim();
  };

  const getFreitextRows = (html = '') => {
    const { container } = parseHtmlFragment(html);
    const freitext = getFreitextElementFromContainer(container);
    const rows = Number(freitext?.getAttribute?.('rows') || 0);
    return Number.isFinite(rows) && rows > 0 ? Math.floor(rows) : 10;
  };

  const getFreitextPlaceholder = (html = '') => {
    const { container } = parseHtmlFragment(html);
    const freitext = getFreitextElementFromContainer(container);
    return freitext?.getAttribute?.('placeholder') || 'Schreibe deinen Text hier...';
  };

  const getFreitextMainPrompt = (html = '') => {
    const { container } = parseHtmlFragment(html);
    const freitext = getFreitextElementFromContainer(container);
    return (
      freitext?.getAttribute?.('prompt') ||
      freitext?.getAttribute?.('teacher-prompt') ||
      freitext?.getAttribute?.('data-prompt') ||
      freitext?.getAttribute?.('data-teacher-prompt') ||
      ''
    ).trim();
  };

  const getFreitextCriteria = (html = '') => {
    const { container } = parseHtmlFragment(html);
    const freitext = getFreitextElementFromContainer(container);
    if (!freitext) return [];
    return Array.from(freitext.querySelectorAll(FREITEXT_CRITERION_SELECTOR)).map(
      (entry, index) => {
        const key = (entry.getAttribute('key') || entry.getAttribute('name') || '').trim();
        const rawLabel = (
          entry.getAttribute('label') ||
          entry.getAttribute('title') ||
          entry.getAttribute('name') ||
          ''
        ).trim();
        const description = (entry.textContent || '').replace(/\s+/g, ' ').trim();
        const internalDescription = (
          entry.getAttribute('internal-description') ||
          entry.getAttribute('data-internal-description') ||
          entry.getAttribute('internal') ||
          ''
        )
          .replace(/\s+/g, ' ')
          .trim();
        if (!key && !rawLabel && !description && !internalDescription) return null;
        return {
          key,
          label: rawLabel || `Element ${index + 1}`,
          description,
          internalDescription
        };
      }
    ).filter(Boolean);
  };

  const getFreitextPremises = (html = '') => {
    const { container } = parseHtmlFragment(html);
    const freitext = getFreitextElementFromContainer(container);
    if (!freitext) return [];
    return Array.from(freitext.querySelectorAll(FREITEXT_PREMISE_SELECTOR)).map(
      (entry, index) => {
        const sourceUrl = (
          entry.getAttribute('source') ||
          entry.getAttribute('href') ||
          entry.getAttribute('url') ||
          ''
        ).trim();
        const key = (entry.getAttribute('key') || entry.getAttribute('name') || '').trim();
        const rawLabel = (
          entry.hasAttribute('label')
            ? entry.getAttribute('label')
            : entry.getAttribute('title') ||
              entry.getAttribute('name') ||
              entry.getAttribute('key') ||
              ''
        ).trim();
        const description = (entry.textContent || '').replace(/\s+/g, ' ').trim();
        const sourceLabel = (
          entry.getAttribute('source-label') ||
          entry.getAttribute('link-label') ||
          (sourceUrl ? 'Quelle öffnen' : '')
        ).trim();
        const sourceKey = (
          entry.getAttribute('source-key') ||
          entry.getAttribute('answer-key') ||
          entry.getAttribute('target') ||
          entry.getAttribute('ref') ||
          ''
        ).trim();
        const sourceType = normalizeFreitextAnswerSourceType(
          entry.getAttribute('source-type') ||
            entry.getAttribute('answer-type') ||
            entry.getAttribute('element-type') ||
            ''
        );
        const labelText = rawLabel.replace(/\s+/g, ' ').trim();
        const isEmptyDefaultPlaceholder =
          /^(Prämisse|Praemisse)\s+1$/i.test(labelText) &&
          !description &&
          !sourceKey &&
          !sourceUrl &&
          !sourceLabel &&
          !entry.hasAttribute('key') &&
          !entry.hasAttribute('name') &&
          !entry.hasAttribute('title') &&
          !entry.hasAttribute('source-key') &&
          !entry.hasAttribute('answer-key') &&
          !entry.hasAttribute('target') &&
          !entry.hasAttribute('ref') &&
          !entry.hasAttribute('source') &&
          !entry.hasAttribute('href') &&
          !entry.hasAttribute('url') &&
          !entry.hasAttribute('source-label') &&
          !entry.hasAttribute('link-label') &&
          !entry.hasAttribute('type') &&
          !entry.hasAttribute('required') &&
          !entry.hasAttribute('optional');
        if (isEmptyDefaultPlaceholder) return null;
        if (!key && !rawLabel && !description && !sourceUrl && !sourceLabel && !sourceKey) {
          return null;
        }
        return {
          key,
          label: rawLabel || `Prämisse ${index + 1}`,
          description,
          sourceKey,
          sourceType,
          type: normalizeFreitextPremiseType(entry.getAttribute('type') || ''),
          sourceUrl,
          sourceLabel,
          required: parseFreitextPremiseRequired(entry)
        };
      }
    ).filter(Boolean);
  };

  const getFreitextReferencePrompt = (entry) => {
    const promptNode = entry?.querySelector?.(FREITEXT_REFERENCE_PROMPT_SELECTOR);
    return (
      entry?.getAttribute?.('prompt') ||
      entry?.getAttribute?.('instruction') ||
      promptNode?.textContent ||
      entry?.textContent ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim();
  };

  const getFreitextReferences = (html = '') => {
    const { container } = parseHtmlFragment(html);
    const freitext = getFreitextElementFromContainer(container);
    if (!freitext) return [];
    return Array.from(freitext.querySelectorAll(FREITEXT_REFERENCE_SELECTOR))
      .map((entry, index) => {
        const sourceKey = (
          entry.getAttribute('source-key') ||
          entry.getAttribute('answer-key') ||
          entry.getAttribute('source') ||
          entry.getAttribute('ref') ||
          entry.getAttribute('target') ||
          entry.getAttribute('key') ||
          ''
        ).trim();
        const rawLabel = (
          entry.getAttribute('label') ||
          entry.getAttribute('title') ||
          entry.getAttribute('name') ||
          sourceKey ||
          ''
        ).trim();
        const prompt = getFreitextReferencePrompt(entry);
        if (!sourceKey && !rawLabel && !prompt) return null;
        return {
          key: (entry.getAttribute('key') || entry.getAttribute('name') || '').trim(),
          label: rawLabel || `Verknüpfung ${index + 1}`,
          sourceKey,
          sourceType: (
            entry.getAttribute('type') ||
            entry.getAttribute('source-type') ||
            'answer'
          ).trim(),
          prompt,
          minClassification: parseFreitextReferenceThreshold(entry),
          required: parseFreitextPremiseRequired(entry)
        };
      })
      .filter(Boolean);
  };

  const truncateEditorLabel = (value = '', max = 54) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(0, max - 3))}...`;
  };

  const getFreitextNodeTitle = (freitext) => {
    const directTitle = (
      freitext?.getAttribute?.('title') ||
      freitext?.querySelector?.('freitext-anweisung h1, freitext-anweisung h2, freitext-anweisung h3')?.textContent ||
      freitext?.querySelector?.('freitext-instruction h1, freitext-instruction h2, freitext-instruction h3')?.textContent ||
      freitext?.getAttribute?.('task') ||
      freitext?.getAttribute?.('instruction') ||
      ''
    ).trim();
    return truncateEditorLabel(directTitle);
  };

  const getBlockAnswerKey = (html = '') => {
    const { container } = parseHtmlFragment(html);
    const freitext = getFreitextElementFromContainer(container);
    return (freitext?.getAttribute?.('name') || '').trim();
  };

  const getSelectableAnswerElements = (currentBlockIndex = -1) => {
    if (!browser) return [];
    const byKey = new Map();

    visualBlocks.forEach((block, blockIndex) => {
      const { container } = parseHtmlFragment(block);
      if (!container) return;

      Array.from(container.querySelectorAll('luecke-gap')).forEach((gap) => {
        const key = (gap.getAttribute('name') || '').trim();
        if (!key || byKey.has(key)) return;
        const solution = truncateEditorLabel(gap.textContent || '', 36);
        byKey.set(key, {
          key,
          type: 'luecke',
          label: `${key} · Lücke${solution ? ` · ${solution}` : ''}`
        });
      });

      Array.from(container.querySelectorAll(FREITEXT_BLOCK_SELECTOR)).forEach((freitext) => {
        if (blockIndex === currentBlockIndex) return;
        const key = (freitext.getAttribute('name') || '').trim();
        if (!key || byKey.has(key)) return;
        const title = getFreitextNodeTitle(freitext);
        byKey.set(key, {
          key,
          type: 'freitext',
          label: `${key} · Freitext${title ? ` · ${title}` : ''}`
        });
      });
    });

    return Array.from(byKey.values());
  };

  const getAnswerElementTypeForKey = (elements = [], key = '') =>
    elements.find((entry) => entry.key === String(key || '').trim())?.type || '';

  const getAnswerElementLabelForKey = (elements = [], key = '') =>
    elements.find((entry) => entry.key === String(key || '').trim())?.label || '';

  const buildLegacyFreitextInstructionHtml = (freitext) => {
    if (!freitext) return '';
    const parts = [];
    const title = (freitext.getAttribute('title') || '').trim();
    const task = (
      freitext.getAttribute('task') ||
      freitext.getAttribute('instruction') ||
      ''
    ).trim();
    const minLength = (freitext.getAttribute('min-length') || '').trim();
    const maxLength = (freitext.getAttribute('max-length') || '').trim();
    if (title) parts.push(`<h2>${escapeHtml(title)}</h2>`);
    if (task) parts.push(`<p>${escapeHtml(task)}</p>`);
    if (minLength || maxLength) {
      const limits = [];
      if (minLength) limits.push(`mind. ${minLength} Zeichen`);
      if (maxLength) limits.push(`max. ${maxLength} Zeichen`);
      parts.push(`<p><em>${escapeHtml(limits.join(' · '))}</em></p>`);
    }
    return parts.join('\n');
  };

  const setFreitextInstructionHtml = (html = '', instructionHtml = '') => {
    const { doc, container } = parseHtmlFragment(html);
    if (!doc || !container) return html || '';
    const freitext = getFreitextElementFromContainer(container);
    if (!freitext) return container.innerHTML;
    const normalizedInstruction = String(instructionHtml ?? '').trim();
    let instruction = getFreitextInstructionNode(freitext);
    if (!normalizedInstruction) {
      instruction?.remove?.();
      return container.innerHTML;
    }
    if (!instruction) {
      instruction = doc.createElement('freitext-anweisung');
      freitext.insertBefore(instruction, freitext.firstChild);
    }
    if (instruction.tagName.toLowerCase() !== 'freitext-anweisung') {
      const replacement = doc.createElement('freitext-anweisung');
      instruction.replaceWith(replacement);
      instruction = replacement;
    }
    instruction.innerHTML = normalizedInstruction;
    return container.innerHTML;
  };

  const setFreitextCriteria = (html = '', criteria = []) => {
    const { doc, container } = parseHtmlFragment(html);
    if (!doc || !container) return html || '';
    const freitext = getFreitextElementFromContainer(container);
    if (!freitext) return container.innerHTML;

    Array.from(freitext.querySelectorAll(FREITEXT_CRITERION_SELECTOR)).forEach((entry) =>
      entry.remove()
    );

    const normalizedCriteria = criteria
      .map((criterion, index) => ({
        key: String(criterion?.key ?? '').trim(),
        label: String(criterion?.label ?? '').trim() || `Element ${index + 1}`,
        description: String(criterion?.description ?? '').trim(),
        internalDescription: String(criterion?.internalDescription ?? '').trim()
      }))
      .filter(
        (criterion) => criterion.label || criterion.description || criterion.internalDescription
      );

    const referenceNodes = Array.from(freitext.querySelectorAll(FREITEXT_REFERENCE_SELECTOR));
    const lastReference = referenceNodes[referenceNodes.length - 1] ?? null;
    const premiseNodes = Array.from(freitext.querySelectorAll(FREITEXT_PREMISE_SELECTOR));
    const lastPremise = premiseNodes[premiseNodes.length - 1] ?? null;
    const referenceNode =
      lastReference?.nextSibling ??
      lastPremise?.nextSibling ??
      getFreitextInstructionNode(freitext)?.nextSibling ??
      freitext.firstChild;
    normalizedCriteria.forEach((criterion) => {
      const node = doc.createElement('freitext-teil');
      if (criterion.key) node.setAttribute('key', criterion.key);
      node.setAttribute('label', criterion.label);
      setOptionalAttribute(node, 'internal-description', criterion.internalDescription);
      node.textContent = criterion.description;
      freitext.insertBefore(doc.createTextNode('\n  '), referenceNode);
      freitext.insertBefore(node, referenceNode);
    });
    if (normalizedCriteria.length) {
      freitext.insertBefore(doc.createTextNode('\n'), referenceNode);
    }

    return container.innerHTML;
  };

  const setFreitextPremises = (html = '', premises = []) => {
    const { doc, container } = parseHtmlFragment(html);
    if (!doc || !container) return html || '';
    const freitext = getFreitextElementFromContainer(container);
    if (!freitext) return container.innerHTML;

    Array.from(freitext.querySelectorAll(FREITEXT_PREMISE_SELECTOR)).forEach((entry) =>
      entry.remove()
    );

    const normalizedPremises = premises
      .map((premise, index) => ({
        key: String(premise?.key ?? '').trim(),
        label: String(premise?.label ?? '').trim(),
        description: String(premise?.description ?? '').trim(),
        sourceKey: String(premise?.sourceKey ?? '').trim(),
        sourceType: normalizeFreitextAnswerSourceType(premise?.sourceType ?? ''),
        type: normalizeFreitextPremiseType(premise?.type ?? ''),
        sourceUrl: String(premise?.sourceUrl ?? '').trim(),
        sourceLabel: String(premise?.sourceLabel ?? '').trim(),
        required: premise?.required !== false
      }))
      .filter(
        (premise) =>
          premise.key ||
          premise.label ||
          premise.description ||
          premise.sourceKey ||
          premise.sourceUrl ||
          premise.sourceLabel
      );

    const referenceNode = getFreitextInstructionNode(freitext)?.nextSibling ?? freitext.firstChild;

    normalizedPremises.forEach((premise) => {
      const node = doc.createElement('freitext-praemisse');
      if (premise.key) node.setAttribute('key', premise.key);
      node.setAttribute('label', premise.label);
      setOptionalAttribute(node, 'source-key', premise.sourceKey);
      setOptionalAttribute(node, 'source-type', premise.sourceType);
      if (premise.type && premise.type !== 'text') node.setAttribute('type', premise.type);
      setOptionalAttribute(node, 'source', premise.sourceUrl);
      setOptionalAttribute(node, 'source-label', premise.sourceLabel);
      if (!premise.required) node.setAttribute('optional', '');
      node.textContent = premise.description;
      freitext.insertBefore(doc.createTextNode('\n  '), referenceNode);
      freitext.insertBefore(node, referenceNode);
    });
    if (normalizedPremises.length) {
      freitext.insertBefore(doc.createTextNode('\n'), referenceNode);
    }

    return container.innerHTML;
  };

  const setFreitextReferences = (html = '', references = []) => {
    const { doc, container } = parseHtmlFragment(html);
    if (!doc || !container) return html || '';
    const freitext = getFreitextElementFromContainer(container);
    if (!freitext) return container.innerHTML;

    Array.from(freitext.querySelectorAll(FREITEXT_REFERENCE_SELECTOR)).forEach((entry) =>
      entry.remove()
    );

    const normalizedReferences = references
      .map((reference, index) => {
        const sourceKey = String(reference?.sourceKey ?? '').trim();
        return {
          key: String(reference?.key ?? '').trim(),
          label:
            String(reference?.label ?? '').trim() ||
            sourceKey ||
            `Verknüpfung ${index + 1}`,
          sourceKey,
          sourceType: String(reference?.sourceType ?? 'answer').trim() || 'answer',
          prompt: String(reference?.prompt ?? '').trim(),
          minClassification: normalizeFreitextReferenceThreshold(reference?.minClassification),
          required: reference?.required !== false
        };
      })
      .filter(
        (reference) =>
          reference.key || reference.label || reference.sourceKey || reference.prompt
      );

    const premiseNodes = Array.from(freitext.querySelectorAll(FREITEXT_PREMISE_SELECTOR));
    const lastPremise = premiseNodes[premiseNodes.length - 1] ?? null;
    const instructionNode = getFreitextInstructionNode(freitext);
    const referenceNode = lastPremise?.nextSibling ?? instructionNode?.nextSibling ?? freitext.firstChild;

    normalizedReferences.forEach((reference) => {
      const node = doc.createElement('freitext-ref');
      if (reference.key) node.setAttribute('key', reference.key);
      node.setAttribute('label', reference.label);
      setOptionalAttribute(node, 'source-key', reference.sourceKey);
      if (reference.sourceType && reference.sourceType !== 'answer') {
        node.setAttribute('source-type', reference.sourceType);
      }
      if (reference.minClassification !== 900) {
        node.setAttribute('min-classification', String(reference.minClassification));
      }
      if (!reference.required) node.setAttribute('optional', '');
      node.textContent = reference.prompt;
      freitext.insertBefore(doc.createTextNode('\n  '), referenceNode);
      freitext.insertBefore(node, referenceNode);
    });
    if (normalizedReferences.length) {
      freitext.insertBefore(doc.createTextNode('\n'), referenceNode);
    }

    return container.innerHTML;
  };

  const setFreitextMainPromptInHtml = (html = '', prompt = '') => {
    const { container } = parseHtmlFragment(html);
    if (!container) return html || '';
    const freitext = getFreitextElementFromContainer(container);
    if (!freitext) return container.innerHTML;
    const normalizedPrompt = String(prompt ?? '').trim();
    freitext.removeAttribute('prompt');
    freitext.removeAttribute('teacher-prompt');
    freitext.removeAttribute('data-prompt');
    freitext.removeAttribute('data-teacher-prompt');
    if (normalizedPrompt) {
      freitext.setAttribute('prompt', normalizedPrompt);
    }
    return container.innerHTML;
  };

  const getEditableFreitextInstructionHtml = (html = '') => {
    const explicit = getFreitextInstructionHtml(html);
    if (explicit) return explicit;
    const legacyFromString = buildLegacyFreitextInstructionHtmlFromString(html);
    if (legacyFromString) return legacyFromString;
    const { container } = parseHtmlFragment(html);
    return buildLegacyFreitextInstructionHtml(getFreitextElementFromContainer(container));
  };

  const isInstructionCandidateBlock = (block = '') => {
    if (!String(block || '').trim()) return false;
    const type = detectWorksheetBlockType(block).id;
    return !isFreitextBlock(block) && type !== 'umfrage';
  };

  const mergeInstructionBlocksIntoFreitextBlocks = (blocks = []) => {
    const result = [];
    let pendingInstructionBlocks = [];

    const flushPending = () => {
      if (!pendingInstructionBlocks.length) return;
      result.push(...pendingInstructionBlocks);
      pendingInstructionBlocks = [];
    };

    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      if (isFreitextBlock(block)) {
        const trailingInstructionBlocks = [];
        let nextIndex = index + 1;
        while (
          nextIndex < blocks.length &&
          isInstructionCandidateBlock(blocks[nextIndex])
        ) {
          trailingInstructionBlocks.push(blocks[nextIndex]);
          nextIndex += 1;
        }
        if (
          (pendingInstructionBlocks.length || trailingInstructionBlocks.length) &&
          !hasFreitextInstructionHtml(block)
        ) {
          const instructionHtml = [...pendingInstructionBlocks, ...trailingInstructionBlocks]
            .map((entry) => renderBlockHtml(entry))
            .join('\n');
          result.push(setFreitextInstructionHtml(block, instructionHtml));
          pendingInstructionBlocks = [];
          index = nextIndex - 1;
          continue;
        }
        flushPending();
        result.push(block);
        continue;
      }

      if (isInstructionCandidateBlock(block)) {
        pendingInstructionBlocks.push(block);
        continue;
      }

      flushPending();
      result.push(block);
    }

    flushPending();
    return result.length ? result : [''];
  };

  const getBlockPromptFromHtml = (html = '') => {
    const { container } = parseHtmlFragment(html);
    if (!container) return '';
    const first = container.firstElementChild;
    if (first && first.tagName && first.tagName.toLowerCase() === 'abu-block-prompt') {
      return (first.textContent ?? '').trim();
    }
    const marker = container.querySelector('abu-block-prompt');
    return (marker?.textContent ?? '').trim();
  };

  const setBlockPromptInHtml = (html = '', prompt = '') => {
    const { doc, container } = parseHtmlFragment(html);
    if (!doc || !container) return html || '';
    const normalizedPrompt = String(prompt ?? '').trim();
    const first = container.firstElementChild;
    const existing =
      first && first.tagName && first.tagName.toLowerCase() === 'abu-block-prompt'
        ? first
        : container.querySelector('abu-block-prompt');
    if (!normalizedPrompt) {
      existing?.remove?.();
      return container.innerHTML;
    }
    const marker = existing || doc.createElement('abu-block-prompt');
    marker.textContent = normalizedPrompt;
    if (!existing) {
      container.insertBefore(marker, container.firstChild);
    }
    return container.innerHTML;
  };

  const listLueckeGapsFromHtml = (html = '') => {
    const { container } = parseHtmlFragment(html);
    if (!container) return [];
    const gaps = Array.from(container.querySelectorAll('luecke-gap'));
    return gaps.map((gap) => ({
      name: (gap.getAttribute('name') || '').trim(),
      prompt: gap.getAttribute('prompt') || gap.getAttribute('data-prompt') || '',
      width: (gap.getAttribute('width') || '').trim(),
      solution: (gap.textContent || '').trim()
    }));
  };

  const setLueckeGapPromptInHtml = (html = '', gapName = '', prompt = '') => {
    const { container } = parseHtmlFragment(html);
    if (!container) return html || '';
    const normalizedName = String(gapName ?? '').trim();
    if (!normalizedName) return html || '';
    const normalizedPrompt = String(prompt ?? '');
    const gap = Array.from(container.querySelectorAll('luecke-gap')).find(
      (entry) => (entry.getAttribute('name') || '').trim() === normalizedName
    );
    if (!gap) return container.innerHTML;
    const hasLegacyPrompt = gap.hasAttribute('data-prompt');
    if (normalizedPrompt.trim() === '') {
      gap.removeAttribute('prompt');
      gap.removeAttribute('data-prompt');
    } else {
      gap.setAttribute('prompt', normalizedPrompt);
      if (hasLegacyPrompt) {
        gap.setAttribute('data-prompt', normalizedPrompt);
      }
    }
    return container.innerHTML;
  };

  const setLueckeGapSolutionInHtml = (html = '', gapName = '', solution = '') => {
    const { container } = parseHtmlFragment(html);
    if (!container) return html || '';
    const normalizedName = String(gapName ?? '').trim();
    if (!normalizedName) return html || '';
    const normalizedSolution = String(solution ?? '').trim();
    const gap = Array.from(container.querySelectorAll('luecke-gap')).find(
      (entry) => (entry.getAttribute('name') || '').trim() === normalizedName
    );
    if (!gap) return container.innerHTML;
    gap.textContent = normalizedSolution;
    return container.innerHTML;
  };

  const setLueckeGapDataInHtml = (html = '', gapName = '', { solution = '', prompt = '', width = '' } = {}) => {
    const { container } = parseHtmlFragment(html);
    if (!container) return html || '';
    const normalizedName = String(gapName ?? '').trim();
    if (!normalizedName) return html || '';
    const gap = Array.from(container.querySelectorAll('luecke-gap')).find(
      (entry) => (entry.getAttribute('name') || '').trim() === normalizedName
    );
    if (!gap) return container.innerHTML;
    gap.textContent = String(solution ?? '').trim();
    const normalizedWidth = normalizeLueckeWidth(width);
    if (normalizedWidth) {
      gap.setAttribute('width', normalizedWidth);
    } else {
      gap.removeAttribute('width');
    }
    const normalizedPrompt = String(prompt ?? '');
    const hasLegacyPrompt = gap.hasAttribute('data-prompt');
    if (normalizedPrompt.trim() === '') {
      gap.removeAttribute('prompt');
      gap.removeAttribute('data-prompt');
    } else {
      gap.setAttribute('prompt', normalizedPrompt);
      if (hasLegacyPrompt) {
        gap.setAttribute('data-prompt', normalizedPrompt);
      }
    }
    return container.innerHTML;
  };

  const ensureLueckeGapNameInHtml = (html = '', gapIndex = 0) => {
    const { container } = parseHtmlFragment(html);
    if (!container) return { html: html || '', name: '' };
    const gaps = Array.from(container.querySelectorAll('luecke-gap'));
    const gap = gaps[Math.max(0, Math.min(Number(gapIndex) || 0, gaps.length - 1))];
    if (!gap) return { html: container.innerHTML, name: '' };
    const existingName = (gap.getAttribute('name') || '').trim();
    if (existingName) return { html: container.innerHTML, name: existingName };
    const name = getNextLueckeName();
    gap.setAttribute('name', name);
    return { html: container.innerHTML, name };
  };

  const setVisualBlockPrompt = (index, prompt) => {
    const current = visualBlocks[index] ?? '';
    const next = setBlockPromptInHtml(current, prompt);
    updateVisualBlock(index, next, {
      coalesce: true,
      chunkKey: `block:${index}:prompt`
    });
  };

  const setVisualBlockGapPrompt = (index, gapName, prompt) => {
    const current = visualBlocks[index] ?? '';
    const next = setLueckeGapPromptInHtml(current, gapName, prompt);
    updateVisualBlock(index, next, {
      coalesce: true,
      chunkKey: `block:${index}:gap:${gapName}:prompt`
    });
  };

  const setVisualBlockFreitextMainPrompt = (index, prompt) => {
    const current = visualBlocks[index] ?? '';
    const next = setFreitextMainPromptInHtml(current, prompt);
    updateVisualBlock(index, next, {
      coalesce: true,
      chunkKey: `block:${index}:freitext-main-prompt`
    });
  };

  const setVisualBlockGapSolution = (index, gapName, solution) => {
    const current = visualBlocks[index] ?? '';
    const next = setLueckeGapSolutionInHtml(current, gapName, solution);
    updateVisualBlock(index, next, {
      coalesce: true,
      chunkKey: `block:${index}:gap:${gapName}:solution`
    });
  };

  const closeLueckeEditor = () => {
    lueckeEditorOpen = false;
    lueckeEditorBlockIndex = null;
    lueckeEditorName = '';
    lueckeEditorSolution = '';
    lueckeEditorPrompt = '';
    lueckeEditorWidth = LUECKE_DEFAULT_WIDTH;
    lueckeEditorError = '';
  };

  const openLueckeEditor = (blockIndex, gapName = '', gapIndex = 0) => {
    if (blockIndex < 0 || blockIndex >= visualBlocks.length) return;
    let current = visualBlocks[blockIndex] || '';
    let name = String(gapName || '').trim();
    if (!name) {
      const ensured = ensureLueckeGapNameInHtml(current, gapIndex);
      current = ensured.html;
      name = ensured.name;
      if (name && current !== visualBlocks[blockIndex]) {
        updateVisualBlock(blockIndex, current, {
          coalesce: true,
          chunkKey: `block:${blockIndex}:gap:${name}:name`
        });
      }
    }
    const gap = listLueckeGapsFromHtml(current).find((entry) => entry.name === name);
    if (!gap) return;
    visualActiveBlock = blockIndex;
    lueckeEditorBlockIndex = blockIndex;
    lueckeEditorName = name;
    lueckeEditorSolution = gap.solution || '';
    lueckeEditorPrompt = gap.prompt || '';
    lueckeEditorWidth = normalizeLueckeWidth(gap.width || '');
    lueckeEditorError = '';
    lueckeEditorOpen = true;
    void tick().then(() => {
      lueckeSolutionInputEl?.focus?.();
      lueckeSolutionInputEl?.select?.();
    });
  };

  const getLueckeGapElementFromEvent = (event) => {
    const target = event?.target;
    const element =
      target && typeof target.closest === 'function'
        ? target
        : target?.parentElement && typeof target.parentElement.closest === 'function'
          ? target.parentElement
          : null;
    return element?.closest?.('luecke-gap') || null;
  };

  const openLueckeEditorFromElement = (blockIndex, gapElement) => {
    if (!gapElement) return false;
    const editorEl = visualBlockEditors[blockIndex];
    if (editorEl && !editorEl.contains(gapElement)) return false;
    const gaps = Array.from(editorEl?.querySelectorAll('luecke-gap') || []);
    const gapIndex = Math.max(0, gaps.indexOf(gapElement));
    openLueckeEditor(blockIndex, gapElement.getAttribute('name') || '', gapIndex);
    return true;
  };

  const getLueckeGapFromPointerEvent = (index, event) => {
    const directGap = getLueckeGapElementFromEvent(event);
    if (directGap) return { gap: directGap, side: getGapCaretSideFromPoint(directGap, event) };

    const editorEl = visualBlockEditors[index];
    if (visualBlockViews[index] !== 'visual') return null;
    const pointGap = getLueckeGapAtPoint(editorEl, event);
    if (pointGap) return pointGap;
    const terminalGap = getTerminalGapBeforePoint(editorEl, event);
    return terminalGap ? { gap: terminalGap, side: 'after' } : null;
  };

  const saveLueckeEditor = () => {
    const blockIndex = lueckeEditorBlockIndex;
    if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= visualBlocks.length) {
      lueckeEditorError = 'Diese Lücke ist nicht mehr verfügbar.';
      return;
    }
    const name = String(lueckeEditorName || '').trim();
    if (!name) {
      lueckeEditorError = 'Diese Lücke hat keinen Namen.';
      return;
    }
    const next = setLueckeGapDataInHtml(visualBlocks[blockIndex] || '', name, {
      solution: lueckeEditorSolution,
      prompt: lueckeEditorPrompt,
      width: lueckeEditorWidth
    });
    updateVisualBlock(blockIndex, next, {
      coalesce: true,
      chunkKey: `block:${blockIndex}:gap:${name}:data`
    });
    closeLueckeEditor();
  };

  let visualInputCommitTimer = null;
  const visualInputCommitQueue = new Map();

  const clearVisualInputCommitTimer = () => {
    if (visualInputCommitTimer === null) return;
    window.clearTimeout(visualInputCommitTimer);
    visualInputCommitTimer = null;
  };

  const flushVisualInputCommits = () => {
    clearVisualInputCommitTimer();
    if (!visualInputCommitQueue.size) return;
    const commits = Array.from(visualInputCommitQueue.entries());
    visualInputCommitQueue.clear();
    visualInputCommitVersion += 1;
    commits.forEach(([index, commit]) => {
      updateVisualBlock(index, commit.value, commit.historyOptions || {});
    });
  };

  const flushSheetHtmlInputWork = () => {
    clearSheetHtmlHighlightTimer();
    sheetHtmlHighlightContent = sheetHtmlInput?.value ?? editorContent ?? '';
  };

  const flushVisualHtmlInputWork = () => {
    clearVisualBlockHtmlHighlightTimer();
    flushVisualInputCommits();
    const activeIndex = Number.isInteger(visualActiveBlock) ? visualActiveBlock : null;
    if (activeIndex !== null && visualBlockViews[activeIndex] === 'html') {
      setVisualBlockHtmlHighlight(
        activeIndex,
        visualBlockHtmlInputs[activeIndex]?.value ?? visualBlocks[activeIndex] ?? ''
      );
    }
  };

  const scheduleVisualInputCommit = (index, value, historyOptions = {}) => {
    if (!Number.isInteger(index)) return;
    visualInputCommitQueue.set(index, { value, historyOptions });
    visualInputCommitVersion += 1;
    clearVisualInputCommitTimer();
    visualInputCommitTimer = window.setTimeout(
      flushVisualInputCommits,
      VISUAL_INPUT_COMMIT_DELAY_MS
    );
  };

  const commitVisualBlocks = () => {
    const normalized = visualBlocks.map((block) => normalizeBlockContent(block));
    const hasChanges = normalized.some((block, idx) => block !== visualBlocks[idx]);
    if (hasChanges) {
      visualBlocks = normalized;
    }
    const nextBlocks = hasChanges ? normalized : visualBlocks;
    visualBlockIds = normalizeVisualBlockIds(visualBlockIds, nextBlocks.length);
    const nextHtml = blocksToHtml(nextBlocks);
    editorContent = nextHtml;
    visualSyncHtml = nextHtml;
    renderVisualPreviewFromBlocks(nextBlocks);
  };

  const updateVisualBlock = (index, value, historyOptions = {}) => {
    if (index < 0 || index >= visualBlocks.length) return;
    if (visualInputCommitQueue.delete(index)) {
      visualInputCommitVersion += 1;
    }
    const normalizedValue = normalizeBlockContent(value);
    if ((visualBlocks[index] ?? '') === normalizedValue) return;
    pushVisualHistorySnapshot(historyOptions);
    const next = [...visualBlocks];
    next[index] = normalizedValue;
    visualBlocks = next;
    commitVisualBlocks();
  };

  const deleteVisualBlockAt = (index) => {
    flushVisualInputCommits();
    if (index < 0 || index >= visualBlocks.length) return;
    pushVisualHistorySnapshot();
    const next = [...visualBlocks];
    next.splice(index, 1);
    if (!next.length) next.push('');
    visualBlocks = next;
    const nextIds = [...visualBlockIds];
    nextIds.splice(index, 1);
    visualBlockIds = normalizeVisualBlockIds(nextIds, next.length);
    const nextViews = [...visualBlockViews];
    nextViews.splice(index, 1);
    visualBlockViews = normalizeVisualBlockViews(nextViews, next.length, next);
    const nextPrompts = [...visualBlockPromptOpen];
    nextPrompts.splice(index, 1);
    visualBlockPromptOpen = normalizeVisualBlockPromptOpen(nextPrompts, next.length);
    const nextSelections = [...visualBlockSelections];
    nextSelections.splice(index, 1);
    visualBlockSelections = nextSelections.slice(0, next.length);
    const nextRevisions = [...visualBlockInputRevisions];
    nextRevisions.splice(index, 1);
    visualBlockInputRevisions = nextRevisions.slice(0, next.length);
    commitVisualBlocks();
  };

  const moveVisualBlock = (from, to) => {
    flushVisualInputCommits();
    if (from === null || to === null || from === to) return;
    if (from < 0 || from >= visualBlocks.length) return;
    if (to < 0 || to > visualBlocks.length) return;
    const next = [...visualBlocks];
    const [item] = next.splice(from, 1);
    const adjusted = from < to ? to - 1 : to;
    if (adjusted === from) return;
    if (adjusted < 0 || adjusted > next.length) return;
    pushVisualHistorySnapshot();
    next.splice(adjusted, 0, item);
    visualBlocks = next;
    visualBlockIds = normalizeVisualBlockIds(
      moveIndexedEntry(visualBlockIds, from, adjusted, createVisualBlockId()),
      next.length
    );
    const nextViews = [...visualBlockViews];
    const [view] = nextViews.splice(from, 1);
    nextViews.splice(adjusted, 0, view ?? 'visual');
    visualBlockViews = normalizeVisualBlockViews(nextViews, next.length, next);
    const nextPrompts = [...visualBlockPromptOpen];
    const [promptOpen] = nextPrompts.splice(from, 1);
    nextPrompts.splice(adjusted, 0, Boolean(promptOpen));
    visualBlockPromptOpen = normalizeVisualBlockPromptOpen(nextPrompts, next.length);
    visualBlockSelections = moveIndexedEntry(visualBlockSelections, from, adjusted).slice(
      0,
      next.length
    );
    visualBlockInputRevisions = moveIndexedEntry(
      visualBlockInputRevisions,
      from,
      adjusted,
      0
    ).slice(0, next.length);
    visualActiveBlock = adjusted;
    commitVisualBlocks();
  };

  const isEditableDragTarget = (event) => {
    const target = event?.target;
    if (!target || !(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        [
          '.block-format-tools',
          'input',
          'textarea',
          'select',
          'button',
          'a'
        ].join(', ')
      )
    );
  };

  const removeBlockDragImage = () => {
    if (!blockDragImageEl) return;
    blockDragImageEl.remove();
    blockDragImageEl = null;
  };

  const getDragImageOffsetScale = () => {
    if (!browser) return 1;
    const dpr = window.devicePixelRatio || 1;
    if (dpr <= 1) return 1;
    const ua = navigator.userAgent || '';
    const vendor = navigator.vendor || '';
    const isSafari =
      /Safari/i.test(ua) &&
      /Apple/i.test(vendor) &&
      !/(Chrome|CriOS|Chromium|Edg|OPR|Firefox|FxiOS)/i.test(ua);
    return isSafari ? dpr : 1;
  };

  const setBlockDragImage = (event, sourceOverride = null) => {
    if (!browser || !event?.dataTransfer) return;
    const source = sourceOverride ?? event.currentTarget;
    if (!(source instanceof HTMLElement)) return;

    removeBlockDragImage();
    const rect = source.getBoundingClientRect();
    const ghost = source.cloneNode(true);
    if (!(ghost instanceof HTMLElement)) return;
    ghost.classList.add('block-editor--drag-image');
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.appendChild(ghost);
    blockDragImageEl = ghost;

    const rawX = Number.isFinite(event.clientX) ? event.clientX - rect.left : rect.width / 2;
    const rawY = Number.isFinite(event.clientY) ? event.clientY - rect.top : rect.height / 2;
    const offsetScale = getDragImageOffsetScale();
    const offsetX = Math.max(0, Math.min(rect.width * offsetScale, rawX * offsetScale));
    const offsetY = Math.max(0, Math.min(rect.height * offsetScale, rawY * offsetScale));
    event.dataTransfer.setDragImage(ghost, offsetX, offsetY);
  };

  const handleBlockDragStart = (event, index) => {
    if (isEditableDragTarget(event)) {
      event.preventDefault();
      return;
    }
    visualActiveBlock = index;
    dragIndex = index;
    dragOverIndex = null;
    blockInsertIndex = null;
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
      const target = event?.target;
      const source =
        target instanceof Element ? target.closest('.block-editor') : event.currentTarget;
      setBlockDragImage(event, source);
    }
  };

  const handleInsertDragOver = (event, index) => {
    event.preventDefault();
    dragOverIndex = index;
    if (event?.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  };

  const handleInsertDragLeave = (event, index) => {
    if (dragOverIndex !== index) return;
    const target = event?.currentTarget;
    const rect = target?.getBoundingClientRect?.();
    const x = event?.clientX;
    const y = event?.clientY;
    if (
      rect &&
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    ) {
      return;
    }
    dragOverIndex = null;
  };

  const handleInsertDrop = (event, index) => {
    event.preventDefault();
    const fromRaw =
      dragIndex ?? (event?.dataTransfer ? parseInt(event.dataTransfer.getData('text/plain'), 10) : NaN);
    const from = Number.isFinite(fromRaw) ? fromRaw : null;
    moveVisualBlock(from, index);
    removeBlockDragImage();
    dragIndex = null;
    dragOverIndex = null;
    blockInsertIndex = null;
  };

  const handleBlockDragEnd = () => {
    removeBlockDragImage();
    dragIndex = null;
    dragOverIndex = null;
  };

  const setVisualBlockView = (index, view) => {
    flushVisualInputCommits();
    const next = [...visualBlockViews];
    next[index] = view;
    visualBlockViews = normalizeVisualBlockViews(next, visualBlocks.length, visualBlocks);
  };

  const toggleVisualBlockPrompts = (index) => {
    const next = [...visualBlockPromptOpen];
    next[index] = !next[index];
    visualBlockPromptOpen = normalizeVisualBlockPromptOpen(next, visualBlocks.length);
  };

  const toggleVisualBlockView = (index) => {
    const currentView = visualBlockViews[index] === 'html' ? 'html' : 'visual';
    const nextView = currentView === 'visual' ? 'html' : 'visual';
    setVisualBlockView(index, nextView);
    visualActiveBlock = index;
    void focusVisualBlockEditor(index, nextView);
  };

  const isVisualBlockActive = (index) => visualActiveBlock === index;

  const isEmptyVisualBlock = (block = '') => !String(block || '').trim();

  const hasOnlyEmptyVisualBlock = () =>
    visualBlocks.length === 1 && isEmptyVisualBlock(visualBlocks[0]);

  const hasActiveVisualBlock = () =>
    Number.isInteger(visualActiveBlock) &&
    visualActiveBlock >= 0 &&
    visualActiveBlock < visualBlocks.length;

  const getClampedVisualActiveBlock = (fallback = null) => {
    if (!visualBlocks.length || !Number.isFinite(visualActiveBlock)) return fallback;
    return Math.max(0, Math.min(visualActiveBlock, Math.max(visualBlocks.length - 1, 0)));
  };

  const resolveVisibleBlockInsertIndexes = () => {
    const indexes = new Set();
    if (Number.isInteger(dragOverIndex)) indexes.add(dragOverIndex);
    if (dragIndex !== null) return indexes;
    if (!visualBlocks.length || hasOnlyEmptyVisualBlock()) {
      indexes.add(0);
      return indexes;
    }
    if (!hasActiveVisualBlock()) return indexes;
    const activeIndex = getClampedVisualActiveBlock(null);
    if (activeIndex !== null) {
      indexes.add(activeIndex);
      indexes.add(activeIndex + 1);
    }
    return indexes;
  };

  $: {
    visualBlocks;
    visualActiveBlock;
    dragIndex;
    dragOverIndex;
    blockInsertIndex;
    visibleBlockInsertIndexes = resolveVisibleBlockInsertIndexes();
  }

  const focusVisualBlockEditor = async (index, viewOverride = null) => {
    await tick();
    const view = viewOverride || visualBlockViews[index];
    const target =
      view === 'html' ? visualBlockHtmlInputs[index] : visualBlockEditors[index];
    if (!target) return;
    target.focus?.();
    if (target === visualBlockEditors[index] && view === 'visual') {
      ensureTerminalCaretTextInEditor(target);
      restoreVisualSelection(index);
    }
  };

  const activateVisualBlock = (index, options = {}) => {
    if (index < 0 || index >= visualBlocks.length) return;
    const wasInactive = visualActiveBlock !== index;
    if (wasInactive) flushVisualInputCommits();
    visualActiveBlock = index;
    if (wasInactive) blockInsertIndex = null;
    if (options?.focusEditor && wasInactive) {
      void focusVisualBlockEditor(index, options?.view);
    }
  };

  const handleVisualBlockPointerDown = (event, index) => {
    if (event?.button !== undefined && event.button !== 0) return;
    const target = event?.target;
    if (
      target instanceof Element &&
      target.closest('.block-format-tools, button, input, textarea, select, a')
    ) {
      return;
    }
    const pointerGap = getLueckeGapFromPointerEvent(index, event);
    if (pointerGap?.gap) {
      if ((event?.detail || 0) > 1 && openLueckeEditorFromElement(index, pointerGap.gap)) {
        if (visualBlockViews[index] !== 'visual') setVisualBlockView(index, 'visual');
        event?.preventDefault?.();
        event?.stopPropagation?.();
        return;
      }
      event?.preventDefault?.();
      event?.stopPropagation?.();
      void placeVisualCaretAroundGapFromEvent(index, pointerGap.gap, event, pointerGap.side);
      return;
    }
  };

  const handleVisualBlockDoubleClick = (event, index) => {
    const pointerGap = getLueckeGapFromPointerEvent(index, event);
    if (!pointerGap?.gap || !openLueckeEditorFromElement(index, pointerGap.gap)) return;
    if (visualBlockViews[index] !== 'visual') setVisualBlockView(index, 'visual');
    event?.preventDefault?.();
    event?.stopPropagation?.();
  };

  const handleVisualBlockFocusIn = (event, index) => {
    const target = event?.target;
    activateVisualBlock(index);
  };

  const handleVisualBlockClick = (event, index) => {
    if (event?.defaultPrevented) return;
    const target = event?.target;
    const wasInactive = visualActiveBlock !== index;
    if (wasInactive) {
      const activationView = visualBlockViews[index] || getDefaultVisualBlockView(visualBlocks[index] || '');
      if (visualBlockViews[index] !== activationView) setVisualBlockView(index, activationView);
      event?.preventDefault?.();
      activateVisualBlock(index, { focusEditor: true, view: activationView });
      return;
    }
    if (
      target instanceof Element &&
      target.closest('.block-format-tools, button, input, textarea, select, a')
    ) {
      return;
    }
    activateVisualBlock(index);
  };

  const handleVisualBlockKeydown = (event, index) => {
    const key = event?.key;
    if (key !== 'Enter' && key !== ' ') return;
    const target = event?.target;
    if (
      target instanceof Element &&
      target.closest(
        '.block-format-tools, button, input, textarea, select, a, [contenteditable="true"]'
      )
    ) {
      return;
    }
    event?.preventDefault?.();
    const activationView = visualBlockViews[index] || getDefaultVisualBlockView(visualBlocks[index] || '');
    if (visualBlockViews[index] !== activationView) setVisualBlockView(index, activationView);
    activateVisualBlock(index, { focusEditor: true, view: activationView });
  };

  const buildLueckeSnippet = (width = '', name = getNextLueckeName(), solution = '') => {
    const trimmedWidth = (width || '').trim();
    const widthAttr = trimmedWidth ? ` width="${escapeHtml(trimmedWidth)}"` : '';
    return `<luecke-gap name="${escapeHtml(name)}"${widthAttr}>${escapeHtml(solution)}</luecke-gap>`;
  };

  const buildHtmlSnippet = () => `<div>
  <p>HTML Block</p>
</div>`;

  const buildFreitextSnippet = () => {
    const index = getNextFreitextIndex();
    return `<freitext-block
  name="freitext${index}"
  title="Freitext-Aufgabe"
  task="Schreibe einen zusammenhängenden Text und achte auf alle Angaben."
  rows="12"
  placeholder="Schreibe deinen Text hier..."
>
  <freitext-anweisung>
    <h2>Freitext-Aufgabe</h2>
    <p>Schreibe einen zusammenhängenden Text und achte auf alle Angaben.</p>
  </freitext-anweisung>
</freitext-block>`;
  };

  const buildUmfrageSnippet = () => {
    const index = getNextUmfrageIndex();
    return `<umfrage-matrix name="umfrage${index}" scale="1 trifft gar nicht zu;2 trifft eher nicht zu;3 teils/teils;4 trifft eher zu;5 trifft voll und ganz zu">
  Aussage 1
  Aussage 2
  Aussage 3
</umfrage-matrix>`;
  };

  const BLOCK_TEMPLATE_BUILDERS = {
    html: buildHtmlSnippet,
    titel: () => buildTitelSnippet(1),
    freitext: buildFreitextSnippet,
    umfrage: buildUmfrageSnippet
  };
  const LUECKE_ELEMENT_TYPE = getWorksheetElementType('luecke');
  const BLOCK_TEMPLATES = BLOCK_TEMPLATE_DEFINITIONS.map((template) => ({
    ...template,
    getHtml: BLOCK_TEMPLATE_BUILDERS[template.id] || (() => '')
  }));

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
      const width = lower.includes('breit') || lower.includes('wide') ? '100%' : '';
      return {
        html: buildLueckeSnippet(width),
        blockLevel: false,
        label: 'Lücke',
        view: 'visual'
      };
    }

    if (
      lower.includes('freitext') ||
      lower.includes('aufsatz') ||
      lower.includes('essay')
    ) {
      return {
        html: buildFreitextSnippet(),
        blockLevel: true,
        label: 'Freitext',
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
      lower.includes('untertitel') ||
      lower.includes('unteruntertitel') ||
      /\bh[1-6]\b/.test(lower)
    ) {
      const match = lower.match(/\bh([1-6])\b/);
      const rawLevel = match
        ? parseInt(match[1], 10)
        : lower.includes('unteruntertitel')
          ? 3
          : lower.includes('untertitel')
            ? 2
            : lower.includes('titel')
              ? 1
              : 2;
      const level = Math.max(1, Math.min(rawLevel, 3));
      const text = payload || TITEL_LEVEL_OPTIONS[level - 1]?.label || 'Titel';
      return {
        html: buildTitelSnippet(level, text),
        blockLevel: true,
        label: 'Titel',
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
    flushVisualInputCommits();
    const normalized = normalizeBlockContent(html);
    pushVisualHistorySnapshot();
    const nextBlocks = [...visualBlocks, normalized];
    visualBlocks = nextBlocks;
    visualBlockIds = normalizeVisualBlockIds(
      [...visualBlockIds, createVisualBlockId()],
      nextBlocks.length
    );
    const nextViews = [...visualBlockViews, view];
    visualBlockViews = normalizeVisualBlockViews(nextViews, nextBlocks.length, nextBlocks);
    visualBlockPromptOpen = normalizeVisualBlockPromptOpen(
      [...visualBlockPromptOpen, false],
      nextBlocks.length
    );
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
    flushVisualInputCommits();
    const normalized = normalizeBlockContent(html);
    pushVisualHistorySnapshot();
    const nextBlocks = [...visualBlocks];
    const clampedIndex = Math.max(0, Math.min(index, nextBlocks.length));
    const replaceEmptyPlaceholder = hasOnlyEmptyVisualBlock() && clampedIndex === 0;
    if (replaceEmptyPlaceholder) {
      nextBlocks[0] = normalized;
    } else {
      nextBlocks.splice(clampedIndex, 0, normalized);
    }
    visualBlocks = nextBlocks;
    const nextIds = [...visualBlockIds];
    if (!replaceEmptyPlaceholder) nextIds.splice(clampedIndex, 0, createVisualBlockId());
    visualBlockIds = normalizeVisualBlockIds(nextIds, nextBlocks.length);
    const nextViews = [...visualBlockViews];
    if (replaceEmptyPlaceholder) {
      nextViews[0] = view;
    } else {
      nextViews.splice(clampedIndex, 0, view);
    }
    visualBlockViews = normalizeVisualBlockViews(nextViews, nextBlocks.length, nextBlocks);
    const nextPrompts = [...visualBlockPromptOpen];
    if (replaceEmptyPlaceholder) {
      nextPrompts[0] = false;
    } else {
      nextPrompts.splice(clampedIndex, 0, false);
    }
    visualBlockPromptOpen = normalizeVisualBlockPromptOpen(nextPrompts, nextBlocks.length);
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

  const scrollAgentHistoryToBottom = async () => {
    await tick();
    if (agentHistoryEl) {
      agentHistoryEl.scrollTop = agentHistoryEl.scrollHeight;
    }
  };

  const patchAgentHistoryEntry = (id, patch) => {
    if (!id) return null;
    let nextEntry = null;
    agentHistory = agentHistory.map((entry) => {
      if (entry.id !== id) return entry;
      const nextPatch = typeof patch === 'function' ? patch(entry) : patch;
      nextEntry = { ...entry, ...(nextPatch || {}) };
      return nextEntry;
    });
    return nextEntry;
  };

  const appendAgentHistoryPrompt = async (prompt, scope = 'app') => {
    const trimmedPrompt = (prompt || '').trim();
    if (!trimmedPrompt) return '';
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    agentHistory = [
      ...agentHistory,
      {
        id,
        scope: typeof scope === 'string' && scope ? scope : 'app',
        prompt: trimmedPrompt,
        response: '',
        pending: true,
        error: false,
        feedbackOpen: false,
        logId: '',
        ratingValue: null,
        ratingComment: '',
        ratingSaving: false,
        ratingSaved: false,
        ratingError: ''
      }
    ];
    await scrollAgentHistoryToBottom();
    return id;
  };

  const trimAgentHistoryText = (value, maxChars = 240) => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (text.length <= maxChars) return text;
    const remaining = text.length - maxChars;
    return `${text.slice(0, maxChars)}...[truncated ${remaining} chars]`;
  };

  const estimateAgentHistoryContextChars = (summary, turns) =>
    (summary || '').length +
    (Array.isArray(turns)
      ? turns.reduce(
          (sum, entry) =>
            sum + String(entry?.user || '').length + String(entry?.assistant || '').length,
          0
        )
      : 0);

  const buildAgentHistoryContext = (scope) => {
    const normalizedScope = typeof scope === 'string' && scope ? scope : 'app';
    const completedEntries = agentHistory
      .filter((entry) => {
        if (!entry || entry.pending) return false;
        const entryScope = typeof entry.scope === 'string' && entry.scope ? entry.scope : 'app';
        return entryScope === normalizedScope;
      })
      .map((entry) => ({
        prompt: trimAgentHistoryText(entry.prompt, AGENT_HISTORY_CONTEXT_MAX_PROMPT_CHARS),
        response: trimAgentHistoryText(entry.response, AGENT_HISTORY_CONTEXT_MAX_RESPONSE_CHARS)
      }))
      .filter((entry) => entry.prompt && entry.response);

    if (!completedEntries.length) return null;

    let turns = completedEntries
      .slice(-AGENT_HISTORY_CONTEXT_MAX_TURNS)
      .map((entry) => ({ user: entry.prompt, assistant: entry.response }));
    const olderEntries = completedEntries.slice(0, Math.max(0, completedEntries.length - turns.length));

    let summary = '';
    if (olderEntries.length) {
      const summaryLines = olderEntries
        .slice(-AGENT_HISTORY_CONTEXT_MAX_SUMMARY_ITEMS)
        .map(
          (entry, index) =>
            `${index + 1}. U: ${trimAgentHistoryText(entry.prompt, AGENT_HISTORY_CONTEXT_MAX_SUMMARY_ITEM_CHARS)} | A: ${trimAgentHistoryText(entry.response, AGENT_HISTORY_CONTEXT_MAX_SUMMARY_ITEM_CHARS)}`
        );
      summary = trimAgentHistoryText(
        `Frühere Unterhaltung (kompakt):\n${summaryLines.join('\n')}`,
        AGENT_HISTORY_CONTEXT_MAX_SUMMARY_CHARS
      );
    }

    while (
      estimateAgentHistoryContextChars(summary, turns) > AGENT_HISTORY_CONTEXT_MAX_TOTAL_CHARS &&
      turns.length > AGENT_HISTORY_CONTEXT_MIN_TURNS
    ) {
      turns = turns.slice(1);
    }

    if (estimateAgentHistoryContextChars(summary, turns) > AGENT_HISTORY_CONTEXT_MAX_TOTAL_CHARS) {
      summary = trimAgentHistoryText(summary, Math.floor(AGENT_HISTORY_CONTEXT_MAX_SUMMARY_CHARS * 0.6));
    }

    if (estimateAgentHistoryContextChars(summary, turns) > AGENT_HISTORY_CONTEXT_MAX_TOTAL_CHARS) {
      turns = turns.map((turn) => ({
        user: trimAgentHistoryText(turn.user, Math.floor(AGENT_HISTORY_CONTEXT_MAX_PROMPT_CHARS * 0.65)),
        assistant: trimAgentHistoryText(
          turn.assistant,
          Math.floor(AGENT_HISTORY_CONTEXT_MAX_RESPONSE_CHARS * 0.65)
        )
      }));
    }

    if (!summary && !turns.length) return null;
    return {
      summary,
      turns
    };
  };

  const resolveAgentHistoryPrompt = async (id, response, error = false) => {
    const text = (response || '').trim();
    if (!id || !text) return;
    const nextEntry = patchAgentHistoryEntry(id, {
      response: text,
      pending: false,
      error
    });
    if (!nextEntry) return;
    await scrollAgentHistoryToBottom();
  };

  const setAgentHistoryLogId = (id, logId) => {
    if (!id || !logId) return;
    patchAgentHistoryEntry(id, {
      logId: String(logId),
      ratingError: ''
    });
  };

  const toggleAgentHistoryFeedback = (id) => {
    patchAgentHistoryEntry(id, (entry) => ({
      feedbackOpen: !Boolean(entry?.feedbackOpen)
    }));
  };

  const setAgentHistoryRatingValue = (id, value) => {
    patchAgentHistoryEntry(id, {
      ratingValue: value,
      ratingSaved: false,
      ratingError: ''
    });
  };

  const setAgentHistoryRatingComment = (id, value) => {
    patchAgentHistoryEntry(id, {
      ratingComment: String(value ?? '').slice(0, 1200),
      ratingSaved: false,
      ratingError: ''
    });
  };

  const submitAgentHistoryFeedback = async (id) => {
    const entry = agentHistory.find((item) => item.id === id);
    if (!entry || entry.pending) return;
    if (!entry.logId) {
      patchAgentHistoryEntry(id, { ratingError: 'Log-ID fehlt. Bitte Anfrage erneut senden.' });
      return;
    }

    const rating = Number(entry.ratingValue);
    if (rating !== 1 && rating !== 0 && rating !== -1) {
      patchAgentHistoryEntry(id, {
        ratingError: 'Bitte zuerst positiv, teilweise oder negativ auswählen.'
      });
      return;
    }

    patchAgentHistoryEntry(id, {
      ratingSaving: true,
      ratingError: ''
    });

    try {
      const res = await apiFetch('agent_log', {
        method: 'PATCH',
        body: JSON.stringify({
          log_id: entry.logId,
          rating,
          comment: (entry.ratingComment || '').trim()
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        patchAgentHistoryEntry(id, {
          ratingSaving: false,
          ratingSaved: false,
          ratingError: payload?.warning || 'Bewertung konnte nicht gespeichert werden.'
        });
        return;
      }

      patchAgentHistoryEntry(id, {
        ratingSaving: false,
        ratingSaved: true,
        ratingError: '',
        ratingValue: Number(payload?.data?.rating ?? rating),
        ratingComment:
          typeof payload?.data?.comment === 'string'
            ? payload.data.comment
            : (entry.ratingComment || '').trim()
      });
    } catch (err) {
      patchAgentHistoryEntry(id, {
        ratingSaving: false,
        ratingSaved: false,
        ratingError: err?.message ?? 'Bewertung konnte nicht gespeichert werden.'
      });
    }
  };

  const resizeAgentInput = () => {
    if (!agentInputEl) return;
    agentInputEl.style.height = 'auto';
    const nextHeight = Math.min(Math.max(agentInputEl.scrollHeight, 34), 140);
    agentInputEl.style.height = `${nextHeight}px`;
  };

  const fitTextareaQueue = new Set();
  let fitTextareaFrame = null;

  const flushFitTextareaQueue = () => {
    fitTextareaFrame = null;
    const nodes = Array.from(fitTextareaQueue).filter((entry) => entry?.isConnected);
    fitTextareaQueue.clear();
    nodes.forEach((entry) => {
      entry.style.height = 'auto';
    });
    nodes.forEach((entry) => {
      entry.style.height = `${entry.scrollHeight}px`;
    });
  };

  const scheduleFitTextarea = (node) => {
    if (!node) return;
    fitTextareaQueue.add(node);
    if (fitTextareaFrame !== null) return;
    if (typeof requestAnimationFrame === 'function') {
      fitTextareaFrame = requestAnimationFrame(flushFitTextareaQueue);
      return;
    }
    fitTextareaFrame = window.setTimeout(flushFitTextareaQueue, 0);
  };

  const fitTextareaToContent = (node) => {
    const resizeSoon = () => {
      scheduleFitTextarea(node);
    };

    resizeSoon();
    node.addEventListener('input', resizeSoon);

    return {
      update: resizeSoon,
      destroy() {
        fitTextareaQueue.delete(node);
        node.removeEventListener('input', resizeSoon);
      }
    };
  };

  const isAgentHtmlEditableContext = (context) =>
    activeTab === 'editor' &&
    Boolean(selectedId) &&
    (context === 'html' || context === 'visual' || context === 'preview' || context === 'answers');

  const resolveAgentMemoryScope = () => {
    if (activeTab === 'editor') {
      if (selectedId) return `editor:sheet:${selectedId}`;
      return 'editor:list';
    }
    if (activeTab === 'collections') {
      if (selectedCollectionId) return `collections:collection:${selectedCollectionId}`;
      return 'collections:list';
    }
    if (activeTab === 'classes') {
      if (selectedClassId) return `classes:class:${selectedClassId}`;
      return 'classes:list';
    }
    if (activeTab === 'schools') {
      if (selectedSchoolId) return `schools:school:${selectedSchoolId}`;
      return 'schools:list';
    }
    if (activeTab === 'shop') return 'shop:list';
    if (activeTab === 'settings') return 'settings';
    return 'app';
  };

  const getAgentMemoryForScope = (scope) => agentScopeState.getMemory(scope);

  const setAgentMemoryForScope = (scope, memory) => {
    agentScopeState.setMemory(scope, memory);
    agentScopeVersion += 1;
  };

  const getAgentDraftForScope = (scope) => agentScopeState.getDraft(scope);

  const setAgentDraftForScope = (scope, draft) => {
    agentScopeState.setDraft(scope, draft);
    agentScopeVersion += 1;
    if (scope === resolveAgentMemoryScope()) {
      const latestDraft = agentScopeState.getDraft(scope);
      agentActiveDraft = latestDraft;
      if (hasOpenAgentDraft(latestDraft)) {
        agentDraftUiVisible = true;
      }
    }
  };

  $: agentActiveScope = resolveAgentMemoryScope();
  $: {
    agentScopeVersion;
    agentActiveDraft = getAgentDraftForScope(agentActiveScope);
  }
  $: agentDraftChangeItems = buildAgentDraftChangeItems(agentActiveDraft);

  const buildAgentVisibleItems = (context) => {
    if (context === 'visual') {
      const activeIndex = getClampedVisualActiveBlock(null);
      return [
        `Editor visuell (${visualBlocks.length} Blöcke)`,
        activeIndex === null ? 'Aktiver Block: keiner' : `Aktiver Block: ${activeIndex + 1}`,
        editorName ? `Sheet: ${editorName}` : 'Kein Sheetname'
      ];
    }
    if (context === 'html') {
      return [
        'Editor HTML',
        editorName ? `Sheet: ${editorName}` : 'Kein Sheetname',
        `Dokumentlänge: ${(editorContent ?? '').length}`
      ];
    }
    if (context === 'preview') {
      return [
        'Editor Preview',
        editorName ? `Sheet: ${editorName}` : 'Kein Sheetname',
        `Dokumentlänge: ${(editorContent ?? '').length}`
      ];
    }
    if (context === 'answers') {
      return [
        'Antwortansicht',
        answersClassId ? `Klassenfilter aktiv: ${answersClassId}` : 'Kein Klassenfilter',
        answersUserFilter ? `Lernendenfilter: ${answersUserFilter}` : 'Alle Antworten'
      ];
    }
    if (context === 'sheets') {
      return [
        `Sheet-Liste (${visibleSheets.length}/${sheets.length})`,
        'Sheet-Suche und Sortierung',
        selectedId ? `Ausgewähltes Sheet: ${selectedId}` : 'Kein Sheet geöffnet'
      ];
    }
    if (context === 'collections') {
      return [
        `Sammlungen (${visibleCollections.length}/${collections.length})`,
        selectedCollectionId
          ? `Sammlung geöffnet: ${selectedCollectionId}`
          : 'Keine Sammlung geöffnet',
        `${selectedCollectionEntries.length} zugeordnete Arbeitsblätter`
      ];
    }
    if (context === 'classes') {
      return [
        `Klassenliste (${visibleClasses.length}/${classes.length})`,
        selectedClassId ? `Klasse geöffnet: ${selectedClassId}` : 'Keine Klasse geöffnet',
        `Detailansicht: ${classDetailView}`
      ];
    }
    if (context === 'schools') {
      return [
        `Schulenliste (${schools.length})`,
        selectedSchoolId ? `Schule geöffnet: ${selectedSchoolId}` : 'Keine Schule geöffnet',
        schoolName ? `Schulname: ${schoolName}` : 'Kein Schulname'
      ];
    }
    if (context === 'shop') {
      return [
        `Bibliothek (${sheets.length})`,
        'Didaktische Filter mit K-Stufen',
        'Braintrade Materialtausch Mockup'
      ];
    }
    if (context === 'settings') {
      return [
        'CI-Einstellungen',
        adminCiSchoolId ? `Ausgewählte CI-Schule: ${adminCiSchoolId}` : 'Standard-CI aktiv'
      ];
    }
    return ['App-Navigation'];
  };

  const buildAgentContextDetails = (context) => ({
    context,
    label: describeAgentContext(context),
    visible: buildAgentVisibleItems(context)
  });

  const logAgentConversation = async ({
    prompt = '',
    response = '',
    status = '',
    context = 'app',
    source = 'navigation',
    error = false,
    changeDecision = 'none',
    modelIntent = null,
    navigation = null,
    action = '',
    agentResult = null,
    agentFlow = null
  } = {}) => {
    const normalizedPrompt = (prompt || '').trim();
    if (!normalizedPrompt) return '';
    try {
      const res = await apiFetch('agent_log', {
        method: 'POST',
        body: JSON.stringify({
          prompt: normalizedPrompt,
          response: (response || '').toString(),
          status: (status || '').toString(),
          context: buildAgentContextDetails(context || 'app'),
          source: (source || 'navigation').toString(),
          error: Boolean(error),
          change_decision: (changeDecision || 'none').toString(),
          outcome: error ? 'client_error' : 'client_success',
          model_intent:
            modelIntent && typeof modelIntent === 'object' ? modelIntent : null,
          navigation:
            navigation && typeof navigation === 'object' ? navigation : null,
          action: (action || '').toString(),
          agent_result:
            agentResult && typeof agentResult === 'object' ? agentResult : null,
          agent_flow:
            agentFlow && typeof agentFlow === 'object' ? agentFlow : null
        })
      });
      const payload = await readPayload(res);
      if (!res.ok) return '';
      return payload?.data?.log_id ? String(payload.data.log_id) : '';
    } catch {
      // Logging darf die Agent-Antwort nicht blockieren.
      return '';
    }
  };

  const runAgentNavigationIntent = async (prompt, memory, modelIntent = null) =>
    resolveAgentNavigationIntent({
      prompt,
      memory,
      modelIntent,
      getSheets: () => sheets,
      isLoadingSheets: () => loadingSheets,
      getClasses: () => classes,
      isLoadingClasses: () => loadingClasses,
      fetchClasses: async () => {
        await fetchClasses();
      },
      fetchLearnersByClass: async (classId) => fetchAgentLearnersByClass(classId),
      fetchAnswers: async ({ sheetKey = '', classId = null, user = '' } = {}) =>
        fetchAnswerEntries({ sheetKey, classId, user }),
      fetchPlansByClass: async (classId) => fetchAgentPlanByClass(classId),
      getActiveTab: () => activeTab,
      getSelectedId: () => selectedId,
      getEditorView: () => editorView,
      getContextDetails: () =>
        buildAgentContextDetails(resolveAgentContext({ activeTab, selectedId, editorView })),
      fetchSheets: async () => {
        await fetchSheets();
      },
      openSheet: async (sheet) => {
        if (!sheet?.id) return false;
        if (activeTab === 'editor' && selectedId && String(selectedId) !== String(sheet.id)) {
          const targetLabel = sheet?.name
            ? `Sheet "${sheet.name}"`
            : sheet?.key
            ? `Sheet "${sheet.key}"`
            : 'anderes Sheet';
          const canLeave = await maybeWarnAndSaveBeforeLeavingEditor(targetLabel);
          if (!canLeave) return false;
        }
        if (activeTab !== 'editor') {
          await switchTab('editor');
          if (activeTab !== 'editor') return false;
        }
        selectSheet(sheet.id);
        return true;
      },
      openClass: async (classEntry, view = 'details') => {
        if (!classEntry?.id) return false;
        if (activeTab !== 'classes') {
          await switchTab('classes');
          if (activeTab !== 'classes') return false;
        }
        const targetView =
          view === 'learners'
            ? 'learners'
            : view === 'assignments'
            ? 'assignments'
            : 'details';
        selectClass(classEntry.id, targetView);
        if (targetView === 'learners') {
          await openLearnersForClass(classEntry.id);
        } else if (targetView === 'assignments') {
          await openAssignmentsForClass(classEntry.id);
        }
        return true;
      },
      closeEditorToList: async () => {
        const targetTab = editorReturnTab === 'editor' ? 'collections' : editorReturnTab;
        const before = activeTab;
        await switchTab(targetTab);
        return activeTab === targetTab || before === targetTab;
      },
      setEditorView: (view) => {
        if (editorView === view) return false;
        editorView = view;
        return true;
      },
      switchTab: async (tab) => {
        const before = activeTab;
        await switchTab(tab);
        return activeTab === tab || before === tab;
      }
    });

  $: agentContext = resolveAgentContext({ activeTab, selectedId, editorView });
  const buildAgentContext = (context) => {
    const payload = {
      view: context,
      scope: 'document',
      contextLabel: describeAgentContext(context),
      visibleItems: buildAgentVisibleItems(context)
    };
    if (context === 'visual') {
      const targetIndex = getClampedVisualActiveBlock(0);
      const activeBlockHtml = visualBlocks[targetIndex] ?? '';
      payload.scope = 'block';
      payload.html = editorContent ?? '';
      payload.activeBlockIndex = targetIndex;
      payload.activeBlockView = visualBlockViews[targetIndex] === 'html' ? 'html' : 'visual';
      payload.activeBlockHtml = activeBlockHtml;
      payload.blockCount = visualBlocks.length;
      payload.documentLength = (editorContent ?? '').length;
      return payload;
    }
    if (context === 'html' || context === 'preview' || context === 'answers') {
      payload.html = editorContent ?? '';
      payload.documentLength = (editorContent ?? '').length;
      payload.selectedSheetId = selectedId ?? null;
      payload.selectedSheetKey = selectedKey ?? '';
      payload.selectedSheetName = editorName ?? '';
      return payload;
    }
    if (context === 'sheets') {
      payload.listCount = sheets.length;
      payload.filteredCount = visibleSheets.length;
      payload.selectedSheetId = selectedId ?? null;
      payload.selectedSheetKey = selectedKey ?? '';
      return payload;
    }
    if (context === 'collections') {
      payload.collectionCount = collections.length;
      payload.filteredCount = visibleCollections.length;
      payload.selectedCollectionId = selectedCollectionId ?? null;
      payload.selectedCollectionName = collectionName ?? '';
      payload.collectionSheetCount = selectedCollectionEntries.length;
      return payload;
    }
    if (context === 'classes') {
      payload.classCount = classes.length;
      payload.selectedClassId = selectedClassId ?? null;
      payload.classDetailView = classDetailView;
      return payload;
    }
    if (context === 'schools') {
      payload.schoolCount = schools.length;
      payload.selectedSchoolId = selectedSchoolId ?? null;
      payload.selectedSchoolName = schoolName ?? '';
      return payload;
    }
    if (context === 'shop') {
      payload.materialCount = sheets.length;
      payload.mockup = true;
      return payload;
    }
    if (context === 'settings') {
      payload.selectedCiSchoolId = adminCiSchoolId ?? '';
      payload.selectedCiLabel = ciLabel ?? '';
      return payload;
    }
    return payload;
  };

  const replaceVisualBlockAt = async (index, html, view = 'visual') => {
    flushVisualInputCommits();
    if (!visualBlocks.length) {
      await appendVisualBlock(html, view === 'html' ? 'html' : 'visual');
      return;
    }
    const clampedIndex = Math.max(0, Math.min(index, visualBlocks.length - 1));
    const nextValue = normalizeBlockContent(html);
    const nextView = view === 'html' ? 'html' : 'visual';
    if (
      (visualBlocks[clampedIndex] ?? '') === nextValue &&
      (visualBlockViews[clampedIndex] ?? 'visual') === nextView
    ) {
      return;
    }
    pushVisualHistorySnapshot();
    const nextBlocks = [...visualBlocks];
    nextBlocks[clampedIndex] = nextValue;
    visualBlocks = nextBlocks;
    const nextViews = [...visualBlockViews];
    nextViews[clampedIndex] = nextView;
    visualBlockViews = normalizeVisualBlockViews(nextViews, nextBlocks.length, nextBlocks);
    commitVisualBlocks();
    await tick();
    visualActiveBlock = clampedIndex;
  };

  const applyAgentInsertion = async (context, html, blockLevel = false, view = 'html') => {
    if (context === 'html') {
      await insertHtmlAtCursor(html);
      return 'inline';
    }

    const targetIndex = getClampedVisualActiveBlock(Math.max(visualBlocks.length - 1, 0));
    const normalizedHtml = (html || '').trim();
    const shouldInsertAsBlock =
      !visualBlocks.length || blockLevel || isBlockHtml(normalizedHtml);

    if (shouldInsertAsBlock) {
      if (!visualBlocks.length) {
        await appendVisualBlock(html, view === 'visual' ? 'visual' : 'html');
        return 'append';
      }
      const insertIndex = Math.min(Math.max(0, targetIndex + 1), visualBlocks.length);
      await insertVisualBlockAt(insertIndex, html, view === 'visual' ? 'visual' : 'html');
      return 'append';
    }

    if (visualBlockViews[targetIndex] === 'visual') {
      insertHtmlIntoVisualBlock(targetIndex, html);
    } else {
      await insertHtmlSelection(targetIndex, { prefix: html, suffix: '' });
    }
    return 'inline';
  };

  // Draft-Aktionen werden ausschliesslich über die Buttons ausgeführt.
  const isApplyDraftPrompt = () => false;
  const isConfirmDraftApplyPrompt = () => false;
  const isDiscardDraftPrompt = () => false;

  const applyAgentDraft = async ({ draft, context }) => {
    const draftApplyContext = context === 'visual' ? 'visual' : 'html';

    if (draft.mode === 'insert') {
      const applied = await applyAgentInsertion(
        draftApplyContext,
        draft.html,
        draft.blockLevel,
        draft.view
      );
      return {
        ok: true,
        status:
          applied === 'append'
            ? draftApplyContext === 'visual'
              ? 'Vorschlag als neuer Block unter dem aktiven Block angewendet.'
              : 'Vorschlag als neuer Block angewendet.'
            : 'Vorschlag eingefügt.',
        message: draft.message || '',
        details: {
          mode: 'insert',
          applied,
          context: draftApplyContext
        }
      };
    }

    if (draftApplyContext === 'visual') {
      const targetIndex = getClampedVisualActiveBlock(0);
      await replaceVisualBlockAt(targetIndex, draft.html, draft.view);
      return {
        ok: true,
        status: 'Vorschlag auf aktiven Block angewendet.',
        message: draft.message || '',
        details: {
          mode: 'replace',
          target: 'visual_block',
          index: targetIndex
        }
      };
    }

    editorContent = draft.html;
    return {
      ok: true,
      status: 'Vorschlag auf Dokument angewendet.',
      message: draft.message || '',
      details: {
        mode: 'replace',
        target: 'editor_document'
      }
    };
  };

  const hasOpenAgentDraft = (draft) =>
    Boolean(draft?.mode && typeof draft?.html === 'string' && draft.html.length);

  const buildAgentDraftPreview = (html, maxChars = 200) => {
    const text = stripHtml(html || '').replace(/\s+/g, ' ').trim();
    if (!text) return 'Kein Textinhalt (nur Struktur/HTML).';
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}…`;
  };

  const resolveAgentDraftTargetLabel = (draft) => {
    const draftContext = draft?.context === 'visual' ? 'visual' : 'html';
    if (draft?.mode === 'insert') {
      if (draftContext === 'visual') {
        if (!visualBlocks.length || draft?.blockLevel) return 'Neuer Block im visuellen Editor';
        const index = getClampedVisualActiveBlock(null);
        if (index === null) return 'Kein aktiver visueller Block';
        return `Aktiver visueller Block #${index + 1}`;
      }
      return 'Cursorposition im HTML-Editor';
    }

    if (draftContext === 'visual') {
      const index = getClampedVisualActiveBlock(null);
      if (index === null) return 'Kein aktiver Block';
      return `Aktiver Block #${index + 1}`;
    }
    return 'Gesamtes Dokument im HTML-Editor';
  };

  const resolveAgentDraftCurrentHtml = (draft) => {
    if (!draft || draft.mode !== 'replace') return '';
    const draftContext = draft.context === 'visual' ? 'visual' : 'html';
    if (draftContext === 'visual') {
      const index = getClampedVisualActiveBlock(null);
      if (index === null) return '';
      return visualBlocks[index] ?? '';
    }
    return editorContent ?? '';
  };

  const buildAgentDraftChangeItems = (draft) => {
    if (!hasOpenAgentDraft(draft)) return [];

    const items = [];
    items.push(`Aktion: ${draft.mode === 'insert' ? 'Einfügen' : 'Ersetzen'}`);
    items.push(`Ziel: ${resolveAgentDraftTargetLabel(draft)}`);

    const nextLength = (draft.html || '').length;
    if (draft.mode === 'replace') {
      const currentHtml = resolveAgentDraftCurrentHtml(draft);
      const currentLength = (currentHtml || '').length;
      const delta = nextLength - currentLength;
      const deltaLabel = delta === 0 ? '0' : delta > 0 ? `+${delta}` : `${delta}`;
      items.push(`Umfang: ${currentLength} -> ${nextLength} Zeichen (${deltaLabel})`);
      if (currentHtml === draft.html) {
        items.push('Hinweis: Vorschlag entspricht bereits dem aktuellen Inhalt.');
      }
    } else {
      items.push(`Umfang: +${nextLength} Zeichen`);
    }

    if (draft.message) {
      const compactMessage = draft.message.replace(/\s+/g, ' ').trim();
      if (compactMessage) {
        const messagePreview =
          compactMessage.length > 220 ? `${compactMessage.slice(0, 220)}…` : compactMessage;
        items.push(`Agent-Hinweis: ${messagePreview}`);
      }
    }

    items.push(`Vorschau: ${buildAgentDraftPreview(draft.html, 200)}`);
    return items;
  };

  const agentProvider = createDefaultAgentProvider({
    apiFetch: (path, options = {}) => apiFetch(path, options),
    readPayload: (res) => readPayload(res),
    resolveNavigation: ({ prompt, memory, modelIntent }) =>
      runAgentNavigationIntent(prompt, memory, modelIntent),
    buildContextDetails: (context) => buildAgentContextDetails(context),
    buildAgentContextPayload: (context) => buildAgentContext(context),
    isApplyDraftPrompt,
    isConfirmDraftApplyPrompt,
    isDiscardDraftPrompt,
    canEditContext: (context) => isAgentHtmlEditableContext(context),
    applyDraft: ({ draft, context }) => applyAgentDraft({ draft, context })
  });

  const agentConversation = createAgentConversation({
    runTurn: (request) => agentProvider.runTurn(request),
    appendHistoryPrompt: (prompt, scope) => appendAgentHistoryPrompt(prompt, scope),
    resolveHistoryPrompt: (id, response, error = false) =>
      resolveAgentHistoryPrompt(id, response, error),
    setHistoryLogId: (id, logId) => setAgentHistoryLogId(id, logId),
    logConversation: (payload) => logAgentConversation(payload),
    resolveScope: () => resolveAgentMemoryScope(),
    buildHistoryContext: (scope) => buildAgentHistoryContext(scope),
    getMemoryForScope: (scope) => getAgentMemoryForScope(scope),
    setMemoryForScope: (scope, memory) => setAgentMemoryForScope(scope, memory),
    getDraftForScope: (scope) => getAgentDraftForScope(scope),
    setDraftForScope: (scope, draft) => setAgentDraftForScope(scope, draft)
  });

  const applyAgentPrompt = async (
    context = agentContext,
    promptOverride = '',
    pendingStatus = 'Agent arbeitet…'
  ) => {
    const prompt = (promptOverride || agentPrompt || '').trim();
    agentStatus = '';
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

    const promptText = prompt;
    const currentContext = context || agentContext;
    if (!promptOverride) {
      agentPrompt = '';
      resizeAgentInput();
    }
    agentPending = true;
    agentStatus = pendingStatus || 'Agent arbeitet…';

    try {
      const result = await agentConversation.runPrompt({
        prompt: promptText,
        context: currentContext,
        selectedSheetId: selectedId ?? null
      });
      const latestDraft = getAgentDraftForScope(resolveAgentMemoryScope());
      agentActiveDraft = latestDraft;
      if (hasOpenAgentDraft(latestDraft)) {
        agentDraftUiVisible = true;
      } else if (result?.action === 'insert_html' || result?.action === 'replace_html') {
        agentDraftUiVisible = true;
      } else if (result?.action === 'draft_apply' || result?.action === 'draft_discard') {
        agentDraftUiVisible = false;
      }
      agentStatus = result.displayStatus || '';
    } catch (err) {
      agentStatus = err?.message ?? 'Agent-Aufruf fehlgeschlagen';
    } finally {
      agentPending = false;
    }
  };

  const triggerAgentDraftAction = async (action) => {
    if (agentPending) return;
    let draft = agentActiveDraft;
    if (!hasOpenAgentDraft(draft)) {
      const latestDraft = getAgentDraftForScope(resolveAgentMemoryScope());
      if (hasOpenAgentDraft(latestDraft)) {
        draft = latestDraft;
        agentActiveDraft = latestDraft;
      }
    }
    if (!hasOpenAgentDraft(draft)) {
      agentStatus = 'Kein offener Vorschlag vorhanden.';
      agentDraftUiVisible = false;
      return;
    }
    const draftContext = draft?.context === 'visual' ? 'visual' : 'html';

    if (action === 'discard') {
      setAgentDraftForScope(agentActiveScope, createEmptyAgentDraft());
      agentStatus = 'Vorschlag verworfen.';
      agentDraftUiVisible = false;
      return;
    }

    if (
      draft?.selectedSheetId !== null &&
      draft?.selectedSheetId !== undefined &&
      String(draft.selectedSheetId) !== String(selectedId ?? '')
    ) {
      agentStatus =
        'Vorschlag gehört zu einem anderen Sheet. Bitte öffne das gleiche Sheet wie bei der Vorschlagserstellung.';
      return;
    }

    if (!isAgentHtmlEditableContext(draftContext)) {
      agentStatus = 'Vorschlag kann hier nicht angewendet werden. Bitte öffne ein Sheet im Editor.';
      return;
    }

    agentPending = true;
    agentStatus = 'Vorschlag wird angewendet…';
    try {
      const applied = await applyAgentDraft({
        draft,
        context: draftContext
      });
      if (!applied.ok) {
        agentStatus = applied.status || 'Vorschlag konnte nicht angewendet werden.';
        return;
      }
      setAgentDraftForScope(agentActiveScope, createEmptyAgentDraft());
      agentStatus = applied.status || 'Vorschlag angewendet.';
      agentDraftUiVisible = false;
    } catch (err) {
      agentStatus = err?.message ?? 'Vorschlag konnte nicht angewendet werden.';
    } finally {
      agentPending = false;
    }
  };

  const handleAgentKeydown = (event, context) => {
    if (event?.key !== 'Enter' || agentPending) return;
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    applyAgentPrompt(context || agentContext);
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

  const isLueckeGapNode = (node) =>
    node instanceof HTMLElement && node.tagName?.toLowerCase() === 'luecke-gap';

  const isLineBreakNode = (node) =>
    node instanceof HTMLElement && node.tagName?.toLowerCase() === 'br';

  const isVisualAtomicNode = (node) => isLueckeGapNode(node) || isLineBreakNode(node);

  const getNodeElement = (node) =>
    node instanceof Element ? node : node?.parentElement || null;

  const getClosestLueckeGap = (node, root = null) => {
    const element = getNodeElement(node);
    const gap = element?.closest?.('luecke-gap') || null;
    if (!gap || (root && !root.contains(gap))) return null;
    return gap;
  };

  const getVisualTextLength = (text = '') =>
    stripVisualTerminalCaretText(text).length;

  const getVisualTextOffset = (text = '', offset = 0) =>
    getVisualTextLength(String(text || '').slice(0, Math.max(0, offset || 0)));

  const getRawVisualTextOffset = (text = '', visibleOffset = 0) => {
    const source = String(text || '');
    const targetOffset = Math.max(0, visibleOffset || 0);
    let rawOffset = 0;
    let visibleCount = 0;
    while (rawOffset < source.length) {
      if (source[rawOffset] === VISUAL_TERMINAL_CARET_TEXT) {
        rawOffset += 1;
        continue;
      }
      if (visibleCount >= targetOffset) break;
      visibleCount += 1;
      rawOffset += 1;
    }
    return rawOffset;
  };

  const hasVisibleVisualContent = (node) => {
    if (!node) return false;
    if (isVisualAtomicNode(node)) return true;
    if (node.nodeType === Node.TEXT_NODE) {
      return getVisualTextLength(node.textContent || '') > 0;
    }
    return Array.from(node.childNodes || []).some((child) => hasVisibleVisualContent(child));
  };

  const hasVisibleVisualContentAfterNode = (node, root) => {
    let current = node;
    while (current && current !== root) {
      let sibling = current.nextSibling;
      while (sibling) {
        if (hasVisibleVisualContent(sibling)) return true;
        sibling = sibling.nextSibling;
      }
      current = current.parentNode;
    }
    return false;
  };

  const getLastVisibleVisualContentNode = (root) => {
    if (!root) return null;
    const findLast = (node) => {
      if (!node) return null;
      if (node !== root && isVisualAtomicNode(node)) return node;
      if (node.nodeType === Node.TEXT_NODE) {
        return getVisualTextLength(node.textContent || '') > 0 ? node : null;
      }
      const children = Array.from(node.childNodes || []);
      for (let idx = children.length - 1; idx >= 0; idx -= 1) {
        const match = findLast(children[idx]);
        if (match) return match;
      }
      return null;
    };
    return findLast(root);
  };

  const getTerminalLueckeGap = (root) => {
    const last = getLastVisibleVisualContentNode(root);
    return isLueckeGapNode(last) ? last : null;
  };

  const ensureTerminalCaretTextInEditor = (editorEl) => {
    const terminalGap = getTerminalLueckeGap(editorEl);
    return terminalGap ? ensureTerminalCaretTextAfterNode(terminalGap, editorEl) : null;
  };

  const ensureTerminalCaretTextAfterNode = (node, root) => {
    if (!browser || !node?.parentNode || !root?.contains?.(node)) return null;
    if (hasVisibleVisualContentAfterNode(node, root)) return null;
    const next = node.nextSibling;
    if (next?.nodeType === Node.TEXT_NODE) {
      if (!String(next.textContent || '').includes(VISUAL_TERMINAL_CARET_TEXT)) {
        next.textContent = `${VISUAL_TERMINAL_CARET_TEXT}${next.textContent || ''}`;
      }
      return next;
    }
    const textNode = document.createTextNode(VISUAL_TERMINAL_CARET_TEXT);
    node.parentNode.insertBefore(textNode, next || null);
    return textNode;
  };

  const getBoundaryAfterVisualAtomicNode = (node, root) => {
    const terminalText = ensureTerminalCaretTextAfterNode(node, root);
    if (terminalText) {
      return {
        node: terminalText,
        offset: (terminalText.textContent || '').length
      };
    }
    return getBoundaryAfterNode(node);
  };

  const focusEditableElement = (el) => {
    if (!el?.focus) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  };

  const setVisualCaretAroundGap = (index, gapElement, side = 'after') => {
    const editorEl = visualBlockEditors[index];
    if (!editorEl || !gapElement || !editorEl.contains(gapElement)) return false;
    const selection = window?.getSelection ? window.getSelection() : null;
    if (!selection) return false;

    focusEditableElement(editorEl);
    const range = document.createRange();
    const boundary =
      side === 'before'
        ? getBoundaryBeforeNode(gapElement)
        : getBoundaryAfterVisualAtomicNode(gapElement, editorEl);
    range.setStart(boundary.node, boundary.offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    const gapStart = getVisualRangeOffset(
      editorEl,
      gapElement.parentNode || editorEl,
      getNodeIndex(gapElement)
    );
    const caretOffset = side === 'before' ? gapStart : gapStart + getVisualUnitLength(gapElement);
    visualBlockSelections[index] = { start: caretOffset, end: caretOffset };
    return true;
  };

  const getGapCaretSideFromPoint = (gapElement, event) => {
    const rect = gapElement?.getBoundingClientRect?.();
    if (!rect || !Number.isFinite(event?.clientX)) return 'after';
    return event.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
  };

  const getCaretRangeFromPoint = (event) => {
    if (!browser || typeof document === 'undefined') return null;
    const x = event?.clientX;
    const y = event?.clientY;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (typeof document.caretRangeFromPoint === 'function') {
      return document.caretRangeFromPoint(x, y);
    }
    if (typeof document.caretPositionFromPoint === 'function') {
      const position = document.caretPositionFromPoint(x, y);
      if (!position) return null;
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
    return null;
  };

  const getLueckeGapAtPoint = (editorEl, event) => {
    if (!editorEl || !Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) {
      return null;
    }

    let candidate = null;
    Array.from(editorEl.querySelectorAll('luecke-gap')).forEach((gap) => {
      const rects = Array.from(gap.getClientRects?.() || []);
      rects.forEach((rect) => {
        const insideX = event.clientX >= rect.left && event.clientX <= rect.right;
        const insideY = event.clientY >= rect.top - 3 && event.clientY <= rect.bottom + 3;
        if (!insideX || !insideY) return;
        const area = rect.width * rect.height;
        if (!candidate || area < candidate.area) {
          candidate = {
            gap,
            area,
            side: event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
          };
        }
      });
    });

    return candidate;
  };

  const getTerminalGapBeforePoint = (editorEl, event) => {
    if (!editorEl || !Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) {
      return null;
    }

    let candidate = null;
    Array.from(editorEl.querySelectorAll('luecke-gap')).forEach((gap) => {
      const rects = Array.from(gap.getClientRects?.() || []);
      rects.forEach((rect) => {
        const sameLine = event.clientY >= rect.top - 3 && event.clientY <= rect.bottom + 3;
        const afterGap = event.clientX >= rect.right - 1;
        if (!sameLine || !afterGap) return;
        if (!candidate || rect.right > candidate.rect.right) {
          candidate = { gap, rect };
        }
      });
    });

    if (!candidate) {
      const terminalGap = getTerminalLueckeGap(editorEl);
      const terminalRects = Array.from(terminalGap?.getClientRects?.() || []);
      const terminalRect = terminalRects[terminalRects.length - 1];
      const editorRect = editorEl.getBoundingClientRect?.();
      const insideEditor =
        editorRect &&
        event.clientX >= editorRect.left &&
        event.clientX <= editorRect.right &&
        event.clientY >= editorRect.top &&
        event.clientY <= editorRect.bottom;
      if (terminalGap && terminalRect && insideEditor && event.clientY > terminalRect.bottom) {
        return terminalGap;
      }
      return null;
    }

    const pointRange = getCaretRangeFromPoint(event);
    if (
      pointRange &&
      editorEl.contains(pointRange.startContainer) &&
      pointRange.startContainer.nodeType === Node.TEXT_NODE &&
      !getClosestLueckeGap(pointRange.startContainer, editorEl)
    ) {
      const pointOffset = getVisualRangeOffset(
        editorEl,
        pointRange.startContainer,
        pointRange.startOffset
      );
      const gapEndOffset =
        getVisualRangeOffset(
          editorEl,
          candidate.gap.parentNode || editorEl,
          getNodeIndex(candidate.gap)
        ) + getVisualUnitLength(candidate.gap);
      if (pointOffset > gapEndOffset) return null;
    }

    return candidate.gap;
  };

  const placeVisualCaretAroundGapFromEvent = async (
    index,
    gapElement,
    event,
    sideOverride = null
  ) => {
    if (!gapElement) return false;
    const editorEl = visualBlockEditors[index];
    const gapIndex = Array.from(editorEl?.querySelectorAll('luecke-gap') || []).indexOf(
      gapElement
    );
    const side = sideOverride || getGapCaretSideFromPoint(gapElement, event);
    const activationView = 'visual';
    if (visualBlockViews[index] !== activationView) setVisualBlockView(index, activationView);
    activateVisualBlock(index);
    await tick();

    const nextGaps = Array.from(visualBlockEditors[index]?.querySelectorAll('luecke-gap') || []);
    const nextGap = (gapIndex >= 0 ? nextGaps[gapIndex] : null) || gapElement;
    return setVisualCaretAroundGap(index, nextGap, side);
  };

  const getVisualUnitLength = (node) => {
    if (!node) return 0;
    if (isLueckeGapNode(node)) return 1;
    if (isLineBreakNode(node)) return 1;
    if (node.nodeType === Node.TEXT_NODE) return getVisualTextLength(node.textContent || '');
    return Array.from(node.childNodes || []).reduce(
      (total, child) => total + getVisualUnitLength(child),
      0
    );
  };

  const getVisualRangeOffset = (el, container, offset) => {
    if (!el || !container) return 0;
    let total = 0;
    let found = false;
    const boundaryOffset = Math.max(0, Number(offset) || 0);

    const addChildrenBeforeOffset = (node, childOffset) => {
      const children = Array.from(node.childNodes || []);
      const limit = Math.min(Math.max(0, childOffset), children.length);
      for (let idx = 0; idx < limit; idx += 1) {
        total += getVisualUnitLength(children[idx]);
      }
    };

    const getContainedAtomicOffset = (atomicNode, childContainer, childOffset) => {
      if (atomicNode === childContainer) return childOffset > 0 ? 1 : 0;
      if (!atomicNode.contains?.(childContainer)) return 1;
      if (childContainer.nodeType === Node.TEXT_NODE) {
        const text = childContainer.textContent || '';
        const textLength = getVisualTextLength(text);
        const textOffset = Math.min(getVisualTextOffset(text, childOffset), textLength);
        return textOffset > textLength / 2 ? 1 : 0;
      }
      return childOffset > 0 ? 1 : 0;
    };

    const visit = (node) => {
      if (!node || found) return;

      if (node === container) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          total += Math.min(getVisualTextOffset(text, boundaryOffset), getVisualTextLength(text));
        } else if (isLueckeGapNode(node) || isLineBreakNode(node)) {
          total += boundaryOffset > 0 ? 1 : 0;
        } else {
          addChildrenBeforeOffset(node, boundaryOffset);
        }
        found = true;
        return;
      }

      if (node !== el && isVisualAtomicNode(node)) {
        total += node.contains?.(container)
          ? getContainedAtomicOffset(node, container, boundaryOffset)
          : 1;
        if (node.contains?.(container)) found = true;
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        total += getVisualTextLength(node.textContent || '');
        return;
      }

      Array.from(node.childNodes || []).some((child) => {
        visit(child);
        return found;
      });
    };

    visit(el);
    return total;
  };

  const getVisualSelectionOffsets = (el) => {
    const selection = window?.getSelection ? window.getSelection() : null;
    if (!el || !selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return null;
    const start = getVisualRangeOffset(el, range.startContainer, range.startOffset);
    const end = getVisualRangeOffset(el, range.endContainer, range.endOffset);
    return { start, end };
  };

  const getNodeIndex = (node) =>
    node?.parentNode ? Array.prototype.indexOf.call(node.parentNode.childNodes, node) : 0;

  const getBoundaryBeforeNode = (node) => ({
    node: node.parentNode || node,
    offset: getNodeIndex(node)
  });

  const getBoundaryAfterNode = (node) => ({
    node: node.parentNode || node,
    offset: getNodeIndex(node) + 1
  });

  const getCurrentVisualSelectionRange = (editorEl) => {
    const selection = window?.getSelection ? window.getSelection() : null;
    if (!editorEl || !selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!editorEl.contains(range.commonAncestorContainer)) return null;
    return range.cloneRange();
  };

  const getLueckeGapFromRange = (range, editorEl) => {
    if (!range || !editorEl) return null;
    return (
      getClosestLueckeGap(range.startContainer, editorEl) ||
      getClosestLueckeGap(range.endContainer, editorEl)
    );
  };

  const getLueckeGapSelectionSide = (gap, range, fallback = 'after') => {
    if (!gap || !range?.collapsed) return fallback;
    const container = range.startContainer;
    const offset = Math.max(0, Number(range.startOffset) || 0);
    if (container === gap) {
      return offset > (gap.childNodes?.length || 0) / 2 ? 'after' : 'before';
    }
    if (container.nodeType === Node.TEXT_NODE) {
      const text = container.textContent || '';
      return getVisualTextOffset(text, offset) > getVisualTextLength(text) / 2
        ? 'after'
        : 'before';
    }
    if (gap.contains?.(container)) {
      const innerOffset = getVisualRangeOffset(gap, container, offset);
      return innerOffset > getVisualTextLength(gap.textContent || '') / 2 ? 'after' : 'before';
    }
    return fallback;
  };

  const moveVisualRangeOutsideLueckeGap = (index, range, fallbackSide = 'after') => {
    const editorEl = visualBlockEditors[index];
    const gap = getLueckeGapFromRange(range, editorEl);
    if (!gap) return false;
    const side = getLueckeGapSelectionSide(gap, range, fallbackSide);
    return setVisualCaretAroundGap(index, gap, side);
  };

  const normalizeVisualSelectionOutsideLueckeGap = (index, fallbackSide = 'after') => {
    const editorEl = visualBlockEditors[index];
    const range = getCurrentVisualSelectionRange(editorEl);
    if (!range) return false;
    return moveVisualRangeOutsideLueckeGap(index, range, fallbackSide);
  };

  const handleVisualSelectionChange = (index) => {
    if (normalizeVisualSelectionOutsideLueckeGap(index)) return;
    captureVisualSelection(index);
  };

  const resolveOffsetInElement = (el, offset) => {
    const targetOffset = Math.max(0, offset || 0);

    const getNodeEndBoundary = (node) => {
      if (!node) return { node: el, offset: el.childNodes.length };
      if (node !== el && isVisualAtomicNode(node)) {
        return getBoundaryAfterVisualAtomicNode(node, el);
      }
      if (node.nodeType === Node.TEXT_NODE) {
        return { node, offset: (node.textContent || '').length };
      }

      const children = Array.from(node.childNodes || []);
      if (!children.length) return { node, offset: 0 };
      return getNodeEndBoundary(children[children.length - 1]) || {
        node,
        offset: children.length
      };
    };

    const resolve = (node, nodeOffset) => {
      if (!node) return { node: el, offset: el.childNodes.length };

      if (node !== el && isVisualAtomicNode(node)) {
        return nodeOffset <= 0
          ? getBoundaryBeforeNode(node)
          : getBoundaryAfterVisualAtomicNode(node, el);
      }

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const length = getVisualTextLength(text);
        const visibleOffset = Math.min(Math.max(0, nodeOffset), length);
        return { node, offset: getRawVisualTextOffset(text, visibleOffset) };
      }

      const children = Array.from(node.childNodes || []);
      let consumed = 0;

      for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
        const child = children[childIndex];
        const childLength = getVisualUnitLength(child);
        const nextConsumed = consumed + childLength;

        if (nodeOffset < nextConsumed) {
          return resolve(child, nodeOffset - consumed);
        }

        if (nodeOffset === nextConsumed) {
          if (isVisualAtomicNode(child)) {
            return getBoundaryAfterVisualAtomicNode(child, el);
          }
          if (isVisualAtomicNode(children[childIndex + 1])) {
            return { node, offset: childIndex + 1 };
          }
          return getNodeEndBoundary(child);
        }

        consumed = nextConsumed;
      }

      return { node, offset: children.length };
    };

    return resolve(el, targetOffset);
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

  let visualSelectionCaptureFrame = null;
  const visualSelectionCaptureIndexes = new Set();

  const captureVisualSelection = (index) => {
    const el = visualBlockEditors[index];
    const offsets = getVisualSelectionOffsets(el);
    if (!offsets) return;
    visualBlockSelections[index] = offsets;
  };

  const flushVisualSelectionCapture = () => {
    visualSelectionCaptureFrame = null;
    const indexes = Array.from(visualSelectionCaptureIndexes);
    visualSelectionCaptureIndexes.clear();
    indexes.forEach((index) => handleVisualSelectionChange(index));
  };

  const scheduleVisualSelectionCapture = (index) => {
    if (!Number.isInteger(index)) return;
    visualSelectionCaptureIndexes.add(index);
    if (visualSelectionCaptureFrame !== null) return;
    if (typeof requestAnimationFrame === 'function') {
      visualSelectionCaptureFrame = requestAnimationFrame(flushVisualSelectionCapture);
    } else {
      visualSelectionCaptureFrame = window.setTimeout(flushVisualSelectionCapture, 0);
    }
  };

  const isLineBreakInputEvent = (event) => {
    const inputType = (event?.inputType || '').toLowerCase();
    return inputType === 'insertparagraph' || inputType === 'insertlinebreak';
  };

  const isGapDeleteEvent = (event) => {
    const inputType = (event?.inputType || '').toLowerCase();
    return inputType.startsWith('delete') || event?.key === 'Backspace' || event?.key === 'Delete';
  };

  const getGapDeleteDirection = (event) => {
    const inputType = (event?.inputType || '').toLowerCase();
    if (inputType.includes('forward') || event?.key === 'Delete') return 'forward';
    return 'backward';
  };

  const getRangeFromInputEvent = (event, editorEl) => {
    if (typeof event?.getTargetRanges === 'function') {
      const targetRange = event.getTargetRanges()?.[0];
      if (targetRange) {
        const range = document.createRange();
        range.setStart(targetRange.startContainer, targetRange.startOffset);
        range.setEnd(targetRange.endContainer, targetRange.endOffset);
        if (editorEl.contains(range.commonAncestorContainer)) return range;
      }
    }

    const selection = window?.getSelection ? window.getSelection() : null;
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!editorEl.contains(range.commonAncestorContainer)) return null;
    return range.cloneRange();
  };

  const getDeepestBoundaryNode = (node, direction) => {
    let current = node;
    while (current?.childNodes?.length) {
      current =
        direction === 'backward'
          ? current.childNodes[current.childNodes.length - 1]
          : current.childNodes[0];
    }
    return current;
  };

  const getSiblingBoundaryNode = (node, root, direction) => {
    if (!node || node === root) return null;
    if (direction === 'backward') {
      if (node.previousSibling) return getDeepestBoundaryNode(node.previousSibling, direction);
      return node.parentNode && node.parentNode !== root ? node.parentNode : null;
    }

    if (node.nextSibling) return getDeepestBoundaryNode(node.nextSibling, direction);
    let current = node;
    while (current && current !== root) {
      if (current.nextSibling) return getDeepestBoundaryNode(current.nextSibling, direction);
      current = current.parentNode;
    }
    return null;
  };

  const getNodeBesideCollapsedRange = (range, root, direction) => {
    const container = range.startContainer;
    const offset = range.startOffset;

    if (container.nodeType === Node.TEXT_NODE) {
      const text = container.textContent || '';
      const textLength = getVisualTextLength(text);
      const textOffset = getVisualTextOffset(text, offset);
      if (direction === 'backward') {
        if (textOffset > 0) return null;
        return getSiblingBoundaryNode(container, root, direction);
      }
      if (textOffset < textLength) return null;
      return getSiblingBoundaryNode(container, root, direction);
    }

    const children = container.childNodes || [];
    if (direction === 'backward') {
      const child = children[offset - 1];
      if (child) return getDeepestBoundaryNode(child, direction);
      return getSiblingBoundaryNode(container, root, direction);
    }

    const child = children[offset];
    if (child) return getDeepestBoundaryNode(child, direction);
    return getSiblingBoundaryNode(container, root, direction);
  };

  const getAdjacentLueckeGap = (range, editorEl, direction) => {
    const currentGap = getClosestLueckeGap(range.startContainer, editorEl);
    if (currentGap) return currentGap;

    let candidate = getNodeBesideCollapsedRange(range, editorEl, direction);
    while (candidate && candidate !== editorEl) {
      const gap = getClosestLueckeGap(candidate, editorEl);
      if (gap) return gap;
      if (candidate.nodeType === Node.TEXT_NODE && (candidate.textContent || '').length > 0) {
        return null;
      }
      if (candidate.nodeType === Node.ELEMENT_NODE) {
        return null;
      }
      candidate = getSiblingBoundaryNode(candidate, editorEl, direction);
    }
    return null;
  };

  const getCurrentCollapsedSelectionRange = (editorEl) => {
    const selection = window?.getSelection ? window.getSelection() : null;
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!range.collapsed || !editorEl.contains(range.commonAncestorContainer)) return null;
    return range.cloneRange();
  };

  const getAdjacentLineBreak = (range, editorEl, direction) => {
    if (!range?.collapsed) return null;
    let candidate = getNodeBesideCollapsedRange(range, editorEl, direction);
    while (candidate && candidate !== editorEl) {
      if (isLineBreakNode(candidate)) return candidate;
      if (getClosestLueckeGap(candidate, editorEl)) return null;
      if (candidate.nodeType === Node.TEXT_NODE) {
        if ((candidate.textContent || '').length > 0) return null;
      } else if (candidate.nodeType === Node.ELEMENT_NODE) {
        return null;
      }
      candidate = getSiblingBoundaryNode(candidate, editorEl, direction);
    }
    return null;
  };

  const getLueckeGapsIntersectingRange = (editorEl, range) =>
    Array.from(editorEl.querySelectorAll('luecke-gap')).filter((gap) => {
      try {
        return range.intersectsNode(gap);
      } catch (err) {
        return false;
      }
    });

  const uniqueLueckeGaps = (gaps = []) =>
    Array.from(new Set(gaps.filter((gap) => gap && gap instanceof HTMLElement)));

  const getLueckeDeleteLabel = (gap) => {
    const name = (gap?.getAttribute?.('name') || '').trim();
    const solution = truncateEditorLabel(gap?.textContent || '', 28);
    if (name && solution) return `Lücke "${name}" (${solution})`;
    if (name) return `Lücke "${name}"`;
    return 'Lücke';
  };

  const confirmDeleteLueckeGaps = (gaps = []) => {
    const uniqueGaps = uniqueLueckeGaps(gaps);
    if (!uniqueGaps.length || !browser) return true;
    if (uniqueGaps.length === 1) {
      return window.confirm(`${getLueckeDeleteLabel(uniqueGaps[0])} wirklich vollständig löschen?`);
    }
    return window.confirm(`${uniqueGaps.length} Lücken wirklich vollständig löschen?`);
  };

  const LUECKE_GAP_HTML_PATTERN =
    /<\s*luecke-gap\b[^>]*(?:\/\s*>|>[\s\S]*?<\s*\/\s*luecke-gap\s*>)/gi;

  const getLueckeDeleteLabelFromHtml = (html = '') => {
    const { container } = parseHtmlFragment(html);
    const gap = container?.querySelector?.('luecke-gap');
    return gap ? getLueckeDeleteLabel(gap) : 'Lücke';
  };

  const listLueckeGapRangesInText = (value = '') =>
    Array.from(String(value || '').matchAll(LUECKE_GAP_HTML_PATTERN)).map((match) => {
      const html = match[0] || '';
      const start = match.index ?? 0;
      return {
        start,
        end: start + html.length,
        html,
        label: getLueckeDeleteLabelFromHtml(html)
      };
    });

  const getLueckeGapRangesForTextDeletion = (value, start, end, direction) => {
    const ranges = listLueckeGapRangesInText(value);
    if (start === end) {
      return ranges.filter((range) =>
        direction === 'forward'
          ? start >= range.start && start < range.end
          : start > range.start && start <= range.end
      );
    }
    return ranges.filter((range) => start < range.end && end > range.start);
  };

  const confirmDeleteLueckeGapRanges = (ranges = []) => {
    if (!ranges.length || !browser) return true;
    if (ranges.length === 1) {
      return window.confirm(`${ranges[0].label} wirklich vollständig löschen?`);
    }
    return window.confirm(`${ranges.length} Lücken wirklich vollständig löschen?`);
  };

  const handleHtmlTextareaGapDelete = async (event, value, applyValue) => {
    if (!isGapDeleteEvent(event)) return false;
    const textarea = event?.currentTarget;
    if (!(textarea instanceof HTMLTextAreaElement)) return false;
    const start = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : 0;
    const end = Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : start;
    const direction = getGapDeleteDirection(event);
    const ranges = getLueckeGapRangesForTextDeletion(value, start, end, direction);
    if (!ranges.length) return false;

    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (!confirmDeleteLueckeGapRanges(ranges)) return true;

    const deleteStart = Math.min(start, ...ranges.map((range) => range.start));
    const deleteEnd = Math.max(end, ...ranges.map((range) => range.end));
    const nextValue = String(value || '').slice(0, deleteStart) + String(value || '').slice(deleteEnd);
    applyValue(nextValue, event);
    await tick();
    textarea.setSelectionRange(deleteStart, deleteStart);
    return true;
  };

  const handleSheetHtmlBeforeInput = (event) => {
    void handleHtmlTextareaGapDelete(event, editorContent, (nextValue) => {
      editorContent = nextValue;
      scheduleSheetHtmlHighlight(nextValue);
    });
  };

  const handleSheetHtmlKeydown = (event) => {
    void handleHtmlTextareaGapDelete(event, editorContent, (nextValue) => {
      editorContent = nextValue;
      scheduleSheetHtmlHighlight(nextValue);
    });
  };

  const handleSheetHtmlInput = (event) => {
    scheduleSheetHtmlHighlight(event?.currentTarget?.value ?? event?.target?.value ?? editorContent);
  };

  const handleVisualHtmlBeforeInput = (index, event) => {
    void handleHtmlTextareaGapDelete(event, visualBlocks[index] || '', (nextValue) => {
      updateVisualBlock(index, nextValue, getVisualInputHistoryOptions(index, event, 'html'));
      scheduleVisualBlockHtmlHighlight(index, nextValue);
    });
  };

  const handleVisualHtmlKeydown = (index, event) => {
    void handleHtmlTextareaGapDelete(event, visualBlocks[index] || '', (nextValue) => {
      updateVisualBlock(index, nextValue, getVisualInputHistoryOptions(index, event, 'html'));
      scheduleVisualBlockHtmlHighlight(index, nextValue);
    });
  };

  const buildGapDeletionRange = (range, gaps) => {
    const deletionRange = range.cloneRange();
    const uniqueGaps = uniqueLueckeGaps(gaps);

    if (deletionRange.collapsed) {
      deletionRange.selectNode(uniqueGaps[0]);
      return deletionRange;
    }

    uniqueGaps.forEach((gap) => {
      if (gap.contains(deletionRange.startContainer)) {
        deletionRange.setStartBefore(gap);
      }
      if (gap.contains(deletionRange.endContainer)) {
        deletionRange.setEndAfter(gap);
      }
    });

    return deletionRange;
  };

  const handleVisualGapDeleteRequest = (index, event) => {
    if (!isGapDeleteEvent(event)) return false;
    const editorEl = event?.currentTarget || visualBlockEditors[index];
    if (!editorEl) return false;
    const range = getRangeFromInputEvent(event, editorEl);
    if (!range) return false;
    const direction = getGapDeleteDirection(event);
    const gaps = range.collapsed
      ? uniqueLueckeGaps([getAdjacentLueckeGap(range, editorEl, direction)])
      : uniqueLueckeGaps(getLueckeGapsIntersectingRange(editorEl, range));
    if (!gaps.length) return false;

    event?.preventDefault?.();
    event?.stopPropagation?.();

    const deletionRange = buildGapDeletionRange(range, gaps);
    if (!confirmDeleteLueckeGaps(gaps)) return true;

    deletionRange.deleteContents();
    deletionRange.collapse(true);

    const selection = window?.getSelection ? window.getSelection() : null;
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(deletionRange);
    }

    captureVisualSelection(index);
    updateVisualBlock(index, editorEl.innerHTML, getVisualInputHistoryOptions(index, event, 'visual'));
    return true;
  };

  const handleVisualLineBreakDeleteRequest = (index, event) => {
    if (!Number.isInteger(index) || !isGapDeleteEvent(event)) return false;
    const editorEl = event?.currentTarget || visualBlockEditors[index];
    if (!editorEl) return false;
    const range = getCurrentCollapsedSelectionRange(editorEl);
    if (!range) return false;
    const direction = getGapDeleteDirection(event);
    const lineBreak = getAdjacentLineBreak(range, editorEl, direction);
    if (!lineBreak) return false;

    event?.preventDefault?.();
    event?.stopPropagation?.();

    const deletionRange = document.createRange();
    deletionRange.selectNode(lineBreak);
    deletionRange.deleteContents();
    deletionRange.collapse(true);

    const selection = window?.getSelection ? window.getSelection() : null;
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(deletionRange);
    }

    captureVisualSelection(index);
    updateVisualBlock(
      index,
      getVisualEditorValueFromElement(index, editorEl),
      getVisualInputHistoryOptions(index, event, 'visual-linebreak')
    );
    return true;
  };

  const isVisualLineBreakRequest = (event) =>
    event?.key === 'Enter' || isLineBreakInputEvent(event);

  const getVisualEditorValueFromElement = (index, editorEl) => {
    const current = visualBlocks[index] || '';
    if (isFreitextBlock(current) && editorEl?.classList?.contains('freitext-instruction-editor')) {
      return setFreitextInstructionHtml(current, editorEl.innerHTML);
    }
    return editorEl?.innerHTML || '';
  };

  const handleVisualLineBreakRequest = (index, event) => {
    if (!Number.isInteger(index) || !isVisualLineBreakRequest(event)) return false;
    if (event?.altKey || event?.ctrlKey || event?.metaKey) return false;

    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (isTitelBlock(visualBlocks[index])) {
      return true;
    }

    const editorEl = event?.currentTarget || visualBlockEditors[index];
    if (!editorEl) return true;
    const range = getRangeFromInputEvent(event, editorEl);
    if (!range) return true;

    const selectedGaps = range.collapsed
      ? []
      : uniqueLueckeGaps(getLueckeGapsIntersectingRange(editorEl, range));
    if (selectedGaps.length && !confirmDeleteLueckeGaps(selectedGaps)) {
      return true;
    }

    const insertionRange = selectedGaps.length
      ? buildGapDeletionRange(range, selectedGaps)
      : range.cloneRange();
    const lineBreak = document.createElement('br');
    insertionRange.deleteContents();
    insertionRange.insertNode(lineBreak);
    insertionRange.setStartAfter(lineBreak);
    insertionRange.collapse(true);

    const selection = window?.getSelection ? window.getSelection() : null;
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(insertionRange);
    }

    captureVisualSelection(index);
    updateVisualBlock(index, getVisualEditorValueFromElement(index, editorEl), {
      coalesce: true,
      chunkKey: `block:${index}:visual:linebreak`
    });
    return true;
  };

  const handleVisualGapAtomicInputRequest = (index, event) => {
    if (!Number.isInteger(index) || isGapDeleteEvent(event)) return false;
    const editorEl = event?.currentTarget || visualBlockEditors[index];
    if (!editorEl) return false;
    const range = getRangeFromInputEvent(event, editorEl);
    if (!range) return false;
    const rangeGap = getLueckeGapFromRange(range, editorEl);
    const intersectingGaps = range.collapsed
      ? []
      : uniqueLueckeGaps(getLueckeGapsIntersectingRange(editorEl, range));
    if (!rangeGap && !intersectingGaps.length) return false;

    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!moveVisualRangeOutsideLueckeGap(index, range, 'after') && intersectingGaps[0]) {
      setVisualCaretAroundGap(index, intersectingGaps[0], 'after');
    }
    return true;
  };

  const handleVisualBeforeInput = (event, index) => {
    if (handleVisualGapDeleteRequest(index, event)) return;
    if (handleVisualGapAtomicInputRequest(index, event)) return;
    if (handleVisualLineBreakRequest(index, event)) return;
    handleVisualLineBreakDeleteRequest(index, event);
  };

  const handleVisualInput = (index, event) => {
    const el = event?.currentTarget;
    if (!el) return;
    const source = event?.target;
    if (
      source &&
      source !== el &&
      (source instanceof HTMLInputElement ||
        source instanceof HTMLTextAreaElement ||
        source instanceof HTMLSelectElement)
    ) {
      return;
    }
    scheduleVisualSelectionCapture(index);
    scheduleVisualInputCommit(
      index,
      el.innerHTML,
      getVisualInputHistoryOptions(index, event, 'visual')
    );
  };

  const handleVisualHtmlInput = (index, event) => {
    const value = event?.currentTarget?.value ?? event?.target?.value ?? '';
    scheduleVisualBlockHtmlHighlight(index, value);
    scheduleVisualInputCommit(index, value, getVisualInputHistoryOptions(index, event, 'html'));
  };

  const handleFreitextInstructionHtmlInput = (index, event) => {
    const value = event?.currentTarget?.value ?? event?.target?.value ?? '';
    const current = visualBlocks[index] || '';
    scheduleVisualBlockHtmlHighlight(index, value);
    scheduleVisualInputCommit(
      index,
      setFreitextInstructionHtml(current, value),
      getVisualInputHistoryOptions(index, event, 'freitext-instruction-html')
    );
  };

  const handleFreitextInstructionVisualInput = (index, event) => {
    const el = event?.currentTarget;
    if (!el) return;
    const source = event?.target;
    if (
      source &&
      source !== el &&
      (source instanceof HTMLInputElement ||
        source instanceof HTMLTextAreaElement ||
        source instanceof HTMLSelectElement)
    ) {
      return;
    }
    scheduleVisualSelectionCapture(index);
    const current = visualBlocks[index] || '';
    scheduleVisualInputCommit(
      index,
      setFreitextInstructionHtml(current, el.innerHTML),
      getVisualInputHistoryOptions(index, event, 'freitext-instruction-visual')
    );
  };

  const updateFreitextCriterion = (blockIndex, criterionIndex, patch, event = null) => {
    const current = visualBlocks[blockIndex] || '';
    const criteria = getFreitextCriteria(current);
    if (!criteria[criterionIndex]) return;
    const nextCriteria = criteria.map((criterion, index) =>
      index === criterionIndex ? { ...criterion, ...patch } : criterion
    );
    const field = Object.keys(patch || {})[0] || 'item';
    updateVisualBlock(
      blockIndex,
      setFreitextCriteria(current, nextCriteria),
      getVisualInputHistoryOptions(
        blockIndex,
        event,
        `freitext-checklist:${criterionIndex}:${field}`
      )
    );
  };

  const addFreitextCriterion = (blockIndex) => {
    const current = visualBlocks[blockIndex] || '';
    const criteria = getFreitextCriteria(current);
    const nextCriteria = [
      ...criteria,
      {
        key: '',
        label: `Element ${criteria.length + 1}`,
        description: '',
        internalDescription: ''
      }
    ];
    updateVisualBlock(blockIndex, setFreitextCriteria(current, nextCriteria));
  };

  const deleteFreitextCriterion = (blockIndex, criterionIndex) => {
    const current = visualBlocks[blockIndex] || '';
    const criteria = getFreitextCriteria(current);
    const nextCriteria = criteria.filter((_, index) => index !== criterionIndex);
    updateVisualBlock(blockIndex, setFreitextCriteria(current, nextCriteria));
  };

  const updateFreitextPremise = (blockIndex, premiseIndex, patch, event = null) => {
    const current = visualBlocks[blockIndex] || '';
    const premises = getFreitextPremises(current);
    if (!premises[premiseIndex]) return;
    const nextPremises = premises.map((premise, index) =>
      index === premiseIndex ? { ...premise, ...patch } : premise
    );
    const field = Object.keys(patch || {})[0] || 'item';
    updateVisualBlock(
      blockIndex,
      setFreitextPremises(current, nextPremises),
      getVisualInputHistoryOptions(
        blockIndex,
        event,
        `freitext-premise:${premiseIndex}:${field}`
      )
    );
  };

  const getNextFreitextPremiseKey = (premises = []) => {
    const keys = new Set(
      premises
        .map((premise) => String(premise?.key || '').trim())
        .filter(Boolean)
    );
    let index = premises.length + 1;
    while (keys.has(`praemisse${index}`)) index += 1;
    return `praemisse${index}`;
  };

  const addFreitextPremise = (blockIndex) => {
    const current = visualBlocks[blockIndex] || '';
    const premises = getFreitextPremises(current);
    const nextPremises = [
      ...premises,
      {
        key: getNextFreitextPremiseKey(premises),
        label: `Prämisse ${premises.length + 1}`,
        description: '',
        sourceKey: '',
        sourceType: '',
        type: 'text',
        sourceUrl: '',
        sourceLabel: '',
        required: true
      }
    ];
    updateVisualBlock(blockIndex, setFreitextPremises(current, nextPremises));
  };

  const deleteFreitextPremise = (blockIndex, premiseIndex) => {
    const current = visualBlocks[blockIndex] || '';
    const premises = getFreitextPremises(current);
    const nextPremises = premises.filter((_, index) => index !== premiseIndex);
    updateVisualBlock(blockIndex, setFreitextPremises(current, nextPremises));
  };

  const updateFreitextReference = (blockIndex, referenceIndex, patch, event = null) => {
    const current = visualBlocks[blockIndex] || '';
    const references = getFreitextReferences(current);
    if (!references[referenceIndex]) return;
    const nextReferences = references.map((reference, index) =>
      index === referenceIndex ? { ...reference, ...patch } : reference
    );
    const field = Object.keys(patch || {})[0] || 'item';
    updateVisualBlock(
      blockIndex,
      setFreitextReferences(current, nextReferences),
      getVisualInputHistoryOptions(
        blockIndex,
        event,
        `freitext-reference:${referenceIndex}:${field}`
      )
    );
  };

  const addFreitextReference = (blockIndex) => {
    const current = visualBlocks[blockIndex] || '';
    const references = getFreitextReferences(current);
    const nextReferences = [
      ...references,
      {
        key: '',
        label: `Verknüpfung ${references.length + 1}`,
        sourceKey: '',
        sourceType: 'answer',
        prompt: '',
        minClassification: 900,
        required: true
      }
    ];
    updateVisualBlock(blockIndex, setFreitextReferences(current, nextReferences));
  };

  const deleteFreitextReference = (blockIndex, referenceIndex) => {
    const current = visualBlocks[blockIndex] || '';
    const references = getFreitextReferences(current);
    const nextReferences = references.filter((_, index) => index !== referenceIndex);
    updateVisualBlock(blockIndex, setFreitextReferences(current, nextReferences));
  };

  const handleVisualGapArrowNavigation = (index, event) => {
    if (!Number.isInteger(index)) return false;
    if (event?.altKey || event?.ctrlKey || event?.metaKey || event?.shiftKey) return false;
    const direction =
      event?.key === 'ArrowRight' ? 'forward' : event?.key === 'ArrowLeft' ? 'backward' : '';
    if (!direction) return false;

    const editorEl = event?.currentTarget || visualBlockEditors[index];
    if (!editorEl) return false;
    ensureTerminalCaretTextInEditor(editorEl);
    const range = getCurrentCollapsedSelectionRange(editorEl);
    if (!range) return false;
    const gap = getAdjacentLueckeGap(range, editorEl, direction);
    if (!gap) return false;

    event.preventDefault();
    event.stopPropagation();
    return setVisualCaretAroundGap(index, gap, direction === 'forward' ? 'after' : 'before');
  };

  const handleVisualGapAtomicKeydown = (index, event) => {
    if (!Number.isInteger(index)) return false;
    if (event?.altKey || event?.ctrlKey || event?.metaKey) return false;
    const key = event?.key || '';
    const isTextInputKey = key.length === 1;
    if (key !== 'Enter' && !isTextInputKey) return false;

    const editorEl = event?.currentTarget || visualBlockEditors[index];
    const range = getCurrentVisualSelectionRange(editorEl);
    if (!range) return false;
    if (!getLueckeGapFromRange(range, editorEl)) return false;

    event.preventDefault();
    event.stopPropagation();
    return moveVisualRangeOutsideLueckeGap(index, range, 'after');
  };

  const handleVisualKeydown = (event, index = null) => {
    const target = event?.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return;
    }
    if (Number.isInteger(index) && handleVisualGapDeleteRequest(index, event)) {
      return;
    }
    if (Number.isInteger(index) && handleVisualGapAtomicKeydown(index, event)) {
      return;
    }
    if (Number.isInteger(index) && handleVisualLineBreakRequest(index, event)) {
      return;
    }
    if (Number.isInteger(index) && handleVisualLineBreakDeleteRequest(index, event)) {
      return;
    }
    if (Number.isInteger(index) && handleVisualGapArrowNavigation(index, event)) {
      return;
    }
    if (isUndoShortcut(event)) {
      event.preventDefault();
      void undoVisualChange();
      return;
    }
    if (isRedoShortcut(event)) {
      event.preventDefault();
      void redoVisualChange();
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
    const current = visualBlocks[index] || '';
    updateVisualBlock(
      index,
      isFreitextBlock(current) && visualBlockViews[index] === 'visual'
        ? setFreitextInstructionHtml(current, el.innerHTML)
        : el.innerHTML
    );
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
    const current = visualBlocks[index] || '';
    updateVisualBlock(
      index,
      isFreitextBlock(current) && visualBlockViews[index] === 'visual'
        ? setFreitextInstructionHtml(current, el.innerHTML)
        : el.innerHTML
    );
    captureVisualSelection(index);
  };

  const normalizeLinkHref = (value = '') => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (/\s/.test(raw)) return '';
    if (/^https?:\/\//i.test(raw)) {
      try {
        return new URL(raw).hostname ? raw : '';
      } catch {
        return '';
      }
    }
    if (/^(mailto:|tel:)/i.test(raw)) return raw;
    if (/^(#|\/|\.\/|\.\.\/)/.test(raw)) return raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';
    const href = `https://${raw}`;
    try {
      return new URL(href).hostname ? href : '';
    } catch {
      return '';
    }
  };

  const buildLinkLabel = (href = '') => {
    const label = String(href || '')
      .replace(/^https?:\/\//i, '')
      .replace(/^mailto:/i, '')
      .replace(/^tel:/i, '')
      .replace(/\/$/, '')
      .trim();
    return label || 'Link';
  };

  const applyLinkFormat = (index) => {
    if (!browser) return;
    const rawHref = window.prompt('Link URL eingeben', 'https://');
    if (rawHref === null) return;
    const href = normalizeLinkHref(rawHref);
    if (!href) {
      window.alert?.('Bitte eine gültige URL eingeben.');
      return;
    }
    const prefix = `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">`;
    const suffix = '</a>';
    const placeholder = escapeHtml(buildLinkLabel(href));
    if (visualBlockViews[index] === 'visual') {
      wrapVisualSelection(index, prefix, suffix, placeholder);
      return;
    }
    wrapHtmlSelection(index, prefix, suffix, placeholder);
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

  const setTitelBlockLevel = (index, event) => {
    const level = Number(event?.currentTarget?.value || 1);
    const normalizedLevel = [1, 2, 3].includes(level) ? level : 1;
    const current = visualBlocks[index] || '';
    const { doc, container } = parseHtmlFragment(current);
    const currentHeading = container?.firstElementChild;
    if (!doc || !container || !currentHeading || !/^h[1-3]$/i.test(currentHeading.tagName || '')) {
      updateVisualBlock(index, buildTitelSnippet(normalizedLevel));
      return;
    }
    const nextHeading = doc.createElement(`h${normalizedLevel}`);
    nextHeading.innerHTML = currentHeading.innerHTML || TITEL_LEVEL_OPTIONS[normalizedLevel - 1]?.label || 'Titel';
    currentHeading.replaceWith(nextHeading);
    updateVisualBlock(index, container.innerHTML);
  };

  const insertSnippetIntoBlock = async (index, width = '') => {
    const name = getNextLueckeName();
    const snippet = buildLueckeSnippet(width, name);
    if (visualBlockViews[index] === 'visual') {
      insertHtmlIntoVisualBlock(index, snippet);
    } else {
      await insertHtmlSelection(index, { prefix: snippet, suffix: '' });
    }
    await tick();
    openLueckeEditor(index, name);
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
    answersUserFilter;
    scheduleAnswersRefresh();
  }

  $: if (answersClassId !== answersLearnersClassKey) {
    answersUserFilter = '';
    fetchAnswersLearners(answersClassId);
  }

  $: if (
    (activeTab !== 'editor' || editorView !== 'preview') &&
    (
      previewLueckeRuntime ||
      previewFreitextRuntime ||
      previewUmfrageRuntime
    )
  ) {
    previewLueckeRuntime?.destroy();
    previewFreitextRuntime?.destroy();
    previewUmfrageRuntime?.destroy();
    previewLueckeRuntime = null;
    previewFreitextRuntime = null;
    previewUmfrageRuntime = null;
    previewUser = '';
  }

  const destroyAnswersRuntime = () => {
    answersLueckeRuntime?.destroy();
    answersFreitextRuntime?.destroy();
    answersUmfrageRuntime?.destroy();
    answersLueckeRuntime = null;
    answersFreitextRuntime = null;
    answersUmfrageRuntime = null;
  };

  const ensureAnswersRenderMode = async (mode) => {
    const contentChanged = editorContent !== answersContent;
    const modeChanged = answersRenderMode !== mode;
    if (!contentChanged && !modeChanged) return false;
    answersRenderMode = mode;
    answersContent = editorContent;
    answersRenderKey += 1;
    await tick();
    return true;
  };

  $: if (
    (activeTab !== 'editor' || editorView !== 'answers' || !answersUserFilter) &&
    (
      answersLueckeRuntime ||
      answersFreitextRuntime ||
      answersUmfrageRuntime
    )
  ) {
    destroyAnswersRuntime();
  }

  const schedulePreviewRefresh = async () => {
    if (previewPending) return;
    previewPending = true;
    await tick();
    previewPending = false;

    if (!previewEl || !apiBaseUrl || activeTab !== 'editor' || editorView !== 'preview') return;
    ensureLueckeElements();
    ensureFreitextElements();
    ensureUmfrageElements();

    const nextUser = `preview:${selectedKey || 'draft'}`;
    previewLueckeRuntime?.destroy();
    previewFreitextRuntime?.destroy();
    previewUmfrageRuntime?.destroy();
    previewLueckeRuntime = createLueckeRuntime({
      root: previewEl,
      apiBaseUrl,
      sheetKey: selectedKey || 'draft',
      user: nextUser,
      previewMode: true
    });
    previewFreitextRuntime = createFreitextRuntime({
      root: previewEl,
      apiBaseUrl,
      sheetKey: selectedKey || 'draft',
      user: nextUser,
      previewMode: true
    });
    previewUmfrageRuntime = createUmfrageRuntime({
      root: previewEl,
      apiBaseUrl,
      sheetKey: selectedKey || 'draft',
      user: nextUser,
      previewMode: true
    });
    previewUser = nextUser;
    await previewLueckeRuntime.refresh();
    await previewFreitextRuntime.refresh();
    await previewUmfrageRuntime.refresh();
  };

  const escapeHtml = (str = '') =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const formatVersionDate = (value) => formatSwissDateTime(value);

  const getVersionTimestamp = (entry) => {
    if (!entry) return Number.NaN;
    const raw = entry.updated_at || entry.created_at;
    if (!raw) return Number.NaN;
    const stamp = new Date(raw).getTime();
    return Number.isNaN(stamp) ? Number.NaN : stamp;
  };

  const compareVersionsByLocalOrder = (a, b) => {
    const stampA = getVersionTimestamp(a);
    const stampB = getVersionTimestamp(b);
    const hasStampA = !Number.isNaN(stampA);
    const hasStampB = !Number.isNaN(stampB);
    if (hasStampA && hasStampB && stampA !== stampB) {
      return stampA - stampB;
    }
    if (hasStampA !== hasStampB) {
      return hasStampA ? -1 : 1;
    }
    const idA = Number(a?.id);
    const idB = Number(b?.id);
    const hasIdA = Number.isFinite(idA);
    const hasIdB = Number.isFinite(idB);
    if (hasIdA && hasIdB && idA !== idB) {
      return idA - idB;
    }
    return String(a?.id ?? '').localeCompare(String(b?.id ?? ''), undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  };

  const buildVersionNumberMap = (versions = []) => {
    const ordered = [...versions].sort(compareVersionsByLocalOrder);
    const map = new Map();
    ordered.forEach((entry, index) => {
      if (entry?.id === null || entry?.id === undefined) return;
      map.set(String(entry.id), index + 1);
    });
    return map;
  };

  const getVersionNumber = (version) => {
    if (!version) return null;
    if (version?.id !== null && version?.id !== undefined) {
      const mapped = sheetVersionNumbers.get(String(version.id));
      if (mapped) return mapped;
    }
    const fallbackIndex = sheetVersions.findIndex((entry) => entry === version);
    return fallbackIndex >= 0 ? fallbackIndex + 1 : null;
  };

  const formatVersionLabel = (version) => {
    if (!version) return '';
    const versionNumber = getVersionNumber(version);
    const number = versionNumber ? `V${versionNumber}` : '';
    const stamp = formatVersionDate(version.updated_at || version.created_at);
    return [number, stamp].filter(Boolean).join(' · ');
  };

  const describeVersion = (version) => {
    if (!version) return 'Version';
    const versionNumber = getVersionNumber(version);
    const number = versionNumber ? `V${versionNumber}` : '';
    const stamp = formatVersionDate(version.updated_at || version.created_at);
    return [number, stamp].filter(Boolean).join(' · ') || 'Version';
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

  const transformGaps = (container) => {
    const gaps = Array.from(
      container.querySelectorAll(`luecke-gap, ${FREITEXT_BLOCK_SELECTOR}`)
    );
    gaps.forEach((gap, idx) => {
      const key = gap.getAttribute('name') || `gap-${idx + 1}`;
      const tag = gap.tagName.toLowerCase();
      const isFreitextTag = FREITEXT_BLOCK_TAG_NAMES.includes(tag);
      const solutionEl =
        isFreitextTag
          ? gap.querySelector('textarea.freitext__textarea')
          : gap.querySelector('input.luecke');
      const solutionSource = solutionEl?.dataset?.solution;
      const solution = isFreitextTag ? '' : (solutionSource || gap.textContent || '').trim();
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

  const fetchAnswersLearners = async (classId) => {
    const normalizedClassId = normalizeClassId(classId);
    const requestId = ++answersLearnersRequestId;
    answersLearnersClassKey = normalizedClassId;
    answersLearners = [];
    answersLearnersError = '';
    if (!token || !normalizedClassId) {
      if (requestId === answersLearnersRequestId) {
        answersLearnersLoading = false;
      }
      return;
    }
    answersLearnersLoading = true;
    try {
      const res = await apiFetch(`learner?classroom=${normalizedClassId}`);
      const payload = await readPayload(res);
      if (requestId !== answersLearnersRequestId) return;
      if (!res.ok) {
        answersLearnersError =
          payload?.warning || 'Schüler konnten nicht geladen werden';
        return;
      }
      answersLearners = payload?.data?.learner ?? [];
      if (
        answersUserFilter &&
        !answersLearners.find(
          (entry) => String(entry?.code ?? '') === String(answersUserFilter)
        )
      ) {
        answersUserFilter = '';
      }
    } catch (err) {
      if (requestId !== answersLearnersRequestId) return;
      answersLearnersError = err?.message ?? 'Schüler konnten nicht geladen werden';
      answersLearners = [];
    } finally {
      if (requestId === answersLearnersRequestId) {
        answersLearnersLoading = false;
      }
    }
  };

  const fetchAgentLearnersByClass = async (classId) => {
    const normalizedClassId = normalizeClassId(classId);
    if (!token || !normalizedClassId) return [];
    try {
      const res = await apiFetch(`learner?classroom=${normalizedClassId}`);
      const payload = await readPayload(res);
      if (!res.ok) return [];
      return payload?.data?.learner ?? [];
    } catch {
      return [];
    }
  };

  const fetchAgentPlanByClass = async (classId) => {
    const normalizedClassId = normalizeClassId(classId);
    if (!token || !normalizedClassId) return [];
    try {
      const res = await apiFetch(`plan?classroom=${normalizedClassId}`);
      const payload = await readPayload(res);
      if (!res.ok) return [];
      return payload?.data?.classroom_sheet ?? [];
    } catch {
      return [];
    }
  };

  const fetchAnswerEntries = async ({ sheetKey = '', classId = null, user = '' } = {}) => {
    const params = new URLSearchParams();
    const normalizedSheetKey = (sheetKey || '').toString().trim();
    const normalizedClassId = normalizeClassId(classId);
    const normalizedUser = (user || '').toString().trim();
    if (normalizedSheetKey) {
      params.set('sheet', normalizedSheetKey);
    }
    if (normalizedClassId) {
      params.set('classroom', String(normalizedClassId));
    }
    if (normalizedUser) {
      params.set('user', normalizedUser);
    }
    const query = params.toString();
    const path = query ? `answer?${query}` : 'answer';
    const res = await apiFetch(path);
    const payload = await readPayload(res);
    if (!res.ok) {
      throw new Error(payload?.warning || 'Antworten konnten nicht geladen werden');
    }
    return payload?.data?.answer ?? [];
  };

  const fetchAnswers = async (key, classId = null, userFilter = '') => {
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
      const user = (userFilter || '').trim();
      answers = await fetchAnswerEntries({ sheetKey: key, classId, user });
      const classLabel = getAnswersClassLabel(classId);
      const userLabel = getAnswersUserLabel(user);
      answersMeta = `Sheet: ${key} · ${classLabel} · ${userLabel} · Antworten geladen (${answers.length} Einträge)`;
      answersKey = key;
      answersClassKey = classId;
      answersUserKey = user;
    } catch (err) {
      answersError = err?.message ?? 'Antworten konnten nicht geladen werden';
      answers = [];
    } finally {
      answersLoading = false;
    }
  };

  const setupAnswersLearnerRuntime = async (key, userCode, classId = null) => {
    if (!answersEl || !apiBaseUrl || !key || !userCode) return;
    answersLoading = true;
    answersError = '';
    const classLabel = getAnswersClassLabel(classId);
    const userLabel = getAnswersUserLabel(userCode);
    answersMeta = `Sheet: ${key} · ${classLabel} · ${userLabel} · Lernendenansicht`;

    try {
      await ensureAnswersCiCss(classId);
      ensureLueckeElements();
      ensureFreitextElements();
      ensureUmfrageElements();
      destroyAnswersRuntime();
      answersLueckeRuntime = createLueckeRuntime({
        root: answersEl,
        apiBaseUrl,
        sheetKey: key,
        user: userCode,
        classroom: classId
      });
      answersFreitextRuntime = createFreitextRuntime({
        root: answersEl,
        apiBaseUrl,
        sheetKey: key,
        user: userCode,
        classroom: classId
      });
      answersUmfrageRuntime = createUmfrageRuntime({
        root: answersEl,
        apiBaseUrl,
        sheetKey: key,
        user: userCode,
        classroom: classId
      });
      await answersLueckeRuntime.refresh();
      await answersFreitextRuntime.refresh();
      await answersUmfrageRuntime.refresh();
      answersKey = key;
      answersClassKey = classId;
      answersUserKey = userCode;
    } catch (err) {
      answersError = err?.message ?? 'Lernendenansicht konnte nicht geladen werden';
      destroyAnswersRuntime();
    } finally {
      answersLoading = false;
    }
  };

  const refreshAnswers = async () => {
    if (!selectedKey) {
      answersError = 'Kein Sheet-Key vorhanden.';
      return;
    }
    if (answersUserFilter) {
      await ensureAnswersRenderMode('learner');
      await setupAnswersLearnerRuntime(selectedKey, answersUserFilter, answersClassId);
      return;
    }
    await ensureAnswersRenderMode('aggregate');
    await fetchAnswers(selectedKey, answersClassId, answersUserFilter);
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
      destroyAnswersRuntime();
      answers = [];
      answersMeta = '';
      answersKey = '';
      answersClassKey = null;
      answersUserKey = '';
      answersLoading = false;
      return;
    }

    if (answersUserFilter) {
      const shouldInitLearnerRuntime =
        selectedKey !== answersKey ||
        answersClassId !== answersClassKey ||
        answersUserFilter !== answersUserKey ||
        editorContent !== answersContent ||
        !answersLueckeRuntime ||
        !answersFreitextRuntime ||
        !answersUmfrageRuntime;
      if (shouldInitLearnerRuntime) {
        await ensureAnswersRenderMode('learner');
        await setupAnswersLearnerRuntime(selectedKey, answersUserFilter, answersClassId);
      }
      return;
    }

    destroyAnswersRuntime();
    await ensureAnswersRenderMode('aggregate');
    const shouldFetch =
      selectedKey &&
      (selectedKey !== answersKey ||
        answersClassId !== answersClassKey ||
        answersUserFilter !== answersUserKey);
    if (shouldFetch) {
      await fetchAnswers(selectedKey, answersClassId, answersUserFilter);
    } else if (!answers.length && !answersLoading && !answersError && selectedKey) {
      await fetchAnswers(selectedKey, answersClassId, answersUserFilter);
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
    const draftPrompt =
      planPromptDraft[sheetKey] !== undefined ? String(planPromptDraft[sheetKey] ?? '') : undefined;
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
        if (planPromptOpenKey === sheetKey) {
          planPromptOpenKey = '';
        }
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
          assignment_form: existingForm,
          prompt: draftPrompt ?? ''
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
            assignment_form: existingForm,
            prompt: draftPrompt ?? ''
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

  const togglePlanPrompt = (sheetKey) => {
    if (!sheetKey) return;
    if (planPromptOpenKey === sheetKey) {
      planPromptOpenKey = '';
      return;
    }
    const existing = planAssignmentMap.get(sheetKey);
    const current = existing?.prompt ?? '';
    planPromptDraft = { ...planPromptDraft, [sheetKey]: String(current ?? '') };
    planPromptOpenKey = sheetKey;
  };

  const setPlanPrompt = async (sheetKey, prompt) => {
    if (!selectedPlanClassId || !sheetKey) return;
    planSaving = true;
    planError = '';
    const existing = planAssignmentMap.get(sheetKey);
    if (!existing?.id) {
      planSaving = false;
      planError = 'Bitte zuerst zuordnen, bevor ein Prompt gespeichert wird.';
      return;
    }
    const normalizedPrompt = String(prompt ?? '');
    try {
      const res = await apiFetch('plan', {
        method: 'PATCH',
        body: JSON.stringify({ id: existing.id, prompt: normalizedPrompt })
      });
      const payload = await readPayload(res);
      if (!res.ok) {
        planError = payload?.warning || 'Prompt konnte nicht gespeichert werden';
        return;
      }
      planAssignments = planAssignments.map((entry) =>
        entry.id === existing.id ? { ...entry, prompt: normalizedPrompt } : entry
      );
    } catch (err) {
      planError = err?.message ?? 'Prompt konnte nicht gespeichert werden';
    } finally {
      planSaving = false;
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

  function parseCollectionSort(value) {
    const raw = value || 'updated_at_desc';
    const lastUnderscore = raw.lastIndexOf('_');
    if (lastUnderscore === -1) {
      return { field: raw, dir: 'asc' };
    }
    const field = raw.slice(0, lastUnderscore);
    const dir = raw.slice(lastUnderscore + 1) === 'desc' ? 'desc' : 'asc';
    return { field, dir };
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

  function getCollectionSortValue(entry, field) {
    switch (field) {
      case 'name':
        return entry?.name ?? '';
      case 'description':
        return entry?.description ?? '';
      case 'sheet_count':
        return getCollectionCount(entry?.id);
      case 'updated_at':
        return entry?.updated_at ?? '';
      default:
        return entry?.updated_at ?? '';
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

  function toggleCollectionSort(field) {
    const { field: currentField, dir } = parseCollectionSort(collectionSort);
    if (currentField === field) {
      collectionSort = `${field}_${dir === 'asc' ? 'desc' : 'asc'}`;
      return;
    }
    const defaultDir = field === 'updated_at' ? 'desc' : field === 'sheet_count' ? 'desc' : 'asc';
    collectionSort = `${field}_${defaultDir}`;
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

  function getCollectionSortNextDir(field) {
    const { field: currentField, dir } = parseCollectionSort(collectionSort);
    const defaultDir = field === 'updated_at' ? 'desc' : field === 'sheet_count' ? 'desc' : 'asc';
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

  function getCollectionSortHint(field) {
    const nextDir = getCollectionSortNextDir(field);
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

<div
  class="app"
  class:app--with-agent={token && isActivatedUser}
  class:app--agent-collapsed={token && isActivatedUser && !agentSidebarOpen}
  class:app--ci-zag={isCiSchoolZag}
>
  <header class="topbar">
    <div class="brand-block">
      <p class="eyebrow">ABU TOOL</p>
      <div class="brand-logo">
        <img src="/zag_logo.png" alt="ZAG Logo" />
      </div>
    </div>
    {#if token && isActivatedUser}
      <div class="tabs topbar-tabs">
        <button
          class="ghost ci-btn-outline topbar-tab-btn"
          aria-pressed={activeTab === 'collections' || activeTab === 'editor'}
          on:click={() => switchTab('collections')}
          type="button"
        >
          <svg class="topbar-tab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M5 4.75h9.2L19 9.55v9.7H5V4.75Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linejoin="round"
            />
            <path
              d="M14.2 4.75v4.8H19M8.35 13.05h7.3M8.35 16.25h5.8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Material
        </button>
        <button
          class="ghost ci-btn-outline topbar-tab-btn"
          aria-pressed={activeTab === 'classes'}
          on:click={() => switchTab('classes')}
          type="button"
        >
          <svg class="topbar-tab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M9.6 11.1a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2ZM4.2 19.1c.45-3.05 2.38-5 5.4-5s4.95 1.95 5.4 5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M15.4 11.1a2.65 2.65 0 1 0 0-5.3M16.8 14.35c1.75.55 2.8 2.1 3.1 4.75"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Klassen
        </button>
        <button
          class="ghost ci-btn-outline topbar-tab-btn"
          aria-pressed={activeTab === 'shop'}
          on:click={() => switchTab('shop')}
          type="button"
        >
          <svg class="topbar-tab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M5.6 4.8h12.8l1.35 3.15H4.25L5.6 4.8Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M5.05 7.95v11.25h13.9V7.95M5.05 12.75h13.9M9.7 7.95v11.25M14.3 7.95v11.25M6.8 10.25h1.2M11.4 10.25h1.2M16 10.25h1.2M6.8 15.55h1.2M11.4 15.55h1.2M16 15.55h1.2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Bibliothek
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
            class:is-active={activeTab === 'collections' || activeTab === 'editor'}
            role="menuitemradio"
            aria-checked={activeTab === 'collections' || activeTab === 'editor'}
            type="button"
            on:click={() => selectTopbarTab('collections')}
          >
            <svg class="topbar-tab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M5 4.75h9.2L19 9.55v9.7H5V4.75Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linejoin="round"
              />
              <path
                d="M14.2 4.75v4.8H19M8.35 13.05h7.3M8.35 16.25h5.8"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            Material
          </button>
          <button
            class="topbar-menu-item"
            class:is-active={activeTab === 'classes'}
            role="menuitemradio"
            aria-checked={activeTab === 'classes'}
            type="button"
            on:click={() => selectTopbarTab('classes')}
          >
            <svg class="topbar-tab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M9.6 11.1a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2ZM4.2 19.1c.45-3.05 2.38-5 5.4-5s4.95 1.95 5.4 5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M15.4 11.1a2.65 2.65 0 1 0 0-5.3M16.8 14.35c1.75.55 2.8 2.1 3.1 4.75"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            Klassen
          </button>
          <button
            class="topbar-menu-item"
            class:is-active={activeTab === 'shop'}
            role="menuitemradio"
            aria-checked={activeTab === 'shop'}
            type="button"
            on:click={() => selectTopbarTab('shop')}
          >
            <svg class="topbar-tab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M5.6 4.8h12.8l1.35 3.15H4.25L5.6 4.8Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M5.05 7.95v11.25h13.9V7.95M5.05 12.75h13.9M9.7 7.95v11.25M14.3 7.95v11.25M6.8 10.25h1.2M11.4 10.25h1.2M16 10.25h1.2M6.8 15.55h1.2M11.4 15.55h1.2M16 15.55h1.2"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            Bibliothek
          </button>
        </div>
      </div>
    {/if}
    <div class="status">
      {#if token}
        <div class="status-user">
          <p class="value">{userEmail || 'User'}</p>
          <p class="hint">{userRoleLabel}</p>
        </div>
        {#if isActivatedUser}
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
        {/if}
        <button class="ghost ci-btn-outline" on:click={logout}>Logout</button>
        {#if isActivatedUser}
          <button
            class="ghost ci-btn-outline agent-topbar-toggle"
            type="button"
            aria-pressed={agentSidebarOpen}
            aria-label={agentSidebarOpen ? 'KI Sidebar ausblenden' : 'KI Sidebar einblenden'}
            title={agentSidebarOpen ? 'KI Sidebar ausblenden' : 'KI Sidebar einblenden'}
            on:click={() => (agentSidebarOpen = !agentSidebarOpen)}
          >
            <svg class="agent-topbar-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M12 4v2.4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M7.2 8h9.6a2.8 2.8 0 0 1 2.8 2.8v5a2.8 2.8 0 0 1-2.8 2.8H7.2a2.8 2.8 0 0 1-2.8-2.8v-5A2.8 2.8 0 0 1 7.2 8Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M4.4 11.7H3M21 11.7h-1.4M9.4 15.3h5.2M9 18.6v1.4M15 18.6v1.4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle cx="9.3" cy="12" r="1" fill="currentColor" />
              <circle cx="14.7" cy="12" r="1" fill="currentColor" />
            </svg>
          </button>
        {/if}
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
      <p class="hint">Bitte config.json prüfen.</p>
    </div>
  {:else if !token}
    <div class="login login--auth">
      <section class="auth-card auth-card--teacher">
        <div class="auth-card__visual">
          <span class="auth-card__badge">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M4.5 7.5h15M7.5 4.5v15M12 7.5v12M16.5 7.5v9"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
            Lehrperson
          </span>
          <img
            class="auth-card__art"
            src="/login-lehrperson.svg"
            alt="Illustration für den Lehrpersonen-Login"
          />
        </div>
        <div class="auth-card__body">
          <h2>Einloggen als Lehrperson</h2>
          <p class="auth-card__copy">
            Verwalte Klassen, bearbeite Arbeitsblätter und werte Antworten an einem Ort aus.
          </p>
          <form class="auth-form" on:submit|preventDefault={login}>
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
            <button class="auth-submit" type="submit" disabled={loginLoading}>
              {loginLoading ? 'Login…' : 'Lehrperson einloggen'}
            </button>
          </form>
        </div>
      </section>

      <section class="auth-card auth-card--student">
        <div class="auth-card__visual">
          <span class="auth-card__badge">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M4 8.5 12 4l8 4.5-8 4.5L4 8.5Zm3 5.1 5 2.8 5-2.8"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            Studierende
          </span>
          <img
            class="auth-card__art"
            src="/login-studierende.svg"
            alt="Illustration für den Studierenden-Login"
          />
        </div>
        <div class="auth-card__body">
          <h2>Einloggen als Studierende</h2>
          <p class="auth-card__copy">
            Mit deinem persönlichen Token direkt in deine freigegebenen Arbeitsblätter.
          </p>
          <form class="auth-form" on:submit|preventDefault={loginLearner}>
            <label>
              <span>Token</span>
              <input
                type="text"
                bind:value={learnerLoginToken}
                placeholder="z. B. CWcT6n3Ba546"
                autocapitalize="off"
                autocomplete="off"
                spellcheck="false"
              />
            </label>
            {#if learnerLoginError}
              <p class="error-text">{learnerLoginError}</p>
            {/if}
            <button class="auth-submit" type="submit" disabled={learnerLoginLoading}>
              {learnerLoginLoading ? 'Login…' : 'Studierende einloggen'}
            </button>
          </form>
        </div>
      </section>
    </div>
  {:else if token && !isActivatedUser}
    <div class="card">
      <h2>Warte auf Aktivierung</h2>
      <p class="hint">
        Dein Account hat Rolle 0 (default). Bitte lass deinen Account aktivieren (Rolle 1 oder 3).
      </p>
    </div>
  {:else}
    {#if activeTab === 'editor'}
    {#if !selectedId}
    <div class="workspace single">
      <section class="panel">
        <div class="panel-header sheet-header">
          <div>
            <h2>Deine Sheets</h2>
            <p class="hint">{visibleSheets.length} / {sheets.length} Einträge</p>
          </div>
          <div class="sheet-toolbar">
            <label class="sheet-filter">
              <span>Suchen</span>
              <input
                type="text"
                bind:value={sheetFilter}
                placeholder="Titel oder Inhalt"
              />
            </label>
            <a class="ci-btn-secondary" href="/import/material">Material importieren</a>
            <button
              class="ci-btn-secondary"
              on:click={() => {
                newSheetName = '';
                newSheetKey = '';
                sheetError = '';
                newSheetCollectionId = getPreferredEditableCollectionId();
                showCreateSheetModal = true;
              }}
              disabled={editableCollections.length === 0}
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
          <p class="hint">Keine Treffer für den Filter.</p>
        {:else}
          <ListTable
            columns={sheetColumns}
            rows={visibleSheets}
            columnsTemplate={SHEET_TABLE_COLUMNS}
            tableClass="sheet-table sheet-table--sheet-list"
            rowKey={(sheet) => sheet.id}
            onRowClick={(sheet) => selectSheet(sheet.id)}
            rowAriaLabel={(sheet) => `Sheet ${sheet.name || sheet.key || sheet.id} öffnen`}
            actionsLabel="Aktion"
            compactBreakpoint={900}
          >
            <svelte:fragment slot="actions" let:row>
              <button
                class="icon-btn ci-btn-outline"
                title="Sheet löschen"
                aria-label="Sheet löschen"
                on:click|stopPropagation={() => deleteSheet(row.id)}
                disabled={deleting || (isAdmin && normalizeUserId(row?.user) !== userId)}
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
            <button
              class="ghost ci-btn-outline"
              on:click={() => switchTab(editorReturnTab === 'editor' ? 'collections' : editorReturnTab)}
            >
              &larr; {getEditorReturnLabel()}
            </button>
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
            <button
              class="ci-btn-secondary editor-action-btn"
              class:editor-action-btn--saved={sheetSaveButtonSaved}
              type="button"
              on:pointerdown={captureSaveFocusSnapshot}
              on:mousedown|preventDefault={captureSaveFocusSnapshot}
              on:click={handleSaveButtonClick}
              disabled={saving || sheetReadOnly}
            >
              <span class="editor-action-btn__status" aria-hidden="true">
                {#if saving}
                  <span class="editor-action-btn__spinner"></span>
                {:else if sheetSaveButtonSaved}
                  <span class="editor-action-btn__check">✓</span>
                {:else}
                  <svg
                    class="editor-action-btn__disk"
                    viewBox="0 0 24 24"
                    focusable="false"
                  >
                    <path
                      d="M5 4h11l3 3v13H5zM8 4v6h8V4M9 16h6"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                {/if}
              </span>
              <span>{sheetSaveButtonLabel}</span>
            </button>
          </div>
        </div>
        {#if sheetSaveStatus === 'error' && saveState}
          <p class="hint error-text">{saveState}</p>
        {/if}
        {#if sheetReadOnly}
          <p class="hint">Admin: Fremdes Sheet (nur lesen).</p>
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
                  <label class="editor-version-select editor-collection-select">
                    <span>Sammlung</span>
                    <select bind:value={editorCollectionId} disabled={sheetReadOnly}>
                      <option value="">Sammlung wählen</option>
                      {#each editableCollections as collection}
                        <option value={String(collection.id)}>
                          {collection.name || `Sammlung #${collection.id}`}
                        </option>
                      {/each}
                    </select>
                  </label>
                  <div class="editor-version">
                    <label class="editor-version-select editor-version-picker">
                      <span>Versionen</span>
                      <select
                        bind:value={selectedVersionId}
                        disabled={sheetReadOnly || versionsLoading || sheetVersions.length === 0}
                        on:change={() => {
                          versionRestoreStatus = 'idle';
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
                        class:version-restore-btn--restored={versionRestoreButtonRestored}
                        type="button"
                        on:click={restoreSheetVersion}
                        disabled={sheetReadOnly || restoringVersion || !selectedVersionId}
                        aria-label="Version wiederherstellen"
                        title={restoringVersion
                          ? 'Version wird wiederhergestellt'
                          : versionRestoreButtonRestored
                          ? 'Version wiederhergestellt'
                          : isCurrentVersion
                            ? 'Aktuelle Version erneut als aktuell setzen'
                            : 'Ausgewählte Version wiederherstellen'}
                    >
                      <span class="version-restore-btn__status" aria-hidden="true">
                        {#if restoringVersion}
                          <span class="editor-action-btn__spinner"></span>
                        {:else if versionRestoreButtonRestored}
                          <span class="editor-action-btn__check">✓</span>
                        {:else}
                          <svg class="restore-icon" viewBox="0 0 24 24" focusable="false">
                            <path
                              d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66M18 4v4h-4"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.8"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                        {/if}
                      </span>
                    </button>
                  </div>
                </div>
                <label class="editor-meta-prompt">
                  <span>Prompt</span>
                  <textarea
                    rows="3"
                    bind:value={editorPrompt}
                    placeholder="Prompt für dieses Auftragsblatt (optional)"
                  ></textarea>
                </label>
                {#if versionsLoading}
                  <p class="hint">Lade Versionen…</p>
                {:else if versionsError}
                  <p class="error-text">{versionsError}</p>
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
                        on:beforeinput={handleSheetHtmlBeforeInput}
                        on:keydown={handleSheetHtmlKeydown}
                        on:input={handleSheetHtmlInput}
                        on:blur={flushSheetHtmlInputWork}
                        on:scroll={() => syncCodeScroll(sheetHtmlInput, sheetHtmlHighlight)}
                      ></textarea>
                    </div>
                  {:else}
                    <div class="visual-layout">
                      <div class="visual-edit-panel">
                        <div class="block-editors">
                          <div
                            class="block-insert-row"
                            class:block-insert-row--visible={visibleBlockInsertIndexes.has(0)}
                            class:block-insert-row--dragging={dragIndex !== null}
                            class:block-insert-row--menu-open={blockInsertIndex === 0 && dragIndex === null}
                            class:drag-over={dragOverIndex === 0}
                            aria-hidden={!visibleBlockInsertIndexes.has(0)}
                            on:dragenter={(event) => handleInsertDragOver(event, 0)}
                            on:dragover={(event) => handleInsertDragOver(event, 0)}
                            on:dragleave={(event) => handleInsertDragLeave(event, 0)}
                            on:drop={(event) => handleInsertDrop(event, 0)}
                          >
                            <div class="block-insert">
                              <button
                                class="block-insert-btn"
                                type="button"
                                tabindex={visibleBlockInsertIndexes.has(0) ? 0 : -1}
                                on:click={() => toggleBlockInsert(0)}
                                aria-label={dragOverIndex === 0 ? 'Block hierhin verschieben' : 'Block einfügen'}
                                aria-haspopup="menu"
                                aria-expanded={blockInsertIndex === 0}
                              >
                                {#if dragOverIndex === 0}
                                  <span class="block-insert-drop-cue" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" focusable="false">
                                      <path
                                        d="M12 4v14M7 13l5 5 5-5M5 4h14"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="1.8"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                      />
                                    </svg>
                                    <span>Hierhin verschieben</span>
                                  </span>
                                {:else}
                                  +
                                {/if}
                              </button>
                              {#if blockInsertIndex === 0 && dragIndex === null}
                                <div class="block-insert-menu" role="menu">
                                  {#each BLOCK_TEMPLATES as template (template.id)}
                                    <button
                                      class="block-insert-option"
                                      type="button"
                                      role="menuitem"
                                      on:click={() => insertBlockTemplateAt(0, template)}
                                    >
                                      <span class="worksheet-type-icon block-insert-option__icon" aria-hidden="true">
                                        <svg viewBox={template.icon.viewBox} focusable="false">
                                          {#each template.icon.paths as path}
                                            <path d={path} />
                                          {/each}
                                        </svg>
                                      </span>
                                      <span class="block-insert-option__text">
                                        <span class="block-insert-option__label">{template.label}</span>
                                        <span class="block-insert-option__meta">{template.meta}</span>
                                      </span>
                                    </button>
                                  {/each}
                                </div>
                              {/if}
                            </div>
                          </div>
                          {#each visualBlocks as block, idx (visualBlockIds[idx])}
                            {@const blockType = detectWorksheetBlockType(block)}
                            {@const blockIsActive = visualActiveBlock === idx}
                            {@const blockIsFreitext = isFreitextBlock(block)}
                            {@const blockAnswerKey = getBlockAnswerKey(block)}
                            <div
                              class="block-editor"
                              class:block-editor--active={blockIsActive}
                              class:block-editor--inactive={!blockIsActive}
                              class:block-editor--html={visualBlockViews[idx] === 'html'}
                              class:block-editor--title={isTitelBlock(block)}
                              class:block-editor--freitext={blockIsFreitext}
                              draggable="true"
                              role={blockIsActive ? 'group' : 'button'}
                              aria-label={`${blockType.shortLabel} Block ${blockIsActive ? 'ausgewählt' : 'auswählen'}`}
                              on:pointerdown={(event) => handleVisualBlockPointerDown(event, idx)}
                              on:dblclick={(event) => handleVisualBlockDoubleClick(event, idx)}
                              on:click={(event) => handleVisualBlockClick(event, idx)}
                              on:keydown={(event) => handleVisualBlockKeydown(event, idx)}
                              on:focusin={(event) => handleVisualBlockFocusIn(event, idx)}
                              on:dragstart={(event) => handleBlockDragStart(event, idx)}
                              on:dragend={handleBlockDragEnd}
                            >
                              {#if blockIsActive}
                                <span class="block-type-badge">
                                  <span class="worksheet-type-icon block-type-badge__icon" aria-hidden="true">
                                    <svg viewBox={blockType.icon.viewBox} focusable="false">
                                      {#each blockType.icon.paths as path}
                                        <path d={path} />
                                      {/each}
                                    </svg>
                                  </span>
                                  <span>{blockType.shortLabel}</span>
                                  {#if blockAnswerKey}
                                    <span class="block-type-badge__key">{blockAnswerKey}</span>
                                  {/if}
                                </span>
                              {/if}
                              {#if blockIsActive}
                                <div class="block-format-tools">
                                {#if isTitelBlock(block)}
                                  <select
                                    class="ghost ci-btn-outline tool-select tool-select--title"
                                    aria-label="Titeltyp"
                                    value={getTitelLevelFromBlock(block)}
                                    on:change={(event) => setTitelBlockLevel(idx, event)}
                                  >
                                    {#each TITEL_LEVEL_OPTIONS as option}
                                      <option value={option.value}>{option.label}</option>
                                    {/each}
                                  </select>
                                {:else if visualBlockViews[idx] === 'visual' && !isUmfrageMatrixBlock(block)}
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
                                  <button
                                    class="ghost ci-btn-outline tool-btn"
                                    type="button"
                                    title="Link einfügen"
                                    aria-label="Link einfügen"
                                    on:mousedown|preventDefault
                                    on:click={() => applyLinkFormat(idx)}
                                  >
                                    <span class="tool-icon tool-icon--link" aria-hidden="true">
                                      <svg viewBox="0 0 24 24" focusable="false">
                                        <path
                                          d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.93"
                                          fill="none"
                                          stroke="currentColor"
                                          stroke-width="1.8"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                        />
                                        <path
                                          d="M14 11a5 5 0 0 0-7.07 0l-1.41 1.41a5 5 0 0 0 7.07 7.07L14 18.07"
                                          fill="none"
                                          stroke="currentColor"
                                          stroke-width="1.8"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                        />
                                      </svg>
                                    </span>
                                  </button>
                                  <div class="tool-divider" aria-hidden="true"></div>
                                  <select
                                    class="ghost ci-btn-outline tool-select"
                                    aria-label="Textgröße"
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
                                  <select class="ghost ci-btn-outline tool-select" aria-label="Lückenbreite" bind:value={lueckeInsertWidth}>
                                    {#each LUECKE_WIDTH_OPTIONS as option}
                                      <option value={option.value}>{option.label}</option>
                                    {/each}
                                  </select>
                                  <button
                                    class="ghost ci-btn-outline tool-btn"
                                    type="button"
                                    title="Lücke einfügen"
                                    aria-label="Lücke einfügen"
                                    on:mousedown|preventDefault
                                    on:click={() => insertSnippetIntoBlock(idx, lueckeInsertWidth)}
                                  >
                                    <span class="worksheet-type-icon tool-icon tool-icon--gap" aria-hidden="true">
                                      <svg viewBox={LUECKE_ELEMENT_TYPE.icon.viewBox} focusable="false">
                                        {#each LUECKE_ELEMENT_TYPE.icon.paths as path}
                                          <path d={path} />
                                        {/each}
                                      </svg>
                                    </span>
                                  </button>
                                  <div class="tool-divider" aria-hidden="true"></div>
                                {/if}
                                <button
                                  class="ghost ci-btn-outline tool-btn tool-btn--right-start tool-btn--danger"
                                  type="button"
                                  title="Block löschen"
                                  aria-label="Block löschen"
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
                                {#if !isTitelBlock(block)}
                                  {#if !blockIsFreitext}
                                  <button
                                    class="ghost ci-btn-outline tool-btn tool-btn--view-toggle"
                                    type="button"
                                    on:click={() => toggleVisualBlockView(idx)}
                                    title={
                                      visualBlockViews[idx] === 'html'
                                        ? 'Aktuell HTML - zu Visuell wechseln'
                                        : 'Aktuell Visuell - zu HTML wechseln'
                                    }
                                    aria-label={
                                      visualBlockViews[idx] === 'html'
                                        ? 'Darstellung: HTML. Zu Visuell wechseln'
                                        : 'Darstellung: Visuell. Zu HTML wechseln'
                                    }
                                  >
                                    {#if visualBlockViews[idx] === 'html'}
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
                                    {:else}
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
                                        <circle
                                          cx="12"
                                          cy="12"
                                          r="2.5"
                                          fill="none"
                                          stroke="currentColor"
                                          stroke-width="1.8"
                                        />
                                      </svg>
                                    {/if}
                                  </button>
                                  {/if}
                                  <button
                                    class="ghost ci-btn-outline tool-btn"
                                    class:active={visualBlockPromptOpen[idx]}
                                    type="button"
                                    on:click={() => toggleVisualBlockPrompts(idx)}
                                    title={visualBlockPromptOpen[idx] ? 'Prompts ausblenden' : 'Prompts einblenden'}
                                    aria-label={
                                      visualBlockPromptOpen[idx]
                                        ? 'Prompts ausblenden'
                                        : 'Prompts einblenden und bearbeiten'
                                    }
                                  >
                                    <span class="tool-icon" aria-hidden="true">
                                      <svg
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                        focusable="false"
                                      >
                                        <path
                                          d="M21 14a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7Z"
                                          fill="none"
                                          stroke="currentColor"
                                          stroke-width="1.8"
                                          stroke-linejoin="round"
                                        />
                                        <path
                                          d="M8 10h8M8 13.5h5"
                                          fill="none"
                                          stroke="currentColor"
                                          stroke-width="1.8"
                                          stroke-linecap="round"
                                        />
                                      </svg>
                                    </span>
                                  </button>
                                {/if}
                                </div>
                              {/if}
                              {#if blockIsFreitext}
                                {@const freitextInstructionHtml = getEditableFreitextInstructionHtml(block)}
                                {@const freitextCriteria = getFreitextCriteria(block)}
                                {@const freitextPremises = getFreitextPremises(block)}
                                {@const freitextReferences = getFreitextReferences(block)}
                                {@const freitextMainPrompt = getFreitextMainPrompt(block)}
                                {@const freitextAnswerElements = getSelectableAnswerElements(idx)}
                                {@const freitextSourceOptionsId = `freitext-source-options-${visualBlockIds[idx] || idx}`}
                                <div
                                  class="freitext-block-editor"
                                  class:freitext-block-editor--active={blockIsActive}
                                  class:freitext-block-editor--compact={!blockIsActive}
                                >
                                  <div
                                    class="block-editor__visual freitext-instruction-editor"
                                    contenteditable={blockIsActive ? 'true' : 'false'}
                                    role="textbox"
                                    tabindex={blockIsActive ? '0' : '-1'}
                                    aria-readonly={!blockIsActive}
                                    aria-multiline="true"
                                    spellcheck="false"
                                    aria-label="Freitext-Beschreibung visuell bearbeiten"
                                    use:syncEditableHtml={{
                                      html: freitextInstructionHtml,
                                      freezeWhileFocused:
                                        blockIsActive &&
                                        visualActiveBlock === idx && !visualHistoryApplying
                                    }}
                                    bind:this={visualBlockEditors[idx]}
                                    on:focus={() => (visualActiveBlock = idx)}
                                    on:blur={flushVisualInputCommits}
                                    on:beforeinput={(event) => handleVisualBeforeInput(event, idx)}
                                    on:keydown={(event) => handleVisualKeydown(event, idx)}
                                    on:input={(event) => handleFreitextInstructionVisualInput(idx, event)}
                                    on:mouseup={() => handleVisualSelectionChange(idx)}
                                    on:keyup={() => handleVisualSelectionChange(idx)}
                                  ></div>
                                  <div
                                    class="freitext-checklist-editor freitext-checklist-editor--premises"
                                    class:freitext-checklist-editor--empty={freitextPremises.length === 0}
                                  >
                                    <div class="freitext-checklist-editor__header">
                                      <strong>Prämissen</strong>
                                      <span class="freitext-checklist-editor__count">{freitextPremises.length}</span>
                                      {#if blockIsActive}
                                        <button
                                          class="icon-btn ci-btn-outline freitext-checklist-editor__add"
                                          type="button"
                                          title="Prämissenfeld hinzufügen"
                                          aria-label="Prämissenfeld hinzufügen"
                                          on:click={() => addFreitextPremise(idx)}
                                        >
                                          +
                                        </button>
                                      {/if}
                                    </div>
                                    {#if freitextPremises.length}
                                      {#if blockIsActive}
                                        <div class="freitext-checklist-editor__field-headings freitext-checklist-editor__field-headings--premises">
                                          <span>Titel</span>
                                          <span>Eingabeelement</span>
                                          <span>Beschreibung intern</span>
                                          <span aria-hidden="true"></span>
                                        </div>
                                        <datalist id={freitextSourceOptionsId}>
                                          {#each freitextAnswerElements as answerElement}
                                            <option value={answerElement.key}>{answerElement.label}</option>
                                          {/each}
                                        </datalist>
                                      {/if}
                                      <ol class="freitext-checklist-editor__list">
                                        {#each freitextPremises as premise, premiseIndex}
                                          <li class="freitext-checklist-editor__item">
                                            <div class="freitext-checklist-editor__fields freitext-checklist-editor__fields--premises">
                                              <label>
                                                <span class="freitext-checklist-editor__sr-label">Titel</span>
                                                <textarea
                                                  class="freitext-checklist-editor__label-field"
                                                  rows="1"
                                                  value={premise.label}
                                                  placeholder="z. B. Link zum Inserat"
                                                  use:fitTextareaToContent={premise.label}
                                                  readonly={!blockIsActive}
                                                  tabindex={blockIsActive ? '0' : '-1'}
                                                  on:input={(event) =>
                                                    blockIsActive && updateFreitextPremise(
                                                      idx,
                                                      premiseIndex,
                                                      { label: event.currentTarget.value },
                                                      event
                                                    )}
                                                ></textarea>
                                              </label>
                                              <label>
                                                <span class="freitext-checklist-editor__sr-label">Eingabeelement</span>
                                                <input
                                                  class="freitext-checklist-editor__source-field"
                                                  type="text"
                                                  value={premise.sourceKey || ''}
                                                  list={freitextSourceOptionsId}
                                                  placeholder={freitextAnswerElements.length ? 'Key wählen oder einfügen' : 'z. B. luecke1'}
                                                  readonly={!blockIsActive}
                                                  tabindex={blockIsActive ? '0' : '-1'}
                                                  on:input={(event) => {
                                                    if (!blockIsActive) return;
                                                    const sourceKey = event.currentTarget.value;
                                                    updateFreitextPremise(
                                                      idx,
                                                      premiseIndex,
                                                      {
                                                        sourceKey,
                                                        sourceType:
                                                          sourceKey.trim()
                                                            ? getAnswerElementTypeForKey(
                                                                freitextAnswerElements,
                                                                sourceKey
                                                              ) ||
                                                              premise.sourceType ||
                                                              ''
                                                            : ''
                                                      },
                                                      event
                                                    );
                                                  }}
                                                />
                                                {#if premise.sourceKey && getAnswerElementLabelForKey(freitextAnswerElements, premise.sourceKey)}
                                                  <span class="freitext-checklist-editor__source-meta">
                                                    {getAnswerElementLabelForKey(freitextAnswerElements, premise.sourceKey)}
                                                  </span>
                                                {/if}
                                              </label>
                                              <label>
                                                <span class="freitext-checklist-editor__sr-label">Beschreibung intern</span>
                                                <textarea
                                                  rows="1"
                                                  value={premise.description}
                                                  placeholder="Interne Prüfhinweise zur Prämisse"
                                                  use:fitTextareaToContent={premise.description}
                                                  readonly={!blockIsActive}
                                                  tabindex={blockIsActive ? '0' : '-1'}
                                                  on:input={(event) =>
                                                    blockIsActive && updateFreitextPremise(
                                                      idx,
                                                      premiseIndex,
                                                      { description: event.currentTarget.value },
                                                      event
                                                  )}
                                                ></textarea>
                                              </label>
                                            </div>
                                            {#if blockIsActive}
                                              <button
                                                class="icon-btn ci-btn-outline tool-btn--danger freitext-checklist-editor__delete"
                                                type="button"
                                                title="Prämissenfeld löschen"
                                                aria-label="Prämissenfeld löschen"
                                                on:click={() => deleteFreitextPremise(idx, premiseIndex)}
                                              >
                                                ×
                                              </button>
                                            {/if}
                                          </li>
                                        {/each}
                                      </ol>
                                    {:else if blockIsActive}
                                      <p class="hint">Noch keine Prämissenfelder erfasst.</p>
                                    {/if}
                                  </div>
                                  <div
                                    class="freitext-checklist-editor freitext-checklist-editor--references"
                                    class:freitext-checklist-editor--empty={freitextReferences.length === 0}
                                  >
                                      <div class="freitext-checklist-editor__header">
                                        <strong>Verknüpfungen</strong>
                                        <span class="freitext-checklist-editor__count">{freitextReferences.length}</span>
                                        {#if blockIsActive}
                                          <button
                                            class="icon-btn ci-btn-outline freitext-checklist-editor__add"
                                            type="button"
                                            title="Verknüpfung hinzufügen"
                                            aria-label="Verknüpfung hinzufügen"
                                            on:click={() => addFreitextReference(idx)}
                                          >
                                            +
                                          </button>
                                        {/if}
                                      </div>
                                      {#if freitextReferences.length}
                                        {#if blockIsActive}
                                          <div class="freitext-checklist-editor__field-headings freitext-checklist-editor__field-headings--references">
                                            <span>Titel</span>
                                            <span>Antwort-Key</span>
                                            <span>Hinweis</span>
                                            <span>Schwelle</span>
                                            <span aria-hidden="true"></span>
                                          </div>
                                        {/if}
                                        <ol class="freitext-checklist-editor__list">
                                          {#each freitextReferences as reference, referenceIndex}
                                            <li class="freitext-checklist-editor__item">
                                              <div class="freitext-checklist-editor__fields freitext-checklist-editor__fields--references">
                                                <label>
                                                  <span class="freitext-checklist-editor__sr-label">Titel</span>
                                                  <textarea
                                                    class="freitext-checklist-editor__label-field"
                                                    rows="1"
                                                    value={reference.label}
                                                    placeholder="z. B. Vorarbeit"
                                                    use:fitTextareaToContent={reference.label}
                                                    readonly={!blockIsActive}
                                                    tabindex={blockIsActive ? '0' : '-1'}
                                                    on:input={(event) =>
                                                      blockIsActive && updateFreitextReference(
                                                        idx,
                                                        referenceIndex,
                                                        { label: event.currentTarget.value },
                                                        event
                                                      )}
                                                  ></textarea>
                                                </label>
                                                <label>
                                                  <span class="freitext-checklist-editor__sr-label">Antwort-Key</span>
                                                  <textarea
                                                    rows="1"
                                                    value={reference.sourceKey}
                                                    placeholder="answer-key"
                                                    use:fitTextareaToContent={reference.sourceKey}
                                                    readonly={!blockIsActive}
                                                    tabindex={blockIsActive ? '0' : '-1'}
                                                    on:input={(event) =>
                                                      blockIsActive && updateFreitextReference(
                                                        idx,
                                                        referenceIndex,
                                                        { sourceKey: event.currentTarget.value },
                                                        event
                                                      )}
                                                  ></textarea>
                                                </label>
                                                <label>
                                                  <span class="freitext-checklist-editor__sr-label">Hinweis</span>
                                                  <textarea
                                                    rows="1"
                                                    value={reference.prompt}
                                                    placeholder="Was wird aus der Vorarbeit verwendet?"
                                                    use:fitTextareaToContent={reference.prompt}
                                                    readonly={!blockIsActive}
                                                    tabindex={blockIsActive ? '0' : '-1'}
                                                    on:input={(event) =>
                                                      blockIsActive && updateFreitextReference(
                                                        idx,
                                                        referenceIndex,
                                                        { prompt: event.currentTarget.value },
                                                        event
                                                      )}
                                                  ></textarea>
                                                </label>
                                                <label class="freitext-checklist-editor__threshold">
                                                  <span class="freitext-checklist-editor__sr-label">Schwelle</span>
                                                  <select
                                                    value={String(reference.minClassification)}
                                                    disabled={!blockIsActive}
                                                    tabindex={blockIsActive ? '0' : '-1'}
                                                    aria-label="Mindeststatus der Verknüpfung"
                                                    on:change={(event) =>
                                                      updateFreitextReference(
                                                        idx,
                                                        referenceIndex,
                                                        {
                                                          minClassification: Number(event.currentTarget.value)
                                                        },
                                                        event
                                                      )}
                                                  >
                                                    <option value="900">richtig</option>
                                                    <option value="101">teilweise</option>
                                                    <option value="0">eingetragen</option>
                                                  </select>
                                                </label>
                                              </div>
                                              {#if blockIsActive}
                                                <button
                                                  class="icon-btn ci-btn-outline tool-btn--danger freitext-checklist-editor__delete"
                                                  type="button"
                                                  title="Verknüpfung löschen"
                                                  aria-label="Verknüpfung löschen"
                                                  on:click={() => deleteFreitextReference(idx, referenceIndex)}
                                                >
                                                  ×
                                                </button>
                                              {/if}
                                            </li>
                                          {/each}
                                        </ol>
                                      {:else if blockIsActive}
                                        <p class="hint">Noch keine Verknüpfungen erfasst.</p>
                                      {/if}
                                  </div>
                                  <div
                                    class="freitext-checklist-editor"
                                    class:freitext-checklist-editor--empty={freitextCriteria.length === 0}
                                  >
                                    <div class="freitext-checklist-editor__header">
                                      <strong>Checkliste</strong>
                                      <span class="freitext-checklist-editor__count">{freitextCriteria.length}</span>
                                      {#if blockIsActive}
                                        <button
                                          class="icon-btn ci-btn-outline freitext-checklist-editor__add"
                                          type="button"
                                          title="Checklistenpunkt hinzufügen"
                                          aria-label="Checklistenpunkt hinzufügen"
                                          on:click={() => addFreitextCriterion(idx)}
                                        >
                                          +
                                        </button>
                                      {/if}
                                    </div>
                                    {#if freitextCriteria.length}
                                      {#if blockIsActive}
                                        <div class="freitext-checklist-editor__field-headings freitext-checklist-editor__field-headings--criteria">
                                          <span>Titel</span>
                                          <span>Beschreibung sichtbar</span>
                                          <span>Beschreibung intern</span>
                                          <span aria-hidden="true"></span>
                                        </div>
                                      {/if}
                                      <ol class="freitext-checklist-editor__list">
                                        {#each freitextCriteria as criterion, criterionIndex}
                                          <li class="freitext-checklist-editor__item">
                                            <div class="freitext-checklist-editor__fields freitext-checklist-editor__fields--criteria">
                                              <label>
                                                <span class="freitext-checklist-editor__sr-label">Titel</span>
                                                <textarea
                                                  class="freitext-checklist-editor__label-field"
                                                  rows="1"
                                                  value={criterion.label}
                                                  placeholder="z. B. Preis"
                                                  use:fitTextareaToContent={criterion.label}
                                                  readonly={!blockIsActive}
                                                  tabindex={blockIsActive ? '0' : '-1'}
                                                  on:input={(event) =>
                                                    blockIsActive && updateFreitextCriterion(
                                                      idx,
                                                      criterionIndex,
                                                      { label: event.currentTarget.value },
                                                      event
                                                    )}
                                                ></textarea>
                                              </label>
                                              <label>
                                                <span class="freitext-checklist-editor__sr-label">
                                                  Beschreibung sichtbar
                                                </span>
                                                <textarea
                                                  rows="1"
                                                  value={criterion.description}
                                                  placeholder="Was muss zwingend vorkommen?"
                                                  use:fitTextareaToContent={criterion.description}
                                                  readonly={!blockIsActive}
                                                  tabindex={blockIsActive ? '0' : '-1'}
                                                  on:input={(event) =>
                                                    blockIsActive && updateFreitextCriterion(
                                                      idx,
                                                      criterionIndex,
                                                      { description: event.currentTarget.value },
                                                      event
                                                    )}
                                                ></textarea>
                                              </label>
                                              <label>
                                                <span class="freitext-checklist-editor__sr-label">Beschreibung intern</span>
                                                <textarea
                                                  rows="1"
                                                  value={criterion.internalDescription || ''}
                                                  placeholder="Interne Prüfhinweise"
                                                  use:fitTextareaToContent={criterion.internalDescription || ''}
                                                  readonly={!blockIsActive}
                                                  tabindex={blockIsActive ? '0' : '-1'}
                                                  on:input={(event) =>
                                                    blockIsActive && updateFreitextCriterion(
                                                      idx,
                                                      criterionIndex,
                                                      { internalDescription: event.currentTarget.value },
                                                      event
                                                    )}
                                                ></textarea>
                                              </label>
                                            </div>
                                            {#if blockIsActive}
                                              <button
                                                class="icon-btn ci-btn-outline tool-btn--danger freitext-checklist-editor__delete"
                                                type="button"
                                                title="Checklistenpunkt löschen"
                                                aria-label="Checklistenpunkt löschen"
                                                on:click={() => deleteFreitextCriterion(idx, criterionIndex)}
                                              >
                                                ×
                                              </button>
                                            {/if}
                                          </li>
                                        {/each}
                                      </ol>
                                    {:else if blockIsActive}
                                      <p class="hint">Noch keine zwingenden Elemente erfasst.</p>
                                    {/if}
                                  </div>
                                  {#if blockIsActive}
                                    <div class="freitext-block-editor__answer-preview">
                                      <textarea
                                        class="freitext__textarea"
                                        rows={getFreitextRows(block)}
                                        value={freitextMainPrompt}
                                        placeholder="Interner Prüfauftrag für die Bewertung dieses Haupttextes"
                                        aria-label="Prompt für Prüfung des Haupttextes"
                                        use:fitTextareaToContent={freitextMainPrompt}
                                        on:input={(event) =>
                                          setVisualBlockFreitextMainPrompt(
                                            idx,
                                            event.currentTarget.value
                                          )}
                                      ></textarea>
                                      <div class="freitext__actions" aria-hidden="true">
                                        <button
                                          type="button"
                                          class="check-btn ci-btn-primary"
                                          aria-label="Aktuellen Stand prüfen"
                                          disabled
                                        ></button>
                                        <input
                                          class="freitext__question-field"
                                          type="text"
                                          placeholder="Optional: Was soll beim Prüfen besonders beachtet werden?"
                                          disabled
                                        />
                                      </div>
                                    </div>
                                  {/if}
                                </div>
                              {:else if !blockIsActive || visualBlockViews[idx] === 'visual'}
                                <div
                                  class="block-editor__visual"
                                  class:block-editor__visual--display={visualBlockViews[idx] === 'html'}
                                  contenteditable={blockIsActive && visualBlockViews[idx] === 'visual' ? 'true' : 'false'}
                                  role="textbox"
                                  tabindex={blockIsActive && visualBlockViews[idx] === 'visual' ? '0' : '-1'}
                                  aria-readonly={!blockIsActive || visualBlockViews[idx] === 'html'}
                                  spellcheck="false"
                                  use:syncEditableHtml={{
                                    html: block,
                                    freezeWhileFocused:
                                      blockIsActive &&
                                      visualBlockViews[idx] === 'visual' &&
                                      visualActiveBlock === idx &&
                                      !visualHistoryApplying
                                  }}
                                  bind:this={visualBlockEditors[idx]}
                                  on:focus={() => (visualActiveBlock = idx)}
                                  on:blur={flushVisualInputCommits}
                                  on:beforeinput={(event) => handleVisualBeforeInput(event, idx)}
                                  on:keydown={(event) => handleVisualKeydown(event, idx)}
                                  on:input={(event) =>
                                    visualBlockViews[idx] === 'visual' && handleVisualInput(idx, event)}
                                  on:mouseup={() => handleVisualSelectionChange(idx)}
                                  on:keyup={() => handleVisualSelectionChange(idx)}
                                ></div>
                              {/if}
                              {#if blockIsActive && visualBlockViews[idx] === 'html'}
                                <div class="code-editor visual-block-code-editor" aria-label="HTML-Block Editor">
                                  <pre class="code-highlight" aria-hidden="true" bind:this={visualBlockHtmlHighlights[idx]}>{#each visualBlockHtmlTokens[idx] || [] as token}<span class={`token token-${token.type}`}>{token.value}</span>{/each}</pre>
                                  <textarea
                                    class="code-input code-input--overlay"
                                    spellcheck="false"
                                    value={block}
                                    bind:this={visualBlockHtmlInputs[idx]}
                                    on:focus={() => {
                                      visualActiveBlock = idx;
                                      setVisualBlockHtmlHighlight(idx, visualBlockHtmlInputs[idx]?.value ?? block);
                                    }}
                                    on:blur={flushVisualHtmlInputWork}
                                    on:beforeinput={(event) => handleVisualHtmlBeforeInput(idx, event)}
                                    on:keydown={(event) => handleVisualHtmlKeydown(idx, event)}
                                    on:input={(event) => handleVisualHtmlInput(idx, event)}
                                    on:scroll={() =>
                                      syncCodeScroll(
                                        visualBlockHtmlInputs[idx],
                                        visualBlockHtmlHighlights[idx]
                                      )}
                                  ></textarea>
                                </div>
                              {/if}
                              {#if blockIsActive && !isTitelBlock(block) && visualBlockPromptOpen[idx]}
                                {@const blockPrompt = getBlockPromptFromHtml(block)}
                                <div class="block-prompts">
                                  <label class="block-prompt-field">
                                    <span>Block Prompt</span>
                                    <textarea
                                      rows="3"
                                      value={blockPrompt}
                                      placeholder="Prompt für diesen Block (optional)"
                                      on:input={(event) =>
                                        setVisualBlockPrompt(idx, event.currentTarget.value)}
                                    ></textarea>
                                  </label>
                                </div>
                              {/if}
                            </div>
                          <div
                            class="block-insert-row"
                            class:block-insert-row--visible={visibleBlockInsertIndexes.has(idx + 1)}
                            class:block-insert-row--dragging={dragIndex !== null}
                            class:block-insert-row--menu-open={blockInsertIndex === idx + 1 && dragIndex === null}
                            class:drag-over={dragOverIndex === idx + 1}
                            aria-hidden={!visibleBlockInsertIndexes.has(idx + 1)}
                            on:dragenter={(event) => handleInsertDragOver(event, idx + 1)}
                            on:dragover={(event) => handleInsertDragOver(event, idx + 1)}
                            on:dragleave={(event) => handleInsertDragLeave(event, idx + 1)}
                            on:drop={(event) => handleInsertDrop(event, idx + 1)}
                          >
                            <div class="block-insert">
                              <button
                                class="block-insert-btn"
                                type="button"
                                tabindex={visibleBlockInsertIndexes.has(idx + 1) ? 0 : -1}
                                on:click={() => toggleBlockInsert(idx + 1)}
                                aria-label={dragOverIndex === idx + 1 ? 'Block hierhin verschieben' : 'Block einfügen'}
                                aria-haspopup="menu"
                                aria-expanded={blockInsertIndex === idx + 1}
                              >
                                {#if dragOverIndex === idx + 1}
                                  <span class="block-insert-drop-cue" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" focusable="false">
                                      <path
                                        d="M12 4v14M7 13l5 5 5-5M5 4h14"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="1.8"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                      />
                                    </svg>
                                    <span>Hierhin verschieben</span>
                                  </span>
                                {:else}
                                  +
                                {/if}
                              </button>
                              {#if blockInsertIndex === idx + 1 && dragIndex === null}
                                <div class="block-insert-menu" role="menu">
                                  {#each BLOCK_TEMPLATES as template (template.id)}
                                    <button
                                      class="block-insert-option"
                                      type="button"
                                      role="menuitem"
                                      on:click={() => insertBlockTemplateAt(idx + 1, template)}
                                    >
                                      <span class="worksheet-type-icon block-insert-option__icon" aria-hidden="true">
                                        <svg viewBox={template.icon.viewBox} focusable="false">
                                          {#each template.icon.paths as path}
                                            <path d={path} />
                                          {/each}
                                        </svg>
                                      </span>
                                      <span class="block-insert-option__text">
                                        <span class="block-insert-option__label">{template.label}</span>
                                        <span class="block-insert-option__meta">{template.meta}</span>
                                      </span>
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
              </div>
            </div>
          {:else if editorView === 'preview'}
            <div class="preview">
              <div class="preview-header">Preview</div>
              <div class="preview-body" bind:this={previewEl}>
                {@html sanitizeSheetContent(editorContent)}
              </div>
            </div>
          {:else if editorView === 'answers'}
            <div class="preview answers">
              <div class="preview-header">Antworten</div>
              <div class="answers-meta-row">
                <p class="answers-title">
                  {editorName || (selectedKey ? `Sheet ${selectedKey}` : 'Kein Sheet ausgewählt')}
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
                  <label class="answers-class-select">
                    <span>Antworten</span>
                    <select
                      bind:value={answersUserFilter}
                      disabled={!answersClassId || answersLearnersLoading}
                    >
                      <option value="">Alle Antworten</option>
                      {#each answersLearners as learnerItem}
                        {#if learnerItem?.code}
                          <option value={learnerItem.code}>
                            {formatAnswersLearnerLabel(learnerItem)}
                          </option>
                        {/if}
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
              {#key `${answersRenderMode}:${answersRenderKey}`}
                <div class="preview-body answers-body" bind:this={answersEl} on:click={handleAnswersClick}>
                  {#if answersLoading}
                    <p class="hint">Lade Antworten...</p>
                  {/if}
                  {@html editorContent}
                </div>
              {/key}
            </div>
          {/if}
        </div>
      </main>
    </div>
    {/if}

    {/if}

    {#if activeTab === 'collections'}
    <section class="panel full">
      {#if !selectedCollectionId}
        <div class="panel-header classes-overview-header">
          <div>
            <h2>Sammlungen</h2>
            <p class="hint">{visibleCollections.length} / {collections.length} Einträge</p>
          </div>
          <div class="sheet-toolbar">
            <label class="sheet-filter">
              <span>Suchen</span>
              <input
                type="text"
                bind:value={collectionFilter}
                placeholder="Name oder Beschreibung"
              />
            </label>
            <button
              class="icon-btn ci-btn-outline refresh-btn"
              on:click={() => {
                fetchCollections({ autoSelect: false });
                fetchCollectionLinks();
              }}
              disabled={loadingCollections || loadingCollectionLinks}
              title="Sammlungen aktualisieren"
              aria-label="Sammlungen aktualisieren"
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
              class="ci-btn-secondary"
              type="button"
              on:click={() => {
                newCollectionName = '';
                newCollectionDescription = '';
                showCollectionModal = true;
              }}
            >
              Neue Sammlung
            </button>
          </div>
        </div>

        <div class="manage-card">
          {#if loadingCollections || loadingCollectionLinks}
            <p class="hint">Lade Sammlungen...</p>
          {:else if collections.length === 0}
            <p class="hint">Noch keine Sammlungen vorhanden.</p>
          {:else if visibleCollections.length === 0}
            <p class="hint">Keine Treffer für den Filter.</p>
          {:else}
            <ListTable
              columns={collectionColumns}
              rows={visibleCollections}
              columnsTemplate={COLLECTION_TABLE_COLUMNS}
              tableClass="sheet-table sheet-table--collections"
              rowKey={(entry) => entry.id}
              onRowClick={(entry) => selectCollection(entry.id)}
              rowAriaLabel={(entry) =>
                `Sammlung ${entry.name || entry.id} öffnen`
              }
              actionsLabel="Aktion"
            >
              <svelte:fragment slot="actions" let:row>
                <button
                  class="icon-btn ci-btn-outline"
                  title="Sammlung löschen"
                  aria-label="Sammlung löschen"
                  on:click|stopPropagation={() => deleteCollection(row.id)}
                  disabled={deletingCollection || (isAdmin && normalizeUserId(row?.user) !== userId)}
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
          {#if collectionError}
            <p class="error-text">{collectionError}</p>
          {/if}
          {#if collectionLinkError}
            <p class="error-text">{collectionLinkError}</p>
          {/if}
        </div>
      {:else}
        <div class="panel-header">
          <div>
            <button
              class="ghost ci-btn-outline"
              on:click={() => {
                resetCollectionSelection();
              }}
              type="button"
            >
              Zurück
            </button>
            <div class="collection-title-row">
              <label class="collection-title-field">
                <span>Sammlung</span>
                <input
                  type="text"
                  bind:value={collectionName}
                  placeholder="Name der Sammlung"
                  disabled={collectionReadOnly}
                />
              </label>
              <button
                class="icon-btn ci-btn-outline collection-title-icon"
                type="button"
                aria-expanded={collectionDescriptionOpen}
                aria-controls="collection-description-panel"
                aria-label="Beschreibung anzeigen"
                title="Beschreibung"
                on:click={() => (collectionDescriptionOpen = !collectionDescriptionOpen)}
              >
                <svg class="info-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    d="M12 17v-6M12 7.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <button
                class="icon-btn ci-btn-outline collection-title-icon"
                type="button"
                on:click={saveCollection}
                disabled={savingCollection || collectionReadOnly}
                aria-label="Sammlung speichern"
                title={savingCollection ? 'Sammlung wird gespeichert' : 'Sammlung speichern'}
              >
                {#if savingCollection}
                  <span class="editor-action-btn__spinner" aria-hidden="true"></span>
                {:else}
                  <svg class="save-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      d="M5 4h11l3 3v13H5zM8 4v6h8V4M9 16h6"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                {/if}
              </button>
            </div>
            {#if collectionReadOnly}
              <p class="hint">Admin: Fremde Sammlung (nur lesen).</p>
            {/if}
          </div>
          <div class="row-actions">
            <button
              class="icon-btn ci-btn-outline refresh-btn"
              on:click={() => {
                fetchCollections();
                fetchCollectionLinks();
              }}
              disabled={loadingCollections || loadingCollectionLinks}
              title="Sammlung aktualisieren"
              aria-label="Sammlung aktualisieren"
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
              class="ghost ci-btn-outline tool-btn--danger"
              type="button"
              on:click={() => deleteCollection(selectedCollectionId)}
              disabled={deletingCollection || collectionReadOnly}
            >
              {deletingCollection ? 'Lösche...' : 'Löschen'}
            </button>
          </div>
        </div>

        {#if collectionDescriptionOpen}
          <div class="manage-card collection-description-panel" id="collection-description-panel">
            <label>
              <span>Beschreibung</span>
              <textarea
                rows="5"
                bind:value={collectionDescription}
                placeholder="Wofür ist diese Sammlung gedacht?"
                disabled={collectionReadOnly}
              ></textarea>
            </label>
            {#if collectionError}
              <p class="error-text">{collectionError}</p>
            {/if}
          </div>
        {:else if collectionError}
          <p class="error-text">{collectionError}</p>
        {/if}

        <div class="manage-grid">
          <div class="manage-card manage-card--wide">
            <div class="panel-header sheet-header">
              <div>
                <h3>Arbeitsblätter</h3>
                <p class="hint">
                  {selectedCollectionVisibleSheets.length} / {selectedCollectionEntries.length} Einträge
                </p>
              </div>
              <div class="sheet-toolbar">
                <label class="sheet-filter">
                  <span>Suchen</span>
                  <input
                    type="text"
                    bind:value={sheetFilter}
                    placeholder="Titel oder Inhalt"
                  />
                </label>
                <a class="ci-btn-secondary" href="/import/material">Material importieren</a>
                <button
                  class="ci-btn-secondary"
                  on:click={() => {
                    newSheetName = '';
                    newSheetKey = '';
                    sheetError = '';
                    newSheetCollectionId =
                      String(normalizeCollectionId(selectedCollectionId) ?? getPreferredEditableCollectionId());
                    showCreateSheetModal = true;
                  }}
                  disabled={collectionReadOnly || editableCollections.length === 0}
                >
                  Neues Sheet
                </button>
              </div>
            </div>
            {#if loadingSheets || loadingCollectionLinks}
              <p class="hint">Lade Sheets…</p>
            {:else if selectedCollectionEntries.length === 0}
              <p class="hint">Noch keine Sheets in dieser Sammlung vorhanden.</p>
            {:else if selectedCollectionVisibleSheets.length === 0}
              <p class="hint">Keine Treffer für den Filter.</p>
            {:else}
              <ListTable
                columns={sheetColumns}
                rows={selectedCollectionVisibleSheets}
                columnsTemplate={SHEET_TABLE_COLUMNS}
                tableClass="sheet-table sheet-table--sheet-list"
                rowKey={(sheet) => sheet.id}
                onRowClick={(sheet) => openShopSheet(sheet.id)}
                rowAriaLabel={(sheet) => `Sheet ${sheet.name || sheet.key || sheet.id} öffnen`}
                actionsLabel="Aktion"
                compactBreakpoint={900}
              >
                <svelte:fragment slot="actions" let:row>
                  <button
                    class="icon-btn ci-btn-outline"
                    title="Sheet löschen"
                    aria-label="Sheet löschen"
                    on:click|stopPropagation={() => deleteSheet(row.id)}
                    disabled={deleting || (isAdmin && normalizeUserId(row?.user) !== userId)}
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
            {#if sheetError}
              <p class="error-text">{sheetError}</p>
            {/if}
            {#if collectionLinkError}
              <p class="error-text">{collectionLinkError}</p>
            {/if}
          </div>
        </div>
      {/if}
    </section>
    {/if}

    {#if activeTab === 'classes'}
    <section class="panel full">
      {#if !selectedClassId}
        <div class="panel-header classes-overview-header">
          <div>
            <h2>Klassen</h2>
            <p class="hint">Wähle eine Klasse, um Details zu sehen.</p>
          </div>
          <div class="row-actions">
            <label class="classes-school-filter">
              <span>Schule</span>
              <select bind:value={classSchoolFilter} disabled={loadingSchools}>
                <option value="">Alle Schulen</option>
                {#each schools as school}
                  <option value={String(school.id)}>
                    {school.name || `Schule #${school.id}`}
                  </option>
                {/each}
              </select>
            </label>
            <button
              class="icon-btn ci-btn-outline refresh-btn"
              on:click={() => fetchClasses({ autoSelect: false })}
              disabled={loadingClasses}
              title="Klassen aktualisieren"
              aria-label="Klassen aktualisieren"
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
              class="ci-btn-secondary"
              on:click={() => {
                newClassName = '';
                newClassYear = '';
                newClassProfession = '';
                newClassNotes = '';
                newClassPrompt = '';
                newClassSchoolId = '';
                showClassModal = true;
              }}
            >
              Neue Klasse
            </button>
          </div>
        </div>

        <div class="manage-card">
          {#if loadingClasses}
            <p class="hint">Lade Klassen...</p>
          {:else if classes.length === 0}
            <p class="hint">Keine Klassen vorhanden.</p>
          {:else if visibleClasses.length === 0}
            <p class="hint">Keine Klassen für die ausgewählte Schule.</p>
          {:else}
            <div class="class-table-wrap">
              <ListTable
                columns={classColumns}
                rows={visibleClasses}
                columnsTemplate={CLASS_TABLE_COLUMNS}
                tableClass="sheet-table sheet-table--classes"
                rowKey={(entry) => entry.id}
                onRowClick={(entry) => selectClass(entry.id)}
                rowAriaLabel={(entry) =>
                  `Klasse ${entry.name || entry.id} öffnen`
                }
                actionsLabel="Aktion"
              >
                <svelte:fragment slot="actions" let:row>
                  <button
                    class="icon-btn ci-btn-outline class-action-btn"
                    title="Arbeitsblätter zuweisen"
                    aria-label="Arbeitsblätter zuweisen"
                    on:click|stopPropagation={() => openClassAssignments(row.id)}
                    disabled={isAdmin && normalizeUserId(row?.user) !== userId}
                    type="button"
                  >
                    <svg class="class-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path
                        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11ZM8 8h8M8 12h8M8 16h5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                    Arbeitsblätter
                  </button>
                  <button
                    class="icon-btn ci-btn-outline class-action-btn"
                    title="Studierende anzeigen"
                    aria-label="Studierende anzeigen"
                    on:click|stopPropagation={() => openLearnersForClass(row.id)}
                    disabled={isAdmin && normalizeUserId(row?.user) !== userId}
                    type="button"
                  >
                    <svg class="class-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path
                        d="M16 18.5a3.5 3.5 0 0 1 3.5 3.5M8 18.5A3.5 3.5 0 0 0 4.5 22M12 14a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-2a2.5 2.5 0 1 0 0-5m-14 5a2.5 2.5 0 1 1 0-5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                    Studierende
                  </button>
                  <button
                    class="icon-btn ci-btn-outline class-action-btn"
                    title="Klasse löschen"
                    aria-label="Klasse löschen"
                    on:click|stopPropagation={() => deleteClass(row.id)}
                    disabled={deletingClass || (isAdmin && normalizeUserId(row?.user) !== userId)}
                    type="button"
                  >
                    <svg class="class-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path
                        d="M4 7h16M9 7v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M10 11v6M14 11v6M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                    Löschen
                  </button>
                </svelte:fragment>
              </ListTable>
            </div>
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
              Zurück
            </button>
            <h2>
              {classDetailView === 'assignments'
                ? 'Arbeitsblätter'
                : classDetailView === 'learners'
                ? 'Studierende'
                : 'Klasse'}
            </h2>
            <p class="hint">
              {className || 'Klasse'} {classYear || ''} {classProfession || ''}
              {getSchoolLabel(classSchoolId) ? ` · ${getSchoolLabel(classSchoolId)}` : ''}
            </p>
            {#if classReadOnly}
              <p class="hint">Admin: Fremde Klasse (nur lesen).</p>
            {/if}
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
              disabled={classReadOnly}
              type="button"
            >
              Studierende
            </button>
            <button
              class="ci-tab"
              class:selected={classDetailView === 'assignments'}
              on:click={() => openAssignmentsForClass()}
              disabled={classReadOnly}
              type="button"
            >
              Arbeitsblätter
            </button>
            {#if classDetailView === 'learners'}
              <button
                class="icon-btn ci-btn-outline refresh-btn"
                on:click={() => fetchLearners(selectedClassId)}
                disabled={classReadOnly || loadingLearners}
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
                class="ci-btn-secondary"
                on:click={() => {
                  learnerModalMode = 'create';
                  newLearnerName = '';
                  newLearnerNotes = '';
                  newLearnerPrompt = '';
                  selectedLearnerCode = '';
                  showLearnerModal = true;
                }}
                disabled={classReadOnly}
                type="button"
              >
                Neue Lernende
              </button>
            {:else if classDetailView === 'assignments'}
              <button
                class="icon-btn ci-btn-outline refresh-btn"
                on:click={() => openAssignmentsForClass()}
                disabled={loadingPlan}
                title="Arbeitsblätter aktualisieren"
                aria-label="Arbeitsblätter aktualisieren"
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
            <h3>Arbeitsblätter zuweisen</h3>
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
                      <button
                        class="ghost ci-btn-outline tool-btn"
                        type="button"
                        title="Prompt bearbeiten"
                        aria-label="Prompt bearbeiten"
                        on:click|preventDefault|stopPropagation={() => togglePlanPrompt(sheet.key)}
                        disabled={!sheet.key}
                      >
                        Prompt
                      </button>
                    </div>
                    {#if sheet.key && planPromptOpenKey === sheet.key}
                      <div class="assignment-prompt">
                        <label>
                          <span>Prompt</span>
                          <textarea
                            rows="4"
                            value={planPromptDraft[sheet.key] ?? assignment?.prompt ?? ''}
                            placeholder="Prompt für diese Zuweisung (optional)"
                            on:input={(event) => {
                              planPromptDraft = {
                                ...planPromptDraft,
                                [sheet.key]: event.currentTarget.value
                              };
                            }}
                          ></textarea>
                        </label>
                        <div class="row-actions">
                          <button
                            class="ci-btn-secondary"
                            type="button"
                            disabled={planSaving}
                            on:click={() =>
                              setPlanPrompt(sheet.key, planPromptDraft[sheet.key] ?? '')}
                          >
                            Speichern
                          </button>
                        </div>
                      </div>
                    {/if}
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
                <input type="text" bind:value={className} placeholder="Klassenname" disabled={classReadOnly} />
              </label>
              <label>
                <span>Jahr</span>
                <input type="text" bind:value={classYear} placeholder="2025/26" disabled={classReadOnly} />
              </label>
              <label>
                <span>Beruf</span>
                <input type="text" bind:value={classProfession} placeholder="Beruf" disabled={classReadOnly} />
              </label>
              <label>
                <span>Prompt</span>
                <textarea
                  rows="3"
                  bind:value={classPrompt}
                  placeholder="Prompt für diese Klasse (optional)"
                  disabled={classReadOnly}
                ></textarea>
              </label>
              <label>
                <span>Schule</span>
                <select bind:value={classSchoolId} disabled={classReadOnly}>
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
                <textarea rows="3" bind:value={classNotes} placeholder="Notizen" disabled={classReadOnly}></textarea>
              </label>
            </div>
            <div class="row-actions">
              <button class="ci-btn-secondary" on:click={updateClass} disabled={classReadOnly || savingClass} type="button">
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
                    <div class="list-row-actions">
                      {#if entry.code}
                        <a
                          class="learner-direct-link ci-btn-outline"
                          href={buildLearnerPortalHref(entry)}
                          target="_blank"
                          rel="noreferrer"
                          title="Lernendenportal öffnen"
                          aria-label="Lernendenportal öffnen"
                        >
                          Portal
                        </a>
                      {/if}
                      <button
                        class="icon-btn ci-btn-outline"
                        title="Lernende löschen"
                        on:click={() => deleteLearnerById(entry.id)}
                        disabled={deletingLearner}
                        type="button"
                      >
                        Löschen
                      </button>
                    </div>
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
              <span>Prompt</span>
              <textarea
                rows="3"
                bind:value={newSchoolPrompt}
                placeholder="Prompt für diese Schule (optional)"
              ></textarea>
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
                  placeholder="CSS für diese Schule"
                  spellcheck="false"
                  on:scroll={() => syncCodeScroll(newSchoolCssInput, newSchoolCssHighlight)}
                ></textarea>
              </div>
            </label>
          </div>
          <div class="row-actions">
            <button class="ci-btn-secondary" on:click={createSchool} disabled={creatingSchool}>
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
                    title="Schule löschen"
                    on:click={() => deleteSchool(entry.id)}
                    disabled={deletingSchool}
                  >
                    Löschen
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
              Zurück
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
              {deletingSchool ? 'Lösche...' : 'Löschen'}
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
              <span>Prompt</span>
              <textarea
                rows="3"
                bind:value={schoolPrompt}
                placeholder="Prompt für diese Schule (optional)"
              ></textarea>
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
                  placeholder="CSS für diese Schule"
                  spellcheck="false"
                  on:scroll={() => syncCodeScroll(schoolCssInput, schoolCssHighlight)}
                ></textarea>
              </div>
            </label>
          </div>
          <div class="row-actions">
            <button class="ci-btn-secondary" on:click={updateSchool} disabled={savingSchool}>
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

    {#if activeTab === 'shop'}
    <section class="panel full panel--shop">
      <ShopMockup
        {sheets}
        {collections}
        {collectionLinks}
        loading={loadingSheets || loadingCollections || loadingCollectionLinks}
        error={sheetError || collectionError || collectionLinkError}
        onOpenSheet={(id) => openShopSheet(id, 'visual')}
        onPreviewSheet={(id) => openShopSheet(id, 'preview')}
      />
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
        <p class="hint">Wähle, welche CI in der Admin-Ansicht aktiv sein soll.</p>

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

      <div class="manage-card settings-card">
        <h3>KI Tokenzähler</h3>
        <p class="hint">
          Summiert alle KI-Anfragen für dieses Konto (Agent im Backend + Schülerantworten).
        </p>
        <div class="settings-usage-grid">
          <div class="settings-current">
            <p class="settings-label">Requests</p>
            <p class="settings-value">{formatUsageCount(userAiUsage.requests)}</p>
          </div>
          <div class="settings-current">
            <p class="settings-label">Prompt Tokens</p>
            <p class="settings-value">{formatUsageCount(userAiUsage.prompt_tokens)}</p>
          </div>
          <div class="settings-current">
            <p class="settings-label">Completion Tokens</p>
            <p class="settings-value">{formatUsageCount(userAiUsage.completion_tokens)}</p>
          </div>
          <div class="settings-current">
            <p class="settings-label">Total Tokens</p>
            <p class="settings-value">{formatUsageCount(userAiUsage.total_tokens)}</p>
          </div>
          <div class="settings-current">
            <p class="settings-label">Prompt Kosten (USD)</p>
            <p class="settings-value">{formatUsageUsd(userAiUsage.prompt_cost_usd)}</p>
          </div>
          <div class="settings-current">
            <p class="settings-label">Completion Kosten (USD)</p>
            <p class="settings-value">{formatUsageUsd(userAiUsage.completion_cost_usd)}</p>
          </div>
          <div class="settings-current">
            <p class="settings-label">Total Kosten (USD)</p>
            <p class="settings-value">{formatUsageUsd(userAiUsage.total_cost_usd)}</p>
          </div>
        </div>
      </div>

      <div class="settings-school-section">
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
                <span>Prompt</span>
                <textarea
                  rows="3"
                  bind:value={newSchoolPrompt}
                  placeholder="Prompt für diese Schule (optional)"
                ></textarea>
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
                    placeholder="CSS für diese Schule"
                    spellcheck="false"
                    on:scroll={() => syncCodeScroll(newSchoolCssInput, newSchoolCssHighlight)}
                  ></textarea>
                </div>
              </label>
            </div>
            <div class="row-actions">
              <button class="ci-btn-secondary" on:click={createSchool} disabled={creatingSchool}>
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
                      title="Schule löschen"
                      on:click={() => deleteSchool(entry.id)}
                      disabled={deletingSchool}
                    >
                      Löschen
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
                Zurück
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
                {deletingSchool ? 'Lösche...' : 'Löschen'}
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
                <span>Prompt</span>
                <textarea
                  rows="3"
                  bind:value={schoolPrompt}
                  placeholder="Prompt für diese Schule (optional)"
                ></textarea>
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
                    placeholder="CSS für diese Schule"
                    spellcheck="false"
                    on:scroll={() => syncCodeScroll(schoolCssInput, schoolCssHighlight)}
                  ></textarea>
                </div>
              </label>
            </div>
            <div class="row-actions">
              <button class="ci-btn-secondary" on:click={updateSchool} disabled={savingSchool}>
                {savingSchool ? 'Speichere...' : 'Speichern'}
              </button>
            </div>
            {#if schoolError}
              <p class="error-text">{schoolError}</p>
            {/if}
          </div>
        {/if}
      </div>
    </section>
    {/if}

    <aside
      class="agent-sidebar"
      class:agent-sidebar--collapsed={!agentSidebarOpen}
      aria-label="KI Kontext"
    >
      {#if agentSidebarOpen}
        <div class="agent-panel">
          <div class="agent-history">
            <div class="agent-history-title">Chatverlauf</div>
            <div class="agent-history-list" bind:this={agentHistoryEl}>
              {#if agentHistory.length}
                {#each agentHistory as entry (entry.id)}
                  <div
                    class="agent-history-item"
                    class:agent-history-item--pending={entry.pending}
                    class:agent-history-item--error={entry.error}
                  >
                    <div class="agent-history-line">
                      <span class="agent-history-label">Du</span>
                      <span class="agent-history-text">{entry.prompt}</span>
                    </div>
                    {#if entry.response}
                      <div class="agent-history-line">
                        <span class="agent-history-label">KI</span>
                        <span class="agent-history-text">{entry.response}</span>
                      </div>
                    {:else if entry.pending}
                      <div class="agent-history-line">
                        <span class="agent-history-label">KI</span>
                        <span class="agent-history-meta">Warte auf Antwort…</span>
                      </div>
                    {/if}
                    {#if entry.response && !entry.pending && entry.feedbackOpen}
                      <div class="agent-feedback">
                        <div class="agent-feedback-label">Bewertung</div>
                        <div class="agent-feedback-actions">
                          <button
                            type="button"
                            class="agent-feedback-btn agent-feedback-btn--positive"
                            class:agent-feedback-btn--active={entry.ratingValue === 1}
                            disabled={entry.ratingSaving}
                            on:click={() => setAgentHistoryRatingValue(entry.id, 1)}
                          >
                            Positiv
                          </button>
                          <button
                            type="button"
                            class="agent-feedback-btn agent-feedback-btn--partial"
                            class:agent-feedback-btn--active={entry.ratingValue === 0}
                            disabled={entry.ratingSaving}
                            on:click={() => setAgentHistoryRatingValue(entry.id, 0)}
                          >
                            Teilweise
                          </button>
                          <button
                            type="button"
                            class="agent-feedback-btn agent-feedback-btn--negative"
                            class:agent-feedback-btn--active={entry.ratingValue === -1}
                            disabled={entry.ratingSaving}
                            on:click={() => setAgentHistoryRatingValue(entry.id, -1)}
                          >
                            Negativ
                          </button>
                        </div>
                        <textarea
                          class="agent-feedback-comment"
                          rows="2"
                          placeholder="Optionaler Kommentar zur Antwort"
                          value={entry.ratingComment || ''}
                          disabled={entry.ratingSaving}
                          on:input={(event) =>
                            setAgentHistoryRatingComment(
                              entry.id,
                              event?.currentTarget?.value ?? ''
                            )}
                        ></textarea>
                        <div class="agent-feedback-row">
                          <button
                            type="button"
                            class="ci-btn-secondary agent-feedback-submit"
                            disabled={entry.ratingSaving || !entry.logId}
                            on:click={() => submitAgentHistoryFeedback(entry.id)}
                          >
                            {entry.ratingSaving
                              ? 'Speichere…'
                              : entry.ratingSaved
                              ? 'Bewertung aktualisieren'
                              : 'Bewertung speichern'}
                          </button>
                          {#if entry.ratingError}
                            <span class="agent-feedback-error">{entry.ratingError}</span>
                          {:else if entry.ratingSaved}
                            <span class="agent-feedback-ok">Gespeichert</span>
                          {/if}
                        </div>
                      </div>
                    {/if}
                    {#if entry.response && !entry.pending}
                      <div class="agent-feedback-toggle-row">
                        <button
                          type="button"
                          class="agent-feedback-toggle"
                          class:agent-feedback-toggle--active={
                            entry.feedbackOpen ||
                            entry.ratingSaved ||
                            entry.ratingValue === 1 ||
                            entry.ratingValue === 0 ||
                            entry.ratingValue === -1
                          }
                          on:click={() => toggleAgentHistoryFeedback(entry.id)}
                          aria-label={entry.feedbackOpen ? 'Bewertung ausblenden' : 'Bewertung einblenden'}
                          title={entry.feedbackOpen ? 'Bewertung ausblenden' : 'Bewertung einblenden'}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path
                              d="M5 14.5V4.5h5l1 3h8v7h-5l-1 3H5z"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.8"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    {/if}
                  </div>
                {/each}
              {:else}
                <div class="agent-history-empty hint">Noch kein Verlauf.</div>
              {/if}
            </div>
          </div>
          {#if agentStatus}
            <div class="agent-status" role="status">{agentStatus}</div>
          {/if}
          {#if hasOpenAgentDraft(agentActiveDraft) || agentDraftUiVisible}
            <section class="agent-draft-card" aria-label="Vorgeschlagene Änderung">
              <div class="agent-draft-title">Vorgeschlagene Änderung</div>
              {#if hasOpenAgentDraft(agentActiveDraft)}
                <ul class="agent-draft-list">
                  {#each agentDraftChangeItems as item}
                    <li class="agent-draft-item">{item}</li>
                  {/each}
                </ul>
              {:else}
                <p class="agent-draft-item">
                  Vorschlag erkannt. Falls die Details noch nicht sichtbar sind, kannst du trotzdem
                  Anwenden oder Verwerfen klicken.
                </p>
              {/if}
              <div class="agent-draft-actions">
                <button
                  type="button"
                  class="ci-btn-secondary agent-draft-btn"
                  disabled={agentPending}
                  on:click={() => triggerAgentDraftAction('apply')}
                >
                  Anwenden
                </button>
                <button
                  type="button"
                  class="ghost ci-btn-outline agent-draft-btn"
                  disabled={agentPending}
                  on:click={() => triggerAgentDraftAction('discard')}
                >
                  Verwerfen
                </button>
              </div>
            </section>
          {/if}
          <div class="agent-context">{describeAgentContext(agentContext)}</div>
          <div class="agent-row agent-row--composer">
            <textarea
              class="agent-input"
              rows="1"
              bind:this={agentInputEl}
              bind:value={agentPrompt}
              disabled={agentPending}
              on:input={() => {
                agentStatus = '';
                resizeAgentInput();
              }}
              on:keydown={handleAgentKeydown}
            ></textarea>
            <button
              class="ci-btn-secondary agent-send-btn"
              type="button"
              on:click={() => applyAgentPrompt()}
              disabled={agentPending}
              aria-label={agentPending ? 'Wird gesendet' : 'Senden'}
              title={agentPending ? 'Wird gesendet' : 'Senden'}
            >
              <svg class="agent-send-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M12 18V6M7.5 10.5 12 6l4.5 4.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.9"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      {/if}
    </aside>

  {/if}
</div>

{#if lueckeEditorOpen}
  <div
    class="modal-backdrop"
    role="button"
    tabindex="0"
    aria-label="Dialog schliessen"
    on:click={(event) => {
      if (event.target === event.currentTarget) {
        closeLueckeEditor();
      }
    }}
    on:keydown={(event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLueckeEditor();
        return;
      }
      if (event.target !== event.currentTarget) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        closeLueckeEditor();
      }
    }}
  >
    <div
      class="modal-card luecke-modal-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="luecke-editor-title"
    >
      <h3 id="luecke-editor-title">Lösung bearbeiten</h3>
      <form class="create-form" on:submit|preventDefault={saveLueckeEditor}>
        <label>
          <span>Lösung(en)</span>
          <input
            type="text"
            bind:this={lueckeSolutionInputEl}
            bind:value={lueckeEditorSolution}
          />
          <span class="field-hint">Mehrere Lösungen mit Semikolon trennen. Die Lösung kann auch leer sein.</span>
        </label>
        <label>
          <span>Breite</span>
          <div class="luecke-width-control">
            <select
              value={getLueckeWidthSelectValue(lueckeEditorWidth)}
              on:change={setLueckeEditorWidthFromPreset}
            >
              {#if !isLueckeWidthOption(lueckeEditorWidth)}
                <option value="custom">Eigene Breite</option>
              {/if}
              {#each LUECKE_WIDTH_OPTIONS as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
            <input
              type="text"
              bind:value={lueckeEditorWidth}
              placeholder="25ch oder 100%"
              aria-label="Breite manuell"
            />
          </div>
        </label>
        <label>
          <span>KI-Prompt</span>
          <textarea
            rows="5"
            bind:value={lueckeEditorPrompt}
            placeholder="Zusätzliche Hinweise zur Korrektheit (optional)"
          ></textarea>
        </label>
        {#if lueckeEditorError}
          <p class="error-text">{lueckeEditorError}</p>
        {/if}
        <div class="row-actions">
          <button class="ghost ci-btn-outline" type="button" on:click={closeLueckeEditor}>
            Abbrechen
          </button>
          <button class="ci-btn-secondary" type="submit">Speichern</button>
        </div>
      </form>
    </div>
  </div>
{/if}

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
          <span>Sammlung</span>
          <select bind:value={newSheetCollectionId}>
            <option value="">Sammlung wählen</option>
            {#each editableCollections as collection}
              <option value={String(collection.id)}>
                {collection.name || `Sammlung #${collection.id}`}
              </option>
            {/each}
          </select>
        </label>
        <label>
          <span>Key (optional)</span>
          <input
            type="text"
            bind:value={newSheetKey}
            placeholder="z. B. abi-geschichte-1"
          />
        </label>
        {#if editableCollections.length === 0}
          <p class="hint">Bitte zuerst eine Sammlung anlegen.</p>
        {/if}
        {#if sheetError}
          <p class="error-text">{sheetError}</p>
        {/if}
        <div class="row-actions">
          <button class="ghost ci-btn-outline" type="button" on:click={() => (showCreateSheetModal = false)}>
            Abbrechen
          </button>
          <button class="ci-btn-secondary" type="submit" disabled={creating || editableCollections.length === 0}>
            {creating ? 'Erstelle…' : 'Erstellen'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if showCollectionModal}
  <div
    class="modal-backdrop"
    role="button"
    tabindex="0"
    aria-label="Dialog schliessen"
    on:click={() => (showCollectionModal = false)}
    on:keydown={(event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        showCollectionModal = false;
        return;
      }
      if (event.target !== event.currentTarget) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showCollectionModal = false;
      }
    }}
  >
    <div class="modal-card" on:click|stopPropagation>
      <h3>Neue Sammlung</h3>
      <form class="create-form" on:submit|preventDefault={handleCreateCollection}>
        <label>
          <span>Name</span>
          <input type="text" bind:value={newCollectionName} placeholder="z. B. UNO" />
        </label>
        <label>
          <span>Beschreibung</span>
          <textarea
            rows="4"
            bind:value={newCollectionDescription}
            placeholder="Wofür ist diese Sammlung gedacht?"
          ></textarea>
        </label>
        {#if collectionError}
          <p class="error-text">{collectionError}</p>
        {/if}
        <div class="row-actions">
          <button
            class="ghost ci-btn-outline"
            type="button"
            on:click={() => (showCollectionModal = false)}
          >
            Abbrechen
          </button>
          <button class="ci-btn-secondary" type="submit" disabled={creatingCollection}>
            {creatingCollection ? 'Erstelle…' : 'Erstellen'}
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
              <span>Prompt</span>
              <textarea rows="3" bind:value={newClassPrompt} placeholder="Prompt für diese Klasse (optional)"></textarea>
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
          class="ci-btn-secondary"
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
        <label>
          <span>Prompt</span>
          <textarea
            rows="3"
            bind:value={newLearnerPrompt}
            placeholder="Prompt für diese Lernende (optional)"
          ></textarea>
        </label>
      </div>
      <div class="row-actions">
        <button class="ghost ci-btn-outline" on:click={() => (showLearnerModal = false)}>Abbrechen</button>
        <button
          class="ci-btn-secondary"
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
    padding: 4px clamp(17px, 4vw, 41px) 41px;
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }

  .app.app--ci-zag {
    --ci-button-secondary: #06b6d4;
    --ci-button-secondary-accent: #0891b2;
  }

  .app.app--with-agent {
    --agent-sidebar-expanded: min(300px, 25vw);
    --agent-sidebar-collapsed: 0px;
    --agent-sidebar-width: var(--agent-sidebar-expanded);
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--agent-sidebar-width);
    grid-template-rows: auto minmax(0, 1fr);
    column-gap: 4px;
    align-items: stretch;
    padding-left: 4px;
    padding-right: 4px;
    height: 100vh;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }

  .app.app--agent-collapsed {
    --agent-sidebar-width: var(--agent-sidebar-collapsed);
  }

  .app.app--with-agent > :not(.topbar):not(.agent-sidebar) {
    grid-column: 1;
    grid-row: 2;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .app.app--with-agent,
  .app.app--with-agent > :not(.agent-sidebar),
  .app.app--with-agent .workspace,
  .app.app--with-agent .panel,
  .app.app--with-agent .panel-header,
  .app.app--with-agent .manage-card,
  .app.app--with-agent .editor,
  .app.app--with-agent .editor-header,
  .app.app--with-agent .editor-body,
  .app.app--with-agent .fields,
  .app.app--with-agent .editor-columns,
  .app.app--with-agent .editor-main,
  .app.app--with-agent .preview,
  .app.app--with-agent .visual-layout,
  .app.app--with-agent .visual-edit-panel,
  .app.app--with-agent .block-editors,
  .app.app--with-agent .block-editor {
    min-width: 0;
    max-width: 100%;
  }

  .app.app--with-agent > .topbar,
  .app.app--with-agent > .workspace,
  .app.app--with-agent > .panel {
    width: auto;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: nowrap;
    gap: 20px;
    margin-bottom: 4px;
    grid-column: 1 / -1;
    min-width: 0;
    max-width: 100%;
  }

  .app.app--with-agent .topbar {
    padding-left: 17px;
    padding-right: 17px;
  }

  .brand-block {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 0 1 auto;
    min-width: 0;
  }

  .brand-logo img {
    height: 37px;
    width: auto;
    object-fit: contain;
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

  .brand-logo {
    display: flex;
    align-items: center;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: nowrap;
    flex: 0 1 auto;
    min-width: 0;
  }

  .status-user {
    min-height: 34px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-width: 0;
    max-width: clamp(120px, 18vw, 260px);
  }

  .status .value {
    margin: 0;
    font-weight: 600;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status .hint {
    margin: 0;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .settings-btn {
    width: 34px;
    height: 34px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .settings-btn svg {
    width: 15px;
    height: 15px;
  }

  .agent-topbar-toggle {
    width: 34px;
    height: 34px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #ec5a8f;
    border-color: #ec5a8f;
  }

  .agent-topbar-toggle:hover:enabled:not([aria-pressed="true"]),
  .agent-topbar-toggle:focus-visible:not([aria-pressed="true"]) {
    background: rgba(236, 90, 143, 0.12);
    border-color: #ec5a8f;
    color: #ec5a8f;
  }

  .agent-topbar-toggle-icon {
    width: 17px;
    height: 17px;
  }

  .settings-btn[aria-pressed="true"],
  .topbar-tab-btn[aria-pressed="true"],
  .agent-topbar-toggle[aria-pressed="true"] {
    background: #ec5a8f;
    border-color: #ec5a8f;
    color: #ffffff;
  }

  .settings-grid {
    display: grid;
    gap: 14px;
  }

  .settings-usage-grid {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fit, minmax(153px, 1fr));
  }

  .settings-school-section {
    display: grid;
    gap: 14px;
    margin-top: 7px;
  }

  .settings-current {
    display: grid;
    gap: 5px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #d9dee7;
    background: #f8fafc;
  }

  .settings-label {
    margin: 0;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: #6f7682;
  }

  .settings-value {
    margin: 0;
    font-weight: 600;
  }

  .settings-select {
    min-height: 119px;
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

  .login {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
    width: min(1180px, 100%);
    margin: 10px auto 0;
    align-items: stretch;
  }

  .login--auth {
    padding-bottom: 24px;
  }

  .auth-card {
    --auth-accent: #0f766e;
    --auth-accent-strong: #102a43;
    --auth-ring: rgba(15, 118, 110, 0.18);
    --auth-panel-start: #f7ead9;
    --auth-panel-end: #eef7f3;
    --auth-glow: rgba(15, 118, 110, 0.18);
    position: relative;
    display: grid;
    gap: 19px;
    min-height: 100%;
    padding: 19px;
    border-radius: 26px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.78);
    background: rgba(255, 255, 255, 0.74);
    backdrop-filter: blur(15px);
    box-shadow: 0 24px 51px rgba(15, 23, 42, 0.14);
  }

  .auth-card::after {
    content: '';
    position: absolute;
    right: -61px;
    bottom: -78px;
    width: 187px;
    height: 187px;
    border-radius: 999px;
    background: var(--auth-glow);
    filter: blur(9px);
    pointer-events: none;
  }

  .auth-card--student {
    --auth-accent: #d97706;
    --auth-accent-strong: #1d4ed8;
    --auth-ring: rgba(29, 78, 216, 0.18);
    --auth-panel-start: #fff2dd;
    --auth-panel-end: #eef3ff;
    --auth-glow: rgba(217, 119, 6, 0.16);
  }

  .auth-card__visual {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 12px;
    align-content: space-between;
    min-height: 187px;
    padding: 15px;
    border-radius: 20px;
    overflow: hidden;
    background:
      radial-gradient(circle at 16% 18%, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0) 32%),
      linear-gradient(145deg, var(--auth-panel-start) 0%, var(--auth-panel-end) 100%);
    border: 1px solid rgba(255, 255, 255, 0.68);
  }

  .auth-card__visual::before {
    content: '';
    position: absolute;
    inset: auto -24px -36px auto;
    width: 143px;
    height: 143px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.34);
    filter: blur(7px);
  }

  .auth-card__badge {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    width: max-content;
    padding: 7px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.82);
    color: #203040;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
  }

  .auth-card__badge svg {
    width: 12px;
    height: 12px;
  }

  .auth-card__art {
    position: relative;
    z-index: 1;
    width: min(100%, 279px);
    justify-self: end;
    align-self: end;
    filter: drop-shadow(0 19px 24px rgba(15, 23, 42, 0.14));
  }

  .auth-card__body {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 14px;
  }

  .auth-card__body h2 {
    margin: 0;
    font-size: clamp(24px, 3vw, 32px);
    line-height: 0.98;
    letter-spacing: -0.04em;
  }

  .auth-card__copy {
    margin: 0;
    max-width: 36ch;
    color: #495568;
    font-size: 13px;
    line-height: 1.5;
  }

  .auth-form {
    display: grid;
    gap: 12px;
  }

  .auth-form label {
    margin: 0;
    gap: 7px;
    font-size: 11px;
  }

  .auth-form input {
    background: rgba(255, 255, 255, 0.9);
    border-color: rgba(148, 163, 184, 0.42);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.84);
  }

  .auth-form input:focus-visible {
    outline: none;
    border-color: var(--auth-accent);
    box-shadow: 0 0 0 3px var(--auth-ring);
  }

  .auth-form .error-text {
    margin: 0;
  }

  .auth-submit {
    width: 100%;
    border: none;
    padding: 12px 15px;
    color: #fff;
    background: linear-gradient(135deg, var(--auth-accent) 0%, var(--auth-accent-strong) 100%);
    box-shadow: 0 14px 24px rgba(15, 23, 42, 0.16);
  }

  .auth-submit:hover:enabled {
    box-shadow: 0 15px 29px rgba(15, 23, 42, 0.2);
  }

  .tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 17px;
  }

  .topbar-tabs {
    margin-bottom: 0;
    flex: 1 1 360px;
    justify-content: center;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .topbar-tabs::-webkit-scrollbar {
    display: none;
  }

  .topbar-tabs .topbar-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    white-space: nowrap;
  }

  .topbar-tab-icon {
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
  }

  .topbar-menu {
    position: relative;
    display: none;
    align-items: center;
  }

  .topbar-menu-btn {
    width: 36px;
    height: 36px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .topbar-menu-icon,
  .topbar-menu-icon::before,
  .topbar-menu-icon::after {
    display: block;
    width: 17px;
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
    top: -5px;
  }

  .topbar-menu-icon::after {
    top: 5px;
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
    top: calc(100% + 9px);
    right: 0;
    min-width: 170px;
    background: #ffffff;
    border: 1px solid #d9dee7;
    border-radius: 14px;
    padding: 7px;
    display: none;
    gap: 5px;
    box-shadow: 0 14px 26px rgba(15, 23, 42, 0.16);
    z-index: 20;
  }

  .topbar-menu-panel.is-open {
    display: grid;
  }

  .topbar-menu-item {
    width: 100%;
    text-align: left;
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: transparent;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .topbar-menu-item:hover {
    background: #eff6f4;
    border-color: #cfe6e1;
    transform: none;
    box-shadow: none;
  }

  .topbar-menu-item.is-active {
    background: transparent;
    border-color: transparent;
    color: inherit;
  }

  .topbar-menu-item.is-active:hover {
    background: #eff6f4;
    border-color: #cfe6e1;
    transform: none;
    box-shadow: none;
  }

  .tabs button {
    border-radius: 999px;
    padding: 9px 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .tabs button.selected {
    font-weight: 600;
  }

  label {
    display: grid;
    gap: 7px;
    margin-bottom: 14px;
    font-weight: 500;
    min-width: 0;
  }

  input,
  textarea,
  select {
    font: inherit;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #d9dee7;
    background: #ffffff;
  }

  textarea {
    min-height: 306px;
    width: 100%;
    resize: vertical;
    font-family: 'IBM Plex Sans', sans-serif;
  }

  .code-input {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
      'Courier New', monospace;
    font-size: 10px;
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
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    overflow: hidden;
    isolation: isolate;
    min-width: 0;
    max-width: 100%;
  }

  .code-highlight,
  .code-input--overlay {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
      'Courier New', monospace;
    font-size: 10px;
    line-height: 1.6;
    padding: 12px;
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
    z-index: 0;
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
    -webkit-text-fill-color: transparent;
    caret-color: #0f172a;
    resize: vertical;
    -webkit-appearance: none;
    appearance: none;
    background-color: transparent;
    z-index: 1;
  }

  .code-input--overlay::placeholder {
    color: #94a3b8;
    opacity: 1;
  }

  .code-editor:focus-within {
    border-color: #cbd5f5;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  .code-editor:focus-within .code-highlight {
    opacity: 0;
  }

  .code-editor:focus-within .code-input--overlay {
    color: #0f172a;
    -webkit-text-fill-color: #0f172a;
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
    padding: 10px 15px;
    border-radius: 999px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  button:hover:enabled {
    transform: translateY(-1px);
    box-shadow: 0 9px 15px rgba(15, 23, 42, 0.16);
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

  .error-text {
    color: #b23a3a;
    font-weight: 500;
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(221px, 272px) minmax(0, 1fr);
    gap: 20px;
  }

  .workspace.single {
    grid-template-columns: minmax(0, 1fr);
  }

  .panel {
    background: #ffffffcc;
    border-radius: 17px;
    padding: 17px;
    box-shadow: 0 10px 26px rgba(20, 24, 40, 0.12);
  }

  .panel.full {
    margin-top: 20px;
  }

  .panel--shop {
    padding: clamp(15px, 2.2vw, 24px);
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.62);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }

  .collection-title-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 32px 32px;
    align-items: end;
    gap: 7px;
    margin: 9px 0 5px;
    max-width: min(527px, 100%);
  }

  .collection-title-field {
    display: grid;
    gap: 5px;
    margin: 0;
    min-width: 0;
  }

  .collection-title-field span {
    color: #6f7682;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .collection-title-field input {
    width: 100%;
    padding: 7px 9px;
    border-radius: 9px;
    font-size: clamp(19px, 3vw, 27px);
    font-weight: 700;
    line-height: 1.1;
    color: #1c232f;
    background: rgba(255, 255, 255, 0.74);
  }

  .collection-title-icon {
    width: 32px;
    height: 32px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .collection-description-panel {
    margin-bottom: 17px;
  }

  .collection-description-panel label {
    margin-bottom: 0;
  }

  .collection-description-panel textarea {
    min-height: 102px;
  }

  .sheet-toolbar {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .sheet-filter {
    margin-bottom: 0;
    display: grid;
    gap: 5px;
    min-width: 187px;
  }

  .list {
    display: grid;
    gap: 10px;
  }

  .create-form {
    display: grid;
    gap: 10px;
    margin-bottom: 14px;
  }

  .create-form button {
    justify-self: start;
  }

  .list button {
    text-align: left;
    border-radius: 12px;
    padding: 12px;
  }

  .list button.selected {
    border-style: solid;
  }

  .list-title {
    font-weight: 600;
    margin-bottom: 5px;
  }

  .list-preview {
    font-size: 11px;
    color: #4d5565;
  }

  .list-meta {
    font-size: 10px;
    color: #8a909c;
    margin-top: 5px;
  }

  .manage-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(221px, 1fr));
    gap: 17px;
  }

  .manage-card {
    background: #f5f7fa;
    border-radius: 14px;
    padding: 14px;
    border: 1px solid #e2e8f0;
    display: grid;
    gap: 10px;
  }

  .manage-card--wide {
    grid-column: 1 / -1;
  }

  .manage-card h3 {
    margin: 0;
    font-size: 15px;
  }

  .manage-card h4 {
    margin: 0;
    font-size: 13px;
    color: #4d5565;
  }

  .assignment-list {
    display: grid;
    gap: 9px;
  }

	  .assignment-row {
	    display: flex;
	    align-items: flex-start;
	    justify-content: space-between;
	    gap: 10px;
	    flex-wrap: wrap;
	    padding: 10px;
	    border-radius: 10px;
	    border: 1px solid #e2e8f0;
	    background: #fff;
	    cursor: pointer;
	  }

  .assignment-info {
    display: grid;
    gap: 3px;
  }

  .assignment-key {
    font-size: 10px;
    color: #6f7682;
  }

  .status-select {
    font: inherit;
    padding: 7px 9px;
    border-radius: 9px;
    border: 1px solid #d9dee7;
    background: #f8fafc;
  }

	  .assignment-controls {
	    display: flex;
	    align-items: center;
	    gap: 7px;
	    flex-wrap: wrap;
	  }

  :global(.sheet-table--collections .sheet-cell--actions) {
    justify-content: flex-start;
  }

	  .assignment-prompt {
	    width: 100%;
	    display: grid;
	    gap: 9px;
	    padding-top: 7px;
	  }

	  .assignment-prompt label {
	    display: grid;
	    gap: 5px;
	    margin: 0;
	  }

	  .assignment-prompt textarea {
	    font: inherit;
	    padding: 9px 10px;
	    border-radius: 10px;
	    border: 1px solid #d9dee7;
	    resize: vertical;
	    min-height: 77px;
	  }

	  .form-select {
	    min-width: 136px;
	  }

  .form-grid {
    display: grid;
    gap: 10px;
  }

  .form-grid textarea {
    min-height: 61px;
  }

  .row-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .classes-overview-header {
    padding-inline: 14px;
  }

  .class-table-wrap {
    overflow-x: auto;
    padding-bottom: 3px;
  }

  .class-table-wrap :global(.sheet-table--classes) {
    min-width: 0;
  }

  .classes-school-filter {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid #d9dee7;
    background: #f8fafc;
    font-size: 11px;
    color: #475569;
  }

  .classes-school-filter span {
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-size: 10px;
    color: #7a6f62;
  }

  .classes-school-filter select {
    border: none;
    background: transparent;
    font-weight: 600;
    color: #1c232f;
    padding: 2px 3px;
  }

  .classes-school-filter select:focus {
    outline: none;
  }

  .class-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
    padding: 5px 7px;
    font-size: 10px;
    line-height: 1;
  }

  .class-action-icon {
    width: 12px;
    height: 12px;
    flex: 0 0 14px;
  }

  .list-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 9px;
    align-items: center;
  }

  .list-row-actions {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 7px;
    flex-wrap: wrap;
  }

  .learner-direct-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    padding: 7px 9px;
    border-radius: 9px;
    font-size: 10px;
    line-height: 1;
  }

  .icon-btn {
    padding: 7px 9px;
    border-radius: 9px;
    font-size: 10px;
    cursor: pointer;
  }

  .refresh-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .refresh-icon {
    width: 15px;
    height: 15px;
  }

  .info-icon,
  .save-icon {
    width: 15px;
    height: 15px;
  }

  .trash-icon {
    width: 15px;
    height: 15px;
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

    .classes-overview-header {
      padding-inline: 0;
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
    padding: 20px;
  }

  .modal-card {
    width: min(442px, 100%);
    background: #fff;
    border-radius: 15px;
    padding: 17px;
    box-shadow: 0 17px 43px rgba(15, 23, 42, 0.2);
    display: grid;
    gap: 14px;
  }

  .luecke-modal-card {
    width: min(520px, 100%);
  }

  .luecke-modal-card textarea {
    min-height: 130px;
    resize: vertical;
  }

  .field-hint {
    color: #6f7682;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.35;
  }

  .luecke-width-control {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(128px, 0.75fr);
    gap: 8px;
    align-items: center;
  }

  .luecke-width-control input {
    min-width: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
      monospace;
  }

  .luecke-width-control select {
    min-width: 0;
  }

  @media (max-width: 480px) {
    .luecke-width-control {
      grid-template-columns: 1fr;
    }
  }

  .divider {
    height: 1px;
    background: #d9dee7;
    margin: 7px 0;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 14px;
  }

  .editor-body {
    display: grid;
    gap: 14px;
    align-items: stretch;
  }

  .editor-tabs {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
  }

  .editor-tabs button {
    border-radius: 999px;
    padding: 7px 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .editor-action-btn {
    padding: 7px 12px;
    min-width: 128px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
  }

  .editor-action-btn__status {
    width: 12px;
    height: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 14px;
  }

  .editor-action-btn__spinner {
    width: 12px;
    height: 12px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: editor-save-spin 0.8s linear infinite;
  }

  .editor-action-btn__check {
    font-size: 11px;
    line-height: 1;
    font-weight: 700;
  }

  .editor-action-btn__disk {
    width: 12px;
    height: 12px;
    display: block;
  }

  .editor-action-btn--saved {
    box-shadow: inset 0 0 0 1px rgba(31, 122, 110, 0.35);
  }

  @keyframes editor-save-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .fields {
    display: grid;
    gap: 10px;
    align-content: start;
  }

  .editor-meta {
    display: grid;
    gap: 7px;
  }

  .editor-meta-row {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 10px;
    align-items: end;
  }

  .editor-meta-row label {
    margin: 0;
  }

  .editor-meta-name {
    grid-column: 1 / -1;
    min-width: 0;
  }

  .editor-version {
    display: flex;
    flex-wrap: nowrap;
    gap: 9px;
    align-items: end;
    justify-self: stretch;
    min-width: 0;
    max-width: 100%;
  }

  .editor-version label {
    margin: 0;
  }

  .editor-version-select {
    min-width: min(204px, 100%);
    max-width: 100%;
    position: relative;
    z-index: 1;
    flex: 1 1 240px;
  }

  .editor-collection-select,
  .editor-version-picker {
    min-width: 0;
    flex-basis: auto;
  }

  .editor-version-select :global(select) {
    width: 100%;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    position: relative;
    z-index: 1;
  }

  .editor-version button {
    white-space: nowrap;
  }

  .version-restore-btn {
    width: 36px;
    height: 36px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
    touch-action: manipulation;
  }

  .version-restore-btn__status {
    width: 15px;
    height: 15px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 18px;
  }

  .version-restore-btn--restored {
    box-shadow: inset 0 0 0 1px rgba(31, 122, 110, 0.35);
  }

  .restore-icon {
    width: 15px;
    height: 15px;
  }

	  .editor-meta .hint,
	  .editor-meta .error-text {
	    margin: 0;
	  }

	  .fields textarea {
	    min-height: 272px;
	  }

	  .fields .editor-meta-prompt textarea {
	    min-height: 77px;
	    resize: vertical;
	  }

	  .block-prompts textarea {
	    min-height: 60px;
	    resize: vertical;
	  }

	  .block-prompt-field {
	    display: grid;
	    gap: 5px;
	    margin: 0;
	  }

	  :global(abu-block-prompt) {
	    display: none !important;
	  }

  .editor-columns {
    display: grid;
    gap: 14px;
    align-items: start;
    grid-template-columns: minmax(0, 1fr);
  }

  .editor-main {
    display: grid;
    gap: 10px;
    align-content: start;
  }

  .agent-sidebar {
    grid-column: 2;
    grid-row: 2;
    display: flex;
    flex-direction: column;
    gap: 0;
    min-height: 0;
    height: 100%;
    align-self: stretch;
    position: relative;
    overflow: visible;
  }

  .agent-panel {
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    overscroll-behavior: contain;
  }

  .agent-row {
    display: flex;
    gap: 9px;
    align-items: center;
    flex-wrap: wrap;
  }

  .agent-row--composer {
    align-items: flex-end;
    flex-wrap: nowrap;
    gap: 7px;
  }

  .agent-input {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
    min-height: 29px;
    max-height: 119px;
    font-size: 10px;
    line-height: 1.35;
    resize: none;
    overflow-y: auto;
  }

  .agent-send-btn {
    width: 34px;
    height: 34px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 40px;
  }

  .agent-send-icon {
    width: 14px;
    height: 14px;
  }

  .agent-status {
    font-size: 10px;
    color: #1f7a6e;
    font-weight: 600;
    min-height: 15px;
  }

  .agent-draft-card {
    display: grid;
    gap: 7px;
    border-radius: 10px;
    border: 1px solid #cfe5df;
    background: #f3fbf8;
    padding: 9px;
  }

  .agent-draft-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #0f766e;
    font-weight: 700;
  }

  .agent-draft-list {
    margin: 0;
    padding-left: 15px;
    display: grid;
    gap: 3px;
  }

  .agent-draft-item {
    font-size: 10px;
    line-height: 1.4;
    color: #1f2937;
    overflow-wrap: anywhere;
  }

  .agent-draft-actions {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
  }

  .agent-draft-btn {
    min-height: 29px;
  }

  .agent-context {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
  }

  .agent-history {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 7px;
    min-height: 0;
    flex: 1 1 auto;
  }

  .agent-history-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: #6f7682;
  }

  .agent-history-list {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    flex: 1 1 auto;
    gap: 9px;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding-right: 3px;
    min-height: 0;
  }

  .agent-history-item {
    position: relative;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    padding: 9px 10px;
    display: grid;
    gap: 7px;
  }

  .agent-history-item--pending {
    border-color: #dbeafe;
    background: #f8fbff;
  }

  .agent-history-item--error {
    border-color: #f3b4b4;
    background: #fff7f7;
  }

  .agent-history-line {
    display: grid;
    gap: 3px;
  }

  .agent-history-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #94a3b8;
    font-weight: 600;
  }

  .agent-history-text {
    font-size: 10px;
    line-height: 1.5;
    color: #1f2937;
    white-space: pre-wrap;
  }

  .agent-history-meta {
    font-size: 10px;
    color: #64748b;
  }

  .agent-feedback-toggle-row {
    display: flex;
    justify-content: flex-end;
    margin-top: -2px;
  }

  .agent-feedback-toggle {
    width: 17px;
    height: 17px;
    border: none;
    background: transparent;
    color: #94a3b8;
    opacity: 0.48;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
    cursor: pointer;
  }

  .agent-feedback-toggle svg {
    width: 14px;
    height: 14px;
  }

  .agent-feedback-toggle:hover:enabled,
  .agent-feedback-toggle:focus-visible {
    color: #64748b;
    opacity: 0.9;
  }

  .agent-feedback-toggle--active {
    color: #0f766e;
    opacity: 0.75;
  }

  .agent-feedback {
    display: grid;
    gap: 5px;
    border-top: 1px solid #edf2f7;
    padding-top: 7px;
  }

  .agent-feedback-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #94a3b8;
    font-weight: 600;
  }

  .agent-feedback-actions {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
  }

  .agent-feedback-btn {
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    color: #334155;
    border-radius: 999px;
    padding: 3px 9px;
    font-size: 10px;
    line-height: 1.2;
    cursor: pointer;
  }

  .agent-feedback-btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .agent-feedback-btn--positive {
    border-color: #86efac;
    background: #f0fdf4;
    color: #166534;
  }

  .agent-feedback-btn--partial {
    border-color: #fcd34d;
    background: #fffbeb;
    color: #92400e;
  }

  .agent-feedback-btn--negative {
    border-color: #fca5a5;
    background: #fef2f2;
    color: #991b1b;
  }

  .agent-feedback-btn--active {
    font-weight: 600;
  }

  .agent-feedback-btn--positive.agent-feedback-btn--active {
    border-color: #15803d;
    background: #16a34a;
    color: #ffffff;
  }

  .agent-feedback-btn--partial.agent-feedback-btn--active {
    border-color: #d97706;
    background: #f59e0b;
    color: #ffffff;
  }

  .agent-feedback-btn--negative.agent-feedback-btn--active {
    border-color: #b91c1c;
    background: #dc2626;
    color: #ffffff;
  }

  .agent-feedback-comment {
    width: 100%;
    min-height: 44px;
    border-radius: 9px;
    border: 1px solid #dbe3ee;
    background: #ffffff;
    padding: 5px 7px;
    font-size: 10px;
    line-height: 1.35;
    resize: vertical;
  }

  .agent-feedback-row {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
  }

  .agent-feedback-submit {
    border-radius: 999px;
    padding: 4px 9px;
    font-size: 10px;
    line-height: 1.2;
    cursor: pointer;
  }

  .agent-feedback-submit:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .agent-feedback-error {
    font-size: 10px;
    color: #b91c1c;
  }

  .agent-feedback-ok {
    font-size: 10px;
    color: #166534;
    font-weight: 600;
  }

  .agent-history-empty {
    font-size: 10px;
    color: #94a3b8;
  }

  @media (min-width: 900px) {
    .editor-meta-row {
      grid-template-columns: minmax(306px, 1fr) minmax(128px, 179px) minmax(187px, 255px);
    }

    .editor-meta-name {
      grid-column: auto;
    }
  }

  @media (min-width: 1100px) {
    .agent-panel {
      height: 100%;
      max-height: calc(100vh - 95px);
    }
  }

  .preview {
    border-radius: 12px;
    border: 1px solid #d9dee7;
    overflow: hidden;
    background: white;
    display: flex;
    flex-direction: column;
  }

  .preview-header {
    padding: 9px 12px;
    background: #f5f7fa;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: #6f7682;
  }

  .preview-body {
    padding: 14px;
    overflow: auto;
  }

  :global(umfrage-matrix) {
    display: block;
    margin: 1.02rem 0;
  }

  :global(umfrage-matrix .umfrage-matrix__scroll) {
    overflow-x: auto;
  }

  :global(umfrage-matrix .umfrage-matrix__table) {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    min-width: 442px;
  }

  :global(umfrage-matrix .umfrage-matrix__col-statement) {
    min-width: 187px;
  }

  :global(umfrage-matrix th),
  :global(umfrage-matrix td) {
    border: 1px solid #d9dee7;
    padding: 0.38rem 0.51rem;
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

  :global(umfrage-matrix .umfrage-matrix__statement-input) {
    width: 100%;
    border-radius: 7px;
    border: 1px solid #cbd5e1;
    padding: 5px 7px;
    font-size: 11px;
    line-height: 1.35;
    background: #fff;
    color: #1f2937;
    resize: vertical;
    min-height: 2.38rem;
    white-space: pre-wrap;
  }

  :global(umfrage-matrix .umfrage-matrix__statement-editor) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 7px;
    align-items: stretch;
  }

  :global(umfrage-matrix .umfrage-matrix__statement-controls) {
    display: grid;
    grid-auto-rows: minmax(0, 1fr);
    gap: 5px;
    align-content: center;
  }

  :global(umfrage-matrix .umfrage-matrix__statement-insert-cell) {
    padding: 0;
    height: 0;
    line-height: 0;
    background: transparent;
  }

  :global(umfrage-matrix .umfrage-matrix__statement-insert-fill) {
    padding: 0;
    height: 0;
    line-height: 0;
    background: transparent;
  }

  :global(umfrage-matrix .umfrage-matrix__statement-insert-btn) {
    width: 20px;
    height: 20px;
    margin: -10px 0;
    border-radius: 999px;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #2f8f83;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
  }

  :global(umfrage-matrix .umfrage-matrix__statement-insert-btn:hover:enabled) {
    background: #eef9f7;
    border-color: #2f8f83;
  }

  :global(umfrage-matrix .umfrage-matrix__statement-btn) {
    width: 20px;
    min-height: 20px;
    border-radius: 999px;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #2f8f83;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  :global(umfrage-matrix .umfrage-matrix__statement-btn:hover:enabled) {
    background: #eef9f7;
    border-color: #2f8f83;
  }

  :global(umfrage-matrix .umfrage-matrix__statement-btn--remove) {
    color: #c33b3b;
    border-color: #e2c8c8;
  }

  :global(umfrage-matrix .umfrage-matrix__statement-btn--remove:hover:enabled) {
    background: #fde7e7;
    border-color: #c33b3b;
  }

  :global(umfrage-matrix .umfrage-matrix__statement-btn:disabled) {
    opacity: 0.45;
    cursor: not-allowed;
  }

  :global(umfrage-matrix .umfrage-matrix__statement-input:focus-visible) {
    outline: 2px solid #2f8f83;
    outline-offset: 2px;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-value) {
    display: block;
    font-size: 0.81rem;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-label) {
    display: block;
    font-size: 0.65rem;
    color: #6f7682;
    margin-top: 2px;
  }

  :global(umfrage-matrix .umfrage-matrix__scale) {
    position: relative;
    overflow: visible;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-editor) {
    display: grid;
    gap: 5px;
    justify-items: center;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-controls) {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 19px;
    position: relative;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-controls .umfrage-matrix__scale-value) {
    display: inline-flex;
    min-width: 1.36rem;
    justify-content: center;
    font-size: 0.72rem;
    font-weight: 700;
    color: #364152;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-input) {
    width: min(136px, 100%);
    border-radius: 7px;
    border: 1px solid #cbd5e1;
    padding: 3px 5px;
    font-size: 10px;
    text-align: center;
    background: #fff;
    color: #1f2937;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-input:focus-visible) {
    outline: 2px solid #2f8f83;
    outline-offset: 2px;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-btn) {
    width: 19px;
    height: 19px;
    border-radius: 999px;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #2f8f83;
    font-size: 12px;
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

  :global(umfrage-matrix .umfrage-matrix__scale-btn--insert) {
    color: #2f8f83;
    position: absolute;
    top: 50%;
    z-index: 2;
    box-shadow: 0 0 0 2px #f5f7fa;
  }

  :global(umfrage-matrix .umfrage-matrix__scale-btn--insert-left) {
    left: 0;
    transform: translate(-50%, -50%);
  }

  :global(umfrage-matrix .umfrage-matrix__scale-btn--insert-right) {
    right: 0;
    transform: translate(50%, -50%);
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
    cursor: pointer;
    margin: 0;
  }

  :global(umfrage-matrix .umfrage-matrix__option input) {
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: #2f8f83;
  }

  :global(umfrage-matrix .umfrage-matrix__option input:focus-visible) {
    outline: 2px solid rgba(47, 143, 131, 0.45);
    outline-offset: 2px;
  }

  @media (max-width: 720px) {
    :global(umfrage-matrix .umfrage-matrix__table) {
      min-width: 357px;
    }
  }

  .visual-layout {
    display: grid;
    gap: 14px;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }

  .visual-edit-panel {
    position: relative;
    border-radius: 12px;
    border: 1px solid #d9dee7;
    background: #ffffff;
    padding: 12px;
    display: grid;
    gap: 9px;
    overflow: visible;
  }

  .visual-edit-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 7px;
  }


  .block-editors {
    position: relative;
    display: grid;
    gap: 14px;
    overflow: visible;
  }

  .block-editor {
    position: relative;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    padding: 15px 10px 10px;
    display: grid;
    gap: 9px;
  }

  .block-editor--active {
    border-color: #c7d0db;
  }

  .block-editor--inactive {
    border-color: transparent;
    background: transparent;
    padding: 2px;
    gap: 0;
    cursor: pointer;
  }

  .block-editor--inactive > * {
    pointer-events: none;
  }

  .block-editor--inactive:hover {
    border-color: #e2e8f0;
    background: #f8fafc;
  }

  .block-editor--inactive:focus-visible {
    outline: 2px solid rgba(47, 143, 131, 0.25);
    outline-offset: 2px;
  }

  .block-editor--inactive .block-editor__visual {
    min-height: 0;
    border-color: transparent;
    background: transparent;
    box-shadow: none;
  }

  .block-editor--inactive .block-editor__visual:focus {
    border-color: transparent;
    box-shadow: none;
  }

  .block-editor--title {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 7px 9px;
  }

  .block-editor--title .block-format-tools {
    display: contents;
  }

  .block-editor--title .tool-select--title {
    order: 2;
    flex: 0 0 auto;
    min-width: 105px;
    height: 29px;
  }

  .block-editor--title .block-editor__visual {
    order: 1;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 29px;
    display: flex;
    align-items: center;
    padding: 3px 9px;
    overflow: hidden;
    white-space: nowrap;
  }

  .block-editor--title.block-editor--inactive .block-editor__visual {
    min-height: 0;
    padding: 0;
    overflow: visible;
    white-space: normal;
  }

  .block-editor--title .tool-btn--danger {
    order: 3;
    flex: 0 0 32px;
    margin-left: 0;
  }

  .block-editor--title .block-editor__visual :global(h1),
  .block-editor--title .block-editor__visual :global(h2),
  .block-editor--title .block-editor__visual :global(h3) {
    margin: 0;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.05;
    white-space: nowrap;
  }

  .block-editor--title.block-editor--inactive .block-editor__visual :global(h1),
  .block-editor--title.block-editor--inactive .block-editor__visual :global(h2),
  .block-editor--title.block-editor--inactive .block-editor__visual :global(h3) {
    overflow: visible;
    text-overflow: clip;
    white-space: normal;
  }

  .block-editor--title .block-editor__visual :global(br) {
    display: none;
  }

  .block-type-badge {
    position: absolute;
    top: -9px;
    left: 10px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 19px;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid #b7d9d2;
    background: #e8f7f4;
    color: #0f766e;
    font-size: 10px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    pointer-events: none;
  }

  .worksheet-type-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    color: currentColor;
  }

  .worksheet-type-icon svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .worksheet-type-icon path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .block-type-badge__icon {
    width: 12px;
    height: 12px;
  }

  .block-type-badge__key {
    margin-left: 2px;
    padding-left: 6px;
    border-left: 1px solid rgba(15, 118, 110, 0.28);
    letter-spacing: 0;
    text-transform: none;
  }

  .block-editor--drag-image {
    position: fixed;
    top: 0;
    left: 0;
    margin: 0;
    box-sizing: border-box;
    pointer-events: none;
    opacity: 0.92;
    z-index: 2147483647;
    transform: translate(-9999px, -9999px);
  }

  .block-editor.drag-over {
    border-color: #2f8f83;
    background: #eef9f7;
  }

  .block-editor__visual :global(pre),
  .block-editor__visual :global(input[type='text']),
  .block-editor__visual :global(textarea),
  .preview-body :global(pre),
  .preview-body :global(input[type='text']),
  .preview-body :global(textarea) {
    position: relative;
  }

  .block-editor__visual :global(pre)::before,
  .block-editor__visual :global(input[type='text'])::before,
  .block-editor__visual :global(textarea)::before,
  .preview-body :global(pre)::before,
  .preview-body :global(input[type='text'])::before,
  .preview-body :global(textarea)::before {
    content: '|';
    position: absolute;
    top: -12px;
    left: 2px;
    font-weight: 700;
    font-size: 14px;
    line-height: 1;
    color: #0f172a;
    pointer-events: none;
    animation: block-caret-blink 1s steps(1, end) infinite;
  }

  .block-editor__visual :global(button),
  .block-editor__visual :global(select),
  .block-editor__visual :global(input[type='checkbox']),
  .block-editor__visual :global(input[type='radio']),
  .block-editor__visual :global(input[type='button']),
  .block-editor__visual :global(input[type='submit']),
  .preview-body :global(button:not(.gap-action-btn)),
  .preview-body :global(select),
  .preview-body :global(input[type='checkbox']),
  .preview-body :global(input[type='radio']),
  .preview-body :global(input[type='button']),
  .preview-body :global(input[type='submit']) {
    position: relative;
  }

  @keyframes block-caret-blink {
    0%,
    45% {
      opacity: 1;
    }
    50%,
    100% {
      opacity: 0;
    }
  }

  .block-editor textarea {
    min-height: 119px;
  }

  .block-editor__visual :global(h1),
  .block-editor__visual :global(h2),
  .block-editor__visual :global(h3),
  .preview-body :global(h1),
  .preview-body :global(h2),
  .preview-body :global(h3) {
    margin: 0 0 0.72rem;
    color: #132238;
    font-family: var(--ci-font-title, 'Arial Black', Arial, sans-serif);
    font-weight: 800;
    line-height: 1.16;
    letter-spacing: 0;
  }

  .block-editor__visual :global(h1),
  .preview-body :global(h1) {
    font-size: 1.7rem;
  }

  .block-editor__visual :global(h2),
  .preview-body :global(h2) {
    font-size: 1.23rem;
    margin-top: 0.3rem;
  }

  .block-editor__visual :global(h3),
  .preview-body :global(h3) {
    font-size: 0.95rem;
    margin-top: 0.25rem;
  }

  .block-editor__visual :global(freitext-block),
  .preview-body :global(freitext-block) {
    display: block;
    margin: 1.27rem 0;
  }

  .block-editor__visual :global(.freitext),
  .preview-body :global(.freitext) {
    display: grid;
    gap: 10px;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid #e2d8cc;
    background: linear-gradient(180deg, #fffdf8 0%, #f8f3ea 100%);
  }

  .block-editor__visual :global(.freitext__intro),
  .preview-body :global(.freitext__intro) {
    display: grid;
    gap: 7px;
  }

  .block-editor__visual :global(.freitext__instruction),
  .preview-body :global(.freitext__instruction) {
    display: grid;
    gap: 7px;
  }

  .block-editor__visual :global(.freitext__instruction > :first-child),
  .preview-body :global(.freitext__instruction > :first-child) {
    margin-top: 0;
  }

  .block-editor__visual :global(.freitext__instruction > :last-child),
  .preview-body :global(.freitext__instruction > :last-child) {
    margin-bottom: 0;
  }

  .block-editor__visual :global(.freitext__title),
  .preview-body :global(.freitext__title) {
    margin: 0;
    font-size: 17px;
    line-height: 1.25;
  }

  .block-editor__visual :global(.freitext__task),
  .block-editor__visual :global(.freitext__meta),
  .preview-body :global(.freitext__task),
  .preview-body :global(.freitext__meta) {
    margin: 0;
    color: #5e554a;
    font-size: 12px;
  }

  .block-editor__visual :global(.freitext__criteria-wrap),
  .preview-body :global(.freitext__criteria-wrap) {
    display: grid;
    gap: 2px;
  }

  .block-editor__visual :global(.freitext__criteria-label),
  .preview-body :global(.freitext__criteria-label) {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #7a6f62;
  }

  .block-editor__visual :global(.freitext__criteria),
  .preview-body :global(.freitext__criteria) {
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0;
    list-style: none;
  }

  .block-editor__visual :global(.freitext__criterion),
  .preview-body :global(.freitext__criterion) {
    display: grid;
    grid-template-columns: minmax(120px, 0.34fr) minmax(0, 1fr);
    gap: 5px;
    align-items: start;
    padding: 2px 5px;
    border: 1px solid #eadfd3;
    border-radius: 0;
    background: #fffdf8;
  }

  .block-editor__visual :global(.freitext__criterion + .freitext__criterion),
  .preview-body :global(.freitext__criterion + .freitext__criterion) {
    border-top: 0;
  }

  .block-editor__visual :global(.freitext__criterion-label),
  .preview-body :global(.freitext__criterion-label) {
    min-width: 0;
    font-weight: 700;
    color: #111827;
    overflow-wrap: anywhere;
  }

  .block-editor__visual :global(.freitext__criterion-description),
  .preview-body :global(.freitext__criterion-description) {
    min-width: 0;
    color: #5e554a;
    font-size: 12px;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .block-editor__visual :global(.freitext__premises-wrap),
  .block-editor__visual :global(.freitext__references-wrap),
  .preview-body :global(.freitext__premises-wrap),
  .preview-body :global(.freitext__references-wrap) {
    display: grid;
    gap: 2px;
  }

  .block-editor__visual :global(.freitext__premises),
  .block-editor__visual :global(.freitext__references),
  .preview-body :global(.freitext__premises),
  .preview-body :global(.freitext__references) {
    display: grid;
    gap: 0;
  }

  .block-editor__visual :global(.freitext__premise),
  .block-editor__visual :global(.freitext__reference),
  .preview-body :global(.freitext__premise),
  .preview-body :global(.freitext__reference) {
    display: grid;
    grid-template-columns: minmax(160px, 0.42fr) minmax(180px, 0.58fr);
    gap: 5px;
    align-items: center;
    padding: 2px 5px;
    border-radius: 0;
    border: 1px solid #eadfd3;
    background: #fffdf8;
  }

  .block-editor__visual :global(.freitext__premise + .freitext__premise),
  .block-editor__visual :global(.freitext__reference + .freitext__reference),
  .preview-body :global(.freitext__premise + .freitext__premise),
  .preview-body :global(.freitext__reference + .freitext__reference) {
    border-top: 0;
  }

  .block-editor__visual :global(.freitext__premise-label),
  .block-editor__visual :global(.freitext__reference-label),
  .preview-body :global(.freitext__premise-label),
  .preview-body :global(.freitext__reference-label) {
    min-width: 0;
    font-weight: 700;
    color: #111827;
    overflow-wrap: anywhere;
  }

  .block-editor__visual :global(.freitext__reference-body),
  .preview-body :global(.freitext__reference-body) {
    display: grid;
    gap: 3px;
    min-width: 0;
    color: #5e554a;
    font-size: 12px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .block-editor__visual :global(.freitext__reference-status),
  .preview-body :global(.freitext__reference-status) {
    font-weight: 700;
    color: #8a5a17;
  }

  .block-editor__visual :global(.freitext__reference--ready .freitext__reference-status),
  .preview-body :global(.freitext__reference--ready .freitext__reference-status) {
    color: #166534;
  }

  .block-editor__visual :global(.freitext__lock-message),
  .preview-body :global(.freitext__lock-message) {
    margin: -2px 0 0;
    color: #8a5a17;
    font-size: 12px;
    font-weight: 700;
  }

  .block-editor__visual :global(.freitext__premise-hint),
  .preview-body :global(.freitext__premise-hint) {
    min-width: 0;
    color: #5e554a;
    font-size: 11px;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .block-editor__visual :global(.freitext__premise-hint a),
  .preview-body :global(.freitext__premise-hint a) {
    color: #25636a;
    font-weight: 700;
  }

  .block-editor__visual :global(.freitext__premise-input-row),
  .preview-body :global(.freitext__premise-input-row) {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .block-editor__visual :global(.freitext__premise-input),
  .preview-body :global(.freitext__premise-input) {
    width: 100%;
    min-height: 34px;
    padding: 7px 9px;
    border-radius: 9px;
    border: 1px solid #d6cdc1;
    background: #fff;
    font: inherit;
  }

  .block-editor__visual :global(.freitext__premise-input:focus),
  .preview-body :global(.freitext__premise-input:focus) {
    outline: 2px solid rgba(47, 143, 131, 0.18);
    border-color: #2f8f83;
  }

  .block-editor__visual :global(.freitext__premise-status),
  .preview-body :global(.freitext__premise-status) {
    display: inline-flex;
    align-items: center;
    width: 100%;
    min-height: 34px;
    padding: 7px 9px;
    border-radius: 9px;
    border: 1px solid #efd8b8;
    background: #fff8ed;
    color: #8a5a17;
    font: inherit;
    font-weight: 700;
  }

  .block-editor__visual :global(.freitext__premise-status--ready),
  .preview-body :global(.freitext__premise-status--ready) {
    border-color: #b7dec8;
    background: #f0fdf4;
    color: #166534;
  }

  .block-editor__visual :global(.freitext__premise-status--warning),
  .preview-body :global(.freitext__premise-status--warning) {
    border-color: #efd8b8;
    background: #fff8ed;
    color: #8a5a17;
  }

  .block-editor__visual :global(.freitext__premise-status--invalid),
  .preview-body :global(.freitext__premise-status--invalid) {
    border-color: #f0b4b4;
    background: #fff5f5;
    color: #991b1b;
  }

  .block-editor__visual :global(.freitext__textarea),
  .preview-body :global(.freitext__textarea) {
    width: 100%;
    min-height: 187px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid #d6cdc1;
    background: #fff;
    font: inherit;
    line-height: 1.6;
    resize: vertical;
  }

  .block-editor__visual :global(.freitext__textarea:disabled),
  .preview-body :global(.freitext__textarea:disabled) {
    cursor: not-allowed;
    background: #f4eee5;
    color: #7a6f62;
  }

  .block-editor__visual :global(.freitext__question),
  .preview-body :global(.freitext__question) {
    display: grid;
    gap: 5px;
    margin: 0;
  }

  .block-editor__visual :global(.freitext__question-label),
  .preview-body :global(.freitext__question-label) {
    font-size: 11px;
    font-weight: 700;
    color: #5e554a;
  }

  .block-editor__visual :global(.freitext__question-field),
  .preview-body :global(.freitext__question-field) {
    width: 100%;
    height: 34px;
    min-height: 34px;
    padding: 0 10px;
    border-radius: 10px;
    border: 1px solid #d6cdc1;
    background: #fff;
    font: inherit;
    line-height: 1.2;
    resize: none;
  }

  .block-editor__visual :global(.freitext__question-field:focus),
  .preview-body :global(.freitext__question-field:focus) {
    outline: 2px solid rgba(47, 143, 131, 0.18);
    border-color: #2f8f83;
  }

  .block-editor__visual :global(.freitext--richtig),
  .preview-body :global(.freitext--richtig) {
    border-color: #1c8f4a;
    background: #f4fbf5;
  }

  .block-editor__visual :global(.freitext--teilweise),
  .preview-body :global(.freitext--teilweise) {
    border-color: #d98a1a;
    background: #fff9ef;
  }

  .block-editor__visual :global(.freitext--falsch),
  .preview-body :global(.freitext--falsch) {
    border-color: #c33b3b;
    background: #fff5f5;
  }

  .block-editor__visual :global(.freitext__actions),
  .preview-body :global(.freitext__actions) {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 9px;
  }

  .block-editor__visual :global(.freitext__actions .check-btn),
  .preview-body :global(.freitext__actions .check-btn) {
    width: 34px;
    height: 34px;
    margin-left: 0;
  }

  .block-editor__visual :global(.freitext__action-hint),
  .preview-body :global(.freitext__action-hint) {
    display: none;
    font-size: 11px;
    color: #6f6a60;
  }

  .visual-block-code-editor {
    border-radius: 9px;
  }

  .visual-block-code-editor .code-highlight,
  .visual-block-code-editor .code-input--overlay {
    min-height: 119px;
  }

  .freitext-block-editor {
    display: grid;
    gap: 10px;
  }

  .freitext-checklist-editor {
    display: grid;
    gap: 2px;
    padding: 5px;
    border-radius: 4px;
    border: 1px solid #d9dee7;
    background: #fff;
  }

  .freitext-checklist-editor__header {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    min-height: 22px;
  }

  .freitext-checklist-editor__header strong {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #475569;
  }

  .freitext-checklist-editor__count {
    margin-left: auto;
    color: #64748b;
    font-size: 10px;
    font-weight: 800;
  }

  .freitext-block-editor--active .freitext-checklist-editor__header {
    justify-content: space-between;
  }

  .freitext-block-editor--active .freitext-checklist-editor__count,
  .freitext-block-editor--active .freitext-checklist-editor--references {
    display: none;
  }

  .freitext-checklist-editor__add {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    font-size: 15px;
    line-height: 1;
  }

  .freitext-checklist-editor__list {
    display: grid;
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .freitext-checklist-editor__item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 24px;
    gap: 4px;
    align-items: center;
    padding: 2px 3px;
    border: 1px solid #e2e8f0;
    border-radius: 0;
    background: #fff;
  }

  .freitext-checklist-editor__item + .freitext-checklist-editor__item {
    border-top: 0;
  }

  .freitext-checklist-editor__fields {
    display: grid;
    grid-template-columns: minmax(120px, 0.34fr) minmax(0, 1fr);
    gap: 4px;
    align-items: start;
  }

  .freitext-checklist-editor__field-headings {
    display: grid;
    grid-template-columns: minmax(96px, 0.26fr) minmax(0, 0.37fr) minmax(0, 0.37fr) 24px;
    gap: 4px;
    align-items: end;
    padding: 0 3px 2px;
    color: #64748b;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.1;
  }

  .freitext-checklist-editor__fields--criteria {
    grid-template-columns: minmax(96px, 0.26fr) minmax(0, 0.37fr) minmax(0, 0.37fr);
  }

  .freitext-checklist-editor__field-headings--premises {
    grid-template-columns: minmax(96px, 0.26fr) minmax(120px, 0.32fr) minmax(0, 0.42fr) 24px;
  }

  .freitext-checklist-editor__fields--premises {
    grid-template-columns: minmax(96px, 0.26fr) minmax(120px, 0.32fr) minmax(0, 0.42fr);
  }

  .freitext-checklist-editor__field-headings--references {
    grid-template-columns: minmax(96px, 0.22fr) minmax(90px, 0.22fr) minmax(0, 0.36fr) minmax(104px, 0.2fr) 24px;
  }

  .freitext-checklist-editor__fields--references {
    grid-template-columns: minmax(96px, 0.22fr) minmax(90px, 0.22fr) minmax(0, 0.36fr) minmax(104px, 0.2fr);
  }

  .freitext-checklist-editor label {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 4px;
    align-items: center;
    margin: 0;
    min-width: 0;
  }

  .freitext-checklist-editor__fields--criteria label,
  .freitext-checklist-editor__fields--premises label {
    grid-template-columns: minmax(0, 1fr);
  }

  .freitext-checklist-editor label span {
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    color: #64748b;
  }

  .freitext-checklist-editor__sr-label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .freitext-checklist-editor textarea {
    width: 100%;
    min-width: 0;
    border: 1px solid #d9dee7;
    border-radius: 3px;
    padding: 3px 6px;
    font: inherit;
    line-height: 1.2;
    color: #0f172a;
    background: #fff;
  }

  .freitext-checklist-editor textarea {
    min-height: 28px;
    resize: vertical;
  }

  .freitext-checklist-editor select {
    width: 100%;
    min-height: 28px;
    border: 1px solid #d9dee7;
    border-radius: 3px;
    padding: 3px 6px;
    background: #fff;
    color: #0f172a;
    font: inherit;
    line-height: 1.2;
  }

  .freitext-checklist-editor input[type='text'] {
    width: 100%;
    min-width: 0;
    min-height: 28px;
    border: 1px solid #d9dee7;
    border-radius: 3px;
    padding: 3px 6px;
    background: #fff;
    color: #0f172a;
    font: inherit;
    line-height: 1.2;
  }

  .freitext-checklist-editor__source-meta {
    display: block;
    margin-top: 3px;
    overflow: hidden;
    color: #64748b;
    font-size: 10px;
    font-weight: 600;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .freitext-checklist-editor__label-field {
    overflow: hidden;
    resize: none;
  }

  .freitext-checklist-editor__delete {
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 4px;
    line-height: 1;
  }

  @media (max-width: 640px) {
    .block-editor__visual :global(.freitext__criterion),
    .preview-body :global(.freitext__criterion),
    .block-editor__visual :global(.freitext__premise),
    .preview-body :global(.freitext__premise),
    .freitext-checklist-editor__fields,
    .freitext-checklist-editor__fields--premises {
      grid-template-columns: 1fr;
    }

    .freitext-checklist-editor__field-headings {
      display: none;
    }

    .freitext-checklist-editor__fields--criteria .freitext-checklist-editor__sr-label,
    .freitext-checklist-editor__fields--premises .freitext-checklist-editor__sr-label {
      position: static;
      width: auto;
      height: auto;
      padding: 0;
      margin: 0 0 2px;
      overflow: visible;
      clip: auto;
      white-space: normal;
      border: 0;
    }
  }

  .freitext-block-editor__answer-preview {
    display: grid;
    gap: 10px;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid #e2d8cc;
    background: linear-gradient(180deg, #fffdf8 0%, #f8f3ea 100%);
  }

  .freitext-block-editor__answer-preview .freitext__textarea {
    width: 100%;
    min-height: 187px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid #d6cdc1;
    background: #fff;
    color: #64748b;
    font: inherit;
    line-height: 1.6;
    resize: vertical;
  }

  .freitext-block-editor__answer-preview .freitext__question-field {
    width: 100%;
    height: 34px;
    min-height: 34px;
    padding: 0 10px;
    border-radius: 10px;
    border: 1px solid #d6cdc1;
    background: #fff;
    color: #64748b;
    font: inherit;
    line-height: 1.2;
    resize: none;
  }

  .freitext-block-editor__answer-preview .freitext__actions {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 9px;
  }

  .freitext-block-editor__answer-preview .freitext__actions .check-btn {
    width: 34px;
    height: 34px;
    margin-left: 0;
  }

  .block-format-tools {
    display: flex;
    gap: 5px;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: flex-start;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tool-btn {
    width: 27px;
    height: 27px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
  }

  .tool-btn--right-start {
    margin-left: auto;
  }

  .tool-btn.active {
    background: #0f172a;
    color: #fff;
    border-color: #0f172a;
  }

  .tool-btn--view-toggle {
    border-radius: 999px;
    background: var(--ci-button-secondary, #06b6d4);
    border-color: var(--ci-button-secondary, #06b6d4);
    color: var(--ci-button-text, #fff);
  }

  .tool-btn--view-toggle:hover:enabled,
  .tool-btn--view-toggle:focus-visible {
    background: var(--ci-button-secondary-accent, #0891b2);
    border-color: var(--ci-button-secondary-accent, #0891b2);
    color: var(--ci-button-text, #fff);
  }

  .tool-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
  }

  .tool-icon svg {
    width: 14px;
    height: 14px;
    display: block;
  }

  .tool-icon--italic {
    font-style: italic;
    font-weight: 600;
  }

  .tool-icon--underline {
    text-decoration: underline;
  }

  .tool-icon--gap {
    font-weight: 600;
    font-size: 10px;
    letter-spacing: 0px;
  }

  .tool-select {
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid #d9dee7;
    background: #fff;
    color: #0f172a;
    font-weight: 600;
    height: 27px;
    font-size: 10px;
  }

  .tool-select--title {
    min-width: 117px;
  }

  .tool-select option {
    color: #0f172a;
  }

  .tool-divider {
    width: 1px;
    height: 17px;
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
    gap: 7px;
  }

  .block-editor__actions {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    align-items: center;
  }

  .block-view-toggle {
    display: flex;
    gap: 3px;
  }

  .block-view-toggle button {
    width: 27px;
    height: 27px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .block-view-toggle .toggle-icon {
    width: 15px;
    height: 15px;
  }

  .block-view-toggle button.active {
    background: #0f172a;
    color: #fff;
    border-color: #0f172a;
  }

  .block-editor__visual {
    min-height: 119px;
    border-radius: 9px;
    border: 1px solid #d9dee7;
    background: #fff;
    padding: 9px 10px;
    outline: none;
  }

  .block-editor__visual--display {
    min-height: 0;
  }

  .block-editor--inactive.block-editor--html .block-editor__visual,
  .block-editor--inactive.block-editor--freitext .freitext-instruction-editor {
    padding: 0;
  }

  .block-editor--inactive.block-editor--freitext {
    padding: 2px 2px 4px;
  }

  .block-editor--inactive.block-editor--freitext .freitext-block-editor {
    gap: 6px;
  }

  .block-editor--inactive.block-editor--freitext .freitext-instruction-editor {
    max-height: 4.8rem;
    overflow: hidden;
  }

  .block-editor--inactive.block-editor--freitext .freitext-block-editor__answer-preview,
  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor--references,
  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor--empty {
    display: none;
  }

  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor {
    gap: 2px;
    padding: 0;
    border: 0;
    background: transparent;
  }

  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor__header {
    min-height: 17px;
    padding-top: 2px;
  }

  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor__header strong,
  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor__count {
    font-size: 10px;
    line-height: 1;
  }

  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor__list {
    max-height: none;
    overflow: visible;
  }

  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor__item {
    grid-template-columns: minmax(0, 1fr);
    padding: 0;
    border: 0;
    background: transparent;
  }

  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor__fields,
  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor__fields--criteria,
  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor__fields--premises,
  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor__fields--references {
    grid-template-columns: minmax(100px, 0.34fr) minmax(0, 1fr);
    gap: 4px;
  }

  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor__fields--criteria label:nth-child(3),
  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor__fields--premises label:nth-child(3) {
    display: none;
  }

  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor__fields--references {
    grid-template-columns: minmax(100px, 0.3fr) minmax(88px, 0.25fr) minmax(0, 0.45fr);
  }

  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor__fields--references .freitext-checklist-editor__threshold {
    display: none;
  }

  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor label > span:not(.freitext-checklist-editor__sr-label) {
    display: none;
  }

  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor textarea,
  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor input[type='text'],
  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor select {
    min-height: 0;
    max-height: 2.4rem;
    padding: 0;
    border-color: transparent;
    background: transparent;
    color: #334155;
    box-shadow: none;
    overflow: hidden;
    pointer-events: none;
    resize: none;
  }

  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor select {
    appearance: none;
  }

  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor__source-meta {
    display: none;
  }

  .block-editor--inactive.block-editor--freitext .freitext-checklist-editor__field-headings,
  .block-editor--inactive.block-editor--freitext .freitext-block-editor__answer-preview {
    display: none;
  }

  .block-editor--inactive :global(.umfrage-matrix__statement-insert-row),
  .block-editor--inactive :global(.umfrage-matrix__statement-controls),
  .block-editor--inactive :global(.umfrage-matrix__scale-controls) {
    display: none;
  }

  .block-editor--inactive :global(.umfrage-matrix__scale-input),
  .block-editor--inactive :global(.umfrage-matrix__statement-input) {
    border-color: transparent;
    background: transparent;
    box-shadow: none;
    pointer-events: none;
    resize: none;
  }

  .block-editor--inactive :global(.umfrage-matrix__scale-input) {
    width: 100%;
    padding: 0;
    text-align: center;
  }

  .block-editor--inactive :global(.umfrage-matrix__statement-input) {
    min-height: 0;
    padding: 0;
    color: inherit;
  }

  .block-editor--inactive :global(.umfrage-matrix__scale-editor),
  .block-editor--inactive :global(.umfrage-matrix__statement-editor) {
    gap: 0;
  }

  .block-editor--inactive :global(.block-editor__visual luecke-gap) {
    gap: 0;
    padding: 1px 7px;
  }

  :global(.block-editor__visual luecke-gap) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 9px;
    border-radius: 999px;
    border: 1px dashed #94a3b8;
    background: rgba(148, 163, 184, 0.12);
    color: #0f172a;
    cursor: pointer;
    font-weight: 600;
    user-select: none;
    white-space: nowrap;
  }

  :global(.block-editor__visual luecke-gap:hover) {
    border-color: rgba(236, 90, 143, 0.8);
    background: rgba(236, 90, 143, 0.08);
  }

  :global(.block-editor__visual luecke-gap)::before {
    content: none;
  }

  :global(.block-editor__visual luecke-gap:not([name])::before) {
    content: none;
  }

  :global(.block-editor__visual luecke-gap:empty)::after {
    content: 'Lösung';
    color: #64748b;
    font-weight: 500;
  }

  :global(.block-editor__visual luecke-gap[width='15ch']),
  :global(.block-editor__visual luecke-gap[width='25ch']),
  :global(.block-editor__visual luecke-gap[width='40ch']) {
    justify-content: center;
  }

  :global(.block-editor__visual luecke-gap[width='15ch']) {
    min-width: 15ch;
  }

  :global(.block-editor__visual luecke-gap[width='25ch']) {
    min-width: 25ch;
  }

  :global(.block-editor__visual luecke-gap[width='40ch']) {
    min-width: 40ch;
  }

  :global(.block-editor__visual luecke-gap[width='100%']) {
    display: flex;
    width: 100%;
    border-radius: 10px;
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
    min-height: 34px;
    margin: -13px 0;
    border-radius: 12px;
    pointer-events: none;
    transition: background 0.15s ease, outline-color 0.15s ease;
  }

  .block-insert-row--menu-open {
    z-index: 1000;
  }

  .block-insert-row--visible,
  .block-insert-row.drag-over {
    margin: -1px 0;
    pointer-events: auto;
  }

  .block-insert-row--dragging {
    min-height: 56px;
    pointer-events: auto;
  }

  .block-insert-row--dragging:not(.block-insert-row--visible):not(.drag-over) {
    margin: -16px 0;
  }

  .block-insert-row::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: #d9dee7;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .block-insert {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transform: scale(0.92);
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  .block-insert-row--visible::before,
  .block-insert-row.drag-over::before,
  .block-insert-row--visible .block-insert,
  .block-insert-row.drag-over .block-insert {
    opacity: 1;
  }

  .block-insert-row--visible .block-insert,
  .block-insert-row.drag-over .block-insert {
    pointer-events: auto;
    transform: scale(1);
  }

  .block-insert-menu {
    position: absolute;
    top: calc(100% + 7px);
    left: 50%;
    transform: translateX(-50%);
    background: #ffffff;
    border: 1px solid #d9dee7;
    border-radius: 10px;
    padding: 5px;
    display: grid;
    gap: 3px;
    min-width: 190px;
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.18);
    z-index: 1001;
  }

  .block-insert-option {
    border: 1px solid transparent;
    background: #fff;
    border-radius: 9px;
    padding: 7px 9px;
    text-align: left;
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    gap: 7px;
    align-items: center;
    cursor: pointer;
    color: #1f2937;
    font-size: 11px;
  }

  .block-insert-option__icon {
    width: 17px;
    height: 17px;
    color: #0f766e;
  }

  .block-insert-option__text {
    display: grid;
    gap: 2px;
    min-width: 0;
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
    font-size: 10px;
    color: #6f7682;
  }

  .block-insert-btn {
    position: relative;
    z-index: 1;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    border: 1px solid #c7d0db;
    background: #fff;
    color: #2f8f83;
    font-size: 15px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .block-insert-row.drag-over .block-insert-btn {
    width: auto;
    min-width: 156px;
    height: 30px;
    padding: 0 12px;
    background: #0f766e;
    border-color: #0f766e;
    color: #fff;
    font-size: 12px;
    font-weight: 800;
    box-shadow: 0 6px 16px rgba(15, 118, 110, 0.24);
  }

  .block-insert-drop-cue {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    white-space: nowrap;
  }

  .block-insert-drop-cue svg {
    width: 15px;
    height: 15px;
    display: block;
    flex: 0 0 auto;
  }

  .block-insert-btn:hover {
    background: #eef9f7;
    border-color: #2f8f83;
    color: #216b61;
  }

  .block-insert-row.drag-over .block-insert-btn:hover {
    background: #0f766e;
    border-color: #0f766e;
    color: #fff;
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
    gap: 10px;
    padding: 9px 12px;
    border-bottom: 1px solid #d9dee7;
    background: #fff;
    flex-wrap: wrap;
  }

  .answers-title {
    margin: 0;
    font-size: 17px;
    line-height: 1.2;
    font-weight: 700;
    color: #0f172a;
  }

  .answers-meta-row button {
    text-transform: none;
  }

  .answers-meta-controls {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
  }

  .answers-class-select {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid #d9dee7;
    background: #f8fafc;
    font-size: 11px;
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
    padding: 2px 3px;
  }

  .answers-class-select select:focus {
    outline: none;
  }

  .answers-error {
    margin: 0 12px 9px;
  }

  .empty {
    text-align: center;
    padding: 34px 17px;
  }

  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }

  .success {
    color: #1f7a6e;
  }

  .answers :global(.gap-wrapper) {
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

  .answers :global(.gap-summary) {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }

  .answers :global(.gap-summary__count) {
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
    min-width: 119px;
    min-height: 27px;
    vertical-align: middle;
    padding: 3px 5px;
    border-bottom: 2px dashed #cbd5e1;
  }

  .answers :global(.gap-solution) {
    display: inline;
    color: #15803d;
    font-weight: 700;
    font-size: 12px;
  }

  .answers :global(.gap-tooltip) {
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

  .answers :global(.gap-slot:hover .gap-tooltip),
  .answers :global(.gap-slot:focus-within .gap-tooltip),
  .answers :global(.gap-slot .gap-tooltip:hover) {
    display: block;
  }

  .answers :global(.gap-tooltip__item) {
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
    font-size: 10px;
  }

  .answers :global(.gap-tooltip__actions) {
    display: inline-flex;
    gap: 5px;
    margin-left: 7px;
  }

  .answers :global(.gap-action-btn) {
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #0f172a;
    padding: 3px 5px;
    border-radius: 5px;
    font-size: 10px;
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
      gap: 14px;
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

    .app.app--with-agent {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto;
      column-gap: 0;
      height: auto;
      min-height: 100vh;
      overflow: visible;
    }

    .app.app--with-agent > :not(.topbar):not(.agent-sidebar) {
      overflow: visible;
    }

    .agent-sidebar {
      grid-column: 1;
      grid-row: auto;
      width: 100%;
      height: auto;
      margin-top: 15px;
    }

  }
</style>
