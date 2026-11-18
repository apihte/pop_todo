import type { TodoEdit, TodoItem } from '../types/todo';
import { compareUrgency } from './status';
import { localizedError } from '../stores/i18n';

export function validateTitle(value: string): string {
  const title = value.trim();
  if (!title) throw localizedError('error.titleRequired');
  if ([...title].length > 200) throw localizedError('error.titleLength');
  return title;
}

export function validateTodoEdit(value: TodoEdit): TodoEdit {
  if (typeof value.content !== 'string' || [...value.content].length > 10000) {
    throw localizedError('error.contentLength');
  }
  if (value.deadline !== null && (typeof value.deadline !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value.deadline) || !Number.isFinite(Date.parse(value.deadline)))) {
    throw localizedError('error.deadline');
  }
  const deadline = value.deadline === null ? null : new Date(value.deadline).toISOString();
  if (value.deadline !== null) {
    const fraction = value.deadline.slice(19, -1).replace('.', '').padEnd(3, '0');
    if (deadline !== `${value.deadline.slice(0, 19)}.${fraction}Z`) throw localizedError('error.deadline');
  }
  const firstSentence = value.content.trim().match(/^[^。！？.!?\r\n]*[。！？.!?]?/u)?.[0]?.trim() ?? '';
  const title = value.title.trim() || [...firstSentence].slice(0, 200).join('');
  return { title: validateTitle(title), content: value.content, deadline };
}

export function createTodo(value: string | TodoEdit, timestamp = new Date().toISOString()): TodoItem {
  const fields = validateTodoEdit(typeof value === 'string' ? { title: value, content: '', deadline: null } : value);
  return { id: crypto.randomUUID(), ...fields, completed: false, createdAt: timestamp, updatedAt: timestamp };
}

export function countUnfinished(items: TodoItem[]): number {
  return items.filter((item) => !item.completed).length;
}

export function sortTodos(items: TodoItem[], now = Date.now()): TodoItem[] {
  return [...items].sort((a, b) => compareUrgency(a, b, now));
}

export function badgeText(count: number): string {
  return count > 99 ? '99+' : count > 0 ? String(count) : '';
}

export function parseTodos(value: unknown): TodoItem[] {
  if (!Array.isArray(value)) throw localizedError('error.todoData');
  const ids = new Set<string>();
  return value.map((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) throw localizedError('error.todoRecord');
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.title !== 'string' ||
      typeof item.completed !== 'boolean' || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) ||
      typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt))) {
      throw localizedError('error.todoRecord');
    }
    ids.add(item.id);
    // Optional additive fields keep existing version-1 documents compatible.
    const fields = validateTodoEdit({ title: item.title,
      content: (item.content === undefined ? '' : item.content) as string,
      deadline: (item.deadline === undefined ? null : item.deadline) as string | null });
    return { id: item.id, ...fields, completed: item.completed, createdAt: item.createdAt, updatedAt: item.updatedAt };
  });
}
