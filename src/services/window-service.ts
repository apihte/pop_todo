import { isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { load } from '@tauri-apps/plugin-store';
import { availableMonitors, primaryMonitor, getCurrentWindow, PhysicalSize, PhysicalPosition } from '@tauri-apps/api/window';
import { areaForAnchor, center, clampPosition, COLLAPSED, containsPoint, defaultAnchor, expandedPosition, EXPANDED, parseAnchor, positionForAnchor, type Bounds, type Point, type Size, type WorkArea } from '../lib/geometry';
import type { ViewMode } from '../types/todo';

interface Display { screen: Bounds; workArea: WorkArea }
type NativeWindow = ReturnType<typeof getCurrentWindow>;
let icon: (Point & Partial<Size>) | undefined;
let savedPosition: Point | undefined;
let legacyAnchor: Point | undefined;
let mode: ViewMode = 'collapsed';
let changing = false;
let operations = Promise.resolve();
let onError: (message: string) => void = console.error;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const settings = () => load('window.json', { defaults: {}, autoSave: false });

function enqueue(operation: () => Promise<void>): Promise<void> {
  const result = operations.then(operation);
  operations = result.catch(() => undefined);
  return result;
}

function samePoint(a: Point | undefined, b: Point): boolean {
  return a?.x === b.x && a.y === b.y;
}

async function readBounds(window: NativeWindow): Promise<Bounds> {
  const [position, size] = await Promise.all([window.outerPosition(), window.outerSize()]);
  return { x: position.x, y: position.y, width: size.width, height: size.height };
}

async function saveIconPosition(position: Point): Promise<void> {
  if (samePoint(savedPosition, position)) return;
  const point = { x: position.x, y: position.y };
  try {
    const store = await settings();
    await store.set('iconPosition', point);
    await store.save();
    savedPosition = point;
  } catch (error) { console.error(error); onError('error.savePosition'); }
}

async function displays(): Promise<{ monitors: Display[]; primary: Display | undefined }> {
  const [available, primaryMonitorInfo] = await Promise.all([availableMonitors(), primaryMonitor()]);
  const monitors = available.map(({ position, size, workArea, scaleFactor }): Display => ({
    screen: { x: position.x, y: position.y, width: size.width, height: size.height },
    workArea: { x: workArea.position.x, y: workArea.position.y, width: workArea.size.width, height: workArea.size.height, scaleFactor }
  }));
  return { monitors, primary: monitors.find(({ screen }) => samePoint(primaryMonitorInfo?.position, screen)) ?? monitors[0] };
}

function physicalSize(logical: Size, area: WorkArea): Size {
  return {
    width: Math.min(area.width, Math.round(logical.width * area.scaleFactor)),
    height: Math.min(area.height, Math.round(logical.height * area.scaleFactor))
  };
}

async function applyMode(next: ViewMode, reason: 'switch' | 'startup' | 'reset' = 'switch'): Promise<void> {
  if (!isTauri()) { mode = next; return; }
  const window = getCurrentWindow();
  if (reason === 'switch' && next === mode) { await window.show(); return; }

  changing = true;
  clearTimeout(saveTimer);
  try {
    // Capture the live icon, including moves still waiting for the save debounce.
    const liveIcon = reason === 'switch' && mode === 'collapsed' ? await readBounds(window) : undefined;
    if (liveIcon) icon = liveIcon;
    const { monitors, primary } = await displays();
    const reference = icon?.width !== undefined && icon.height !== undefined
      ? center({ ...icon, width: icon.width, height: icon.height }) : icon;
    const iconDisplay = reference && monitors.find(({ screen }) => containsPoint(screen, reference));
    const legacyDisplay = !icon && monitors.find(({ workArea }) => areaForAnchor(legacyAnchor, [workArea]));
    const selected = reason === 'reset' ? primary : iconDisplay || legacyDisplay || primary;
    if (!selected) throw new Error('error.monitors');

    const { screen, workArea } = selected;
    const collapsed = physicalSize(COLLAPSED, workArea);
    const remembered = reason === 'reset' ? undefined : iconDisplay ? icon : undefined;
    const restored = remembered
      ? (reason !== 'startup' && containsPoint(workArea, center({ ...remembered, ...collapsed }))
        ? { x: remembered.x, y: remembered.y }
        : clampPosition(remembered, collapsed, workArea))
      : positionForAnchor(reason !== 'reset' && legacyDisplay ? legacyAnchor! : defaultAnchor(workArea), collapsed, workArea);
    const panelSize = physicalSize(EXPANDED, workArea);
    const panelOrigin = liveIcon && iconDisplay ? liveIcon : { ...restored, ...collapsed };
    const size = next === 'expanded' ? panelSize : collapsed;
    const position = next === 'expanded' ? expandedPosition(panelOrigin, panelSize, screen, workArea) : restored;

    // Size after moving so destination DPI changes can't rescale the requested bounds.
    await window.setPosition(new PhysicalPosition(position.x, position.y));
    await window.setSize(new PhysicalSize(size.width, size.height));
    await window.show();
    mode = next;
    icon = { ...restored, ...collapsed };
    legacyAnchor = undefined;
    await saveIconPosition(icon);
  } finally { changing = false; }
}

export function resizeWindow(next: ViewMode): Promise<void> {
  return enqueue(() => applyMode(next));
}

export async function startWindowDrag(): Promise<void> {
  if (isTauri()) await getCurrentWindow().startDragging();
}

export async function initializeWindow(reportError: (message: string) => void): Promise<() => void> {
  onError = reportError;
  if (!isTauri()) return () => {};
  const window = getCurrentWindow();
  await enqueue(async () => {
    try {
      const store = await settings();
      savedPosition = parseAnchor(await store.get('iconPosition'));
      icon = savedPosition;
      legacyAnchor = savedPosition ? undefined : parseAnchor(await store.get('anchor'));
    } catch (error) { console.error(error); onError('error.readPosition'); }
    try { await applyMode('collapsed', 'startup'); }
    catch (error) { await window.show(); throw error; }
  });

  let disposed = false;
  const listeners: UnlistenFn[] = [];
  function scheduleIconSave() {
    if (mode !== 'collapsed' || changing || disposed) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void enqueue(async () => {
        if (mode !== 'collapsed' || disposed) return;
        icon = await readBounds(window);
        await saveIconPosition(icon);
      }).catch((error: unknown) => { console.error(error); onError('error.savePosition'); });
    }, 300);
  }
  try {
    listeners.push(await window.onMoved(scheduleIconSave));
    // The OS handles resizing after a DPI change. Never re-anchor a dragged panel.
    listeners.push(await window.onScaleChanged(scheduleIconSave));
    listeners.push(await listen('window:reset', () => {
      void enqueue(() => applyMode(mode, 'reset')).catch(() => onError('error.resetPosition'));
    }));
  } catch (error) {
    listeners.forEach((unlisten) => unlisten());
    throw error;
  }
  return () => { disposed = true; clearTimeout(saveTimer); listeners.forEach((unlisten) => unlisten()); };
}
