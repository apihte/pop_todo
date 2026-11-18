import { describe, expect, it } from 'vitest';
import { badgeText, countUnfinished, createTodo, parseTodos, sortTodos, validateTitle } from '../src/lib/todos';

describe('todo domain', () => {
  it('trims titles and generates unique identities', () => {
    const first = createTodo('  买牛奶  ');
    expect(first.title).toBe('买牛奶');
    expect(first.completed).toBe(false);
    expect(first.id).not.toBe(createTodo('买牛奶').id);
  });
  it('rejects empty and long titles, counts Unicode characters', () => {
    expect(() => validateTitle('  ')).toThrow('标题必须不为空');
    expect(() => validateTitle('a'.repeat(201))).toThrow('200');
    expect(validateTitle('🎉'.repeat(200))).toHaveLength(400);
  });
  it('counts unfinished and caps badge display', () => {
    expect(countUnfinished([createTodo('A'), { ...createTodo('B'), completed: true }])).toBe(1);
    expect(badgeText(0)).toBe('');
    expect(badgeText(3)).toBe('3');
    expect(badgeText(99)).toBe('99');
    expect(badgeText(100)).toBe('99+');
  });
  it('sorts unfinished first then creation time without mutating input', () => {
    const older = createTodo('old', '2026-01-01T00:00:00.000Z');
    const newer = createTodo('new', '2026-01-02T00:00:00.000Z');
    const done = { ...older, id: 'done', completed: true };
    const items = [done, newer, older];
    expect(sortTodos(items)).toEqual([older, newer, done]);
    expect(items[0]).toBe(done);
  });
  it('validates persisted records and rejects corrupted or duplicate data', () => {
    const item = createTodo('valid');
    expect(parseTodos([item])).toEqual([item]);
    for (const invalid of [null, {}, [null], [{ ...item, completed: 'false' }], [{ ...item, createdAt: 'invalid' }], [item, item]]) {
      expect(() => parseTodos(invalid)).toThrow();
    }
  });
});
