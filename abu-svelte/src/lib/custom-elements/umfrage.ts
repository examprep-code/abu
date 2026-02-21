import { createSyncIconElement, ensureSyncIconElement } from '$lib/components/icons/sync-icon';

export type UmfrageRuntimeOptions = {
  root: HTMLElement;
  apiBaseUrl: string;
  sheetKey: string;
  user: string;
  classroom?: string | number | null;
  onSaveState?: (event: {
    status: 'saving' | 'saved' | 'error';
    message?: string;
    at?: number;
  }) => void;
};

type UmfrageScaleEntry = {
  value: string;
  label: string;
};

const DEFAULT_SCALE: UmfrageScaleEntry[] = [
  { value: '1', label: 'trifft gar nicht zu' },
  { value: '2', label: 'trifft eher nicht zu' },
  { value: '3', label: 'teils/teils' },
  { value: '4', label: 'trifft eher zu' },
  { value: '5', label: 'trifft voll und ganz zu' }
];

const DEFAULT_STATEMENTS = ['Aussage 1', 'Aussage 2', 'Aussage 3'];
const DEFAULT_NEW_STATEMENT = 'Neue Aussage';
const SCALE_OFF_VALUES = new Set(['-', 'none', 'off', 'ohne', 'keine', 'leer']);
const DEFAULT_NEW_LABEL = 'Neue Kategorie';

const splitList = (raw: string): string[] => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return [];
  let parts = trimmed
    .split(/\r?\n|;/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    parts = trimmed
      .split(/\|/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (parts.length <= 1) {
    parts = trimmed
      .split(/,/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return parts;
};

const parseScaleEntry = (entry: string): UmfrageScaleEntry => {
  const trimmed = entry.trim();
  const parts = trimmed.split(/[:=]/).map((part) => part.trim());
  if (parts.length > 1) {
    const value = parts.shift() || '';
    const label = parts.join(':').trim();
    return { value: value || label, label: label || value };
  }
  const match = trimmed.match(/^(\S+)\s+(.+)$/);
  if (match) {
    return { value: match[1], label: match[2] };
  }
  return { value: trimmed, label: trimmed };
};

const parseScale = (raw: string): UmfrageScaleEntry[] => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return DEFAULT_SCALE;
  if (SCALE_OFF_VALUES.has(trimmed.toLowerCase())) return [];
  const rangeMatch = trimmed.match(/^(\d+)\s*(?:-|bis|to|\.{2,})\s*(\d+)$/i);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      const step = start <= end ? 1 : -1;
      const values: UmfrageScaleEntry[] = [];
      for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
        values.push({ value: String(i), label: String(i) });
      }
      if (values.length) return values;
    }
  }
  const entries = splitList(trimmed);
  return entries.length ? entries.map(parseScaleEntry) : DEFAULT_SCALE;
};

const findScaleContainer = (element: HTMLElement): Element | null =>
  element.querySelector('[data-scale], [data-answers], .umfrage-scale');

const parseScaleFromContainer = (container: Element | null): UmfrageScaleEntry[] => {
  if (!container) return [];
  const listItems = Array.from(container.querySelectorAll('li'))
    .map((li) => (li.textContent || '').trim())
    .filter(Boolean);
  const entries = listItems.length ? listItems : splitList(container.textContent || '');
  return entries.length ? entries.map(parseScaleEntry) : [];
};

const parseScaleFromTable = (table: Element | null): UmfrageScaleEntry[] => {
  if (!table) return [];
  const headers = Array.from(table.querySelectorAll('thead th.umfrage-matrix__scale'));
  const scale = headers
    .map((th) => {
      const valueAttr = th.getAttribute('data-value') || '';
      const labelAttr = th.getAttribute('data-label') || '';
      const input = th.querySelector('input.umfrage-matrix__scale-input') as HTMLInputElement | null;
      const valueEl = th.querySelector('.umfrage-matrix__scale-value');
      const labelEl = th.querySelector('.umfrage-matrix__scale-label');
      const valueText = (valueEl?.textContent || '').trim();
      const labelText = (labelEl?.textContent || '').trim();
      const inputValue = (input?.value || '').trim();
      const value = valueAttr || valueText || labelAttr || inputValue;
      const label = inputValue || labelAttr || labelText || value;
      if (!value && !label) return null;
      return { value: value || label, label: label || value };
    })
    .filter((entry): entry is UmfrageScaleEntry => Boolean(entry));
  return scale;
};

const parseStatementsFromTable = (table: Element | null): string[] => {
  if (!table) return [];
  const rows = Array.from(table.querySelectorAll('tbody th.umfrage-matrix__statement'));
  return rows.map((cell) => {
    const input = cell.querySelector(
      'input.umfrage-matrix__statement-input, textarea.umfrage-matrix__statement-input'
    ) as HTMLInputElement | HTMLTextAreaElement | null;
    if (input) return input.value || '';
    return (cell.textContent || '').trim();
  });
};

const parseStatements = (element: HTMLElement, scaleContainer?: Element | null): string[] => {
  const attr =
    element.getAttribute('statements') ||
    element.getAttribute('data-statements') ||
    element.getAttribute('questions') ||
    element.getAttribute('data-questions') ||
    element.getAttribute('items') ||
    element.getAttribute('data-items') ||
    '';

  const items = attr ? splitList(attr) : [];
  if (items.length) return items;

  const listItems = Array.from(element.querySelectorAll('li'))
    .filter((li) => !scaleContainer || !scaleContainer.contains(li))
    .map((li) => (li.textContent || '').trim())
    .filter(Boolean);
  if (listItems.length) return listItems;

  const textItems = splitList(element.textContent || '');
  return textItems.length ? textItems : DEFAULT_STATEMENTS;
};

const serializeScale = (scale: UmfrageScaleEntry[]): string => {
  if (!scale.length) return 'off';
  return scale
    .map((entry) => {
      const value = (entry.value || '').trim();
      const label = (entry.label || '').trim();
      if (!value && !label) return '';
      if (!label || value === label) return value || label;
      return `${value}: ${label}`;
    })
    .filter(Boolean)
    .join(';');
};

const normalizeScaleValues = (scale: UmfrageScaleEntry[]): UmfrageScaleEntry[] =>
  scale.map((entry, index) => ({
    value: String(index + 1),
    label: (entry.label || entry.value || '').trim()
  }));

const serializeStatements = (statements: string[]): string =>
  statements.map((statement) => statement.trim()).join(';');

const buildNextEntry = (): UmfrageScaleEntry => {
  return { value: DEFAULT_NEW_LABEL, label: DEFAULT_NEW_LABEL };
};

const updateScaleEntryLabel = (entry: UmfrageScaleEntry, label: string): UmfrageScaleEntry => ({
  ...entry,
  label: label || ''
});

const buildAriaLabel = (statement: string, entry: UmfrageScaleEntry): string => {
  const labelParts = [entry.value, entry.label].filter(Boolean).join(' ');
  if (!labelParts) return statement;
  return `${statement} - ${labelParts}`;
};

async function sendAnswerToBackend(
  apiBaseUrl: string,
  payload: Record<string, string>
): Promise<{ ok: boolean; warning?: string }> {
  try {
    const response = await fetch(`${apiBaseUrl}answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    let parsed: Record<string, any> = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }
    if (!response.ok) {
      const warning =
        parsed.warning ||
        (parsed.data && parsed.data.chatgpt && parsed.data.chatgpt.error) ||
        parsed.error ||
        `Fehler im Backend (${response.status})`;
      return { ok: false, warning: String(warning) };
    }
    if (parsed.warning) {
      return { ok: false, warning: String(parsed.warning) };
    }
    return { ok: true };
  } catch {
    return { ok: false, warning: 'Antwort konnte nicht gespeichert werden.' };
  }
}

function notifySaveState(
  options: UmfrageRuntimeOptions,
  status: 'saving' | 'saved' | 'error',
  message = ''
): void {
  if (!options.onSaveState) return;
  options.onSaveState({
    status,
    message,
    at: status === 'saved' ? Date.now() : undefined
  });
}

type RowSaveState = 'saving' | 'saved' | 'error';

function rowIndicatorForInput(input: HTMLInputElement): HTMLElement | null {
  const row = input.closest('tr');
  if (!(row instanceof HTMLElement)) return null;
  const existing = row.querySelector('.umfrage-save-indicator');
  if (existing instanceof HTMLElement) return existing;
  const anchorCell = row.querySelector('td:last-child, th:last-child');
  if (!(anchorCell instanceof HTMLElement)) return null;

  const indicator = document.createElement('button');
  indicator.type = 'button';
  indicator.className = 'umfrage-save-indicator';
  indicator.setAttribute('aria-live', 'polite');
  indicator.tabIndex = -1;
  indicator.disabled = true;
  anchorCell.appendChild(indicator);
  return indicator;
}

function setRowIndicator(
  input: HTMLInputElement,
  state: RowSaveState,
  message = ''
): void {
  const indicator = rowIndicatorForInput(input);
  if (!indicator) return;

  indicator.classList.remove(
    'umfrage-save-indicator--saving',
    'umfrage-save-indicator--saved',
    'umfrage-save-indicator--error',
    'umfrage-save-indicator--retry',
    'umfrage-save-indicator--visible'
  );

  if (state === 'saving') {
    indicator.replaceChildren(createSyncIconElement());
    indicator.title = 'Wird gespeichert';
    indicator.setAttribute('aria-label', 'Wird gespeichert');
    indicator.tabIndex = -1;
    (indicator as HTMLButtonElement).disabled = true;
    indicator.classList.add('umfrage-save-indicator--saving', 'umfrage-save-indicator--visible');
    return;
  }

  if (state === 'saved') {
    indicator.textContent = '✓';
    indicator.title = 'Gespeichert';
    indicator.setAttribute('aria-label', 'Gespeichert');
    indicator.tabIndex = -1;
    (indicator as HTMLButtonElement).disabled = true;
    indicator.classList.add('umfrage-save-indicator--saved', 'umfrage-save-indicator--visible');
    return;
  }

  indicator.textContent = '!';
  indicator.title = message
    ? `${message} Klick zum erneut senden.`
    : 'Speichern fehlgeschlagen. Klick zum erneut senden.';
  indicator.setAttribute('aria-label', 'Speichern fehlgeschlagen. Erneut senden');
  indicator.tabIndex = 0;
  (indicator as HTMLButtonElement).disabled = false;
  indicator.classList.add(
    'umfrage-save-indicator--error',
    'umfrage-save-indicator--retry',
    'umfrage-save-indicator--visible'
  );
}

function collectLatestByKey(entries: Array<Record<string, any>>): Record<string, Record<string, any>> {
  const latestByKey: Record<string, Record<string, any>> = {};
  entries.forEach((entry) => {
    const key = entry?.key;
    if (!key) return;
    const existing = latestByKey[key];
    if (!existing) {
      latestByKey[key] = entry;
      return;
    }
    const existingTime = new Date(existing.updated_at || 0).getTime();
    const entryTime = new Date(entry.updated_at || 0).getTime();
    if (entryTime > existingTime) {
      latestByKey[key] = entry;
    } else if (entryTime === existingTime && (entry.id || 0) > (existing.id || 0)) {
      latestByKey[key] = entry;
    }
  });
  return latestByKey;
}

async function prefillAnswers(options: UmfrageRuntimeOptions): Promise<void> {
  const { apiBaseUrl, sheetKey, user, root } = options;
  if (!user) return;

  const params = new URLSearchParams();
  params.set('sheet', sheetKey);
  params.set('user', user);
  if (options.classroom) {
    params.set('classroom', String(options.classroom));
  }
  const endpoint = `${apiBaseUrl}answer?${params.toString()}`;

  try {
    const resp = await fetch(endpoint);
    if (!resp.ok) return;
    const payload = await resp.json().catch(() => ({}));
    const answers: Array<Record<string, any>> = payload?.data?.answer ?? [];
    const latestByKey = collectLatestByKey(answers);

    const inputs = Array.from(root.querySelectorAll('input.umfrage-input')) as HTMLInputElement[];
    const groups = new Map<string, HTMLInputElement[]>();
    inputs.forEach((input) => {
      const key = input.dataset.key || input.name;
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(input);
    });

    groups.forEach((group, key) => {
      const entry = latestByKey[key];
      const value = entry?.value ?? '';
      group.forEach((input) => {
        input.checked = entry ? String(input.value) === String(value) : false;
      });
    });
  } catch {
    // ignore prefill errors
  }
}

export function ensureUmfrageElements(): void {
  if (customElements.get('umfrage-matrix')) return;

  class UmfrageMatrix extends HTMLElement {
    private scaleEntries: UmfrageScaleEntry[] = [];
    private statements: string[] = [];
    private editable = false;

    connectedCallback() {
      const isFirstConnect = this.dataset.upgraded !== '1';
      if (isFirstConnect) {
        this.dataset.upgraded = '1';
        this.setAttribute('contenteditable', 'false');
      }

      const nameAttr = this.getAttribute('name') || `umfrage-${Math.random().toString(36).slice(2)}`;
      this.setAttribute('name', nameAttr);

      const scaleRaw = this.getAttribute('scale') || this.getAttribute('data-scale') || '';
      const label = this.getAttribute('label') || this.getAttribute('data-label') || 'Aussage';

      const existingTable = this.querySelector('.umfrage-matrix__table');
      const scaleFromTable = parseScaleFromTable(existingTable);
      const statementsFromTable = parseStatementsFromTable(existingTable);

      const scaleContainer = findScaleContainer(this);
      const containerScale = parseScaleFromContainer(scaleContainer);
      const parsedScale = scaleRaw.trim()
        ? parseScale(scaleRaw)
        : scaleFromTable.length
        ? scaleFromTable
        : containerScale.length
        ? containerScale
        : DEFAULT_SCALE;
      const parsedStatements = statementsFromTable.length
        ? statementsFromTable
        : parseStatements(this, scaleContainer);

      this.scaleEntries = normalizeScaleValues(parsedScale);
      this.statements = parsedStatements.length ? parsedStatements : DEFAULT_STATEMENTS;
      this.editable = Boolean(this.closest('.block-editor__visual, [contenteditable="true"]'));
      this.updateScaleAttribute();
      this.updateStatementsAttribute();

      this.render(label, nameAttr);
    }

    private notifyEditor() {
      const editor = this.closest('.block-editor__visual, [contenteditable="true"]');
      if (!editor) return;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    private updateScaleAttribute() {
      const serialized = serializeScale(this.scaleEntries);
      this.setAttribute('scale', serialized);
    }

    private updateStatementsAttribute() {
      this.setAttribute('statements', serializeStatements(this.statements));
    }

    private syncScaleState() {
      this.scaleEntries = normalizeScaleValues(this.scaleEntries);
      this.updateScaleAttribute();
    }

    private handleScaleInput(index: number, input: HTMLInputElement) {
      const entry = this.scaleEntries[index];
      if (!entry) return;
      input.setAttribute('value', input.value);
      this.scaleEntries[index] = updateScaleEntryLabel(entry, input.value);
      this.updateScaleAttribute();
    }

    private handleStatementInput(index: number, input: HTMLInputElement | HTMLTextAreaElement) {
      if (index < 0 || index >= this.statements.length) return;
      input.setAttribute('value', input.value);
      this.statements[index] = input.value;
      this.updateStatementsAttribute();
    }

    private commitScaleEdit() {
      this.notifyEditor();
    }

    private commitStatementEdit() {
      this.notifyEditor();
    }

    private insertScaleAt(index: number) {
      const nextEntry = buildNextEntry();
      const insertIndex = Math.max(0, Math.min(index, this.scaleEntries.length));
      this.scaleEntries.splice(insertIndex, 0, nextEntry);
      this.syncScaleState();
      this.render();
      const input = this.querySelectorAll<HTMLInputElement>('.umfrage-matrix__scale-input')[insertIndex];
      input?.focus();
      input?.select();
      this.notifyEditor();
    }

    private removeScaleAt(index: number) {
      if (index < 0 || index >= this.scaleEntries.length) return;
      this.scaleEntries.splice(index, 1);
      this.syncScaleState();
      this.render();
      this.notifyEditor();
    }

    private insertStatementAt(index: number) {
      const insertIndex = Math.max(0, Math.min(index, this.statements.length));
      this.statements.splice(insertIndex, 0, DEFAULT_NEW_STATEMENT);
      this.updateStatementsAttribute();
      this.render();
      const input = this.querySelectorAll<HTMLTextAreaElement>('.umfrage-matrix__statement-input')[
        insertIndex
      ];
      input?.focus();
      input?.select();
      this.notifyEditor();
    }

    private removeStatementAt(index: number) {
      if (this.statements.length <= 1) return;
      if (index < 0 || index >= this.statements.length) return;
      this.statements.splice(index, 1);
      this.updateStatementsAttribute();
      this.render();
      const focusIndex = Math.max(0, Math.min(index, this.statements.length - 1));
      const input = this.querySelectorAll<HTMLTextAreaElement>('.umfrage-matrix__statement-input')[
        focusIndex
      ];
      input?.focus();
      this.notifyEditor();
    }

    private appendStatementInsertRow(
      tbody: HTMLTableSectionElement,
      insertIndex: number,
      scaleColSpan: number
    ) {
      const insertRow = document.createElement('tr');
      insertRow.className = 'umfrage-matrix__statement-insert-row';

      const insertCell = document.createElement('th');
      insertCell.className = 'umfrage-matrix__statement-insert-cell';
      insertCell.scope = 'row';

      const insertBtn = document.createElement('button');
      insertBtn.type = 'button';
      insertBtn.className = 'umfrage-matrix__statement-insert-btn';
      insertBtn.textContent = '+';
      insertBtn.setAttribute('aria-label', 'Aussage einfuegen');
      insertBtn.addEventListener('click', () => this.insertStatementAt(insertIndex));

      insertCell.appendChild(insertBtn);
      insertRow.appendChild(insertCell);

      if (scaleColSpan > 0) {
        const fillCell = document.createElement('td');
        fillCell.className = 'umfrage-matrix__statement-insert-fill';
        fillCell.colSpan = scaleColSpan;
        fillCell.setAttribute('aria-hidden', 'true');
        insertRow.appendChild(fillCell);
      }

      tbody.appendChild(insertRow);
    }

    private render(labelOverride?: string, nameOverride?: string) {
      const label = labelOverride || this.getAttribute('label') || this.getAttribute('data-label') || 'Aussage';
      const nameAttr = nameOverride || this.getAttribute('name') || '';

      this.innerHTML = '';

      const scroll = document.createElement('div');
      scroll.className = 'umfrage-matrix__scroll';

      const table = document.createElement('table');
      table.className = 'umfrage-matrix__table';
      const colgroup = document.createElement('colgroup');
      const statementCol = document.createElement('col');
      statementCol.className = 'umfrage-matrix__col-statement';
      statementCol.style.width = this.scaleEntries.length ? '44%' : '100%';
      colgroup.appendChild(statementCol);
      if (this.scaleEntries.length) {
        const perScaleWidth = `${(56 / this.scaleEntries.length).toFixed(4)}%`;
        this.scaleEntries.forEach(() => {
          const col = document.createElement('col');
          col.className = 'umfrage-matrix__col-scale';
          col.style.width = perScaleWidth;
          colgroup.appendChild(col);
        });
      }
      table.appendChild(colgroup);

      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      const corner = document.createElement('th');
      corner.className = 'umfrage-matrix__corner';
      corner.scope = 'col';
      corner.textContent = label;
      headRow.appendChild(corner);

      if (this.scaleEntries.length) {
        this.scaleEntries.forEach((entry, index) => {
          const th = document.createElement('th');
          th.className = 'umfrage-matrix__scale';
          th.scope = 'col';
          th.dataset.value = entry.value;
          th.dataset.label = entry.label;

          if (this.editable) {
            const editor = document.createElement('div');
            editor.className = 'umfrage-matrix__scale-editor';

            const controls = document.createElement('div');
            controls.className = 'umfrage-matrix__scale-controls';

            const addBeforeBtn = document.createElement('button');
            addBeforeBtn.type = 'button';
            addBeforeBtn.className =
              'umfrage-matrix__scale-btn umfrage-matrix__scale-btn--add umfrage-matrix__scale-btn--insert umfrage-matrix__scale-btn--insert-left';
            addBeforeBtn.textContent = '+';
            addBeforeBtn.setAttribute('aria-label', 'Kategorie links einfuegen');
            addBeforeBtn.addEventListener('click', () => this.insertScaleAt(index));
            controls.appendChild(addBeforeBtn);

            const valueEl = document.createElement('span');
            valueEl.className = 'umfrage-matrix__scale-value';
            valueEl.textContent = String(index + 1);
            controls.appendChild(valueEl);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'umfrage-matrix__scale-btn umfrage-matrix__scale-btn--remove';
            removeBtn.textContent = '-';
            removeBtn.setAttribute('aria-label', 'Kategorie entfernen');
            removeBtn.addEventListener('click', () => this.removeScaleAt(index));
            controls.appendChild(removeBtn);

            if (index === this.scaleEntries.length - 1) {
              const addAfterBtn = document.createElement('button');
              addAfterBtn.type = 'button';
              addAfterBtn.className =
                'umfrage-matrix__scale-btn umfrage-matrix__scale-btn--add umfrage-matrix__scale-btn--insert umfrage-matrix__scale-btn--insert-right';
              addAfterBtn.textContent = '+';
              addAfterBtn.setAttribute('aria-label', 'Kategorie rechts einfuegen');
              addAfterBtn.addEventListener('click', () => this.insertScaleAt(index + 1));
              controls.appendChild(addAfterBtn);
            }

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'umfrage-matrix__scale-input';
            input.value = entry.label;
            input.setAttribute('value', entry.label);
            input.addEventListener('input', (event) => {
              event.stopPropagation();
              this.handleScaleInput(index, input);
            });
            input.addEventListener('blur', (event) => {
              event.stopPropagation();
              this.commitScaleEdit();
            });

            editor.appendChild(controls);
            editor.appendChild(input);
            th.appendChild(editor);
          } else {
            const valueEl = document.createElement('span');
            valueEl.className = 'umfrage-matrix__scale-value';
            valueEl.textContent = String(index + 1);

            const labelEl = document.createElement('span');
            labelEl.className = 'umfrage-matrix__scale-label';
            labelEl.textContent = entry.label;

            th.appendChild(valueEl);
            th.appendChild(labelEl);
          }
          headRow.appendChild(th);
        });
      } else if (this.editable) {
        const th = document.createElement('th');
        th.className = 'umfrage-matrix__scale umfrage-matrix__scale--empty';
        th.scope = 'col';
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'umfrage-matrix__scale-btn umfrage-matrix__scale-btn--add';
        addBtn.textContent = '+';
        addBtn.setAttribute('aria-label', 'Kategorie einfuegen');
        addBtn.addEventListener('click', () => this.insertScaleAt(0));
        th.appendChild(addBtn);
        headRow.appendChild(th);
      }

      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      const scaleColSpan = Math.max(0, this.scaleEntries.length);
      if (this.editable) {
        this.appendStatementInsertRow(tbody, 0, scaleColSpan);
      }
      this.statements.forEach((statement, rowIndex) => {
        const row = document.createElement('tr');
        const rowHeader = document.createElement('th');
        rowHeader.className = 'umfrage-matrix__statement';
        rowHeader.scope = 'row';
        if (this.editable) {
          const editor = document.createElement('div');
          editor.className = 'umfrage-matrix__statement-editor';

          const input = document.createElement('textarea');
          input.className = 'umfrage-matrix__statement-input';
          input.value = statement;
          input.setAttribute('rows', '2');
          input.setAttribute('value', statement);
          input.addEventListener('input', (event) => {
            event.stopPropagation();
            this.handleStatementInput(rowIndex, input);
          });
          input.addEventListener('blur', (event) => {
            event.stopPropagation();
            this.commitStatementEdit();
          });

          const controls = document.createElement('div');
          controls.className = 'umfrage-matrix__statement-controls';

          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className =
            'umfrage-matrix__statement-btn umfrage-matrix__statement-btn--remove';
          removeBtn.textContent = '-';
          removeBtn.setAttribute('aria-label', 'Aussage entfernen');
          removeBtn.disabled = this.statements.length <= 1;
          removeBtn.addEventListener('click', () => this.removeStatementAt(rowIndex));

          controls.appendChild(removeBtn);
          editor.appendChild(input);
          editor.appendChild(controls);
          rowHeader.appendChild(editor);
        } else {
          rowHeader.textContent = statement;
        }
        row.appendChild(rowHeader);

        this.scaleEntries.forEach((entry) => {
          const cell = document.createElement('td');
          cell.className = 'umfrage-matrix__cell';

          const labelEl = document.createElement('label');
          labelEl.className = 'umfrage-matrix__option';

          const input = document.createElement('input');
          input.type = 'radio';
          input.className = 'umfrage-input';
          input.name = `${nameAttr}-${rowIndex + 1}`;
          input.value = entry.value;
          if (this.editable) {
            input.disabled = true;
          }
          input.dataset.key = `${nameAttr}-${rowIndex + 1}`;
          input.dataset.statement = statement;
          input.dataset.scaleLabel = entry.label;
          input.dataset.scaleValue = entry.value;
          input.setAttribute('aria-label', buildAriaLabel(statement, entry));

          labelEl.appendChild(input);
          cell.appendChild(labelEl);
          row.appendChild(cell);
        });

        tbody.appendChild(row);
        if (this.editable) {
          this.appendStatementInsertRow(tbody, rowIndex + 1, scaleColSpan);
        }
      });

      table.appendChild(tbody);
      scroll.appendChild(table);
      this.appendChild(scroll);
    }
  }

  customElements.define('umfrage-matrix', UmfrageMatrix);
}

export function createUmfrageRuntime(options: UmfrageRuntimeOptions): {
  destroy: () => void;
  refresh: () => Promise<void>;
} {
  ensureSyncIconElement();
  ensureUmfrageElements();
  const inputHandlers = new Map<HTMLInputElement, EventListener>();
  const retryHandlers = new Map<HTMLElement, EventListener>();
  const busyKeys = new Set<string>();
  const isEditorInput = (input: HTMLInputElement): boolean =>
    Boolean(input.closest('.block-editor__visual, [contenteditable="true"]'));
  const inputKeyFor = (input: HTMLInputElement): string => input.dataset.key || input.name || '';

  const findCheckedInputForKey = (key: string): HTMLInputElement | null => {
    if (!key) return null;
    const inputs = Array.from(options.root.querySelectorAll('input.umfrage-input')) as HTMLInputElement[];
    return (
      inputs.find((candidate) => inputKeyFor(candidate) === key && candidate.checked) || null
    );
  };

  const clearRetryHandler = (indicator: HTMLElement | null): void => {
    if (!indicator) return;
    const existing = retryHandlers.get(indicator);
    if (existing) {
      indicator.removeEventListener('click', existing);
      retryHandlers.delete(indicator);
    }
    indicator.classList.remove('umfrage-save-indicator--retry');
  };

  const setRetryHandler = (
    indicator: HTMLElement | null,
    key: string,
    fallbackInput: HTMLInputElement
  ): void => {
    if (!indicator || !key) return;
    clearRetryHandler(indicator);
    const retry = () => {
      if (busyKeys.has(key)) return;
      const selected = findCheckedInputForKey(key) || fallbackInput;
      if (!selected || !selected.checked) return;
      void submitInput(selected);
    };
    retryHandlers.set(indicator, retry);
    indicator.addEventListener('click', retry);
    indicator.classList.add('umfrage-save-indicator--retry');
  };

  const submitInput = async (input: HTMLInputElement): Promise<void> => {
    if (!input.checked) return;
    if (!options.user) return;
    const key = inputKeyFor(input);
    if (!key) return;
    if (busyKeys.has(key)) return;
    busyKeys.add(key);

    const indicator = rowIndicatorForInput(input);
    clearRetryHandler(indicator);
    setRowIndicator(input, 'saving');
    notifySaveState(options, 'saving');

    const payload: Record<string, string> = {
      key,
      sheet: options.sheetKey,
      user: options.user,
      value: input.value
    };
    if (options.classroom) {
      payload.classroom = String(options.classroom);
    }

    try {
      const result = await sendAnswerToBackend(options.apiBaseUrl, payload);
      if (!result.ok) {
        setRowIndicator(input, 'error', result.warning || 'Antwort konnte nicht gespeichert werden.');
        setRetryHandler(indicator, key, input);
        notifySaveState(options, 'error', result.warning || 'Antwort konnte nicht gespeichert werden.');
        return;
      }

      setRowIndicator(input, 'saved');
      clearRetryHandler(indicator);
      notifySaveState(options, 'saved');
    } finally {
      busyKeys.delete(key);
    }
  };

  const bindInputs = () => {
    const inputs = Array.from(options.root.querySelectorAll('input.umfrage-input')) as HTMLInputElement[];
    inputs.forEach((input) => {
      // Defensive fallback: persisted editor markup may contain disabled radios.
      if (input.disabled && !isEditorInput(input)) {
        input.disabled = false;
      }
      if (inputHandlers.has(input)) return;
      const handler = () => {
        void submitInput(input);
      };
      inputHandlers.set(input, handler);
      input.addEventListener('change', handler);
    });
  };

  options.root.dataset.umfrageRuntime = '1';
  bindInputs();
  const observer = new MutationObserver(() => {
    bindInputs();
  });
  observer.observe(options.root, { childList: true, subtree: true });

  const refresh = async () => {
    await prefillAnswers(options);
    bindInputs();
  };

  return {
    destroy: () => {
      observer.disconnect();
      inputHandlers.forEach((handler, input) => {
        input.removeEventListener('change', handler);
      });
      inputHandlers.clear();
      retryHandlers.forEach((handler, indicator) => {
        indicator.removeEventListener('click', handler);
      });
      retryHandlers.clear();
      busyKeys.clear();
      options.root.dataset.umfrageRuntime = '';
    },
    refresh
  };
}
