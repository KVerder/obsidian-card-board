# Test and revision record

## Release 0.9.0 - 2026-10-30

All requested features are implemented. Actual time uses `@spent(...)`; estimates remain in `@takes(...)`, with legacy `@estimate(...)` input supported. Killian's actual hours are his own, not divided for shared tasks. Dismissing his popup records the estimate, or 1 hour if absent. Shared estimates and scheduled workloads are divided equally. The assignment dropdown receives current assignees across the full vault, including people defined directly in note tags.

### Test and revision rounds

1. The initial extension round passed 1,686 Elm tests and 59 TypeScript tests. Corrected old expectations to use `@takes(...)`, preserved legacy estimates, and added stable ordering and shared-person metadata.
2. The completion and scheduling round passed 1,690 Elm tests and 66 TypeScript tests. Verified Killian's estimate preservation, own-hours accounting, dismissal defaults, cumulative comparison, independent shared scheduling and full-vault activity arithmetic. Browser revisions corrected coordinate targeting and assertions that had accidentally included icon polygons.
3. The efficiency review and final round passed **1,691 Elm tests** and **70 TypeScript tests**. TypeScript checking, the compiled browser interaction suite and the production build passed. The production-bundle browser test exercises the actual embedded worker against a fixture vault, verifies zero note reads before opening CardBoard, then verifies all 32 notes are read and all 32 tasks are delivered. Separate background tests parse 2,000 tasks while UI timers continue running, with no per-note startup `tasksAdded` messages.

The Linux CI browser check exposed a case-sensitive expectation for person labels; the assertion now checks the case-insensitive identities used by the plugin.

Browser checks cover mouse and CDP touch input, within-column ordering, cross-column hashtag updates, stable anchors and restored order after reload, two/three/four-person colour geometry, deadline borders, current-assignee quick selection, person filters, completion entry/Cancel/backdrop/Escape, activity totals and heatmap selection, Killian's two cumulative series, week navigation and a narrow viewport.

### Efficiency review: findings and fixes

- **UI-thread parsing:** Elm's `Platform.worker` was running inside the main renderer rather than a browser Worker. Parsing now runs in a real Web Worker, embedded in `main.js` as source text. Installation still requires only the usual three runtime files.
- **Unnecessary startup indexing:** startup previously read notes even when CardBoard was closed. Controls now register immediately and indexing starts on first board opening or workspace restoration. Parsed data is reused for the Obsidian session.
- **Development-mode production output:** production Elm compilation now uses `optimize: true`. Profiling the previous output found heavy character/equality overhead in parser predicates.
- **Repeated collection copies and updates:** initial tasks accumulate as chunks and flatten once; initial per-file messages are suppressed, and the first board snapshot is awaited explicitly. Chunked reads, worker barriers and debounced edits bound queued work. Changes during scanning are reconciled against current note text.
- **Redundant presentation work:** inactive boards are not rendered; Markdown output is cached per element and hover handlers are registered once. Analytics aggregate tasks by day/person using dictionaries instead of scanning the full list for every calendar cell. Ordered-card lookup uses dictionary ranks and skips anchoring lookups when no manual order exists.
- **Data correctness and lifecycle:** ordering survives line shifts and note/folder path changes; stale-note safeguards remain atomic. Deletion now uses exact atomic replacements. Startup edits, restored views and worker disposal have regression coverage. A person literally named Unassigned is no longer merged with unassigned tasks. Palette/order saves no longer rebuild unchanged command registrations.

### Synthetic parser timing

One controlled run on the same machine and synthetic input, ten top-level tasks per note. The baseline uses the previous worker accumulation and unoptimized compiler settings with the same task parser; the updated build uses chunked accumulation and optimized Elm. These are parser/index timings, excluding actual disk reads, board layout and Obsidian startup.

| Notes | Tasks | Baseline | Updated |
| --- | --- | --- | --- |
| 250 | 2,500 | 1.829 s | 0.281 s |
| 1,000 | 10,000 | 7.082 s | 0.865 s |
| 2,000 | 20,000 | 14.249 s | 1.492 s |

The 20,000-task case was about 9.6 times faster in this run. This is not a measurement of the user's vault, and timings vary with machine load. The startup adapter and production browser checks separately verify zero note reads when no board requests data. A restored/open board still requires a first full-vault scan.

Reproduce updated parser timing after compiling `src/Worker.elm` with `--optimize --output=elm-stuff/worker-after.js`, then run `scripts/benchmark-index.cjs` with `BENCH_WORKER=elm-stuff/worker-after.js`. `BENCH_FILES` accepts a JSON list of note counts.

Synthetic browser screenshots: [activity heatmap](images/activity.png), [Killian estimate feedback](images/estimate-feedback.png), [four-person card](images/shared-card.png).

### Verification limits

This was a focused review by the implementing assistant, not an independent human review. Browser tests use synthetic Markdown, a fixture vault, and simulated Obsidian API/modal primitives; the production test does load the actual optimized plugin bundle and its real embedded Worker. No physical touchscreen test or live-vault acceptance/performance measurement is claimed.

## Previous release

Release: 0.8.0. Verification date: 2026-10-28.

These were automated tests and AI code/visual reviews. No human review or live Obsidian-vault acceptance test is claimed.

## Round 1 — implementation and regression checks

- Compiled the complete Elm board and worker; generated their TypeScript port definitions.
- Passed 38 TypeScript tests covering status-tag rewrites, subtask handling, block IDs, CRLF preservation, stale snapshots, board filters, person colours and planning metadata.
- Ran 1,678 Elm tests: 1,677 passed; one old TypeScript-schema expectation did not include the new optional year context.
- Revised that expectation and the legacy settings fixtures. Tightened the Urgent marker's token boundary. Refreshed generated interfaces after the metadata extensions.

## Round 2 — browser interactions and revisions

- All 1,678 Elm tests passed.
- Ran the compiled Elm board and parser worker in headless Microsoft Edge with synthetic Markdown tasks and simulated Obsidian ports.
- The browser found that selected person colours fell back to generated defaults because Elm's ordinary style helper did not set CSS custom properties. Revised the palette rendering to use validated inline custom properties.
- Verified person tabs, shared colours, deadline-border classification, create/assign/planning commands, native card drag/drop, five weekday columns, split allocations, late highlighting, missing-estimate/assignee lists, week navigation and a 480-pixel viewport.
- Revised the browser harness to wait for asynchronous Elm rendering and to close its own browser process explicitly.

## Round 3 — final regression, data safety and release checks

- All **1,679 Elm tests** passed with `--fuzz 100 --seed 20261028`.
- All **46 TypeScript tests** passed across five suites. Added API-adapter tests for actual note-text updates from board creation, movement, assignment and planning controls, plus invalid dates, escaping paths and stale edits.
- Revised move/create writes to recheck live note properties inside the atomic vault update instead of trusting a potentially stale metadata cache.
- Revised assigned-card title contrast for dark person colours. Browser checks verified palette changes and readable foreground text while the deadline border retained its own colour.
- Sorted combined-person daily allocations by the same urgency/deadline/duration priority as scheduling, and added a regression test.
- Verified generated interfaces with `tsc --noEmit` and checked Elm formatting.
- Repeated the browser interaction suite successfully against the final sources.
- Production webpack build passed and emitted a minimized plugin bundle. A Node VM check loaded that bundle with an API stub and verified its exported plugin class.
- Validated the release ZIP, its runtime filenames, plugin ID/version, archive integrity and SHA-256 checksums. The ZIP also includes the upstream MIT license.

## Boundaries

The browser fixture uses the real compiled Elm UI and parsing worker, with text rendering and Obsidian API calls simulated. Vault-write tests use an in-memory API adapter. The production plugin compiles against the Obsidian 1.5.7 API types; installation into a real vault remains a user acceptance check.

The scheduling rule is a deterministic greedy priority queue per person. It does not prove that a late task is impossible under every other ordering. It provides the result under the selected Urgent/deadline/duration rule, with full eight-hour planning days, split work and no automatic progress tracking.

## Reproduce

```sh
npm ci
npm run generate
npm run generate-worker
npx elm-format src tests --validate
npx tsc --noEmit
npm test -- --fuzz 100 --seed 20261028
npm run test-ts -- --runInBand
npx playwright install chromium
npm run test-browser
npm run build
```

The browser script uses installed Microsoft Edge on Windows and Playwright Chromium elsewhere. `BROWSER_CHANNEL` can select another installed Chromium channel. On Windows ARM, Elm's x64 tools may require execution outside restricted sandbox isolation. Local verification used a temporary build copy outside Box to avoid sync-folder I/O delays.
