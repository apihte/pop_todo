<script lang="ts">
  import { translator } from '../stores/i18n';
  export let onAdd: () => void;
  export let disabled = false;
</script>

<button class="add-row" {disabled} on:click={() => onAdd()}><span class="plus">＋</span><span>{$translator('todo.add')}</span></button>
