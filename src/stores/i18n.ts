import { derived, get, writable } from 'svelte/store';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import fallback from '../locales/zh_cn.json';
import { buildLanguages, translate } from '../lib/locale';

// Adding a JSON file here is sufficient; no registry or switch statement to maintain.
export const languages = buildLanguages(import.meta.glob('../locales/*.json', { eager: true, import: 'default' }), fallback);
export const language = writable('zh_cn');
export const languageError = writable<string | null>(null);
export const languageBusy = writable(false);
export const activeLanguage = derived(language, (code) => languages.find((entry) => entry.code === code) ?? languages.find((entry) => entry.code === 'zh_cn')!);
export const translator = derived(activeLanguage, (entry) => (key: string, params?: Record<string, string | number>) => translate(entry.messages, fallback, key, params));
export function t(key: string, params?: Record<string, string | number>): string { return get(translator)(key, params); }

// Store errors as keys, so existing alerts also retranslate when the language changes.
export function errorKey(error: unknown, fallbackKey = 'error.save'): string {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') return error.code;
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith('error.') ? message : fallbackKey;
}
export function localizedError(key: string): Error { return Object.assign(new Error(t(key)), { code: key }); }

const previewKey = 'floating-todo-preview-language';
const settings = () => load('window.json', { defaults: {}, autoSave: false });

async function syncNative(): Promise<void> {
  if (!isTauri()) return;
  const entry = get(activeLanguage);
  const messages = { ...fallback, ...entry.messages };
  await invoke('set_menu_language', { messages });
}
function apply(code: string): void {
  language.set(code);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = get(activeLanguage).locale;
    document.title = t('app.title');
  }
}

export async function initializeLanguage(): Promise<void> {
  languageBusy.set(true);
  try {
    const value = isTauri() ? await (await settings()).get<unknown>('language') : localStorage.getItem(previewKey);
    apply(typeof value === 'string' && languages.some((entry) => entry.code === value) ? value : 'zh_cn');
    await syncNative();
    languageError.set(null);
  } catch (error) {
    console.error(error);
    languageError.set('error.languageRead');
  } finally { languageBusy.set(false); }
}

export async function changeLanguage(code: string): Promise<void> {
  if (get(languageBusy)) return;
  if (!languages.some((entry) => entry.code === code)) throw new Error(`Unknown language: ${code}`);
  languageBusy.set(true);
  try {
    if (isTauri()) {
      const store = await settings();
      const previous = await store.get('language');
      await store.set('language', code);
      try { await store.save(); }
      catch (error) { await store.set('language', previous ?? get(language)); throw error; }
    } else { localStorage.setItem(previewKey, code); }
    apply(code);
    languageError.set(null);
    try { await syncNative(); }
    catch (error) { console.error(error); languageError.set('error.languageMenus'); }
  } catch (error) {
    console.error(error);
    languageError.set('error.languageSave');
  } finally { languageBusy.set(false); }
}
