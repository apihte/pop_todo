<script lang="ts">
  import { changeLanguage, initializeLanguage, language, languageBusy, languageError, languages, translator } from '../stores/i18n';
  import { onMount, tick } from 'svelte';
  import { invoke, isTauri } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { modalFocus } from '../lib/modal';
  import { DEFAULT_COLORS, STATUS_LABELS, type ActiveStatus } from '../lib/status';
  import { initializeSettings, settingsError, settingsReady, statusColors, updateColors } from '../stores/settings-store';

  export let onCancel: () => void;
  let draft = { ...$statusColors };
  let error = '';
  let saving = false;
  let pinned: boolean | undefined;
  let pinBusy = false;
  const preview = !isTauri();
  const statuses: ActiveStatus[] = ['normal', 'today', 'overdue', 'unscheduled'];

  onMount(() => {
    let disposed = false;
    let cleanup: UnlistenFn | undefined;
    if (!preview) {
      void invoke<boolean>('get_always_on_top').then((value) => pinned = value)
        .catch(() => error = 'error.pinRead');
      void listen<boolean>('window:pin-changed', (event) => pinned = event.payload)
        .then((unlisten) => { if (disposed) unlisten(); else cleanup = unlisten; })
        .catch(() => error = 'error.pinSync');
    }
    return () => { disposed = true; cleanup?.(); };
  });

  async function selectLanguage(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    await changeLanguage(select.value);
    await tick();
    // Explicitly restore the control too if saving failed without changing the store.
    select.value = $language;
  }

  async function togglePin() {
    if (pinBusy) return;
    pinBusy = true;
    try { pinned = await invoke<boolean>('toggle_always_on_top'); }
    catch (cause) {
      error = typeof cause === 'string' && cause.startsWith('error.') ? cause : 'error.pin';
      try { pinned = await invoke<boolean>('get_always_on_top'); }
      catch { pinned = undefined; }
    }
    finally { pinBusy = false; }
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (saving || !$settingsReady) return;
    saving = true; error = '';
    try { await updateColors(draft); onCancel(); }
    catch (cause) { console.error(cause); error = 'error.saveColors'; }
    finally { saving = false; }
  }

  async function retry() {
    await initializeSettings();
    if ($settingsReady) draft = { ...$statusColors };
  }
</script>

<div class="editor-backdrop">
  <div class="todo-editor settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabindex="-1" use:modalFocus={() => { if (!saving && !pinBusy) onCancel(); }}>
    <h2 id="settings-title">{$translator('menu.settings')}</h2>
    <form on:submit={save}>
      <div class="editor-fields">
        <label for="language-select">{$translator('settings.language')}</label>
        <select id="language-select" value={$language} disabled={$languageBusy} on:change={selectLanguage}>
          {#each languages as entry}<option value={entry.code}>{entry.name}</option>{/each}
        </select>
        <p class="field-hint">{$translator('settings.languageHint')}</p>
        {#if $languageError}<p class="validation-error" role="alert">{$translator($languageError)}</p><button type="button" disabled={$languageBusy} on:click={initializeLanguage}>{$translator('settings.retryLanguage')}</button>{/if}
        <h3>{$translator('settings.colors')}</h3>
        <p class="field-hint">{$translator('settings.colorHint')}</p>
        {#each statuses as status}
          <label class="color-setting" for={`color-${status}`}><span>{$translator(STATUS_LABELS[status])}</span>
            <input id={`color-${status}`} type="color" bind:value={draft[status]} disabled={saving || !$settingsReady} />
            <span>{draft[status]}</span>
          </label>
        {/each}
        <button type="button" class="restore-colors" disabled={saving || !$settingsReady} on:click={() => draft = { ...DEFAULT_COLORS }}>{$translator('settings.restoreColors')}</button>
        {#if $settingsError}<p class="validation-error" role="alert">{$translator($settingsError)}</p><button type="button" on:click={retry}>{$translator('common.retryRead')}</button>{/if}
        <h3>{$translator('settings.window')}</h3>
        <label class="pin-setting"><input type="checkbox" checked={pinned ?? false} disabled={preview || pinned === undefined || pinBusy} on:change={togglePin} /> {$translator('settings.pin')}</label>
        {#if preview}<p class="field-hint">{$translator('settings.pinPreview')}</p>{/if}
        {#if error}<p class="validation-error" role="alert">{$translator(error)}</p>{/if}
      </div>
      <footer class="editor-actions"><button type="button" disabled={saving || pinBusy} on:click={onCancel}>{$translator('common.cancel')}</button><button type="submit" class="editor-save" disabled={saving || !$settingsReady}>{$translator(saving ? 'common.saving' : 'common.save')}</button></footer>
    </form>
  </div>
</div>
