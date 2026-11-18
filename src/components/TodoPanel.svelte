<script lang="ts">
  import type { TodoItem } from '../types/todo';
  import TodoItemView from './TodoItem.svelte';
  import AddTodoRow from './AddTodoRow.svelte';
  import { currentTime } from '../stores/clock';
  import { statusColors } from '../stores/settings-store';
  import { iconStatus } from '../stores/todo-store';
  import { translator } from '../stores/i18n';
  import { contrastText } from '../lib/status';

  export let disabled = false;
  export let loading = false;
  export let saving = false;
  export let todos: TodoItem[] = [];
  export let count = 0;
  export let onCollapse: () => void;
  export let onToggle: (id: string) => void;
  export let onRemove: (id: string) => void;
  export let onAdd: () => void;
  export let onSettings: () => void;
  export let onEdit: (todo: TodoItem) => void;
</script>

<section class="panel" aria-label={$translator('todo.list')}>
  <header class="panel-header" data-tauri-drag-region>
    <button style:background={$statusColors[$iconStatus]} style:color={contrastText($statusColors[$iconStatus])} class="panel-logo" aria-label={$translator('icon.collapse')} on:click={onCollapse}>✓</button>
    <div class="panel-title-wrap" data-tauri-drag-region>
      <h1 data-tauri-drag-region>{$translator('todo.heading')}</h1>
      <span data-tauri-drag-region>{$translator('todo.count', { count })}{saving ? $translator('todo.savingSuffix') : ''}</span>
    </div>
    <button class="close-button" aria-label={$translator('menu.settings')} on:click={onSettings}>⚙</button>
    <button class="close-button" aria-label={$translator('icon.collapse')} on:click={onCollapse}>×</button>
  </header>

  <div class="todo-list">
    {#if loading}
      <p class="empty-state" role="status">{$translator('todo.loading')}</p>
    {:else if todos.length === 0}
      <p class="empty-state">{$translator('todo.empty')}</p>
    {:else}
      {#each todos as todo (todo.id)}
        <TodoItemView {todo} {disabled} {onToggle} {onRemove} {onEdit} now={$currentTime} colors={$statusColors} />
      {/each}
    {/if}
  </div>

  <footer class="panel-footer"><AddTodoRow {disabled} {onAdd} /></footer>
</section>
