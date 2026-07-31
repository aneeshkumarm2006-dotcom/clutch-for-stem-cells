"use client";

/**
 * useComboboxNav — keyboard and open/close behaviour for a typeahead field.
 *
 * The header search and the hero's two fields all need the same combobox
 * mechanics (arrow keys that wrap, Home/End, a two-stage Escape, dismiss on
 * outside click) and they must behave identically, so it lives here once
 * instead of being reimplemented per field.
 *
 * Caller owns the option array and what selecting one does; this owns which
 * option is highlighted.
 */
import * as React from "react";

export interface ComboboxNavOptions<T> {
  /** Selectable options in draw order. A new identity resets the highlight. */
  options: readonly T[];
  onSelect: (option: T, index: number) => void;
  /** Enter with nothing highlighted (submit what was actually typed). */
  onSubmit: () => void;
  /** Escape on an already-closed menu. */
  onClear?: () => void;
}

export interface ComboboxNav<T> {
  active: number;
  setActive: React.Dispatch<React.SetStateAction<number>>;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Open *and* worth drawing. */
  listboxOpen: boolean;
  onKeyDown: (e: React.KeyboardEvent) => void;
  /** Choose an option: dismisses the menu, then runs the caller's `onSelect`. */
  select: (option: T, index: number) => void;
  /** Attach to the field wrapper so outside clicks can be detected. */
  rootRef: React.RefObject<HTMLDivElement>;
}

export function useComboboxNav<T>({
  options,
  onSelect,
  onSubmit,
  onClear,
}: ComboboxNavOptions<T>): ComboboxNav<T> {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const select = (option: T, index: number): void => {
    // Always dismiss first: every caller navigates or fills the field, and a
    // menu left open over the result is the one thing none of them want.
    setOpen(false);
    setActive(-1);
    onSelect(option, index);
  };

  // A highlight left over from the previous keystroke points at a row that is
  // no longer there, so Enter would open something the visitor never saw.
  React.useEffect(() => {
    setActive(-1);
  }, [options]);

  React.useEffect(() => {
    const dismissIfOutside = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    // `mousedown` covers clicking anywhere inert; `focusin` covers moving on by
    // keyboard or into a sibling field. Without the second one, tabbing from the
    // hero's term field to its location field left both menus open at once.
    document.addEventListener("mousedown", dismissIfOutside);
    document.addEventListener("focusin", dismissIfOutside);
    return () => {
      document.removeEventListener("mousedown", dismissIfOutside);
      document.removeEventListener("focusin", dismissIfOutside);
    };
  }, []);

  const listboxOpen = open && options.length > 0;

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!listboxOpen) {
          setOpen(true);
          return;
        }
        const step = e.key === "ArrowDown" ? 1 : -1;
        // Wrapping through -1 (the raw input) means a visitor can always get
        // back to what they typed without deleting the highlight by hand.
        setActive((a) => {
          const next = a + step;
          if (next < -1) return options.length - 1;
          if (next >= options.length) return -1;
          return next;
        });
        return;
      }
      case "Home":
        if (!listboxOpen) return;
        e.preventDefault();
        setActive(0);
        return;
      case "End":
        if (!listboxOpen) return;
        e.preventDefault();
        setActive(options.length - 1);
        return;
      case "Enter": {
        e.preventDefault();
        const option = active >= 0 ? options[active] : undefined;
        if (option !== undefined) select(option, active);
        else onSubmit();
        return;
      }
      case "Escape":
        // First Escape dismisses the menu, a second clears the field. Marking
        // the first one handled stops an enclosing overlay (the mobile search
        // panel) from closing out from under a menu the visitor was reading.
        if (listboxOpen) {
          e.preventDefault();
          setOpen(false);
        } else onClear?.();
        setActive(-1);
        return;
      case "Tab":
        setOpen(false);
        return;
      default:
    }
  };

  return {
    active,
    setActive,
    open,
    setOpen,
    listboxOpen,
    onKeyDown,
    select,
    rootRef,
  };
}
