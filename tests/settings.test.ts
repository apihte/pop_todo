import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { get } from 'svelte/store';
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => false }));
import { DEFAULT_COLORS } from '../src/lib/status';
import { loadColors, saveColors } from '../src/services/color-storage';
import { initializeSettings, statusColors } from '../src/stores/settings-store';
import SettingsPanel from '../src/components/SettingsPanel.svelte';

beforeEach(async () => { localStorage.clear(); await initializeSettings(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('custom color settings', () => {
  it('loads defaults, saves all statuses and restores after initialization', async () => {
    expect(await loadColors()).toEqual(DEFAULT_COLORS);
    const colors = { normal: '#abcdef', today: '#123456', overdue: '#654321', unscheduled: '#ffffff' };
    await saveColors(colors); await initializeSettings();
    expect(get(statusColors)).toEqual(colors);
  });
  it('loads legacy preferences and defaults the new state without changing existing colors', async () => {
    localStorage.setItem('floating-todo-preview-colors-v1', JSON.stringify({ normal: '#112233', today: '#445566', overdue: '#778899' }));
    await initializeSettings();
    expect(get(statusColors)).toEqual({ normal: '#112233', today: '#445566', overdue: '#778899', unscheduled: '#ffffff' });
  });
  it('saves and restores the custom no-deadline color from settings', async () => {
    const user = userEvent.setup();
    const view = render(SettingsPanel, { onCancel: vi.fn() });
    expect((view.getByLabelText(/未设置时间/) as HTMLInputElement).value).toBe('#ffffff');
    await fireEvent.input(view.getByLabelText(/未设置时间/), { target: { value: '#eeeeee' } });
    await user.click(view.getByRole('button', { name: '保存' }));
    await initializeSettings();
    expect(get(statusColors).unscheduled).toBe('#eeeeee');
  });
  it('does not silently replace corrupt stored colors', async () => {
    localStorage.setItem('floating-todo-preview-colors-v1', 'broken');
    await expect(loadColors()).rejects.toThrow();
    expect(localStorage.getItem('floating-todo-preview-colors-v1')).toBe('broken');
  });
  it('saves from the dialog and supports reset to defaults', async () => {
    const user = userEvent.setup(); const onCancel = vi.fn();
    const view = render(SettingsPanel, { onCancel });
    await fireEvent.input(view.getByLabelText(/正常/), { target: { value: '#112233' } });
    await user.click(view.getByRole('button', { name: '保存' }));
    expect(onCancel).toHaveBeenCalledOnce(); expect(get(statusColors).normal).toBe('#112233');
    view.unmount();
    const reset = render(SettingsPanel, { onCancel: vi.fn() });
    await user.click(reset.getByRole('button', { name: '恢复默认颜色' }));
    await user.click(reset.getByRole('button', { name: '保存' }));
    expect(await loadColors()).toEqual(DEFAULT_COLORS);
  });
  it('does not apply a canceled draft', async () => {
    const user = userEvent.setup(); const onCancel = vi.fn();
    const view = render(SettingsPanel, { onCancel });
    await fireEvent.input(view.getByLabelText(/正常/), { target: { value: '#112233' } });
    await user.click(view.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalledOnce(); expect(get(statusColors)).toEqual(DEFAULT_COLORS);
    expect(await loadColors()).toEqual(DEFAULT_COLORS);
  });
  it('retains the draft and prior colors when persistence fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('full'); });
    const onCancel = vi.fn(); const user = userEvent.setup();
    const view = render(SettingsPanel, { onCancel });
    await fireEvent.input(view.getByLabelText(/正常/), { target: { value: '#112233' } });
    await user.click(view.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(view.getByRole('alert').textContent).toContain('颜色保存失败'));
    expect(get(statusColors)).toEqual(DEFAULT_COLORS); expect(onCancel).not.toHaveBeenCalled();
    await user.click(view.getByRole('button', { name: '保存' }));
    expect(get(statusColors).normal).toBe('#112233');
  });
});
