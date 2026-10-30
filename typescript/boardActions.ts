import { App, Menu, Notice, normalizePath, parseFrontMatterTags, parseYaml, TFile } from 'obsidian';
import { NewCardModal } from './newCardModal';
import { AssigneeModal } from './assigneeModal';
import { PlanningModal } from './planningModal';
import { readPlanning, writePlanning } from './planning';
import { assigneesFromLine, assignPeopleLine, updatePeople, validatePerson } from './assignees';
import { ReorderRequest, prepareOrder, validateSnapshots, blockId, withBlockId } from './cardOrder';
import { FileFilter } from './fileFilter';
import { CardBoardPluginSettingsPostV11, TaskItem } from './types';
import { appendTask, applyTaskReplacements, BoardConfig, boardAllowsTask, insertBeforeBlockId,
         isTagDestination, lineTags, moveReplacements } from './cardEditing';

type CardLocation = { boardIndex: number; taskItem: TaskItem };
type BoardLocation = { boardIndex: number; columnIndex: number };

export class BoardActions {
  constructor(private app: App, private settings: () => CardBoardPluginSettingsPostV11,
              private fileFilter: FileFilter,
              private saveSettings: (settings: CardBoardPluginSettingsPostV11) => Promise<void>) {}

  assignCard(data: CardLocation & { people?: string[] }) {
    new AssigneeModal(this.app, this.settings().data.globalSettings.people || [],
      assigneesFromLine(data.taskItem.fields.originalLine), async assigned => {
        assigned.forEach(person => validatePerson(person.name, person.color));
        const file = this.app.vault.getAbstractFileByPath(data.taskItem.fields.filePath);
        if (!(file instanceof TFile)) throw new Error('The task note no longer exists.');
        const replacement = {
          lineNumber: data.taskItem.fields.lineNumber,
          originalLine: data.taskItem.fields.originalLine,
          newText: assignPeopleLine(data.taskItem.fields.originalLine, assigned.map(person => person.name))
        };
        // Check the card before saving its shared colour, then check again in the atomic write.
        applyTaskReplacements(await this.app.vault.read(file), [replacement], data.taskItem);
        const settings = this.settings();
        const people = assigned.reduce((people, person) => updatePeople(people, person.name, person.color), settings.data.globalSettings.people || []);
        await this.saveSettings({ ...settings, data: { ...settings.data,
          globalSettings: { ...settings.data.globalSettings, people } } });
        await this.app.vault.process(file, markdown => applyTaskReplacements(markdown, [replacement], data.taskItem));
      }, data.people || []).open();
  }

  private boardConfig(index: number): BoardConfig {
    return this.settings().data.boardConfigs[index];
  }

  editPlanning(data: CardLocation) {
    new PlanningModal(this.app, readPlanning(data.taskItem.fields.originalLine), async planning => {
      const file = this.app.vault.getAbstractFileByPath(data.taskItem.fields.filePath);
      if (!(file instanceof TFile)) throw new Error('The task note no longer exists.');
      const replacement = { lineNumber: data.taskItem.fields.lineNumber, originalLine: data.taskItem.fields.originalLine,
        newText: writePlanning(data.taskItem.fields.originalLine, planning) };
      await this.app.vault.process(file, markdown => applyTaskReplacements(markdown, [replacement], data.taskItem));
    }).open();
  }

  private inheritedTags(file: TFile): string[] {
    return (parseFrontMatterTags(this.app.metadataCache.getFileCache(file)?.frontmatter) || [])
      .map(tag => tag.replace(/^#/, ''));
  }

  private liveInheritedTags(markdown: string): string[] {
    const frontmatter = /^\s*---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
    if (!frontmatter) return [];
    try {
      return (parseFrontMatterTags(parseYaml(frontmatter[1])) || []).map(tag => tag.replace(/^#/, ''));
    } catch {
      return [];
    }
  }

  createCard(data: BoardLocation) {
    const board = this.boardConfig(data.boardIndex);
    const column = board?.columns[data.columnIndex];
    if (!column || !isTagDestination(column)) return;
    const vault = this.app.vault;
    const allowedFiles = vault.getMarkdownFiles().filter(file => this.fileFilter.isAllowed(file.path));
    const initialPath = allowedFiles.find(file => boardAllowsTask(board, file.path,
      [...this.inheritedTags(file), ...(column.tag === 'namedTag' ? [column.data.tag.replace(/\/$/, '')] : [])]))?.path || 'CardBoard.md';
    new NewCardModal(this.app, column.data.name, initialPath, async (path, title, due, planning) => {
      title = title.trim();
      if (!title || /[\r\n]/.test(title)) throw new Error('Enter a single-line task title.');
      // Validate before normalization, which can otherwise hide an absolute path.
      path = path.trim().replace(/\\/g, '/');
      if (!path || path.split('/').some(part => part === '..') || path.startsWith('/') || path.includes(':')) {
        throw new Error('Enter a note path inside your vault.');
      }
      path = normalizePath(path);
      if (!path.toLowerCase().endsWith('.md')) path += '.md';
      if (!this.fileFilter.isAllowed(path)) throw new Error('This note is excluded by the global CardBoard filters.');
      let line = '- [ ] ' + title;
      const dueText = due.trim();
      if (dueText) {
        if (!validPlainDue(dueText)) throw new Error('Enter a valid deadline as due dd-mm-yy or due dd-mm.');
        if (/(?:^|\s)(?:due \d|@due\(|📅|\[due::)/.test(title)) {
          throw new Error('Set the deadline in the title or the deadline field, rather than both.');
        }
        line = insertBeforeBlockId(line, dueText);
      }
      for (const match of Array.from(line.matchAll(/(?:^|\s)(due \d{2}-\d{2}(?:-\d{2})?)(?=$|\s)/g))) {
        if (!validPlainDue(match[1])) throw new Error('The task title contains an invalid deadline.');
      }
      if (planning.duration || planning.urgent) line = writePlanning(line, planning);
      const file = vault.getAbstractFileByPath(path);
      if (file && !(file instanceof TFile && file.extension === 'md')) throw new Error('Choose a Markdown note.');
      const inherited = file instanceof TFile ? this.inheritedTags(file) : [];
      if (column.tag === 'untagged' && (inherited.length || lineTags(line).length)) {
        throw new Error('An Untagged card needs a title and note without tags.');
      }
      if (column.tag === 'namedTag') {
        const tag = column.data.tag.replace(/^#/, '').replace(/\/$/, '');
        if (!lineTags(line).some(existing => existing.toLowerCase() === tag.toLowerCase())) {
          line = insertBeforeBlockId(line, '#' + tag);
        }
      }
      if (!boardAllowsTask(board, path, [...inherited, ...lineTags(line)])) {
        throw new Error('This task would be hidden by the board filters. Choose a matching note or add the required tags.');
      }
      const parent = path.slice(0, path.lastIndexOf('/'));
      if (path.includes('/') && !vault.getAbstractFileByPath(parent)) {
        throw new Error('The destination folder does not exist. Choose an existing folder.');
      }
      if (file instanceof TFile) {
        await vault.process(file, markdown => {
          const currentTags = this.liveInheritedTags(markdown);
          if ((column.tag === 'untagged' && currentTags.length) ||
              !boardAllowsTask(board, path, [...currentTags, ...lineTags(line)])) {
            throw new Error('The note properties changed and would hide this card. Choose a matching note.');
          }
          return appendTask(markdown, line);
        });
      } else {
        await vault.create(path, line + '\n');
      }
    }).open();
  }

  showMoveCardMenu(data: CardLocation) {
    const board = this.boardConfig(data.boardIndex);
    if (!board) return;
    const menu = new Menu();
    board.columns.forEach((column, columnIndex) => {
      if (isTagDestination(column)) menu.addItem(item => item.setTitle('Move to ' + column.data.name)
        .setIcon('move').onClick(() => this.moveCard({ ...data, columnIndex })));
    });
    // The action button owns keyboard focus, so the same menu works without dragging.
    const rect = document.activeElement?.getBoundingClientRect();
    menu.showAtPosition({ x: rect?.left || 100, y: rect?.bottom || 100 });
  }

  async reorderCard(data: ReorderRequest): Promise<void> {
    try {
      const board = this.boardConfig(data.boardIndex);
      const column = board?.columns[data.columnIndex];
      if (!column) throw new Error('The destination column no longer exists.');
      const moving = data.sourceColumnIndex !== data.columnIndex;
      if (moving && !isTagDestination(column)) throw new Error('Choose a tag or Untagged column.');
      const prepared = prepareOrder(data.columnTasks, data.taskItem, data.beforeTask, () => crypto.randomUUID());
      const paths = Array.from(new Set(prepared.tasks.map(task => task.fields.filePath)));
      const source = data.taskItem.fields.filePath;
      paths.sort((a, b) => Number(a === source) - Number(b === source));
      // Preflight every affected card before writing any anchors.
      for (const path of paths) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) throw new Error('A task note no longer exists.');
        validateSnapshots(await this.app.vault.read(file), prepared.tasks.filter(task => task.fields.filePath === path));
      }
      for (const path of paths) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) throw new Error('A task note no longer exists.');
        await this.app.vault.process(file, markdown => {
          const tasks = prepared.tasks.filter(task => task.fields.filePath === path);
          validateSnapshots(markdown, tasks);
          let replacements = prepared.replacements.filter((_, index) => prepared.tasks[index].fields.filePath === path);
          if (moving && path === source) {
            const inherited = this.liveInheritedTags(markdown);
            const moved = moveReplacements(data.taskItem, board.columns, column, inherited);
            if (!boardAllowsTask(board, path, [...inherited, ...lineTags(moved[0].newText)], moved.slice(1).flatMap(change => [...inherited, ...lineTags(change.newText)]))) {
              throw new Error('Moving this card would hide it because of the board filters.');
            }
            const anchor = replacements.find(change => change.lineNumber === data.taskItem.fields.lineNumber)!;
            moved[0].newText = withBlockId(moved[0].newText, () => blockId(anchor.newText)!.replace(/^cb-/, ''));
            replacements = [...replacements.filter(change => !moved.some(other => other.lineNumber === change.lineNumber)), ...moved];
          }
          return applyTaskReplacements(markdown, replacements);
        });
      }
      const current = this.settings();
      if (this.boardConfig(data.boardIndex)?.name !== board.name) throw new Error('Board settings changed. Try ordering again.');
      const cardOrder = (current.data.globalSettings.cardOrder || []).filter(order => order.board !== board.name || order.column !== column.data.name);
      cardOrder.push({ board: board.name, column: column.data.name, tasks: prepared.order });
      await this.saveSettings({ ...current, data: { ...current.data, globalSettings: { ...current.data.globalSettings, cardOrder } } });
    } catch (error) {
      new Notice(error instanceof Error ? error.message : 'Could not reorder card.');
    }
  }

  async moveCard(data: CardLocation & BoardLocation) {
    try {
      const board = this.boardConfig(data.boardIndex);
      const column = board?.columns[data.columnIndex];
      if (!column) throw new Error('The destination column no longer exists.');
      const file = this.app.vault.getAbstractFileByPath(data.taskItem.fields.filePath);
      if (!(file instanceof TFile)) throw new Error('The task note no longer exists.');
      await this.app.vault.process(file, markdown => {
        const inherited = this.liveInheritedTags(markdown);
        const replacements = moveReplacements(data.taskItem, board.columns, column, inherited);
        const tags = (index: number) => [...inherited, ...lineTags(replacements[index].newText)];
        if (!boardAllowsTask(board, file.path, tags(0), replacements.slice(1).flatMap((_, i) => tags(i + 1)))) {
          throw new Error('Moving this card would hide it because of the board filters. Update the filters first.');
        }
        return applyTaskReplacements(markdown, replacements, data.taskItem);
      });
    } catch (error) {
      new Notice(error instanceof Error ? error.message : 'Could not move card.');
    }
  }
}

export function validPlainDue(text: string, currentYear = new Date().getFullYear()): boolean {
  const match = /^due (\d{2})-(\d{2})(?:-(\d{2}))?$/.exec(text);
  if (!match) return false;
  const year = match[3] ? 2000 + Number(match[3]) : currentYear;
  const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
  return date.getFullYear() === year && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[1]);
}
