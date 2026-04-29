export const applySchoolCiCss = (css?: string | null) => {
  if (typeof document === 'undefined') return;
  const id = 'school-ci-css';
  const existing = document.getElementById(id);
  const next = (css ?? '').trim();
  if (!next) {
    if (existing) existing.remove();
    return;
  }
  const styleEl = existing ?? document.createElement('style');
  styleEl.id = id;
  styleEl.textContent = next;
  // Re-append to keep CI rules last in <head>, so page defaults don't override them.
  document.head.appendChild(styleEl);
};
