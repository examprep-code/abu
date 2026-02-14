export type UmfrageRuntimeOptions = {
  root: HTMLElement;
  apiBaseUrl: string;
  sheetKey: string;
  user: string;
  classroom?: string | number | null;
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
  return rows
    .map((cell) => (cell.textContent || '').trim())
    .filter(Boolean);
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

const isNumericValue = (value: string) => {
  const num = Number(value);
  return Number.isFinite(num);
};

const buildNextEntry = (scale: UmfrageScaleEntry[]): UmfrageScaleEntry => {
  const numericValues = scale.map((entry) => entry.value).filter(isNumericValue);
  if (numericValues.length === scale.length && scale.length > 0) {
    const max = Math.max(...numericValues.map((value) => Number(value)));
    return { value: String(max + 1), label: DEFAULT_NEW_LABEL };
  }
  return { value: DEFAULT_NEW_LABEL, label: DEFAULT_NEW_LABEL };
};

const updateScaleEntryLabel = (entry: UmfrageScaleEntry, label: string): UmfrageScaleEntry => {
  const nextLabel = label || '';
  if (entry.value === entry.label) {
    return { value: nextLabel, label: nextLabel };
  }
  return { ...entry, label: nextLabel };
};

const buildAriaLabel = (statement: string, entry: UmfrageScaleEntry): string => {
  const labelParts = [entry.value, entry.label].filter(Boolean).join(' ');
  if (!labelParts) return statement;
  return `${statement} - ${labelParts}`;
};

async function sendAnswerToBackend(
  apiBaseUrl: string,
  payload: Record<string, string>
): Promise<void> {
  try {
    await fetch(`${apiBaseUrl}answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch {
    // ignore submit errors
  }
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
      if (this.dataset.upgraded === '1') return;
      this.dataset.upgraded = '1';

      const nameAttr = this.getAttribute('name') || `umfrage-${Math.random().toString(36).slice(2)}`;
      this.setAttribute('name', nameAttr);
      this.setAttribute('contenteditable', 'false');

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

      this.scaleEntries = parsedScale;
      this.statements = parsedStatements.length ? parsedStatements : DEFAULT_STATEMENTS;
      this.editable = Boolean(this.closest('.block-editor__visual'));

      this.render(label, nameAttr);
    }

    private notifyEditor() {
      const editor = this.closest('.block-editor__visual');
      if (!editor) return;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    private updateScaleAttribute() {
      const serialized = serializeScale(this.scaleEntries);
      this.setAttribute('scale', serialized);
    }

    private handleScaleInput(index: number, input: HTMLInputElement) {
      const entry = this.scaleEntries[index];
      if (!entry) return;
      input.setAttribute('value', input.value);
      this.scaleEntries[index] = updateScaleEntryLabel(entry, input.value);
      this.updateScaleAttribute();
      this.notifyEditor();
    }

    private insertScaleAt(index: number) {
      const nextEntry = buildNextEntry(this.scaleEntries);
      const insertIndex = Math.max(0, Math.min(index, this.scaleEntries.length));
      this.scaleEntries.splice(insertIndex, 0, nextEntry);
      this.updateScaleAttribute();
      this.render();
      const input = this.querySelectorAll<HTMLInputElement>('.umfrage-matrix__scale-input')[insertIndex];
      input?.focus();
      input?.select();
      this.notifyEditor();
    }

    private removeScaleAt(index: number) {
      if (index < 0 || index >= this.scaleEntries.length) return;
      this.scaleEntries.splice(index, 1);
      this.updateScaleAttribute();
      this.render();
      this.notifyEditor();
    }

    private render(labelOverride?: string, nameOverride?: string) {
      const label = labelOverride || this.getAttribute('label') || this.getAttribute('data-label') || 'Aussage';
      const nameAttr = nameOverride || this.getAttribute('name') || '';

      this.innerHTML = '';

      const scroll = document.createElement('div');
      scroll.className = 'umfrage-matrix__scroll';

      const table = document.createElement('table');
      table.className = 'umfrage-matrix__table';

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

            const valueEl = document.createElement('span');
            valueEl.className = 'umfrage-matrix__scale-value';
            valueEl.textContent = entry.value;

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'umfrage-matrix__scale-input';
            input.value = entry.label;
            input.setAttribute('value', entry.label);
            input.addEventListener('input', () => this.handleScaleInput(index, input));

            const actions = document.createElement('div');
            actions.className = 'umfrage-matrix__scale-actions';

            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'umfrage-matrix__scale-btn umfrage-matrix__scale-btn--add';
            addBtn.textContent = '+';
            addBtn.setAttribute('aria-label', 'Kategorie einfuegen');
            addBtn.addEventListener('click', () => this.insertScaleAt(index + 1));

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'umfrage-matrix__scale-btn umfrage-matrix__scale-btn--remove';
            removeBtn.textContent = '-';
            removeBtn.setAttribute('aria-label', 'Kategorie entfernen');
            removeBtn.addEventListener('click', () => this.removeScaleAt(index));

            actions.appendChild(addBtn);
            actions.appendChild(removeBtn);
            editor.appendChild(valueEl);
            editor.appendChild(input);
            editor.appendChild(actions);
            th.appendChild(editor);
          } else {
            const valueEl = document.createElement('span');
            valueEl.className = 'umfrage-matrix__scale-value';
            valueEl.textContent = entry.value;

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
      this.statements.forEach((statement, rowIndex) => {
        const row = document.createElement('tr');
        const rowHeader = document.createElement('th');
        rowHeader.className = 'umfrage-matrix__statement';
        rowHeader.scope = 'row';
        rowHeader.textContent = statement;
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

          const dot = document.createElement('span');
          dot.className = 'umfrage-matrix__dot';

          labelEl.appendChild(input);
          labelEl.appendChild(dot);
          cell.appendChild(labelEl);
          row.appendChild(cell);
        });

        tbody.appendChild(row);
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
  ensureUmfrageElements();

  const bindInputs = () => {
    const inputs = Array.from(options.root.querySelectorAll('input.umfrage-input')) as HTMLInputElement[];
    inputs.forEach((input) => {
      if (input.dataset.umfrageBound === '1') return;
      input.dataset.umfrageBound = '1';
      input.addEventListener('change', () => {
        if (!input.checked) return;
        if (!options.user) return;
        const key = input.dataset.key || input.name;
        if (!key) return;
        const payload: Record<string, string> = {
          key,
          sheet: options.sheetKey,
          user: options.user,
          value: input.value
        };
        if (options.classroom) {
          payload.classroom = String(options.classroom);
        }
        sendAnswerToBackend(options.apiBaseUrl, payload);
      });
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
      options.root.dataset.umfrageRuntime = '';
    },
    refresh
  };
}
