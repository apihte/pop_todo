import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { get } from 'svelte/store';
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => false, invoke: vi.fn() }));
import fallback from '../src/locales/zh_cn.json';
import english from '../src/locales/en_us.json';
import { buildLanguages, translate } from '../src/lib/locale';
import { changeLanguage, initializeLanguage, language, languageError, languages, localizedError, t } from '../src/stores/i18n';
import { initializeSettings } from '../src/stores/settings-store';
import { validateTitle } from '../src/lib/todos';
import { formatDeadline } from '../src/lib/deadline';
import App from '../src/App.svelte';

beforeEach(async () => { localStorage.clear(); await initializeLanguage(); await initializeSettings(); });
afterEach(async () => { cleanup(); vi.restoreAllMocks(); await changeLanguage('zh_cn'); });

describe('language files', () => {
  it('discovers both languages and preserves lang display names and standard locale tags', () => {
    expect(languages.map(({ code, name, locale }) => ({ code, name, locale }))).toEqual(expect.arrayContaining([
      { code: 'en_us', name: 'English (US)', locale: 'en-US' },
      { code: 'zh_cn', name: '简体中文', locale: 'zh-CN' }
    ]));
    expect(Object.keys(english).sort()).toEqual(Object.keys(fallback).sort());
  });
  it('supports a new file without any registry change and falls back for missing keys', () => {
    const added = buildLanguages({ '../locales/fr_fr.json': { lang: 'Français', 'common.save': 'Enregistrer' } }, fallback)[0];
    expect(added.locale).toBe('fr-FR');
    expect(translate(added.messages, fallback, 'common.save')).toBe('Enregistrer');
    expect(translate(added.messages, fallback, 'common.cancel')).toBe('取消');
    expect(translate(added.messages, fallback, 'todo.count', { count: 3 })).toBe('3 件未完成');
  });
  it('rejects bad filenames, missing names, invalid types and placeholder mismatches', () => {
    for (const files of [
      { 'Chinese.json': { lang: '中文' } }, { 'fr_fr.json': {} },
      { 'fr_fr.json': { lang: 'French', 'common.save': 42 } },
      { 'fr_fr.json': { lang: 'French', 'todo.count': 'Tasks' } }
    ]) expect(() => buildLanguages(files, fallback)).toThrow();
  });
  it('interpolates task text literally, not as HTML or additional placeholders', () => {
    expect(translate(english, fallback, 'todo.editItem', { title: '<script>{count}</script>' })).toBe('Edit “<script>{count}</script>”');
  });
});

describe('language preference', () => {
  it('persists the language and translates dates, document metadata and validation', async () => {
    await changeLanguage('en_us');
    expect(t('common.save')).toBe('Save');
    expect(document.documentElement.lang).toBe('en-US');
    expect(document.title).toBe('Floating Todo');
    expect(() => validateTitle('')).toThrow('Title must not be empty');
    expect(localizedError('error.titleRequired')).toHaveProperty('code', 'error.titleRequired');
    const deadline = '2026-06-15T06:30:00.000Z';
    expect(formatDeadline(deadline)).toBe(new Date(deadline).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
    language.set('zh_cn'); await initializeLanguage();
    expect(get(language)).toBe('en_us');
  });
  it('falls back safely for an obsolete or unknown saved language', async () => {
    localStorage.setItem('floating-todo-preview-language', 'missing');
    await initializeLanguage(); expect(get(language)).toBe('zh_cn');
  });
  it('retains the active language on write failure and allows retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('full'); });
    await changeLanguage('en_us');
    expect(get(language)).toBe('zh_cn'); expect(get(languageError)).toBe('error.languageSave');
    await changeLanguage('en_us');
    expect(get(language)).toBe('en_us'); expect(get(languageError)).toBeNull();
  });
});

it('switches the running UI from settings, translates existing errors and persists without changing task content', async () => {
  const user = userEvent.setup(); const view = render(App);
  await user.click(view.getByRole('button', { name: '展开代办列表' }));
  await user.click(view.getByRole('button', { name: '设置' }));
  const select = await view.findByLabelText('语言');
  await user.selectOptions(select, 'en_us');
  await waitFor(() => expect(view.getByRole('dialog', { name: 'Settings' })).toBeTruthy());
  expect(view.getByLabelText('Language')).toBeTruthy();
  await user.click(view.getByRole('button', { name: 'Cancel' }));
  await user.click(view.getByRole('button', { name: /Add todo/ }));
  await user.click(view.getByRole('button', { name: 'Save' }));
  expect(view.getByRole('alert').textContent).toBe('Title must not be empty');
  await changeLanguage('zh_cn');
  await waitFor(() => expect(view.getByRole('alert').textContent).toBe('标题必须不为空'));
  await user.type(view.getByLabelText('具体内容（选填）'), '保留中文。详细信息');
  await user.click(view.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(view.queryByRole('dialog')).toBeNull());
  await changeLanguage('en_us');
  await waitFor(() => expect(view.getByRole('button', { name: 'Edit “保留中文。”' })).toBeTruthy());
  expect(JSON.parse(localStorage.getItem('floating-todo-preview-v1')!).todos[0].content).toBe('保留中文。详细信息');
});
