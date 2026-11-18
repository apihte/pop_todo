import { writable, derived, get } from 'svelte/store';
import type { TodoEdit, TodoItem } from '../types/todo';
import { loadTodos, saveTodos } from '../services/storage';
import { countUnfinished, createTodo, sortTodos, validateTodoEdit } from '../lib/todos';
import { currentTime } from './clock';
import { overallStatus } from '../lib/status';
import { localizedError } from './i18n';

export const todos = writable<TodoItem[]>([]);
export const isLoading = writable(true);
export const isSaving = writable(false);
export const storageReady = writable(false);
export const errorMessage = writable<string | null>(null);
export const unfinishedCount = derived(todos, countUnfinished);
export const sortedTodos = derived([todos, currentTime], ([$todos, $time]) => sortTodos($todos, $time));
export const iconStatus = derived([todos, currentTime], ([$todos, $time]) => overallStatus($todos, $time));
export const dirty = writable(false);
let writeQueue = Promise.resolve();
let revision = 0;

export async function initialize(): Promise<void> {
  isLoading.set(true);
  storageReady.set(false);
  try {
    todos.set(await loadTodos());
    storageReady.set(true);
    errorMessage.set(null);
    dirty.set(false);
  } catch (error) {
    console.error(error);
    errorMessage.set('error.readTodos');
  } finally {
    isLoading.set(false);
  }
}

function persist(): Promise<void> {
  const snapshot = get(todos).map((item) => ({ ...item }));
  const savedRevision = revision;
  isSaving.set(true);
  // Serialize writes so an earlier snapshot can never overwrite a later change.
  writeQueue = writeQueue.then(async () => {
    try {
      await saveTodos(snapshot);
      if (savedRevision === revision) {
        dirty.set(false);
        errorMessage.set(null);
      }
    } catch (error) {
      console.error(error);
      dirty.set(true);
      errorMessage.set('error.saveTodos');
    } finally {
      if (savedRevision === revision) isSaving.set(false);
    }
  });
  return writeQueue;
}

function mutate(next: TodoItem[]): Promise<void> {
  if (!get(storageReady)) return Promise.resolve();
  todos.set(next);
  revision += 1;
  dirty.set(true);
  return persist();
}

export async function addTodo(fields: string | TodoEdit, draftId?: string): Promise<void> {
  if (!get(storageReady)) {
    if (draftId) throw localizedError('error.addNotReady');
    return;
  }
  const item = createTodo(fields);
  if (draftId) {
    // A failed save retains the item in memory; retry the same draft rather than duplicating it.
    if (get(todos).some((todo) => todo.id === draftId)) {
      await updateTodo(draftId, item);
      return;
    }
    item.id = draftId;
  }
  await mutate([...get(todos), item]);
  if (draftId && get(errorMessage)) throw localizedError(get(errorMessage)!);
}

export async function updateTodo(id: string, edit: TodoEdit): Promise<void> {
  if (!get(storageReady)) throw localizedError('error.editNotReady');
  if (!get(todos).some((todo) => todo.id === id)) throw localizedError('error.todoMissing');
  const fields = validateTodoEdit(edit);
  await mutate(get(todos).map((todo) => todo.id === id
    ? { ...todo, ...fields, updatedAt: new Date().toISOString() } : todo));
  // Keep the editor draft open if persistence failed; the global retry path remains available.
  if (get(errorMessage)) throw localizedError(get(errorMessage)!);
}

export async function toggleTodo(id: string): Promise<void> {
  await mutate(get(todos).map((todo) => todo.id === id
    ? { ...todo, completed: !todo.completed, updatedAt: new Date().toISOString() }
    : todo));
}

export async function removeTodo(id: string): Promise<void> {
  await mutate(get(todos).filter((todo) => todo.id !== id));
}

export async function retryStorage(): Promise<void> {
  if (!get(storageReady)) await initialize();
  else { revision += 1; await persist(); }
}
