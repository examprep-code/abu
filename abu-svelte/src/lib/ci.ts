export const applySchoolCiCss = (css?: string | null) => {
  if (typeof document === 'undefined') return;
  const id = 'school-ci-css';
  const shellGuardId = 'school-ci-shell-guard';
  const shellGuardCss = `
.app {
  box-sizing: border-box !important;
  max-width: 100vw !important;
}

.app.app--with-agent {
  min-width: 0 !important;
  max-width: 100vw !important;
  overflow: hidden !important;
}

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
  box-sizing: border-box !important;
  min-width: 0 !important;
  max-width: 100% !important;
}

@media (max-width: 900px) {
  .app.app--with-agent {
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: auto auto !important;
    height: auto !important;
    min-height: 100vh !important;
    overflow: visible !important;
  }
}
`.trim();
  const existing = document.getElementById(id);
  const existingGuard = document.getElementById(shellGuardId);
  const next = (css ?? '').trim();
  if (!next) {
    if (existing) existing.remove();
    if (existingGuard) existingGuard.remove();
    return;
  }
  const styleEl = existing ?? document.createElement('style');
  styleEl.id = id;
  styleEl.textContent = next;
  // Re-append to keep CI rules last in <head>, so page defaults don't override them.
  document.head.appendChild(styleEl);

  const shellGuardEl = existingGuard ?? document.createElement('style');
  shellGuardEl.id = shellGuardId;
  shellGuardEl.textContent = shellGuardCss;
  document.head.appendChild(shellGuardEl);
};
