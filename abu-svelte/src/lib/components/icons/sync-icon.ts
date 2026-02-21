const SYNC_ICON_TAG = 'abu-sync-icon';

export function ensureSyncIconElement(): void {
  if (customElements.get(SYNC_ICON_TAG)) return;

  class AbuSyncIcon extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>
          :host {
            display: inline-block;
            inline-size: var(--sync-icon-size, 0.92rem);
            block-size: var(--sync-icon-size, 0.92rem);
            color: currentColor;
            line-height: 0;
            pointer-events: none;
          }
          svg {
            inline-size: 100%;
            block-size: 100%;
            display: block;
            animation: sync-icon-spin 0.95s linear infinite;
          }
          @keyframes sync-icon-spin {
            to {
              transform: rotate(360deg);
            }
          }
        </style>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6.5 9A6.5 6.5 0 0 1 17 5.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M17 5.5V9h-3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M17.5 15A6.5 6.5 0 0 1 7 18.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M7 18.5V15h3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      `;
    }
  }

  customElements.define(SYNC_ICON_TAG, AbuSyncIcon);
}

export function createSyncIconElement(): HTMLElement {
  ensureSyncIconElement();
  return document.createElement(SYNC_ICON_TAG);
}
