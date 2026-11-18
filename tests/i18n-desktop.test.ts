import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
const { invoke, load, storeGet, set, save } = vi.hoisted(() => ({ invoke: vi.fn(), load: vi.fn(), storeGet: vi.fn(), set: vi.fn(), save: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke }));
vi.mock('@tauri-apps/plugin-store', () => ({ load }));
import { changeLanguage, initializeLanguage, language, languageError } from '../src/stores/i18n';
beforeEach(() => {
  vi.resetAllMocks(); language.set('zh_cn');
  load.mockResolvedValue({ get: storeGet, set, save });
  set.mockResolvedValue(undefined); save.mockResolvedValue(undefined); invoke.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());
it('restores desktop preference and sends the same language file strings to native menus', async () => {
  storeGet.mockResolvedValue('en_us'); await initializeLanguage();
  expect(get(language)).toBe('en_us');
  expect(invoke).toHaveBeenCalledWith('set_menu_language', { messages: expect.objectContaining({ 'menu.show': 'Show todos', 'menu.pin': 'Always on top', lang: 'English (US)' }) });
});
it('saves only the language key and does not replace position, colors or pin preferences', async () => {
  await changeLanguage('en_us');
  expect(set).toHaveBeenCalledExactlyOnceWith('language', 'en_us'); expect(save).toHaveBeenCalledOnce();
});
it('restores the old store cache and UI when language persistence fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  storeGet.mockResolvedValue('zh_cn'); save.mockRejectedValueOnce(new Error('full'));
  await changeLanguage('en_us');
  expect(set).toHaveBeenLastCalledWith('language', 'zh_cn');
  expect(get(language)).toBe('zh_cn'); expect(get(languageError)).toBe('error.languageSave');
  expect(invoke).not.toHaveBeenCalled();
});
it('reports native menu failure without undoing a successfully saved interface language', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  invoke.mockRejectedValueOnce(new Error('menu'));
  await changeLanguage('en_us'); expect(get(language)).toBe('en_us');
  expect(get(languageError)).toBe('error.languageMenus');
});
