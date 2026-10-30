# Install this fork in Obsidian

This is KVerder's extended fork of roovo's CardBoard plugin. The Community plugins listing installs the original plugin, so use the files from this repository's release.

1. Download `card-board-0.9.0.zip` from this repository's **Releases** page and unzip it.
2. In Obsidian, open **Settings → Community plugins**. If CardBoard is already enabled, turn it off while replacing its files.
3. Open your vault's folder in your file manager. Create `.obsidian/plugins/card-board/` if it does not exist. On systems that hide dot folders, enable hidden files.
4. Copy the ZIP's contents (`main.js`, `manifest.json`, `styles.css`, and `LICENSE`) into that folder. The runtime files must be directly inside `card-board/`, rather than inside another nested folder. If you already use CardBoard, preserve its `data.json` settings file.
5. Restart Obsidian, then enable **CardBoard** under **Settings → Community plugins**. This build requires Obsidian 1.5.7 or later.
6. Open CardBoard from the ribbon or Command palette. For status columns, choose a tag board and configure tags such as `status/todo` and `status/doing` in CardBoard's settings.

Your vault should contain:

```text
.obsidian/
  plugins/
    card-board/
      main.js
      manifest.json
      styles.css
      data.json       # retained existing settings, or created by Obsidian
```

## Use the extensions

- **Create:** choose **+ Add card** in a tag or Untagged column. Choose the destination Markdown note, task title, optional deadline, duration and urgency.
- **Move and reorder:** drag the grip on a card using a mouse, touch screen or pen. Drop above another card to reorder within a column, or into another tag or Untagged column to move it. The move button remains available. Manual order is saved per board and column; stable `^cb-...` block IDs are added to ordered tasks without rearranging note lines. The plugin updates the task's hashtags in the note. Completed cards must first be reopened using their checkbox.
- **Deadline:** write `due 31-12-26` or `due 31-12` in a task, or right-click a card to edit its deadline. The short form uses the current local year when parsed; two-digit years mean 2000–2099. Existing CardBoard, Tasks and Dataview date formats remain supported.
- **People and colours:** use the person button to add up to four people and choose each colour. The quick-select dropdown lists people assigned to tasks anywhere in the vault, including names entered directly in notes. Assignments are stored as separate `@assigned(Name)` tags. Two people split the card along its top-left to bottom-right diagonal; three use a top zone and two lower zones; four use the four triangles formed by both diagonals. Remove all people to unassign. The left border continues to show deadline timing.
- **Duration and urgency:** use the clock button. Enter remaining work in hours or working days, and optionally mark the task Urgent. One day means eight working hours. Notes use `@takes(4h)` or `@takes(1.5d)`; existing `@estimate(...)` tags remain readable.
- **Person tabs:** choose a person's tab to filter the current board or schedule to their cards, including shared tasks. **All people** restores the combined view.
- **Schedule:** choose **Smart schedule view**. The view has Monday–Friday columns and eight hours of capacity per person per day. Work starts today, splits across days and continues into later weeks. Use **Next week** to see overflow. Shared task durations are divided equally between assignees and each share is scheduled against that person's independent capacity.

- **Completion time:** completing a task without a duration opens a popup. Enter hours, or use Cancel, Escape, or click outside to accept 1 hour and complete the task.
- **Killian actual time:** completing a card in CardBoard assigned to `Killian` (case-insensitive) always prompts for actual hours. The estimate stays in `@takes(...)`; actual time is stored separately as `@spent(...)`. Actual time means Killian’s own hours, including on shared tasks. Cancel, Escape, or clicking outside records the estimate in hours, or 1 hour if none exists. In Killian’s Activity hours view, the cumulative comparison plots estimated and actual hours for dated completions with recorded actual time. Shared estimates are divided between people; Killian’s actual hours are not divided. Missing estimates use the stated 1-hour task default.
- **Activity:** choose **Activity view** to see completed-task counts and task hours per person across the whole vault, including notes excluded from boards. Switch between counts and hours, choose a person, and select heatmap days for their values. Task hours use the current duration, default to 1 hour when absent, and are divided equally for shared tasks. Each assignee receives one completed-task count. Editing durations updates the totals. Completed cards without completion dates count in totals but cannot appear on a daily heatmap. Subtasks are not separately counted as cards.

Example task:

```markdown
- [ ] Prepare report #status/todo due 31-12-26 @assigned(Alex Smith) @takes(1.5d) @urgent
```

The scheduler uses Urgent first, then earliest deadline, then shortest duration. Within each urgency group, undated tasks follow dated tasks. Tasks without estimates or assignees remain in separate lists. All allocations of a task finishing after its deadline receive a red background highlight and a late-completion label.

The schedule is a recalculated planning view; it does not rewrite due dates or track elapsed work automatically. Keep the remaining-work estimate up to date and mark completed tasks done. Today receives a full eight-hour planning allowance. The plan does not account for calendar meetings, holidays, dependencies or leave.

Note-level tags apply to all tasks in that note. If an inherited tag prevents a card from leaving its old column, the plugin explains the conflict and leaves the note unchanged. Resolve the note properties or move the task to a different note before retrying.

## Startup and indexing

CardBoard registers its controls during startup and indexes notes when a board is first opened or restored. Parsing runs in an embedded background Web Worker; no extra worker file is needed for installation. Initial indexing sends a single complete snapshot to the board rather than repainting for every note. Note reads are chunked and edits are debounced, with live changes reconciled before the first snapshot. Later board openings reuse the index for the current Obsidian session.

The first opening still reads Markdown notes across the vault so Activity can include the entire vault. The performance checks use synthetic data, not your own vault.
