<script lang="ts">
  import type { TodoItem } from '../types/todo';
  import { translator, activeLanguage } from '../stores/i18n';
  import { formatDeadline } from '../lib/deadline';
  import { DEFAULT_COLORS, STATUS_LABELS, todoStatus, type StatusColors } from '../lib/status';

  export let todo: TodoItem;
  export let disabled = false;
  export let now = Date.now();
  export let colors: StatusColors = DEFAULT_COLORS;
  $: status = todoStatus(todo, now);
  $: color = status === 'completed' ? '#94a3b8' : colors[status];
  export let onToggle: (id: string) => void;
  export let onRemove: (id: string) => void;
  export let onEdit: (todo: TodoItem) => void;
</script>

<div class:completed={todo.completed} class="todo-item" data-status={status} style:--status-color={color} style:background={`${color}12`}>
  <label class="todo-check">
    <input
      type="checkbox"
      {disabled}
      checked={todo.completed}
      aria-label={$translator(todo.completed ? 'todo.uncompleteItem' : 'todo.completeItem', { title: todo.title })}
      on:change={() => onToggle(todo.id)}
    />
    <span class="custom-check" aria-hidden="true">✓</span>
  </label>
  <button class="todo-edit-button" {disabled} aria-label={$translator('todo.editItem', { title: todo.title })} on:click={() => onEdit(todo)}>
    <span class="todo-title" title={todo.title}>{todo.title}</span>
    <span class="todo-status">{$translator(STATUS_LABELS[status])}</span>
    {#if todo.deadline}<span class="todo-deadline">{$translator('todo.due', { date: formatDeadline(todo.deadline, $activeLanguage.locale) })}</span>{/if}
  </button>
  <button {disabled} class="remove-button" aria-label={$translator('todo.removeItem', { title: todo.title })} on:click={() => onRemove(todo.id)}>×</button>
</div>
