"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

// Open dialogs, most recent last. Only the topmost one handles Tab/Escape, so
// two dialogs open at once (say a request popup and the profile reminder)
// don't fight over focus.
const stack: object[] = [];

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("inert") && el.getAttribute("aria-hidden") !== "true"
  );
}

// Keyboard behaviour every modal dialog needs (WCAG 2.1.2, 2.4.3, 4.1.2):
//  - on open, focus moves into the dialog (an [autofocus]/[data-autofocus]
//    element if there is one, else the first focusable, else the dialog);
//  - Tab and Shift+Tab cycle inside the dialog;
//  - Escape calls onClose (omit onClose for dialogs that must not close
//    that way, such as an acknowledgement-required alert);
//  - on close, focus returns to whatever opened the dialog.
// Attach the returned ref (or pass your own) to the element with role="dialog".
export function useDialogFocus<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose?: () => void,
  existingRef?: RefObject<T | null>
): RefObject<T | null> {
  const ownRef = useRef<T | null>(null);
  const ref = existingRef ?? ownRef;
  // Latest onClose without re-running the effect (parents pass inline closures).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const token = {};
    stack.push(token);
    const opener = document.activeElement as HTMLElement | null;
    const root = ref.current;

    if (root) {
      const preferred = root.querySelector<HTMLElement>("[autofocus], [data-autofocus]");
      const target = preferred ?? focusables(root)[0] ?? root;
      if (target === root && !root.hasAttribute("tabindex")) root.setAttribute("tabindex", "-1");
      if (!root.contains(document.activeElement)) target.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      const el = ref.current;
      if (!el || stack[stack.length - 1] !== token) return;
      if (e.key === "Escape" && onCloseRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables(el);
      if (items.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !el.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !el.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      const at = stack.indexOf(token);
      if (at !== -1) stack.splice(at, 1);
      // Give focus back to the control that opened the dialog, if it still exists.
      if (opener && opener.isConnected && typeof opener.focus === "function") {
        opener.focus();
      }
    };
  }, [open, ref]);

  return ref;
}
