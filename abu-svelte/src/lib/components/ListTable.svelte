<script>
  import { onMount } from 'svelte';

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
  export let compactBreakpoint = null;

  const hasActionsSlot = !!$$slots.actions;
  const isClickable = typeof onRowClick === 'function';
  let tableEl = null;
  let isWidthCompact = false;

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

  const resolveCompactBreakpoint = () => {
    const value = Number(compactBreakpoint);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  const updateWidthCompactState = () => {
    if (!tableEl) {
      isWidthCompact = false;
      return;
    }
    const breakpoint = resolveCompactBreakpoint();
    isWidthCompact =
      breakpoint > 0 && tableEl.getBoundingClientRect().width <= breakpoint;
  };

  onMount(() => {
    updateWidthCompactState();
    if (typeof ResizeObserver === 'undefined' || !tableEl) return undefined;
    const observer = new ResizeObserver(() => {
      updateWidthCompactState();
    });
    observer.observe(tableEl);
    return () => observer.disconnect();
  });

  $: compactBreakpoint, updateWidthCompactState();
</script>

<div
  bind:this={tableEl}
  class={tableClass}
  class:sheet-table--width-compact={isWidthCompact}
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
          <span class="sheet-cell__value">{resolveValue(column, row)}</span>
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
    margin-top: 7px;
  }

  .sheet-row {
    display: grid;
    grid-template-columns: var(
      --table-columns,
      minmax(102px, 0.9fr) minmax(153px, 1.1fr) minmax(187px, 2fr) minmax(
          136px,
          0.9fr
        )
        minmax(136px, 0.9fr) auto
    );
    gap: 10px;
    align-items: center;
    padding: 0;
    border-radius: 12px;
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
    font-size: 10px;
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
    padding: 9px 10px;
  }

  .sheet-cell__value {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sheet-cell--name {
    font-weight: 700;
  }

  .sheet-cell--text-preview {
    white-space: normal;
  }

  .sheet-cell--text-preview .sheet-cell__value {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
    color: #475569;
    font-size: 12px;
    line-height: 1.35;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .sheet-cell--actions {
    display: flex;
    justify-content: flex-end;
    overflow: visible;
    gap: 7px;
    flex-wrap: wrap;
    align-items: center;
    row-gap: 7px;
  }

  .sheet-cell--actions .icon-btn {
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .sheet-table--classes .sheet-cell--actions {
    justify-content: flex-start;
    flex-wrap: nowrap;
    gap: 5px;
    row-gap: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .sheet-table--classes .sheet-cell--actions .icon-btn {
    white-space: nowrap;
    overflow-wrap: normal;
    flex: 0 0 auto;
  }

  @media (max-width: 1480px) {
    .sheet-table--classes .sheet-row {
      grid-template-columns: minmax(0, 1.26fr) minmax(0, 0.45fr) minmax(0, 0.75fr) minmax(
          0,
          0.86fr
        ) minmax(221px, 1.4fr);
    }

    .sheet-table--classes .sheet-cell--class-notes {
      display: none;
    }
  }

  @media (max-width: 1320px) {
    .sheet-table--classes .sheet-row {
      grid-template-columns: minmax(0, 1.32fr) minmax(0, 0.46fr) minmax(0, 0.78fr) minmax(
          207px,
          1.36fr
        );
    }

    .sheet-table--classes .sheet-cell--class-school {
      display: none;
    }
  }

  @media (max-width: 1140px) {
    .sheet-table--classes .sheet-row {
      grid-template-columns: minmax(0, 1.36fr) minmax(0, 0.55fr) minmax(194px, 1.32fr);
    }

    .sheet-table--classes .sheet-cell--class-profession {
      display: none;
    }
  }

  @media (max-width: 1000px) {
    .sheet-table--classes .sheet-row {
      grid-template-columns: minmax(0, 1fr) minmax(187px, 1.24fr);
    }

    .sheet-table--classes .sheet-cell--class-year {
      display: none;
    }
  }

  .sheet-head-btn {
    display: flex;
    width: 100%;
    height: 100%;
    align-self: stretch;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: 0;
    border-radius: 10px;
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
      gap: 5px;
      padding: 10px;
      align-items: start;
    }

    .sheet-row--head {
      display: none;
    }

    .sheet-cell {
      display: grid;
      grid-template-columns: minmax(94px, 0.5fr) minmax(0, 1fr);
      align-items: baseline;
      gap: 9px;
      white-space: normal;
      padding: 0;
    }

    .sheet-cell::before {
      content: attr(data-label);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 10px;
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

    .sheet-cell--text-preview.sheet-cell--compact-visible {
      white-space: normal;
    }

    .sheet-cell--compact-visible::before {
      display: none;
    }

    .sheet-row--with-actions .sheet-cell--actions::before {
      display: none;
    }

  }

  .sheet-table--sheet-list.sheet-table--width-compact .sheet-row--with-actions {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(41px, auto);
  }

  .sheet-table--sheet-list.sheet-table--width-compact .sheet-row:not(.sheet-row--with-actions) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .sheet-table--sheet-list.sheet-table--width-compact .sheet-row {
    gap: 10px;
    align-items: center;
    padding: 0;
  }

  .sheet-table--sheet-list.sheet-table--width-compact .sheet-row--head {
    display: grid;
  }

  .sheet-table--sheet-list.sheet-table--width-compact .sheet-cell {
    display: block;
    padding: 9px 10px;
    white-space: nowrap;
  }

  .sheet-table--sheet-list.sheet-table--width-compact .sheet-cell::before {
    display: none;
  }

  .sheet-table--sheet-list.sheet-table--width-compact .sheet-cell--compact-hidden {
    display: none;
  }

  .sheet-table--sheet-list.sheet-table--width-compact .sheet-cell--compact-visible {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sheet-table--sheet-list.sheet-table--width-compact
    .sheet-cell--text-preview.sheet-cell--compact-visible {
    white-space: normal;
  }

  .sheet-table--sheet-list.sheet-table--width-compact .sheet-cell--actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-inline-start: 0;
  }

  .sheet-table--sheet-list.sheet-table--width-compact .sheet-row--head .sheet-cell--actions {
    visibility: hidden;
  }
</style>
