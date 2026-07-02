# Accessibility in the Development Lifecycle

> **In force since:** 2026-07-01 · applies to every UI change (new component,
> page, or visual modification) before it ships.
> **Owner:** Gabriel Dilworth (Program Owner / Developer)

## Pre-delivery checklist (every UI change)

**Structure & semantics**
- [ ] Semantic HTML elements (`button`, `nav`, `main`, `label`, headings in order) — no clickable `div`s
- [ ] Every form input has an associated `label` (or `aria-label` where a visible label is impossible)
- [ ] Images/icons carry `alt` text or `aria-hidden` as appropriate; no emojis used as icons

**Keyboard & focus**
- [ ] Every interactive element reachable and operable by keyboard alone
- [ ] Visible focus state on all interactive elements (never `outline: none` without a replacement)
- [ ] Hover states have focus-state equivalents; `cursor-pointer` on all clickables
- [ ] Modals trap focus while open and restore it on close

**Visual**
- [ ] Text contrast ≥ 4.5:1 against its background (3:1 for large text)
- [ ] Information is never conveyed by color alone
- [ ] Layout verified at 375px, 768px, and 1024px widths
- [ ] Usable at 200% browser zoom

**States**
- [ ] All four UI states designed: loading, error, empty, success
- [ ] Errors are announced in text (not color/icon only) and associated with their field

## Verification tooling

- Playwright e2e suite covers the core flows; axe-core assertions are being
  added per the [roadmap](./roadmap.md) milestone 4 (target 2026-09-30).
- Manual keyboard spot-check is part of every UI review until the
  keyboard-only audit (milestone 5) establishes the full baseline.

## Escape hatch

If a change must ship with a known checklist failure, the failure is filed
via the [issue-reporting process](./issue-reporting.md) with a fix date —
silent exceptions are not permitted.
