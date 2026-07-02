# Accessibility Roadmap — BYUI CAN Mentor Connect

> **Target standard:** WCAG 2.1 Level AA (adopted 2026-07-01; published at `/accessibility`)
> **Owner:** Gabriel Dilworth (Program Owner / Developer)
> **Status legend:** ✅ done · 🔨 in progress · 📅 scheduled

## Current baseline (honest state, 2026-07-01)

Built with accessibility-conscious defaults from the project's UI
checklist (semantic HTML, visible focus states, ≥4.5:1 contrast targets,
375/768/1024px responsive layouts, no emoji-as-icons), but **no formal
WCAG audit has been completed** and keyboard-only coverage has not been
systematically verified. The roadmap below closes that gap.

## Milestones

| # | Milestone | Deliverable | Target |
|---|-----------|-------------|--------|
| 1 | ✅ Publish accessibility statement | Public `/accessibility` page: adopted standard, known limitations, reporting channel, contact | 2026-07 (done) |
| 2 | ✅ Document issue reporting & tracking | [issue-reporting.md](./issue-reporting.md) — channels, triage SLA, resolution priority | 2026-07 (done) |
| 3 | ✅ Accessibility in the development lifecycle | [sdlc-checklist.md](./sdlc-checklist.md) applied to every UI change | 2026-07 (done) |
| 4 | ✅ Automated accessibility checks | axe-core WCAG 2.1 AA assertions for all public pages in the Playwright suite (`tests/e2e/a11y.spec.ts`); full-surface scanner incl. authenticated + admin pages (`scripts/a11y-scan.mjs`) | 2026-07 (done, ahead of 2026-09-30 target) |
| 4b | ✅ First full-surface remediation | 2026-07-01 axe scan of all 28 pages found 2 violation classes (low-contrast small text; 4 unlabeled selects) — fixed same day; app now scans clean against axe WCAG 2.1 AA rules | 2026-07 (done) |
| 5 | 📅 Keyboard-only audit | Every core task completable with keyboard alone; fixes filed and closed for any failure | 2026-10-31 |
| 6 | 📅 Screen-reader pass | NVDA walkthrough of the 6 core flows; labels/landmarks/announcements fixed | 2026-11-30 |
| 7 | 📅 Contrast & zoom audit | Automated contrast portion complete (milestone 4b); manual 200% zoom usability check remains | 2026-11-30 |
| 8 | 📅 VPAT / ACR draft | WCAG 2.1 AA conformance report (self-assessment) published alongside the accessibility statement | 2026-12-19 |
| 9 | 📅 Third-party review decision | With BYU-Idaho: decide whether an external audit is required for the program's scope; schedule if so | 2027-Q1 |

## Standing commitments

- Accessibility barriers that block a core task are treated as **defects**,
  prioritized ahead of feature work (see issue-reporting.md).
- The SDLC checklist applies to **every** UI change from 2026-07-01 onward.
- This roadmap is reviewed monthly and re-dated honestly if milestones slip —
  stale roadmaps are worse than slow ones.
