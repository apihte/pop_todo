import { writable } from 'svelte/store';
import { DEFAULT_COLORS, parseColors, type StatusColors } from '../lib/status';
import { loadColors, saveColors } from '../services/color-storage';

export const statusColors = writable<StatusColors>({ ...DEFAULT_COLORS });
export const settingsError = writable<string | null>(null);
export const settingsReady = writable(false);

export async function initializeSettings(): Promise<void> {
  settingsReady.set(false);
  try {
    statusColors.set(await loadColors());
    settingsError.set(null);
    settingsReady.set(true);
  } catch (error) {
    console.error(error);
    settingsError.set('error.readColors');
  }
}

export async function updateColors(value: StatusColors): Promise<void> {
  const next = parseColors(value);
  await saveColors(next);
  statusColors.set(next);
  settingsError.set(null);
}
