import { afterEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { createTodo, sortTodos, validateTodoEdit } from '../src/lib/todos';
import { contrastText, DEFAULT_COLORS, overallStatus, parseColors, todoStatus } from '../src/lib/status';
import { currentTime } from '../src/stores/clock';

const now = new Date(2026, 5, 15, 12, 0).getTime();
const at = (day: number, hour: number) => new Date(2026, 5, day, hour).toISOString();
const item = (title: string, deadline: string | null = null) => ({ ...createTodo(title, at(1, 0)), deadline });
afterEach(() => vi.useRealTimers());

describe('title derivation', () => {
  it.each([
    ['  第一件事。第二件事', '第一件事。'], ['First! Next.', 'First!'],
    ['  第一行\n第二行', '第一行'], ['单句话', '单句话'], ['问什么？然后', '问什么？']
  ])('extracts first sentence from %s', (content, title) => {
    expect(validateTodoEdit({ title: '  ', content, deadline: null }).title).toBe(title);
  });
  it('keeps content intact, prefers explicit titles, and truncates only derived titles', () => {
    const content = '🎉'.repeat(201) + '。下一句';
    expect(validateTodoEdit({ title: '', content, deadline: null })).toMatchObject({ title: '🎉'.repeat(200), content });
    expect(validateTodoEdit({ title: ' custom ', content, deadline: null }).title).toBe('custom');
    expect(() => validateTodoEdit({ title: ' ', content: '\n ', deadline: null })).toThrow('标题必须不为空');
  });
});

describe('deadline urgency', () => {
  it('uses local today, exact time boundaries and excludes completed items', () => {
    expect(todoStatus(item('none'), now)).toBe('unscheduled');
    expect(todoStatus(item('future', at(16, 0)), now)).toBe('normal');
    expect(todoStatus(item('today', at(15, 14)), now)).toBe('today');
    expect(todoStatus(item('exact', new Date(now).toISOString()), now)).toBe('today');
    expect(todoStatus(item('past', new Date(now - 1).toISOString()), now)).toBe('overdue');
    expect(todoStatus({ ...item('done', at(14, 1)), completed: true }, now)).toBe('completed');
    const midnight = new Date(2026, 5, 16, 0).getTime();
    expect(todoStatus(item('tomorrow', at(16, 1)), midnight - 1)).toBe('normal');
    expect(todoStatus(item('tomorrow', at(16, 1)), midnight)).toBe('today');
  });
  it('aggregates overdue > today > normal > unscheduled, excluding completed items', () => {
    expect(overallStatus([item('none')], now)).toBe('unscheduled');
    expect(overallStatus([item('none'), item('future', at(16, 0))], now)).toBe('normal');
    expect(overallStatus([item('future', at(16, 0)), item('none')], now)).toBe('normal');
    expect(overallStatus([item('none'), { ...item('done', at(14, 0)), completed: true }], now)).toBe('unscheduled');
    expect(overallStatus([], now)).toBe('normal');
    expect(overallStatus([{ ...item('done', at(14, 0)), completed: true }], now)).toBe('normal');
    expect(overallStatus([item('today', at(15, 14)), item('none')], now)).toBe('today');
    expect(overallStatus([item('today', at(15, 14)), item('past', at(14, 0))], now)).toBe('overdue');
  });
  it('sorts by state then ascending deadlines then insertion time, preserving ties', () => {
    const overdue1 = item('overdue1', at(13, 0)); const overdue2 = item('overdue2', at(14, 0));
    const today1 = item('today1', at(15, 13)); const today2 = item('today2', at(15, 14));
    const future1 = item('future1', at(16, 0)); const future2 = item('future2', at(17, 0));
    const none1 = item('none1'); const none2 = { ...item('none2'), createdAt: at(2, 0) };
    const done = { ...item('done', at(10, 0)), completed: true };
    const input = [none2, future2, done, today2, overdue2, future1, none1, today1, overdue1];
    expect(sortTodos(input, now).map((todo) => todo.title)).toEqual(['overdue1', 'overdue2', 'today1', 'today2', 'future1', 'future2', 'none1', 'none2', 'done']);
    expect(input[0]).toBe(none2);
    expect(sortTodos([none1, { ...none1, id: 'second' }], now).map((todo) => todo.id)).toEqual([none1.id, 'second']);
  });
  it('ticks without user interaction and refreshes on focus after suspension', () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const values: number[] = [];
    const unsubscribe = currentTime.subscribe((value) => values.push(value));
    vi.advanceTimersByTime(1000);
    expect(get(currentTime)).toBe(now + 1000);
    vi.setSystemTime(now + 86400000);
    window.dispatchEvent(new Event('focus'));
    expect(values.at(-1)).toBe(now + 86400000);
    unsubscribe();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('status colors', () => {
  it('accepts only complete safe hex color configurations', () => {
    expect(parseColors({ normal: '#ABCDEF', today: '#123456', overdue: '#000000' }).normal).toBe('#abcdef');
    for (const invalid of [null, {}, { ...DEFAULT_COLORS, today: 'red' }, { ...DEFAULT_COLORS, normal: 'url(x)' }]) {
      expect(() => parseColors(invalid)).toThrow();
    }
  });
  it('migrates legacy three-color preferences without resetting custom colors', () => {
    expect(parseColors({ normal: '#ABCDEF', today: '#123456', overdue: '#000000' })).toEqual({
      normal: '#abcdef', today: '#123456', overdue: '#000000', unscheduled: '#ffffff'
    });
    expect(parseColors({ ...DEFAULT_COLORS, unscheduled: '#AABBCC' }).unscheduled).toBe('#aabbcc');
    for (const unscheduled of [null, 0, '', 'white', '#fff']) {
      expect(() => parseColors({ ...DEFAULT_COLORS, unscheduled })).toThrow();
    }
  });
  it('reclassifies and reorders after adding or clearing a deadline', () => {
    const none = item('none');
    const timed = item('timed', at(17, 0));
    const updated = { ...none, deadline: at(16, 0) };
    expect(todoStatus(updated, now)).toBe('normal');
    expect(sortTodos([timed, updated], now)).toEqual([updated, timed]);
    const cleared = { ...updated, deadline: null };
    expect(todoStatus(cleared, now)).toBe('unscheduled');
    expect(sortTodos([cleared, timed], now)).toEqual([timed, cleared]);
  });
  it('chooses a readable glyph for yellow or dark backgrounds', () => {
    expect(contrastText('#eab308')).toBe('#111827');
    expect(contrastText('#ffffff')).toBe('#111827');
    expect(contrastText('#000000')).toBe('#ffffff');
  });
});
