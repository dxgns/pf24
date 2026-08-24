export type ScopeDomPoint = { x: number; y: number };

function safeRatio(numerator: number, denominator: number) {
  return denominator > 0 && Number.isFinite(denominator) ? numerator / denominator : 1;
}

export function scopeElementLocalScale(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return {
    x: safeRatio(Math.max(1, element.clientWidth), rect.width),
    y: safeRatio(Math.max(1, element.clientHeight), rect.height),
  };
}

export function scopeClientPointToLocal(
  element: HTMLElement,
  clientX: number,
  clientY: number,
): ScopeDomPoint {
  const rect = element.getBoundingClientRect();
  const scale = scopeElementLocalScale(element);
  return {
    x: (clientX - rect.left) * scale.x,
    y: (clientY - rect.top) * scale.y,
  };
}

export function scopeClientDeltaToLocal(
  element: HTMLElement,
  deltaX: number,
  deltaY: number,
): ScopeDomPoint {
  const scale = scopeElementLocalScale(element);
  return { x: deltaX * scale.x, y: deltaY * scale.y };
}

export function scopeRectCenterToLocal(
  host: HTMLElement,
  rect: DOMRect,
): ScopeDomPoint {
  return scopeClientPointToLocal(
    host,
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  );
}

export function scopeElementLocalSize(element: HTMLElement): ScopeDomPoint {
  return {
    x: Math.max(1, element.clientWidth),
    y: Math.max(1, element.clientHeight),
  };
}
