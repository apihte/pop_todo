import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/svelte';
const { invoke, create, item } = vi.hoisted(() => ({
  invoke: vi.fn(), create: vi.fn(),
  item: { setChecked: vi.fn(), setEnabled: vi.fn() }
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/api/menu', () => ({ CheckMenuItem: { new: create } }));
import { createPinMenuItem, refreshPinMenuItem } from '../src/services/pin-service';

beforeEach(() => {
  vi.resetAllMocks();
  create.mockResolvedValue(item);
  item.setChecked.mockResolvedValue(undefined);
  item.setEnabled.mockResolvedValue(undefined);
});

describe('always-on-top context menu', () => {
  it.each([true, false])('initializes its checkbox from the persisted desktop setting: %s', async (enabled) => {
    invoke.mockResolvedValueOnce(enabled);
    await createPinMenuItem(vi.fn());
    expect(invoke).toHaveBeenCalledWith('get_always_on_top');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ text: '置顶显示', checked: enabled }));
  });

  it.each([true, false])('synchronizes with the backend result after toggling to %s', async (next) => {
    invoke.mockResolvedValueOnce(!next).mockResolvedValueOnce(next);
    const reportError = vi.fn();
    await createPinMenuItem(reportError);
    create.mock.calls[0][0].action();
    await waitFor(() => expect(item.setEnabled).toHaveBeenLastCalledWith(true));
    expect(invoke).toHaveBeenCalledWith('toggle_always_on_top');
    expect(item.setChecked).toHaveBeenLastCalledWith(next);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('restores the checkbox from authoritative state on save failure and allows retry', async () => {
    invoke.mockResolvedValueOnce(true)
      .mockRejectedValueOnce('error.pinRollback')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const reportError = vi.fn();
    await createPinMenuItem(reportError);
    const action = create.mock.calls[0][0].action;
    action();
    await waitFor(() => expect(item.setEnabled).toHaveBeenLastCalledWith(true));
    expect(reportError).toHaveBeenCalledWith('error.pinRollback');
    expect(item.setChecked).toHaveBeenLastCalledWith(true);
    item.setEnabled.mockClear();
    action();
    await waitFor(() => expect(item.setEnabled).toHaveBeenLastCalledWith(true));
    expect(item.setChecked).toHaveBeenLastCalledWith(false);
  });

  it('refreshes from the desktop state after tray changes', async () => {
    invoke.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const menu = await createPinMenuItem(vi.fn());
    await refreshPinMenuItem(menu);
    expect(item.setChecked).toHaveBeenCalledWith(false);
  });

  it('prevents duplicate context-menu requests while a toggle is pending', async () => {
    invoke.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await createPinMenuItem(vi.fn());
    const action = create.mock.calls[0][0].action;
    action();
    action();
    await waitFor(() => expect(item.setEnabled).toHaveBeenLastCalledWith(true));
    expect(invoke.mock.calls.filter(([command]) => command === 'toggle_always_on_top')).toHaveLength(1);
  });
});
