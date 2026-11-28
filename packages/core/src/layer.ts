// Floating panels above everything else (HelpTip, Tooltip): how a panel gets into the browser's top layer, where it
// is placed, and that only one of them is open at a time.
//
// - The panel stays in the DOM next to its anchor, so inside a modal dialog it is part of the dialog (the rest of the
//   page is inert there) and its link follows the anchor in the keyboard order.
// - Top layer: a manual popover where the browser has the Popover API. A popover opened after a modal dialog is
//   painted above it, and outside every overflow and transform of its ancestors. Elsewhere (old browsers, jsdom) it
//   is a fixed element with a high z-index.
// - Place: above the anchor, below when there is no room above, shifted sideways at the window's edges. The
//   position is written through the CSSOM (element.style), which a strict Content-Security-Policy without
//   'unsafe-inline' allows; no style attribute is rendered.

const GAP = 8;
const MARGIN = 8;

/** Whether the browser has the Popover API. */
export const HAS_POPOVER = typeof HTMLElement !== "undefined" && typeof HTMLElement.prototype.showPopover === "function";

/** Puts a panel with a popover attribute into the top layer; false where that is not possible. */
export function raiseLayer(panel: HTMLElement): boolean {
  if (!HAS_POPOVER || !panel.hasAttribute("popover")) return false;
  try {
    if (!panel.matches(":popover-open")) panel.showPopover();
    return true;
  } catch {
    return false;
  }
}

/** Takes a panel out of the top layer again. */
export function lowerLayer(panel: HTMLElement): void {
  if (!HAS_POPOVER || !panel.hasAttribute("popover")) return;
  try {
    if (panel.matches(":popover-open")) panel.hidePopover();
  } catch {
    // Already closed.
  }
}

export interface Placement {
  top: number;
  left: number;
  below: boolean;
}

/** The panel's place: above the anchor, else below; always inside the window. */
export function placeLayer(
  rect: { top: number; bottom: number; left: number; width: number },
  size: { width: number; height: number },
  view: { width: number; height: number },
): Placement {
  return placeLayerAt(rect, size, view, "top");
}

/**
 * The panel's place on the preferred side of the anchor ("top": above, "bottom": below), on the other side when it
 * does not fit there and the other side has more room; shifted sideways at the window's edges, always inside it.
 */
export function placeLayerAt(
  rect: { top: number; bottom: number; left: number; width: number },
  size: { width: number; height: number },
  view: { width: number; height: number },
  side: "top" | "bottom",
): Placement {
  const room = { above: rect.top - GAP - MARGIN, below: view.height - rect.bottom - GAP - MARGIN };
  const below =
    side === "bottom" ? !(size.height > room.below && room.above > room.below) : size.height > room.above && room.below >= room.above;
  const wanted = below ? rect.bottom + GAP : rect.top - size.height - GAP;
  const top = Math.max(MARGIN, Math.min(wanted, view.height - size.height - MARGIN));
  const centre = rect.left + rect.width / 2 - size.width / 2;
  const left = Math.max(MARGIN, Math.min(centre, view.width - size.width - MARGIN));
  return { top, left, below };
}

/** Places `panel` next to `anchor` in the window. */
export function positionLayer(panel: HTMLElement, anchor: HTMLElement): Placement {
  return positionLayerAt(panel, anchor, "top");
}

/** Places `panel` on the preferred side of `anchor` in the window (placeLayerAt). */
export function positionLayerAt(panel: HTMLElement, anchor: HTMLElement, side: "top" | "bottom"): Placement {
  const doc = anchor.ownerDocument;
  const view = { width: doc.documentElement.clientWidth || window.innerWidth, height: window.innerHeight };
  const place = placeLayerAt(anchor.getBoundingClientRect(), { width: panel.offsetWidth, height: panel.offsetHeight }, view, side);
  panel.style.setProperty("top", `${place.top}px`);
  panel.style.setProperty("left", `${place.left}px`);
  return place;
}

let active: (() => void) | null = null;

/** Makes `close` the one open floating panel: the panel open before it (a tooltip or a help panel) is closed. */
export function claimLayer(close: () => void): void {
  if (active && active !== close) active();
  active = close;
}

/** Forgets `close` once its panel is closed or gone. */
export function releaseLayer(close: () => void): void {
  if (active === close) active = null;
}

/** Whether an element was focused by the keyboard (focus by a pointer press does not open hover help). */
export function focusVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}
