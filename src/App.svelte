<script lang="ts">
  import { initializeLanguage, languageError, translator } from './stores/i18n';
  import { onMount } from 'svelte';
  import { invoke, isTauri } from '@tauri-apps/api/core';
  import { Menu, type CheckMenuItem } from '@tauri-apps/api/menu';
  import { createPinMenuItem, refreshPinMenuItem } from './services/pin-service';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import FloatingIcon from './components/FloatingIcon.svelte';
  import TodoPanel from './components/TodoPanel.svelte';
  import TodoEditor from './components/TodoEditor.svelte';
  import SettingsPanel from './components/SettingsPanel.svelte';
  import { initializeSettings, settingsError, statusColors } from './stores/settings-store';
  import { addTodo, dirty, errorMessage, initialize, isLoading, isSaving, removeTodo, retryStorage, sortedTodos, storageReady, toggleTodo, unfinishedCount, updateTodo, iconStatus } from './stores/todo-store';
  import { initializeWindow, resizeWindow } from './services/window-service';
  import type { TodoEdit, TodoItem, ViewMode } from './types/todo';

  let viewMode: ViewMode = 'collapsed';
  let switching = false;
  let windowError: string | null = null;
  let confirmQuit = false;
  let editingTodo: TodoItem | null = null;
  let adding = false;
  let showSettings = false;
  $: modalOpen = editingTodo !== null || showSettings;
  let contextMenuResource: Menu | undefined;
  let pinMenuItem: CheckMenuItem | undefined;
  const preview = !isTauri();

  onMount(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    let quitListener: UnlistenFn | undefined;
    const pinListeners: UnlistenFn[] = [];
    if (!preview) {
      void listen('app:quit-request', () => { void quit(); })
        .then((unlisten) => { if (disposed) unlisten(); else quitListener = unlisten; })
        .catch(() => windowError = 'error.quitMenu');
    }
    if (!preview) {
      for (const [name, callback] of [
        ['window:pin-changed', () => {
          if (pinMenuItem) void refreshPinMenuItem(pinMenuItem).catch(() => windowError = 'error.pinMenuSync');
        }],
        ['window:pin-error', (event: { payload: string }) => windowError = event.payload]
      ] as const) {
        void listen<string>(name, callback)
          .then((unlisten) => { if (disposed) unlisten(); else pinListeners.push(unlisten); })
          .catch(() => windowError = 'error.pinListener');
      }
    }
    if (!preview) {
      void listen('settings:open', () => { void openSettings(); })
        .then((unlisten) => { if (disposed) unlisten(); else pinListeners.push(unlisten); })
        .catch(() => windowError = 'error.settingsMenu');
    }
    void initializeLanguage();
    void initializeSettings();
    void initialize();
    void initializeWindow((message) => windowError = message)
      .then((unlisten) => { if (disposed) unlisten(); else cleanup = unlisten; })
      .catch((error: unknown) => { console.error(error); windowError = 'error.windowInit'; });
    return () => {
      disposed = true; cleanup?.(); quitListener?.(); pinListeners.forEach((unlisten) => unlisten());
      void contextMenuResource?.close(); void pinMenuItem?.close();
    };
  });

  async function setMode(next: ViewMode) {
    if (switching || (modalOpen && next === 'collapsed')) return;
    switching = true;
    try { await resizeWindow(next); viewMode = next; }
    catch (error) { console.error(error); windowError = 'error.resize'; }
    finally { switching = false; }
  }

  async function quit() {
    if (modalOpen || $dirty || $isSaving) { confirmQuit = true; await setMode('expanded'); return; }
    await forceQuit();
  }

  async function forceQuit() {
    if (isTauri()) {
      await invoke('quit_app');
    }
  }

  async function contextMenu(event: MouseEvent) {
    event.preventDefault();
    if (preview || modalOpen) return;
    try {
      pinMenuItem ??= await createPinMenuItem((message) => windowError = message);
      await refreshPinMenuItem(pinMenuItem);
      if (contextMenuResource) await contextMenuResource.close();
      await pinMenuItem.setText($translator('menu.pin'));
      contextMenuResource = await Menu.new({ items: [
        { id: 'expand', text: $translator('menu.expand'), action: () => { void setMode('expanded'); } },
        { id: 'collapse', text: $translator('menu.collapse'), action: () => { void setMode('collapsed'); } },
        pinMenuItem,
        { id: 'settings', text: $translator('menu.settings'), action: () => { void openSettings(); } },
        { id: 'quit', text: $translator('menu.quit'), action: () => { void quit(); } }
      ] });
      await contextMenuResource.popup();
    } catch (error) { console.error(error); windowError = 'error.menu'; }
  }

  async function openSettings() {
    if (modalOpen) return;
    await setMode('expanded');
    if (viewMode === 'expanded') showSettings = true;
  }

  function openNew() {
    if (!$storageReady) return;
    const timestamp = new Date().toISOString();
    editingTodo = { id: crypto.randomUUID(), title: '', content: '', deadline: null, completed: false, createdAt: timestamp, updatedAt: timestamp };
    adding = true;
  }

  async function saveEdit(id: string, fields: TodoEdit) {
    if (adding) await addTodo(fields, id);
    else await updateTodo(id, fields);
    editingTodo = null;
  }

  function keydown(event: KeyboardEvent) {
    if (modalOpen) return;
    if (event.key === 'Escape' && !event.defaultPrevented && viewMode === 'expanded') void setMode('collapsed');
  }
</script>

<svelte:window on:keydown={keydown} on:contextmenu={contextMenu} />

<div class:preview class="app-surface">
  {#if preview}<p class="preview-label">{$translator('app.preview')}</p>{/if}
  {#if viewMode === 'collapsed'}
    <FloatingIcon status={$iconStatus} color={$statusColors[$iconStatus]} count={$unfinishedCount} onExpand={() => setMode('expanded')} onError={(message) => windowError = message} />
    {#if $errorMessage || windowError || $settingsError || $languageError}<span class="error-dot" title={$translator('app.errorDetails')} aria-label={$translator('app.error')}>!</span>{/if}
  {:else}
    <div class="panel-wrapper">
      <div class="panel-content" inert={modalOpen}>
      <TodoPanel todos={$sortedTodos} count={$unfinishedCount} disabled={!$storageReady || $isLoading} loading={$isLoading} saving={$isSaving}
        onCollapse={() => setMode('collapsed')} onToggle={toggleTodo} onRemove={removeTodo} onAdd={openNew} onEdit={(todo) => { editingTodo = todo; adding = false; }} onSettings={openSettings} />
      </div>
      {#if editingTodo}
        <TodoEditor todo={editingTodo} isNew={adding} onSave={saveEdit} onCancel={() => editingTodo = null} />
      {/if}
      {#if showSettings}<SettingsPanel onCancel={() => showSettings = false} />{/if}
      {#if (!modalOpen && ($errorMessage || $settingsError || $languageError)) || windowError || confirmQuit}
        <div class="error-banner" role="alert">
          {#if $errorMessage}<p>{$translator($errorMessage)}</p><button on:click={retryStorage}>{$translator($storageReady ? 'common.retrySave' : 'common.retryRead')}</button>{/if}
          {#if $settingsError && !modalOpen}<p>{$translator($settingsError)}</p><button on:click={initializeSettings}>{$translator('settings.retryColors')}</button>{/if}
          {#if $languageError && !modalOpen}<p>{$translator($languageError)}</p><button on:click={initializeLanguage}>{$translator('settings.retryLanguage')}</button>{/if}
          {#if windowError}<p>{$translator(windowError)}</p><button on:click={() => windowError = null}>{$translator('common.dismiss')}</button>{/if}
          {#if confirmQuit}
            <p>{$translator('common.quitConfirm')}</p>
            <button on:click={() => confirmQuit = false}>{$translator('common.continue')}</button><button on:click={forceQuit}>{$translator('common.forceQuit')}</button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
