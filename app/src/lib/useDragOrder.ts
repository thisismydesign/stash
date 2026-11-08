import { useRef, useState, type PointerEvent } from "react";

export type DragOrder = { from: number; to: number };

/**
 * Pointer-dragged reordering of items laid out along `axis`. Each item registers its element and spreads `handle(i)` on what is pressed to drag it; a press that moves a few pixels is a drag, and `onMove(from, to)` hears where the item was let go.
 */
export function useDragOrder(axis: "x" | "y", onMove: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<DragOrder>();
  const items = useRef<(HTMLElement | null)[]>([]);
  const press = useRef<{ from: number; at: number; rects: DOMRect[]; moved: boolean }>(undefined);
  // The click that follows a drag is not a click.
  const dragged = useRef(false);
  const pos = (e: PointerEvent) => (axis === "x" ? e.clientX : e.clientY);
  const middle = (r: DOMRect) => (axis === "x" ? r.left + r.width / 2 : r.top + r.height / 2);
  const targetOf = (p: number, from: number, rects: DOMRect[]) => {
    const before = rects.findIndex((r) => p < middle(r));
    if (before === -1) return rects.length - 1;
    return before > from ? before - 1 : before;
  };
  const start = (from: number) => (e: PointerEvent) => {
    if (e.button !== 0) return;
    const rects = items.current.map((el) => el?.getBoundingClientRect() ?? new DOMRect());
    press.current = { from, at: pos(e), rects, moved: false };
  };
  // The pointer is taken only once this is a drag, so a plain click still reaches what was pressed.
  const move = (e: PointerEvent) => {
    const p = press.current;
    if (!p) return;
    // A press let go elsewhere is over.
    if ((e.buttons & 1) === 0) return cancel();
    if (!p.moved && Math.abs(pos(e) - p.at) < 6) return;
    if (!p.moved) e.currentTarget.setPointerCapture(e.pointerId);
    p.moved = true;
    setDrag({ from: p.from, to: targetOf(pos(e), p.from, p.rects) });
  };
  const end = (e: PointerEvent) => {
    const p = press.current;
    press.current = undefined;
    setDrag(undefined);
    if (!p?.moved) return;
    dragged.current = true;
    setTimeout(() => (dragged.current = false), 0);
    const to = targetOf(pos(e), p.from, p.rects);
    if (to !== p.from) onMove(p.from, to);
  };
  const cancel = () => {
    press.current = undefined;
    setDrag(undefined);
  };
  return {
    drag,
    item: (i: number) => (el: HTMLElement | null) => {
      items.current[i] = el;
    },
    handle: (i: number) => ({
      onPointerDown: start(i),
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: cancel,
    }),
    /** True in the click right after a drag. */
    justDragged: () => dragged.current,
    /** The class an item wears while a drag is on: moving, or where it would land. */
    className: (i: number) =>
      !drag || drag.from === drag.to
        ? undefined
        : drag.from === i
          ? "drag-moving"
          : drag.to === i
            ? drag.to < drag.from
              ? "drag-before"
              : "drag-after"
            : undefined,
  };
}
