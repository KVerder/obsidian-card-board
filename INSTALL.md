# Install this fork in Obsidian

This is KVerder's extended fork of roovo's CardBoard plugin. The Community plugins listing installs the original plugin, so use the files from this repository's release.

1. Download `card-board-0.8.0.zip` from this repository's **Releases** page and unzip it.
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
- **Move:** drag a card into another tag or Untagged column, or use its move button. The plugin updates the task's hashtags in the note. Completed cards must first be reopened using their checkbox.
- **Deadline:** write `due 31-12-26` or `due 31-12` in a task, or right-click a card to edit its deadline. The short form uses the current local year when parsed; two-digit years mean 2000–2099. Existing CardBoard, Tasks and Dataview date formats remain supported.
- **Person and colour:** use the person button on a card. Enter a name and choose a colour. The selected colour applies to every card assigned to that person. Leave the name blank to unassign. The left border continues to show deadline timing.
- **Duration and urgency:** use the clock button. Enter remaining work in hours or working days, and optionally mark the task Urgent. One day means eight working hours.
- **Person tabs:** choose a person's tab to filter the current board or schedule to their cards. **All people** restores the combined view.
- **Schedule:** choose **Smart schedule view**. The view has Monday–Friday columns and eight hours of capacity per person per day. Work starts today, splits across days and continues into later weeks. Use **Next week** to see overflow.

Example task:

```markdown
- [ ] Prepare report #status/todo due 31-12-26 @assigned(Alex Smith) @estimate(1.5d) @urgent
```

The scheduler uses Urgent first, then earliest deadline, then shortest duration. Within each urgency group, undated tasks follow dated tasks. Tasks without estimates or assignees remain in separate lists. All allocations of a task finishing after its deadline receive a red background highlight and a late-completion label.

The schedule is a recalculated planning view; it does not rewrite due dates or track elapsed work automatically. Keep the remaining-work estimate up to date and mark completed tasks done. Today receives a full eight-hour planning allowance. The plan does not account for calendar meetings, holidays, dependencies or leave.

Note-level tags apply to all tasks in that note. If an inherited tag prevents a card from leaving its old column, the plugin explains the conflict and leaves the note unchanged. Resolve the note properties or move the task to a different note before retrying.
