# Non-functional production gates

These budgets are release requirements, not current claims. Measurements must use a production build served from staging on representative hardware.

## Performance budgets

### Build budgets

| Asset | Budget | Current baseline |
|---|---:|---:|
| Initial application JavaScript | ≤ 150 kB gzip | 132.70 kB |
| Application CSS | ≤ 15 kB gzip | 11.23 kB |
| Largest content/data chunk | ≤ 45 kB gzip | 37.80 kB |
| Largest non-entry shared chunk | ≤ 60 kB gzip | 52.00 kB |

Any budget increase requires a written reason and a measured user benefit. Build success alone does not prove runtime performance.

### Runtime budgets

| Measure | Production gate |
|---|---|
| Cold route becomes usable | ≤ 2.5 s at p75 on the agreed representative broadband profile |
| Warm route navigation | ≤ 500 ms at p75 |
| Physical key to visual update | ≤ 50 ms at p95; no accepted keystroke lost or reordered |
| Typing-session start after countdown | ≤ 100 ms |
| Timer drift | ≤ 250 ms over a five-minute active session; paused/hidden time excluded correctly |
| Long session | 20 minutes at 120 WPM-equivalent input without growing DOM, input lag, crash, or incorrect completion |
| Result calculation | ≤ 250 ms after completion at p95 |
| Local summary save | ≤ 100 ms at p95 with 1,000 compact attempts |
| Automatic sync indication | Local save immediate; backup begins within 1 s while online and settled |

Measure key-to-paint with browser performance tooling or a deterministic harness; event-handler duration alone is insufficient.

## Reliability and data integrity

- A completed valid session is recorded once locally and at most once in cloud aggregates for its client session ID.
- Refresh, route exit, process close, and browser crash recovery never convert an incomplete run into a valid assessment.
- Sync success cannot clear changes created after that sync began.
- Guest migration is idempotent per account and guest-data fingerprint.
- Partial cloud failures retain pending session IDs and snapshot state.
- Account switching exposes zero data from another account in UI, LocalStorage scope, IndexedDB scope, recovery keys, or outbox.
- Import either completes with validated merged data or leaves the prior data unchanged.
- No migration reduces completed lesson/mastery evidence unless an explicit curriculum correction is versioned and communicated.

Operational targets after monitoring exists:

- ≥ 99.9% of local session-completion writes succeed on supported browsers, excluding browser-enforced exhausted storage after a visible warning.
- ≥ 99% of online automatic-sync attempts succeed within five minutes.
- P0 alerts reach the release owner within five minutes; P1 alerts within 30 minutes.
- Recovery objectives are recorded and proven by drill before RC; provisional targets are RPO ≤ 24 hours for cloud backup and RTO ≤ 4 hours for service restoration.

## Security gates

- `npm audit --omit=dev` has zero unresolved critical/high findings, or every exception has evidence of non-applicability, compensating controls, an owner, and an expiry before the next release.
- The lockfile is committed and installs are deterministic in CI.
- No service-role key, database password, access token, or `.env.local` is committed or embedded in the built client.
- Every user-data table has RLS enabled and ownership policies tested for select/insert/update/delete against anonymous, owner, and second-user sessions.
- RPC functions validate ownership server-side and expose execute permission only to intended roles.
- Password reset and auth redirects use exact staging/production allowlists.
- Production serves HTTPS with HSTS and explicit CSP, frame-ancestors, MIME-sniffing, referrer, and permissions policies.
- User-provided custom text is rendered as text, never interpreted HTML; import data is bounded and normalised.
- Error and monitoring payloads exclude passwords, auth tokens, raw typed text, custom text, and complete imported backups.
- Account deletion requires recent authentication, explicit confirmation, server-side cascade checks, local cleanup, and an auditable failure state.

## Privacy and data-control gates

Before RC, publish a reviewed inventory covering:

- Local compact profile/settings/progress and up to 1,000 attempt summaries.
- Local IndexedDB detailed attempts, currently pruned toward the latest 200.
- Active-session recovery snapshots retained for at most 24 hours when compatible.
- Cloud profile, settings, progress, lesson mastery, session summary/aggregates, daily activity, skill aggregates, sync state, and saved custom-text policy.
- What is deliberately excluded from cloud payloads, including raw typed text.
- Retention, export, deletion, support contact, incident contact, and account closure behavior.

Product copy, privacy text, database behavior, and monitoring payloads must agree.

## Accessibility gate

Target: WCAG 2.2 AA for supported desktop journeys.

- Complete all critical journeys using keyboard only.
- Focus is visible, logical, restored after modal/expansion changes, and moved appropriately on route/results changes.
- Semantic names, instructions, status, and errors are available to a screen reader without duplicate live announcements.
- Text and interactive contrast meet AA in light/dark themes and all status states.
- At 200% zoom, content reflows or remains operable without clipped controls or two-dimensional page scrolling.
- Reduced motion removes non-essential animation; color is never the only state cue.
- Countdown, pause, correction mode, expected character, result validity, and errors remain understandable without animation or sound.

Automated scanning is required but cannot replace keyboard and screen-reader journey tests.

## Observability gate

Production monitoring must provide:

- Client release/build ID on every event.
- Route-level crashes and unhandled promise rejections.
- Auth initialization and recovery failures without identifiers beyond an approved pseudonymous ID.
- Local save, IndexedDB, quota, import, sync pull/push/RPC, and retry-exhaustion failures.
- Deployment health, availability, and asset-loading failures.
- Dashboards and alert thresholds with named primary and backup owners.
- A tested kill/rollback decision path and a way to distinguish new-release errors from existing ones.

Never send raw typing passages, typed text, custom text, email addresses, passwords, tokens, or backup bodies to monitoring.

## Exit evidence

The measurement record includes build ID, commit ID, environment, OS, browser/version, device CPU/RAM, viewport/zoom, network profile, tool/method, sample count, p50/p75/p95 where relevant, raw artifact link, result, and approver.

