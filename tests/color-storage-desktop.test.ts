import { beforeEach, expect, it, vi } from 'vitest';
const { load, get, set, save } = vi.hoisted(() => ({ load: vi.fn(), get: vi.fn(), set: vi.fn(), save: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
vi.mock('@tauri-apps/plugin-store', () => ({ load }));
import { loadColors, saveColors } from '../src/services/color-storage';
import { DEFAULT_COLORS } from '../src/lib/status';

beforeEach(() => {
  vi.resetAllMocks();
  load.mockResolvedValue({ get, set, save });
  set.mockResolvedValue(undefined); save.mockResolvedValue(undefined);
});
it('persists only the colors key without replacing position or pin settings', async () => {
  get.mockResolvedValue(undefined);
  expect(await loadColors()).toEqual(DEFAULT_COLORS);
  const next = { normal: '#112233', today: '#445566', overdue: '#778899', unscheduled: '#ffffff' };
  await saveColors(next);
  expect(load).toHaveBeenCalledWith('window.json', { defaults: {}, autoSave: false });
  expect(set).toHaveBeenCalledExactlyOnceWith('statusColors', next);
  expect(save).toHaveBeenCalledOnce();
});
it('restores the prior store cache after failed persistence to avoid exit-time overwrite', async () => {
  get.mockResolvedValue(DEFAULT_COLORS); save.mockRejectedValueOnce(new Error('disk full'));
  await expect(saveColors({ normal: '#112233', today: '#445566', overdue: '#778899', unscheduled: '#ffffff' })).rejects.toThrow('disk full');
  expect(set).toHaveBeenLastCalledWith('statusColors', DEFAULT_COLORS);
});
