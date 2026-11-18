import { isTauri } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import { DEFAULT_COLORS, parseColors, type StatusColors } from '../lib/status';

const KEY = 'floating-todo-preview-colors-v1';
const store = () => load('window.json', { defaults: {}, autoSave: false });

export async function loadColors(): Promise<StatusColors> {
  const value: unknown = isTauri() ? await (await store()).get('statusColors') : JSON.parse(localStorage.getItem(KEY) ?? 'null');
  return value == null ? { ...DEFAULT_COLORS } : parseColors(value);
}

export async function saveColors(value: StatusColors): Promise<void> {
  const colors = parseColors(value);
  if (!isTauri()) { localStorage.setItem(KEY, JSON.stringify(colors)); return; }
  const settings = await store();
  const previous = await settings.get('statusColors');
  await settings.set('statusColors', colors);
  try { await settings.save(); }
  catch (error) {
    // Store may save at exit. Don't leave an unsuccessful edit registered in its cache.
    await settings.set('statusColors', previous ?? DEFAULT_COLORS);
    throw error;
  }
}
