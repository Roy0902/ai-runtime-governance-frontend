import { t } from '../i18n';
import { shortMonths } from '../locales/en';

export type DateZone = 'utc' | 'local';

function parsed(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function two(value: number): string {
  return String(value).padStart(2, '0');
}

function parts(date: Date, zone: DateZone) {
  return zone === 'utc'
    ? {
        day: date.getUTCDate(),
        month: date.getUTCMonth(),
        year: date.getUTCFullYear(),
        hours: date.getUTCHours(),
        minutes: date.getUTCMinutes(),
        seconds: date.getUTCSeconds(),
      }
    : {
        day: date.getDate(),
        month: date.getMonth(),
        year: date.getFullYear(),
        hours: date.getHours(),
        minutes: date.getMinutes(),
        seconds: date.getSeconds(),
      };
}

export function formatDate(
  value: string | null,
  fallback = t('common.notReported'),
  zone: DateZone = 'utc',
): string {
  if (value === null) {
    return fallback;
  }
  const date = parsed(value);
  if (!date) {
    return value;
  }
  const { day, month, year } = parts(date, zone);
  return `${two(day)}-${shortMonths[month]}-${year}`;
}

export function formatDateTime(
  value: string | null,
  fallback = t('common.notReported'),
  zone: DateZone = 'utc',
  includeSeconds = true,
): string {
  if (value === null) {
    return fallback;
  }
  const date = parsed(value);
  if (!date) {
    return value;
  }
  const { hours, minutes, seconds } = parts(date, zone);
  const time = includeSeconds
    ? `${two(hours)}:${two(minutes)}:${two(seconds)}`
    : `${two(hours)}:${two(minutes)}`;
  return `${formatDate(value, fallback, zone)} ${time}${zone === 'utc' ? t('common.utcSuffix') : ''}`;
}
