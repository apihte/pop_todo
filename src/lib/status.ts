import type { TodoItem } from '../types/todo';
import { localizedError } from '../stores/i18n';

export type ActiveStatus = 'normal' | 'today' | 'overdue' | 'unscheduled';
export type TodoStatus = ActiveStatus | 'completed';
export type StatusColors = Record<ActiveStatus, string>;
export const DEFAULT_COLORS: StatusColors = { normal: '#3b82f6', today: '#eab308', overdue: '#ef4444', unscheduled: '#ffffff' };
export const STATUS_LABELS: Record<TodoStatus, string> = {
  normal: 'status.normal', today: 'status.today', overdue: 'status.overdue', unscheduled: 'status.unscheduled', completed: 'status.completed'
};
const PRIORITY: Record<TodoStatus, number> = { overdue: 0, today: 1, normal: 2, unscheduled: 3, completed: 4 };

export function todoStatus(todo: TodoItem, now = Date.now()): TodoStatus {
  if (todo.completed) return 'completed';
  if (!todo.deadline) return 'unscheduled';
  const deadline = new Date(todo.deadline);
  if (deadline.getTime() < now) return 'overdue';
  const current = new Date(now);
  return deadline.getFullYear() === current.getFullYear() && deadline.getMonth() === current.getMonth() &&
    deadline.getDate() === current.getDate() ? 'today' : 'normal';
}

export function overallStatus(items: TodoItem[], now = Date.now()): ActiveStatus {
  let status: ActiveStatus | undefined;
  for (const todo of items) {
    const next = todoStatus(todo, now);
    if (next === 'completed') continue;
    if (status === undefined || PRIORITY[next] < PRIORITY[status]) status = next;
  }
  // Retain the existing idle appearance when no unfinished items remain.
  return status ?? 'normal';
}

export function compareUrgency(a: TodoItem, b: TodoItem, now: number): number {
  const priority = PRIORITY[todoStatus(a, now)] - PRIORITY[todoStatus(b, now)];
  if (priority) return priority;
  if (a.deadline && b.deadline) {
    const difference = Date.parse(a.deadline) - Date.parse(b.deadline);
    if (difference) return difference;
  } else if (a.deadline || b.deadline) {
    return a.deadline ? -1 : 1;
  }
  // Stable Array.sort preserves insertion order even when creation timestamps tie.
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

export function parseColors(value: unknown): StatusColors {
  if (!value || typeof value !== 'object') throw localizedError('error.colors');
  const colors = value as Record<string, unknown>;
  for (const key of ['normal', 'today', 'overdue'] as const) {
    if (typeof colors[key] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(colors[key])) throw localizedError('error.hexColor');
  }
  // Existing three-color preferences acquire only the new default; preserve custom colors.
  const unscheduled = colors.unscheduled === undefined ? DEFAULT_COLORS.unscheduled : colors.unscheduled;
  if (typeof unscheduled !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(unscheduled)) throw localizedError('error.hexColor');
  return { normal: String(colors.normal).toLowerCase(), today: String(colors.today).toLowerCase(), overdue: String(colors.overdue).toLowerCase(), unscheduled: unscheduled.toLowerCase() };
}

/** Keep white or dark icon glyphs readable for arbitrary user-chosen colors. */
export function contrastText(color: string): string {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? '#111827' : '#ffffff';
}
