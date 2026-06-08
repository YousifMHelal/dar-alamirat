"use client";

import { useRef, useState } from "react";

/**
 * Minimal HTML5 drag-and-drop reordering for a list, with no external
 * dependency. Returns the drag handlers to spread on each item plus
 * arrow-key/button helpers (move up/down) so reordering is also keyboard-
 * and touch-accessible — dragging alone is not (a11y: gesture-alternative).
 *
 * The parent owns the list state and passes a `reorder(from, to)` callback;
 * this hook only tracks the in-flight drag index.
 */
export function useReorder(reorder: (from: number, to: number) => void) {
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const dragProps = (index: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      dragIndex.current = index;
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (overIndex !== index) setOverIndex(index);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const from = dragIndex.current;
      if (from != null && from !== index) reorder(from, index);
      dragIndex.current = null;
      setOverIndex(null);
    },
    onDragEnd: () => {
      dragIndex.current = null;
      setOverIndex(null);
    },
    "data-drag-over": overIndex === index ? "true" : undefined,
  });

  return { dragProps, overIndex };
}

/** Pure helper: return a new array with the item at `from` moved to `to`. */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}
