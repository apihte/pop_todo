import { t } from '../stores/i18n';
import { invoke } from '@tauri-apps/api/core';
import { CheckMenuItem } from '@tauri-apps/api/menu';

/** Rust owns the shared setting used by both tray and window context menus. */
export async function createPinMenuItem(reportError: (message: string) => void): Promise<CheckMenuItem> {
  const checked = await invoke<boolean>('get_always_on_top');
  const item = await CheckMenuItem.new({
    id: 'context-always-on-top', text: t('menu.pin'), checked,
    action: () => { void toggle(); }
  });
  let busy = false;
  async function toggle(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      await item.setEnabled(false);
      const next = await invoke<boolean>('toggle_always_on_top');
      await item.setChecked(next);
    } catch (error) {
      reportError(typeof error === 'string' && error.startsWith('error.') ? error : 'error.pin');
      try { await refreshPinMenuItem(item); }
      catch (refreshError) { console.error(refreshError); }
    } finally {
      busy = false;
      try { await item.setEnabled(true); }
      catch (error) { console.error(error); }
    }
  }
  return item;
}

export async function refreshPinMenuItem(item: CheckMenuItem): Promise<void> {
  await item.setChecked(await invoke<boolean>('get_always_on_top'));
}
