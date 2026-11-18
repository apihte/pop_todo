import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createTodo, parseTodos, validateTodoEdit } from '../src/lib/todos';
import { deadlineFromLocal, deadlineToLocal } from '../src/lib/deadline';
import TodoEditor from '../src/components/TodoEditor.svelte';

afterEach(cleanup);
describe('editable todo fields', () => {
  it('upgrades old records with empty content and no deadline', () => {
    const { content: _content, deadline: _deadline, ...legacy } = createTodo('legacy');
    expect(parseTodos([legacy])[0]).toMatchObject({ ...legacy, content: '', deadline: null });
  });
  it('validates edits without rejecting past deadlines', () => {
    expect(validateTodoEdit({ title: ' new ', content: '多行\n内容', deadline: '2020-01-01T00:00:00.000Z' }))
      .toEqual({ title: 'new', content: '多行\n内容', deadline: '2020-01-01T00:00:00.000Z' });
    expect(() => validateTodoEdit({ title: ' ', content: '', deadline: null })).toThrow();
    expect(() => validateTodoEdit({ title: 'x', content: 'a'.repeat(10001), deadline: null })).toThrow('10000');
    expect(() => validateTodoEdit({ title: 'x', content: '', deadline: 'invalid' })).toThrow('截止时间');
    expect(() => validateTodoEdit({ title: 'x', content: '', deadline: '2026-02-30T12:00:00.000Z' })).toThrow('截止时间');
  });
  it('rejects corrupt new fields while accepting omitted legacy fields', () => {
    for (const fields of [{ content: 3 }, { deadline: 'tomorrow' }, { deadline: 0 }]) {
      expect(() => parseTodos([{ ...createTodo('bad'), ...fields }])).toThrow();
    }
  });
  it('round-trips local date/time and permits clearing', () => {
    const local = '2026-06-15T14:30';
    expect(deadlineToLocal(deadlineFromLocal(local))).toBe(local);
    expect(deadlineFromLocal('')).toBe(null);
    expect(deadlineToLocal(null)).toBe('');
    expect(() => deadlineFromLocal('2026-02-30T12:00')).toThrow();
    expect(() => deadlineFromLocal('not a date')).toThrow();
  });
});

describe('todo edit dialog', () => {
  it('prefills fields and saves an isolated draft', async () => {
    const todo = { ...createTodo('original'), content: 'details', deadline: deadlineFromLocal('2026-06-15T14:30') };
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const view = render(TodoEditor, { todo, onSave, onCancel: vi.fn() });
    expect(view.getByRole('dialog', { name: '编辑代办' })).toBeTruthy();
    expect((view.getByLabelText('截止时间（选填）') as HTMLInputElement).value).toBe('2026-06-15T14:30');
    await user.clear(view.getByLabelText('标题'));
    await user.type(view.getByLabelText('标题'), 'edited');
    await user.type(view.getByLabelText('具体内容（选填）'), '{Enter}more');
    expect(todo.title).toBe('original');
    await user.click(view.getByRole('button', { name: '保存' }));
    expect(onSave).toHaveBeenCalledWith(todo.id, expect.objectContaining({ title: 'edited', content: 'details\nmore', deadline: todo.deadline }));
  });
  it('cancels with Escape without bubbling or saving, and restores focus', async () => {
    const button = document.createElement('button');
    document.body.append(button); button.focus();
    const onSave = vi.fn(); const onCancel = vi.fn();
    const view = render(TodoEditor, { todo: createTodo('cancel'), onSave, onCancel });
    const bubble = vi.fn(); window.addEventListener('keydown', bubble);
    await fireEvent.keyDown(view.getByLabelText('标题'), { key: 'Escape' });
    window.removeEventListener('keydown', bubble);
    expect(onCancel).toHaveBeenCalledOnce(); expect(onSave).not.toHaveBeenCalled(); expect(bubble).not.toHaveBeenCalled();
    view.unmount(); expect(document.activeElement).toBe(button); button.remove();
  });
  it('keeps the dialog open on validation or save failure', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('不能保存'));
    const user = userEvent.setup();
    const view = render(TodoEditor, { todo: createTodo('test'), onSave, onCancel: vi.fn() });
    await user.clear(view.getByLabelText('标题'));
    await user.click(view.getByRole('button', { name: '保存' }));
    expect(onSave).not.toHaveBeenCalled(); expect(view.getByRole('alert')).toBeTruthy();
    await user.type(view.getByLabelText('标题'), 'valid');
    await user.click(view.getByRole('button', { name: '保存' }));
    expect(view.getByRole('alert').textContent).toContain('保存失败，请重试');
  });
  it('preserves stored seconds when the deadline field is unchanged', async () => {
    const todo = { ...createTodo('seconds'), deadline: '2026-06-15T06:30:45.123Z' };
    const onSave = vi.fn().mockResolvedValue(undefined);
    const view = render(TodoEditor, { todo, onSave, onCancel: vi.fn() });
    await userEvent.setup().click(view.getByRole('button', { name: '保存' }));
    expect(onSave).toHaveBeenCalledWith(todo.id, expect.objectContaining({ deadline: todo.deadline }));
  });
  it('derives a title when creating with only content and rejects wholly empty drafts', async () => {
    const todo = { ...createTodo('draft'), title: '' };
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const view = render(TodoEditor, { todo, isNew: true, onSave, onCancel: vi.fn() });
    expect(view.getByRole('dialog', { name: '新增代办' })).toBeTruthy();
    await user.click(view.getByRole('button', { name: '保存' }));
    expect(view.getByRole('alert').textContent).toBe('标题必须不为空');
    expect(onSave).not.toHaveBeenCalled();
    await user.type(view.getByLabelText('具体内容（选填）'), '内容第一句。下一句');
    await user.click(view.getByRole('button', { name: '保存' }));
    expect(onSave).toHaveBeenCalledWith(todo.id, { title: '内容第一句。', content: '内容第一句。下一句', deadline: null });
  });
  it('does not submit when Enter confirms an IME composition', async () => {
    const onSave = vi.fn();
    const view = render(TodoEditor, { todo: createTodo('中文'), onSave, onCancel: vi.fn() });
    const input = view.getByLabelText('标题');
    await fireEvent.compositionStart(input);
    await fireEvent.submit(view.container.querySelector('form')!);
    expect(onSave).not.toHaveBeenCalled();
    await fireEvent.compositionEnd(input);
    await fireEvent.submit(view.container.querySelector('form')!);
    expect(onSave).toHaveBeenCalledOnce();
  });
  it('clears a deadline and traps keyboard focus within the dialog', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const view = render(TodoEditor, { todo: { ...createTodo('clear'), deadline: deadlineFromLocal('2026-06-15T14:30') }, onSave, onCancel: vi.fn() });
    const user = userEvent.setup();
    await user.click(view.getByRole('button', { name: '清除截止时间' }));
    const save = view.getByRole('button', { name: '保存' });
    save.focus(); await user.tab(); expect(document.activeElement).toBe(view.getByLabelText('标题'));
    await user.click(save);
    expect(onSave).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ deadline: null }));
  });
});
