const SWISS_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('de-CH', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Europe/Zurich'
});

const SWISS_TIME_FORMATTER = new Intl.DateTimeFormat('de-CH', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Europe/Zurich'
});

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const RECENT_DATE_THRESHOLD_DAYS = 30;

const parseDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatSwissDateTime = (value: unknown, fallback = ''): string => {
  const date = parseDate(value);
  if (!date) return fallback || String(value ?? '');

  const parts = SWISS_DATE_TIME_FORMATTER.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? '';

  return `${part('day')}. ${part('month')} ${part('year')} ${part('hour')}:${part('minute')}`;
};

export const formatSwissRecentDateTime = (value: unknown, fallback = ''): string => {
  const date = parseDate(value);
  if (!date) return fallback || String(value ?? '');

  const diffMs = Date.now() - date.getTime();
  if (diffMs >= 0 && diffMs < RECENT_DATE_THRESHOLD_DAYS * DAY_IN_MS) {
    const days = Math.floor(diffMs / DAY_IN_MS);
    if (days === 0) return 'heute';
    if (days === 1) return 'vor 1 Tag';
    return `vor ${days} Tagen`;
  }

  return formatSwissDateTime(date, fallback);
};

export const formatSwissTime = (value: unknown, fallback = ''): string => {
  const date = parseDate(value);
  if (!date) return fallback || String(value ?? '');
  return SWISS_TIME_FORMATTER.format(date);
};
