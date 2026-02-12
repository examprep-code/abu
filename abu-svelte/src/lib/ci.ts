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
  if (!existing) {
    document.head.appendChild(styleEl);
  }
};
