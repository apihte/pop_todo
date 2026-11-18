<script lang="ts">
  import type { TodoEdit, TodoItem } from '../types/todo';
  import { validateTodoEdit } from '../lib/todos';
  import { deadlineFromLocal, deadlineToLocal } from '../lib/deadline';
  import { modalFocus } from '../lib/modal';
  import { errorKey, translator } from '../stores/i18n';

  export let todo: TodoItem;
  export let isNew = false;
  export let onSave: (id: string, edit: TodoEdit) => Promise<void>;
  export let onCancel: () => void;

  let title = todo.title;
  let content = todo.content;
  const initialDeadline = deadlineToLocal(todo.deadline);
  let deadline = initialDeadline;
  let error = '';
  let saving = false;
  let composing = false;

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (saving || composing) return;
    try {
      const fields = validateTodoEdit({ title, content,
        deadline: deadline === initialDeadline ? todo.deadline : deadlineFromLocal(deadline) });
      saving = true;
      error = '';
      await onSave(todo.id, fields);
    } catch (cause) {
      error = errorKey(cause);
    } finally { saving = false; }
  }
</script>

<div class="editor-backdrop">
  <div class="todo-editor" role="dialog" aria-modal="true" aria-labelledby="todo-editor-title" tabindex="-1" use:modalFocus={() => { if (!saving) onCancel(); }}>
    <h2 id="todo-editor-title">{$translator(isNew ? 'todo.add' : 'todo.edit')}</h2>
    <form on:submit={save} on:compositionstart={() => composing = true} on:compositionend={() => composing = false}>
      <div class="editor-fields">
        <label for="edit-title">{$translator('todo.title')}</label>
        <input id="edit-title" bind:value={title} maxlength="400" disabled={saving} placeholder={$translator('todo.titlePlaceholder')} aria-describedby={error ? 'editor-error' : 'title-hint'} />
        <span id="title-hint" class="field-hint">{$translator('todo.titleHint')}</span>
        <label for="edit-content">{$translator('todo.content')}</label>
        <textarea id="edit-content" bind:value={content} rows="4" maxlength="20000" disabled={saving} placeholder={$translator('todo.contentPlaceholder')}></textarea>
        <label for="edit-deadline">{$translator('todo.deadline')}</label>
        <input id="edit-deadline" type="datetime-local" bind:value={deadline} disabled={saving} />
        <div class="deadline-hint"><span>{$translator('todo.timezoneHint')}</span><button type="button" disabled={saving || !deadline} on:click={() => deadline = ''}>{$translator('todo.clearDeadline')}</button></div>
        {#if error}<p id="editor-error" class="validation-error" role="alert">{$translator(error)}</p>{/if}
      </div>
      <footer class="editor-actions">
        <button type="button" disabled={saving} on:click={onCancel}>{$translator('common.cancel')}</button>
        <button class="editor-save" type="submit" disabled={saving}>{$translator(saving ? 'common.saving' : 'common.save')}</button>
      </footer>
    </form>
  </div>
</div>
