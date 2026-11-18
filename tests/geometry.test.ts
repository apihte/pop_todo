import { describe, expect, it } from 'vitest';
import { areaForAnchor, defaultAnchor, expandedPosition, parseAnchor, positionForAnchor } from '../src/lib/geometry';

const primary = { x: 0, y: 0, width: 1920, height: 1040, scaleFactor: 1 };
const left = { x: -2560, y: -200, width: 2560, height: 1400, scaleFactor: 2 };
describe('window geometry in physical pixels', () => {
  it('uses the work area rather than covering taskbars', () => {
    expect(defaultAnchor(primary)).toEqual({ x: 1896, y: 992 });
    expect(defaultAnchor(left)).toEqual({ x: -48, y: 1104 });
  });
  it.each([
    ['upper right', 1464, 164, 1140, 200],
    ['lower right', 1464, 764, 1140, 320],
    ['lower left', 264, 764, 300, 320],
    ['upper left', 264, 164, 300, 200]
  ])('opens from the icon center in the %s quadrant', (_quadrant, x, y, panelX, panelY) => {
    expect(expandedPosition({ x, y, width: 72, height: 72 }, { width: 360, height: 480 }, primary, primary))
      .toEqual({ x: panelX, y: panelY });
  });
  it('uses the full screen for quadrant and the work area for clamping', () => {
    const screen = { ...primary, height: 1080 };
    expect(expandedPosition({ x: 1464, y: 494, width: 72, height: 72 }, { width: 360, height: 480 }, screen, primary))
      .toEqual({ x: 1140, y: 530 });
    expect(expandedPosition({ x: 0, y: 0, width: 72, height: 72 }, { width: 1920, height: 1040 }, screen, primary))
      .toEqual({ x: 0, y: 0 });
  });
  it('retains the legacy bottom-right conversion for previously saved icons', () => {
    expect(positionForAnchor({ x: 1500, y: 900 }, { width: 72, height: 72 }, primary)).toEqual({ x: 1428, y: 828 });
  });
  it('clamps at left/top boundaries including negative screen origins', () => {
    expect(positionForAnchor({ x: 20, y: 10 }, { width: 360, height: 480 }, primary)).toEqual({ x: 0, y: 0 });
    expect(positionForAnchor({ x: -2500, y: -100 }, { width: 720, height: 960 }, left)).toEqual({ x: -2560, y: -200 });
  });
  it('recovers an offscreen anchor when a screen is removed', () => {
    expect(areaForAnchor({ x: -48, y: 1104 }, [primary])).toBeUndefined();
    expect(areaForAnchor({ x: -48, y: 1104 }, [primary, left])).toBe(left);
  });
  it('rejects invalid persisted positions', () => {
    expect(parseAnchor({ x: NaN, y: 1 })).toBeUndefined();
    expect(parseAnchor({ x: '12', y: 1 })).toBeUndefined();
    expect(parseAnchor({ x: -100, y: 20 })).toEqual({ x: -100, y: 20 });
  });
});
