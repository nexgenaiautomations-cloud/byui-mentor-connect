# Admin issue reports (all admins notified, acknowledgement required)

Requested by Dave Harrell (ICAN App Teams chat, 2026-11-09):
> For any "report an issue", all admins receive all issues, and they popup for
> all admins. The admin has to click on a button saying that they have seen
> the issue. There is also a tab for admins of reported issues sorted in
> descending order with the most recent on top.

Goal: every reported issue (IT, mentor, mentee, other) reaches every admin and
leaves a durable record of who saw it, when, and who addressed it, so
responsibility sits with the program's admins, not the developer.

## Behaviour
- **Report** (`POST /api/issues`, any signed-in user): saves the issue,
  writes an `ISSUE_REPORTED` audit event, and emails **every admin**
  (`user.is_admin = true`) plus the optional `ISSUE_REPORT_TO` inbox.
- **Popup**: whenever an admin loads any app page, every issue that admin
  has not yet acknowledged opens in a blocking modal (oldest first). There is no
  close button and Escape does not dismiss it. The admin must choose:
  - **I've seen this**: records a receipt (admin, time).
  - **Mark addressed** (optional note): records a receipt and sets the issue
    status to `addressed` (who, when, note).
  Each admin acknowledges on their own; one admin addressing an issue does not
  clear it for the others, who still must confirm they saw it.
- **Issues tab** (`/admin/issues`, admins only): every issue, newest first,
  filterable by category and status. Each row shows the reporter, role,
  message, which admins have seen it (with times), which have not yet,
  and who addressed it. Admins can mark seen/addressed from the page too.
- **Audit**: `ISSUE_REPORTED`, `ADMIN_ACKNOWLEDGED_ISSUE`,
  `ADMIN_ADDRESSED_ISSUE` events (metadata: issue id + category only, no
  free-text message, per the audit-log safety invariants).

## Data
- `issue_report` + `status` (`open` | `addressed`, default `open`),
  `addressed_at`, `addressed_by_id`, `resolution_note`.
- New `issue_report_receipt` (`issue_id`, `admin_id`, `seen_at`), PK on both
  ids, cascade on delete.
- `audit_event_type` enum + the three values above.

## Out of scope
- Per-school scoping of admins (Dave asked for all admins).
