import { beforeEach, describe, expect, it, vi } from 'vitest';
const { invoke, load, set, save, get } = vi.hoisted(() => ({
  invoke: vi.fn(), load: vi.fn(), set: vi.fn(), save: vi.fn(), get: vi.fn()
}));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke }));
vi.mock('@tauri-apps/plugin-store', () => ({ load }));
import { loadTodos, saveTodos } from '../src/services/storage';
import { createTodo } from '../src/lib/todos';

beforeEach(() => {
  vi.clearAllMocks();
  load.mockResolvedValue({ set, save, get });
});

describe('desktop storage corruption guard', () => {
  it('returns empty only when the Rust reader reports a missing file', async () => {
    invoke.mockResolvedValueOnce(null);
    expect(await loadTodos()).toEqual([]);
    expect(invoke).toHaveBeenCalledWith('read_todo_document');
    expect(load).not.toHaveBeenCalled();
  });
  it('does not register a corrupt file in Store, even on parser failure', async () => {
    invoke.mockRejectedValueOnce(new Error('invalid json'));
    await expect(loadTodos()).rejects.toThrow('invalid json');
    invoke.mockResolvedValueOnce({ version: 1, todos: [{}] });
    await expect(loadTodos()).rejects.toThrow();
    expect(load).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
  it('rejects unknown versions without allowing exit-time overwrite', async () => {
    invoke.mockResolvedValueOnce({ version: 2, todos: [] });
    await expect(loadTodos()).rejects.toThrow();
    expect(load).not.toHaveBeenCalled();
  });
  it('reads validated todos and uses Store only for explicitly requested writes', async () => {
    const items = [createTodo('desktop')];
    invoke.mockResolvedValueOnce({ version: 1, todos: items });
    expect(await loadTodos()).toEqual(items);
    expect(load).not.toHaveBeenCalled();
    await saveTodos(items);
    expect(load).toHaveBeenCalledWith('todos.json', { autoSave: false, defaults: {} });
    expect(set).toHaveBeenCalledWith('version', 1);
    expect(set).toHaveBeenCalledWith('todos', items);
    expect(save).toHaveBeenCalledOnce();
  });
});
