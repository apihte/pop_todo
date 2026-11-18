import { invoke, isTauri } from '@tauri-apps/api/core';
import { load, type Store } from '@tauri-apps/plugin-store';
import { parseTodos } from '../lib/todos';
import { localizedError } from '../stores/i18n';
import type { TodoItem } from '../types/todo';

// A browser preview is intentionally separate from the real desktop data.
const PREVIEW_KEY = 'floating-todo-preview-v1';
let storePromise: Promise<Store> | undefined;
export interface TodoStorage { version: 1; todos: TodoItem[] }

async function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load('todos.json', { autoSave: false, defaults: {} }).catch((error: unknown) => {
      storePromise = undefined;
      throw error;
    });
  }
  return storePromise;
}

export async function loadTodos(): Promise<TodoItem[]> {
  let value: unknown;
  if (isTauri()) {
    // Store.load can ignore JSON errors, and registered stores may save at exit.
    // Read and validate without registering the file; only open Store after a successful read.
    const document = await invoke<unknown>('read_todo_document');
    if (document === null) return [];
    if (typeof document !== 'object' || !('version' in document) || document.version !== 1 || !('todos' in document)) {
      throw localizedError('error.todoVersion');
    }
    value = document.todos;
  } else {
    const raw = localStorage.getItem(PREVIEW_KEY);
    if (raw === null) return [];
    const document: unknown = JSON.parse(raw);
    if (typeof document !== 'object' || document === null || !('version' in document) || document.version !== 1 || !('todos' in document)) {
      throw localizedError('error.previewData');
    }
    value = document.todos;
  }
  return value === undefined ? [] : parseTodos(value);
}

export async function saveTodos(todos: TodoItem[]): Promise<void> {
  const document: TodoStorage = { version: 1, todos };
  if (!isTauri()) {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(document));
    return;
  }
  const store = await getStore();
  await store.set('version', document.version);
  await store.set('todos', document.todos);
  await store.save();
}
