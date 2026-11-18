import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  window: { outerPosition: vi.fn(), outerSize: vi.fn(), setPosition: vi.fn(), setSize: vi.fn(), show: vi.fn(), onMoved: vi.fn(), onScaleChanged: vi.fn() },
  store: { get: vi.fn(), set: vi.fn(), save: vi.fn() },
  monitors: vi.fn(), primary: vi.fn(), listen: vi.fn()
}));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
vi.mock('@tauri-apps/api/event', () => ({ listen: native.listen }));
vi.mock('@tauri-apps/plugin-store', () => ({ load: async () => native.store }));
vi.mock('@tauri-apps/api/window', () => {
  class Position { constructor(public x: number, public y: number) {} }
  class Size { constructor(public width: number, public height: number) {} }
  return { getCurrentWindow: () => native.window, availableMonitors: native.monitors, primaryMonitor: native.primary,
    LogicalSize: Size, PhysicalSize: Size, PhysicalPosition: Position };
});

const display = (x = 0, scaleFactor = 1) => ({
  position: { x, y: 0 }, size: { width: 1920, height: 1080 }, scaleFactor,
  workArea: { position: { x, y: 0 }, size: { width: 1920, height: 1040 } }
});
let point: { x: number; y: number };
let size: { width: number; height: number };
let emitMove: () => void;
let emitScale: () => void;
let reset: () => void;
let dispose: (() => void) | undefined;
const settings = new Map<string, unknown>();

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.useFakeTimers();
  settings.clear();
  point = { x: 0, y: 0 }; size = { width: 72, height: 72 };
  native.monitors.mockResolvedValue([display()]); native.primary.mockResolvedValue(display());
  native.window.onMoved.mockImplementation(async (callback) => { emitMove = callback; return vi.fn(); });
  native.window.onScaleChanged.mockImplementation(async (callback) => { emitScale = callback; return vi.fn(); });
  native.listen.mockImplementation(async (_name, callback) => { reset = callback; return vi.fn(); });
  native.window.outerPosition.mockImplementation(async () => point);
  native.window.outerSize.mockImplementation(async () => size);
  native.window.setPosition.mockImplementation(async ({ x, y }) => { point = { x, y }; });
  native.window.setSize.mockImplementation(async ({ width, height }) => { size = { width, height }; });
  native.store.get.mockImplementation(async (key) => settings.get(key));
  native.store.set.mockImplementation(async (key, value) => { settings.set(key, value); });
});
afterEach(() => { dispose?.(); dispose = undefined; vi.useRealTimers(); });

async function setup() {
  const service = await import('../src/services/window-service');
  dispose = await service.initializeWindow(vi.fn());
  return service;
}
function drag(x: number, y: number) { point = { x, y }; emitMove(); }

describe('window placement', () => {
  it('anchors the panel at the actual icon center and opens down-left in the upper-right quadrant', async () => {
    const { resizeWindow } = await setup();
    drag(1400, 165);
    await resizeWindow('expanded'); // Click before the move debounce fires.
    expect(point).toEqual({ x: 1076, y: 201 });
  });

  it('returns to the original icon position even after moving the expanded panel', async () => {
    const { resizeWindow } = await setup();
    const original = { ...point };
    await resizeWindow('expanded');
    native.store.set.mockClear();
    drag(25, 50);
    emitScale();
    await vi.advanceTimersByTimeAsync(500);
    expect(point).toEqual({ x: 25, y: 50 });
    expect(native.store.set).not.toHaveBeenCalled();
    await resizeWindow('collapsed');
    expect(point).toEqual(original);
    expect(size).toEqual({ width: 72, height: 72 });
  });

  it('saves the icon, not the panel, when opening before the drag debounce', async () => {
    const { resizeWindow } = await setup();
    drag(265, 160);
    await resizeWindow('expanded');
    drag(400, 340);
    await vi.advanceTimersByTimeAsync(500);
    expect(settings.get('iconPosition')).toEqual({ x: 265, y: 160 });
    await resizeWindow('expanded'); // Opening settings on an already expanded panel must not reposition it.
    expect(point).toEqual({ x: 400, y: 340 });
    await resizeWindow('collapsed');
    expect(point).toEqual({ x: 265, y: 160 });
  });

  it('restores an icon on a negative-coordinate HiDPI monitor after dragging the panel to another monitor', async () => {
    const { resizeWindow } = await setup();
    native.monitors.mockResolvedValue([display(), display(-1920, 1.5)]);
    size = { width: 108, height: 108 };
    drag(-1500, 150);
    await resizeWindow('expanded');
    expect(point).toEqual({ x: -1446, y: 204 });
    expect(size).toEqual({ width: 540, height: 720 });
    size = { width: 360, height: 480 };
    drag(500, 300);
    emitScale();
    await resizeWindow('collapsed');
    expect(point).toEqual({ x: -1500, y: 150 });
    expect(size).toEqual({ width: 108, height: 108 });
  });

  it('falls back to the main work area when the original display is unplugged', async () => {
    const { resizeWindow } = await setup();
    native.monitors.mockResolvedValue([display(), display(-1920)]);
    drag(-1500, 150);
    await resizeWindow('expanded');
    native.monitors.mockResolvedValue([display()]);
    await resizeWindow('collapsed');
    expect(point).toEqual({ x: 1824, y: 920 });
    expect(settings.get('iconPosition')).toEqual(point);
  });

  it('loads old icon anchors and writes the equivalent top-left position', async () => {
    settings.set('anchor', { x: 357, y: 247 });
    await setup();
    expect(point).toEqual({ x: 285, y: 175 });
    expect(settings.get('iconPosition')).toEqual(point);
  });

  it('persists drags only while collapsed and allows an explicit tray reset', async () => {
    await setup();
    drag(222, 300);
    await vi.advanceTimersByTimeAsync(300);
    expect(settings.get('iconPosition')).toEqual({ x: 222, y: 300 });
    reset();
    await vi.advanceTimersByTimeAsync(0);
    expect(point).toEqual({ x: 1824, y: 920 });
    expect(settings.get('iconPosition')).toEqual(point);
  });
});
