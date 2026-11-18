import { get } from 'svelte/store';
import { activeLanguage, localizedError } from '../stores/i18n';

/** datetime-local uses wall-clock time; persistence always uses UTC. */
export function deadlineToLocal(deadline: string | null): string {
  if (deadline === null) return '';
  const date = new Date(deadline);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function deadlineFromLocal(value: string): string | null {
  if (value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw localizedError('error.deadline');
  const date = new Date(value);
  // Reject calendar rollover and nonexistent local times during DST transitions.
  if (!Number.isFinite(date.getTime()) || deadlineToLocal(date.toISOString()) !== value) {
    throw localizedError('error.localDeadline');
  }
  return date.toISOString();
}

export function formatDeadline(deadline: string, locale = get(activeLanguage).locale): string {
  return new Date(deadline).toLocaleString(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}
