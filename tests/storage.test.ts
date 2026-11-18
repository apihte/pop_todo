import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => false }));
import { loadTodos, saveTodos } from '../src/services/storage';
import { createTodo } from '../src/lib/todos';

beforeEach(() => localStorage.clear());
describe('preview storage', () => {
  it('starts empty and restores todos including completion state', async () => {
    expect(await loadTodos()).toEqual([]);
    const items = [{ ...createTodo('persisted'), completed: true }];
    await saveTodos(items);
    expect(await loadTodos()).toEqual(items);
  });
  it('upgrades legacy records without losing completion or dates on save', async () => {
    const { content: _content, deadline: _deadline, ...legacy } = createTodo('legacy');
    localStorage.setItem('floating-todo-preview-v1', JSON.stringify({ version: 1, todos: [legacy] }));
    const items = await loadTodos();
    expect(items[0]).toEqual({ ...legacy, content: '', deadline: null });
    items[0].content = 'new content';
    items[0].deadline = '2026-06-15T06:30:00.000Z';
    await saveTodos(items);
    expect(await loadTodos()).toEqual(items);
  });
  it('does not silently replace malformed data', async () => {
    localStorage.setItem('floating-todo-preview-v1', '{broken');
    await expect(loadTodos()).rejects.toThrow();
    expect(localStorage.getItem('floating-todo-preview-v1')).toBe('{broken');
  });
  it('rejects a future storage version', async () => {
    localStorage.setItem('floating-todo-preview-v1', JSON.stringify({ version: 2, todos: [] }));
    await expect(loadTodos()).rejects.toThrow();
  });
});
