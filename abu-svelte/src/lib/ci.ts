const SHELL_GUARD_ID = 'school-ci-shell-guard';

const SHELL_GUARD_CSS = `
html:has(body .app),
body:has(.app) {
  width: 100% !important;
  max-width: 100vw !important;
  overflow-x: hidden !important;
}

body:has(.app) .app {
  box-sizing: border-box !important;
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100vw !important;
}

body:has(.app.app--with-agent) .app.app--with-agent {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) var(--agent-sidebar-width) !important;
  grid-template-rows: auto minmax(0, 1fr) !important;
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100vw !important;
  overflow: hidden !important;
}

body:has(.app.app--with-agent) .app.app--with-agent > :not(.agent-sidebar),
body:has(.app.app--with-agent) .app.app--with-agent .workspace,
body:has(.app.app--with-agent) .app.app--with-agent .panel,
body:has(.app.app--with-agent) .app.app--with-agent .editor,
body:has(.app.app--with-agent) .app.app--with-agent .editor-body,
body:has(.app.app--with-agent) .app.app--with-agent .editor-main,
body:has(.app.app--with-agent) .app.app--with-agent .preview,
body:has(.app.app--with-agent) .app.app--with-agent .visual-layout,
body:has(.app.app--with-agent) .app.app--with-agent .visual-edit-panel,
body:has(.app.app--with-agent) .app.app--with-agent .block-editors,
body:has(.app.app--with-agent) .app.app--with-agent .block-editor {
  box-sizing: border-box !important;
  min-width: 0 !important;
  max-width: 100% !important;
}

body:has(.app.app--with-agent) .app.app--with-agent > .topbar,
body:has(.app.app--with-agent) .app.app--with-agent > .workspace,
body:has(.app.app--with-agent) .app.app--with-agent > .panel,
body:has(.app.app--with-agent) .app.app--with-agent > section,
body:has(.app.app--with-agent) .app.app--with-agent .panel {
  width: auto !important;
}

@media (max-width: 900px) {
  body:has(.app.app--with-agent) .app.app--with-agent {
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: auto auto !important;
    height: auto !important;
    min-height: 100vh !important;
    overflow: visible !important;
  }
}
`.trim();

const removeShellGuard = () => {
  document.getElementById(SHELL_GUARD_ID)?.remove();
};

const appendShellGuard = () => {
  const guardEl = document.getElementById(SHELL_GUARD_ID) ?? document.createElement('style');
  guardEl.id = SHELL_GUARD_ID;
  guardEl.textContent = SHELL_GUARD_CSS;
  document.head.appendChild(guardEl);
};

export const applySchoolCiCss = (css?: string | null) => {
  if (typeof document === 'undefined') return;
  const id = 'school-ci-css';
  const existing = document.getElementById(id);
  const next = (css ?? '').trim();
  if (!next) {
    if (existing) existing.remove();
    removeShellGuard();
    return;
  }
  const styleEl = existing ?? document.createElement('style');
  styleEl.id = id;
  styleEl.textContent = next;
  // Re-append to keep CI rules last in <head>, so page defaults don't override them.
  document.head.appendChild(styleEl);
  appendShellGuard();
};
