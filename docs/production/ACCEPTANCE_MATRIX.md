# Acceptance matrix

## Support contract

Typing Master is supported as a **desktop web application with a physical keyboard**.

### Required environments

| OS | Browsers | Policy |
|---|---|---|
| macOS | Safari and Chrome | Current stable and previous major release at RC test time |
| Windows 11 | Edge and Chrome | Current stable and previous major release at RC test time |
| macOS or Windows | Firefox | Current stable; required for standards diversity |

Required viewport/zoom cells:

- 1280×720 at 100% — minimum supported workspace.
- 1366×768 at 100% — common compact laptop.
- 1440×900 at 100% and 125% — primary design target.
- 1920×1080 at 100% and 150% — large desktop and enlarged text.
- One supported browser at 200% zoom — every action remains reachable without clipped content or trapped horizontal scrolling.

Required input cells:

- Physical QWERTY keyboard.
- Keyboard-only navigation with Tab, Shift+Tab, Enter, Space, Escape, Backspace, and browser refresh.
- Composition input sanity check so multi-character commits do not corrupt telemetry.
- System light/dark themes and reduced-motion preference.

Mobile, tablet, touch-only, alternate keyboard layouts, and browsers outside this matrix are not release blockers. The product must not advertise them as supported.

## Route inventory

There are 16 user-facing route patterns plus a not-found fallback.

| Route | Purpose | Critical states |
|---|---|---|
| `/` | Today dashboard and recommended next action | new, due review, lesson, benchmark, goal complete, empty history |
| `/welcome` | Two-step setup | first visit, skip, beginner, hunt-and-peck, touch typist |
| `/diagnostic` | Two-minute placement diagnostic | idle, running, paused, completed, interrupted/recovered |
| `/learn` | Course path | locked, active, mastered, placement credit, review due, complete |
| `/learn/:lessonId` | Lesson guidance and guided/extended work | invalid, locked, learning, transfer, review, complete |
| `/review/:lessonId` | Dedicated spaced-review entry for a previously mastered lesson | invalid, unavailable, scheduled, due; never silently replays the teaching lesson |
| `/review/:lessonId/session` | Short spaced-review retention session | due-only entry, cold recall, fresh transfer, refresh/recovery; source-lesson character boundary is mandatory |
| `/practice` | Presets and custom session builder | defaults, custom text, advanced controls, validation errors |
| `/practice/session` | Active practice and result flow | missing config, idle, countdown, typing, pause, recovery, results |
| `/tests` | Progress checks and proficiency assessments | no history, estimate only, official level, invalid attempts |
| `/tests/:testId` | Active benchmark | invalid ID, countdown, interruption, invalid result, valid result |
| `/insights` | Local performance evidence | empty, sparse, mature history, weak keys, no chart data |
| `/settings` | Profile, behavior, storage, backup, reset | guest, account, import/export, quota warning, sync error |
| `/account` | Sign-up, sign-in, status, sign-out | not configured, signed out, confirmation required, signed in, error |
| `/forgot-password` | Request reset | configured/unconfigured, valid email, service failure, neutral success |
| `/reset-password` | Set new password | loading, valid recovery, expired/missing token, mismatch, success |
| fallback | Recover from unknown route | useful explanation and path to Today |

## Critical learner journeys

Each mandatory journey must pass on Chrome/Windows and Safari/macOS. Journeys marked “cross-browser” also run on every browser in the support contract.

| ID | Journey | Start state | Required result | Coverage required |
|---|---|---|---|---|
| J-01 | First-time guest setup | empty browser storage | Profile and goal persist; learner reaches lesson 1 or diagnostic; refresh does not restart setup | automated + cross-browser manual |
| J-02 | Skip setup | empty browser storage | Safe beginner defaults are saved; Today has one obvious next action | automated + manual |
| J-03 | Diagnostic placement | beginner and verified touch-typist profiles | Interruption never grants credit; valid completion applies only allowed placement credit | automated + manual typing |
| J-04 | Guided lesson mastery | unlocked lesson | Exercises use allowed keys, distinct requirements are visible, mastery requires valid staged evidence, next lesson unlocks once | automated + cross-browser manual |
| J-05 | Spaced and cumulative review | mastered/due lesson and module checkpoint | The current course lesson remains the primary Home action while due reviews stay clearly visible as maintenance work; dedicated spaced review uses cold recall then fresh curriculum-safe transfer; only a valid accuracy-first review pass advances the interval once; failure remains due without relocking forward course progress | automated + manual |
| J-06 | Ready-made practice | history with weak keys | Generated text reflects recipe/evidence; session and result save; new text differs while preserving purpose | automated + manual |
| J-07 | Custom practice builder | guest and account | All supported purpose/content/goal options validate; custom text saves/deletes; long session has enough content | automated + manual |
| J-08 | Progress and proficiency assessments | no history and existing history | 1-minute result is estimate only; 3/5-minute valid tests classify within allowed level; invalid runs do not set bests/levels | automated + manual |
| J-09 | Targeted recovery and fresh transfer | failed lesson/practice/test/review | Exact mistakes are trained inside the source curriculum boundary; a failed spaced review can enter targeted recovery; only a separate fresh lesson/test/review reassessment can verify transfer or retention; route returns safely | automated + manual |
| J-10 | Pause, blur, refresh, and crash recovery | partially typed session | Hidden/blur pauses when enabled; refresh restores exact compatible work paused; complete/stale sessions do not revive | automated + cross-browser manual |
| J-11 | Guest persistence and reset | returning guest | Settings, history, mastery, and custom text survive refresh; confirmed reset removes all guest summaries/details/recovery state | automated + manual |
| J-12 | Export and import | mature guest/account data | Full backup downloads; valid import merges without discarding newer data; invalid/newer/large file fails safely | automated + manual file flow |
| J-13 | Sign-up with guest progress | mature guest data | Guest data moves once, account history is preserved, details migrate, guest data clears only after successful sync | automated + staging manual |
| J-14 | Sign-in and cross-device merge | account with divergent device state | No duplicate sessions; mastery evidence is unioned safely; newer local pending settings are not overwritten | automated + two-browser staging |
| J-15 | Automatic settings/session sync | signed-in online | Change saves locally immediately; cloud backup starts without a sync button; latest change made during a request gets a follow-up sync | automated + network-observed staging |
| J-16 | Offline practice and reconnect | signed-in then offline | Practice and settings remain usable/local; outbox persists; reconnect retries; no progress disappears or duplicates | automated + cross-browser network toggle |
| J-17 | Account switching | guest, Account A, Account B on one browser | Each local cache/outbox/detail scope remains isolated; sign-out never displays the prior account’s data | automated + staging manual |
| J-18 | Password recovery | signed-out account | Request is enumeration-safe; allowlisted link opens reset route; expired/used link fails clearly; new password works | automated URL unit + staging email flow |
| J-19 | Cloud account deletion | signed-in mature account | Re-authentication, explicit confirmation, complete server deletion, local cleanup, and safe failure recovery | required after implementation; staging only before RC |
| J-20 | Recoverable application error | injected render/storage/network failure | Learner sees a clear recovery action; saved progress remains intact; error reaches monitoring without typed text | automated + staging fault injection |

## Data-state matrix

| State | Expected behavior | Must prove |
|---|---|---|
| Fresh guest | Fully usable without Supabase | No network dependency for practice; onboarding persists |
| Returning guest | Local state restored | Correct version migration and no account data shown |
| Interrupted guest/account session | Exact compatible snapshot restored paused | Text, telemetry, elapsed time, and recipe identity match |
| Corrupt LocalStorage JSON | App remains operable and explains recovery | No crash loop; recovery/reset route available; diagnostic event recorded |
| IndexedDB unavailable | Compact progress still works; detail limitation is visible | Session completion cannot reject or disappear |
| Quota denied/full | Save failure is visible before the learner assumes success | Existing data remains readable; cleanup/export path works |
| Signed in, no cloud record | Local account data seeds cloud | No guest/account confusion and no duplicate migration |
| Signed in, cloud newer | Cloud data merges safely | Totals, attempts, mastery, settings, and custom text follow defined rules |
| Local mutation during initial pull | Mutation survives | Pending session and preference are queued after reconciliation |
| Local mutation during active push | New snapshot remains pending | Completed request cannot clear a newer revision |
| Offline with pending outbox | Local work continues | Queue survives refresh and bounded 1,000-ID compaction is explicit |
| Reconnect after failures | Retry occurs automatically | Backoff clears after success; no required manual sync action |
| Account A → sign-out → Account B | Complete isolation | LocalStorage, IndexedDB, recovery snapshot, outbox, and UI identity are isolated |
| Unsupported future backup | Import rejected | Current data remains unchanged and error is understandable |
| Cloud schema mismatch/RPC failure | Local state remains safe | Error is visible, retryable, monitored, and does not partially clear the outbox |

## Desktop UX pass criteria

For every primary route:

- One visually dominant next action; secondary choices do not compete.
- Main purpose is understandable in five seconds without scrolling.
- All controls have visible keyboard focus and a logical order.
- No action is hidden behind hover alone.
- No horizontal page scrolling at required viewport/zoom cells.
- Sticky headers, dialogs, dropdowns, and results do not obscure the typing target or focused control.
- Loading, empty, success, error, offline, and disabled states explain what happened and what to do.
- Typing begins only from deliberate focus/countdown, never from navigation keystrokes.
- Live metrics can be hidden; current character, correction rule, pause state, and completion remain clear.
- Results distinguish practice, estimate, valid assessment, and invalid assessment.

## Evidence format

Each matrix result records: release ID, date, OS/browser/version, viewport/zoom, data fixture, tester, pass/fail, defect ID, and screenshot/video/log link. A verbal “checked” is not acceptable evidence.

