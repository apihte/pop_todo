import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import AddTodoRow from '../src/components/AddTodoRow.svelte';
import FloatingIcon from '../src/components/FloatingIcon.svelte';
import TodoItemView from '../src/components/TodoItem.svelte';
import { createTodo } from '../src/lib/todos';

vi.mock('../src/services/window-service', () => ({ startWindowDrag: vi.fn().mockResolvedValue(undefined) }));
import { startWindowDrag } from '../src/services/window-service';
afterEach(cleanup);

describe('todo components', () => {
  it('requests the shared editor rather than showing an inline title input', async () => {
    const onAdd = vi.fn();
    const view = render(AddTodoRow, { onAdd });
    await userEvent.setup().click(view.getByRole('button', { name: /新增代办/ }));
    expect(onAdd).toHaveBeenCalledOnce();
    expect(onAdd).toHaveBeenCalledWith();
    expect(view.queryByRole('textbox')).toBeNull();
  });
  it('does not allow adding when storage is unavailable', async () => {
    const onAdd = vi.fn();
    const view = render(AddTodoRow, { onAdd, disabled: true });
    await userEvent.setup().click(view.getByRole('button'));
    expect(onAdd).not.toHaveBeenCalled();
  });
  it('exposes accessible complete and remove controls', async () => {
    const todo = createTodo('测试事件');
    const onToggle = vi.fn();
    const onRemove = vi.fn();
    const onEdit = vi.fn();
    const view = render(TodoItemView, { todo, onToggle, onRemove, onEdit });
    await fireEvent.click(view.getByRole('checkbox'));
    await fireEvent.click(view.getByRole('button', { name: /移除/ }));
    expect(onToggle).toHaveBeenCalledWith(todo.id);
    expect(onRemove).toHaveBeenCalledWith(todo.id);
    expect(onEdit).not.toHaveBeenCalled();
    await fireEvent.click(view.getByRole('button', { name: /编辑/ }));
    expect(onEdit).toHaveBeenCalledWith(todo);
  });
  it('distinguishes an icon drag from a click', async () => {
    const onExpand = vi.fn();
    const view = render(FloatingIcon, { count: 0, onExpand, onError: vi.fn() });
    const button = view.getByRole('button');
    await fireEvent.pointerDown(button, { button: 0, clientX: 10, clientY: 10 });
    await fireEvent.pointerMove(button, { buttons: 1, clientX: 30, clientY: 30 });
    await fireEvent.click(button);
    expect(startWindowDrag).toHaveBeenCalledOnce();
    expect(onExpand).not.toHaveBeenCalled();
  });
  it('shows unfinished badges and opens the panel', async () => {
    const onExpand = vi.fn();
    const view = render(FloatingIcon, { count: 100, onExpand, onError: vi.fn() });
    expect(view.getByText('99+')).toBeTruthy();
    await fireEvent.click(view.getByRole('button'));
    expect(onExpand).toHaveBeenCalledOnce();
  });
});
