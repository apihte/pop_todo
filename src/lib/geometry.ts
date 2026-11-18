export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface Bounds extends Point, Size {}
export interface WorkArea extends Bounds { scaleFactor: number }

export const COLLAPSED: Size = { width: 72, height: 72 };
export const EXPANDED: Size = { width: 360, height: 480 };

/** All positions and bounds here are physical pixels, including negative monitor origins. */
export function clampPosition(point: Point, size: Size, area: Bounds): Point {
  return {
    x: Math.round(Math.max(area.x, Math.min(point.x, area.x + area.width - size.width))),
    y: Math.round(Math.max(area.y, Math.min(point.y, area.y + area.height - size.height)))
  };
}

export function positionForAnchor(anchor: Point, size: Size, area: Bounds): Point {
  return clampPosition({ x: anchor.x - size.width, y: anchor.y - size.height }, size, area);
}

export function center(bounds: Bounds): Point {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export function containsPoint(bounds: Bounds, point: Point): boolean {
  return point.x >= bounds.x && point.x < bounds.x + bounds.width && point.y >= bounds.y && point.y < bounds.y + bounds.height;
}

export function expandedPosition(icon: Bounds, panel: Size, screen: Bounds, workArea: Bounds): Point {
  const origin = center(icon);
  const middle = center(screen);
  return clampPosition({
    x: origin.x - (origin.x >= middle.x ? panel.width : 0),
    y: origin.y - (origin.y >= middle.y ? panel.height : 0)
  }, panel, workArea);
}

export function defaultAnchor(area: WorkArea): Point {
  return { x: area.x + area.width - 24 * area.scaleFactor, y: area.y + area.height - 48 * area.scaleFactor };
}

export function areaForAnchor(anchor: Point | undefined, areas: WorkArea[]): WorkArea | undefined {
  return areas.find((area) => anchor && anchor.x > area.x && anchor.x <= area.x + area.width && anchor.y > area.y && anchor.y <= area.y + area.height);
}

export function parseAnchor(value: unknown): Point | undefined {
  if (typeof value !== 'object' || value === null || !('x' in value) || !('y' in value)) return undefined;
  return typeof value.x === 'number' && Number.isFinite(value.x) && typeof value.y === 'number' && Number.isFinite(value.y)
    ? { x: value.x, y: value.y } : undefined;
}
