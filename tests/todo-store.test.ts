import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
vi.mock('../src/services/storage', () => ({ loadTodos: vi.fn(), saveTodos: vi.fn() }));
import { loadTodos, saveTodos } from '../src/services/storage';
import { addTodo, dirty, errorMessage, initialize, removeTodo, retryStorage, storageReady, todos, toggleTodo, unfinishedCount, updateTodo } from '../src/stores/todo-store';

beforeEach(async () => {
  vi.mocked(loadTodos).mockResolvedValue([]);
  vi.mocked(saveTodos).mockResolvedValue(undefined);
  await initialize();
});

describe('todo store persistence', () => {
  it('creates, completes, uncompletes and removes todos', async () => {
    await addTodo('first');
    const id = get(todos)[0].id;
    expect(get(unfinishedCount)).toBe(1);
    await toggleTodo(id);
    expect(get(unfinishedCount)).toBe(0);
    await toggleTodo(id);
    expect(get(unfinishedCount)).toBe(1);
    await removeTodo(id);
    expect(get(todos)).toEqual([]);
    expect(get(dirty)).toBe(false);
  });
  it('keeps failed writes in memory and supports explicit retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(saveTodos).mockRejectedValueOnce(new Error('disk full'));
    await addTodo('keep me');
    expect(get(todos)[0].title).toBe('keep me');
    expect(get(dirty)).toBe(true);
    expect(get(errorMessage)).toBe('error.saveTodos');
    await retryStorage();
    expect(get(dirty)).toBe(false);
    expect(get(errorMessage)).toBe(null);
    vi.restoreAllMocks();
  });
  it('disables mutation after a read failure and preserves the source', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(loadTodos).mockRejectedValueOnce(new Error('corrupt'));
    await initialize();
    expect(get(storageReady)).toBe(false);
    await addTodo('do not write');
    expect(get(todos)).toEqual([]);
    await retryStorage();
    expect(get(storageReady)).toBe(true);
    vi.restoreAllMocks();
  });
  it('edits fields without changing identity, completion, creation time or badge count', async () => {
    await addTodo('before');
    const original = get(todos)[0];
    await toggleTodo(original.id);
    const edit = { title: 'after', content: 'details\nsecond line', deadline: '2026-06-15T06:30:00.000Z' };
    await updateTodo(original.id, edit);
    expect(get(todos)[0]).toMatchObject({ ...edit, id: original.id, createdAt: original.createdAt, completed: true });
    expect(get(unfinishedCount)).toBe(0);
    expect(saveTodos).toHaveBeenLastCalledWith(get(todos));
    await updateTodo(original.id, { ...edit, content: '', deadline: null });
    expect(get(todos)[0].deadline).toBe(null);
  });
  it('rejects invalid edits or missing ids without writing', async () => {
    await addTodo('original');
    vi.mocked(saveTodos).mockClear();
    const edit = { title: '', content: '', deadline: null };
    await expect(updateTodo(get(todos)[0].id, edit)).rejects.toThrow();
    await expect(updateTodo('missing', { ...edit, title: 'ok' })).rejects.toThrow('不存在');
    expect(saveTodos).not.toHaveBeenCalled();
    expect(get(todos)[0].title).toBe('original');
  });
  it('keeps edited fields in memory after save failure and retries them', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await addTodo('original');
    const id = get(todos)[0].id;
    vi.mocked(saveTodos).mockRejectedValueOnce(new Error('disk full'));
    const fields = { title: 'edited', content: 'keep details', deadline: null };
    await expect(updateTodo(id, fields)).rejects.toThrow('保存失败');
    expect(get(todos)[0]).toMatchObject(fields);
    expect(get(dirty)).toBe(true);
    await retryStorage();
    expect(get(dirty)).toBe(false);
    expect(saveTodos).toHaveBeenLastCalledWith([expect.objectContaining(fields)]);
    vi.restoreAllMocks();
  });
  it('retries a failed new draft using its identity without creating duplicates', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fields = { title: '', content: '自动标题。更多内容', deadline: null };
    vi.mocked(saveTodos).mockRejectedValueOnce(new Error('disk full'));
    await expect(addTodo(fields, 'draft-id')).rejects.toThrow('保存失败');
    expect(get(todos)).toHaveLength(1);
    expect(get(todos)[0]).toMatchObject({ id: 'draft-id', title: '自动标题。', content: fields.content });
    await addTodo(fields, 'draft-id');
    expect(get(todos)).toHaveLength(1);
    expect(get(dirty)).toBe(false);
    vi.restoreAllMocks();
  });
  it('serializes rapid edits so old snapshots cannot overwrite new data', async () => {
    const saved: number[] = [];
    vi.mocked(saveTodos).mockImplementation(async (items) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      saved.push(items.length);
    });
    await Promise.all([addTodo('A'), addTodo('B'), addTodo('C')]);
    expect(saved).toEqual([1, 2, 3]);
    expect(get(dirty)).toBe(false);
  });
});
