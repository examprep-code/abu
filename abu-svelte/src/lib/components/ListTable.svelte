<script>
  export let columns = [];
  export let rows = [];
  export let columnsTemplate = '';
  export let rowKey = (row, index) => row?.id ?? index;
  export let rowAriaLabel = null;
  export let onRowClick = null;
  export let actionsLabel = '';
  export let tableClass = 'sheet-table';
  export let rowClass = 'sheet-row';
  export let headRowClass = 'sheet-row sheet-row--head';
  export let cellClass = 'sheet-cell';
  export let headerButtonClass = 'sheet-head-btn';
  export let headerStaticClass = 'sheet-head-static';
  export let actionsClass = 'sheet-cell--actions';

  const hasActionsSlot = !!$$slots.actions;
  const isClickable = typeof onRowClick === 'function';

  const resolveHint = (hint) => (typeof hint === 'function' ? hint() : hint);
  const resolveValue = (column, row) => {
    if (column?.value) return column.value(row);
    const key = column?.key;
    if (!key) return '';
    const value = row?.[key];
    return value ?? '';
  };
  const resolveClassName = (...parts) => parts.filter(Boolean).join(' ');
  const normalizeText = (value) => (value ?? '').toString().trim().toLowerCase();
  const hasActions = () => !!(actionsLabel || hasActionsSlot);
  const isTitleColumn = (column) => {
    const label = normalizeText(column?.label);
    const key = normalizeText(column?.key);
    const className = normalizeText(column?.className);
    const headerClass = normalizeText(column?.headerClass);
    return (
      key === 'name' ||
      key === 'title' ||
      key === 'titel' ||
      label.includes('name') ||
      label.includes('title') ||
      label.includes('titel') ||
      className.includes('sheet-cell--name') ||
      headerClass.includes('sheet-cell--name')
    );
  };
  const showOnCompact = (column) =>
    column?.compactHidden === true
      ? false
      : column?.compactVisible === true || isTitleColumn(column);
  const compactClass = (column) =>
    showOnCompact(column) ? 'sheet-cell--compact-visible' : 'sheet-cell--compact-hidden';
  const isSortable = (column) =>
    column?.sortable && typeof column?.onSort === 'function';

  const handleRowKeydown = (event, row) => {
    if (!isClickable) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick(row);
    }
  };

  const handleRowClick = (row) => {
    if (!isClickable) return;
    onRowClick(row);
  };
</script>

<div
  class={tableClass}
  style={columnsTemplate ? `--table-columns: ${columnsTemplate};` : ''}
>
  <div class={resolveClassName(headRowClass, hasActions() ? 'sheet-row--with-actions' : '')}>
    {#each columns as column}
      {#if isSortable(column)}
        <button
          type="button"
          class={resolveClassName(
            cellClass,
            headerButtonClass,
            column?.headerClass,
            compactClass(column)
          )}
          on:click={column.onSort}
          title={resolveHint(column.sortHint)}
        >
          <span class="sheet-head-label">{column.label}</span>
        </button>
      {:else}
        <div
          class={resolveClassName(
            cellClass,
            headerStaticClass,
            column?.headerClass,
            compactClass(column)
          )}
        >
          <span class="sheet-head-label">{column.label}</span>
        </div>
      {/if}
    {/each}
    {#if actionsLabel || hasActionsSlot}
      <div class={resolveClassName(cellClass, actionsClass)}>{actionsLabel}</div>
    {/if}
  </div>
  {#each rows as row, index (rowKey(row, index))}
    <div
      class={resolveClassName(rowClass, hasActions() ? 'sheet-row--with-actions' : '')}
      role={isClickable ? 'button' : undefined}
      tabindex={isClickable ? 0 : undefined}
      aria-label={rowAriaLabel ? rowAriaLabel(row) : undefined}
      on:click={() => handleRowClick(row)}
      on:keydown={(event) => handleRowKeydown(event, row)}
    >
      {#each columns as column}
        <div
          class={resolveClassName(cellClass, column?.className, compactClass(column))}
          data-label={column.label}
        >
          {resolveValue(column, row)}
        </div>
      {/each}
      {#if actionsLabel || hasActionsSlot}
        <div class={resolveClassName(cellClass, actionsClass)} data-label={actionsLabel}>
          <slot name="actions" {row} />
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .sheet-table {
    display: grid;
    gap: 0;
  }

  .sheet-row:not(.sheet-row--head) + .sheet-row:not(.sheet-row--head) {
    margin-top: 8px;
  }

  .sheet-row {
    display: grid;
    grid-template-columns: var(
      --table-columns,
      minmax(120px, 0.9fr) minmax(180px, 1.1fr) minmax(220px, 2fr) minmax(
          160px,
          0.9fr
        )
        minmax(160px, 0.9fr) auto
    );
    gap: 12px;
    align-items: center;
    padding: 0;
    border-radius: 14px;
    border: 1px solid #d9dee7;
    background: #ffffff;
    cursor: pointer;
  }

  .sheet-row:focus-visible {
    outline: 2px solid #1f7a6e;
    outline-offset: 2px;
  }

  .sheet-row--head {
    background: #f5f7fa;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 12px;
    color: #6f7682;
    cursor: default;
    padding: 0;
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: 0;
  }

  .sheet-row--head:focus-visible {
    outline: none;
  }

  .sheet-cell {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 10px 12px;
  }

  .sheet-cell--name {
    font-weight: 700;
  }

  .sheet-cell--actions {
    display: flex;
    justify-content: flex-end;
    overflow: visible;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    row-gap: 8px;
  }

  .sheet-cell--actions .icon-btn {
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .sheet-table--classes .sheet-cell--actions {
    flex-wrap: wrap;
  }

  .sheet-table--classes .sheet-cell--actions .icon-btn {
    white-space: nowrap;
    overflow-wrap: normal;
  }

  .sheet-head-btn {
    display: flex;
    width: 100%;
    height: 100%;
    align-self: stretch;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 0;
    border-radius: 12px;
    text-align: left;
    font: inherit;
    color: inherit;
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .sheet-head-static {
    display: flex;
    width: 100%;
    align-self: stretch;
    align-items: center;
    text-align: left;
    color: inherit;
    cursor: default;
  }

  .sheet-head-btn:hover,
  .sheet-head-btn:focus-visible {
    color: #1f7a6e;
    background: rgba(31, 122, 110, 0.08);
  }

  @media (max-width: 900px) {
    .sheet-row {
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
      padding: 12px;
      align-items: start;
    }

    .sheet-row--head {
      display: none;
    }

    .sheet-cell {
      display: grid;
      grid-template-columns: minmax(110px, 0.5fr) minmax(0, 1fr);
      align-items: baseline;
      gap: 10px;
      white-space: normal;
      padding: 0;
    }

    .sheet-cell::before {
      content: attr(data-label);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 11px;
      color: #6f7682;
    }

    .sheet-cell--actions {
      justify-content: flex-start;
    }

    .sheet-cell--compact-hidden {
      display: none;
    }

    .sheet-cell--compact-visible {
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sheet-cell--compact-visible::before {
      display: none;
    }

    .sheet-row--with-actions .sheet-cell--actions::before {
      display: none;
    }

  }
</style>
