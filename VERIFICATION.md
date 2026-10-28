# Test and revision record

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
