const mockSaves: { kind: string; save: (...args: any[]) => Promise<void> }[] = [];
const mockNotices: string[] = [];

jest.mock('obsidian', () => ({
  TFile: class { extension = 'md'; constructor(public path: string) {} },
  Notice: class { constructor(message: string) { mockNotices.push(message); } },
  normalizePath: (path: string) => path.replace(/\/+/g, '/'),
  parseYaml: (text: string) => ({ tags: /tags:\s*\[([^\]]*)\]/.exec(text)?.[1].split(',').map(tag => tag.trim()) || [] }),
  parseFrontMatterTags: (frontmatter: any) => (frontmatter?.tags || []).map((tag: string) => '#' + tag),
  Menu: class {}
}), { virtual: true });
jest.mock('../typescript/newCardModal', () => ({ NewCardModal: class {
  constructor(_app: any, _column: any, _path: any, save: any) { mockSaves.push({ kind: 'create', save }); }
  open() {}
} }));
jest.mock('../typescript/assigneeModal', () => ({ AssigneeModal: class {
  constructor(_app: any, _people: any, _name: any, save: any) { mockSaves.push({ kind: 'assign', save }); }
  open() {}
} }));
jest.mock('../typescript/planningModal', () => ({ PlanningModal: class {
  constructor(_app: any, _initial: any, save: any) { mockSaves.push({ kind: 'planning', save }); }
  open() {}
} }));

import { TFile } from 'obsidian';
import { BoardActions, validPlainDue } from '../typescript/boardActions';
import { FileFilter } from '../typescript/fileFilter';
import { TaskItem } from '../typescript/types';

function fixture(initial = '# Tasks\r\n- [ ] Work #status/todo\r\n') {
  let markdown = initial;
  const file = new (TFile as any)('Tasks.md');
  const app: any = { metadataCache: { getFileCache: () => ({}) }, vault: {
    getMarkdownFiles: () => [file], getAbstractFileByPath: (path: string) => path === file.path ? file : null,
    read: async () => markdown,
    process: async (_file: any, change: (content: string) => string) => { markdown = change(markdown); },
    create: async () => { throw new Error('Unexpected new file'); }
  } };
  let settings: any = { version: '0.13.0', data: { globalSettings: { people: [] }, boardConfigs: [{
    name: 'Team', filters: [], filterPolarity: 'Allow', filterScope: 'Both', showColumnTags: true, showFilteredTags: true,
    columns: [{ tag: 'namedTag', data: { name: 'Todo', tag: 'status/todo', collapsed: false } },
      { tag: 'namedTag', data: { name: 'Doing', tag: 'status/doing', collapsed: false } }]
  }] } };
  const actions = new BoardActions(app, () => settings, new FileFilter([]), async next => { settings = next; });
  const originalLine = '- [ ] Work #status/todo';
  const task: TaskItem = { fields: {
    originalLine, originalBlock: originalLine, lineNumber: initial.split(/\r?\n/).indexOf(originalLine) + 1,
    filePath: 'Tasks.md', completion: { tag: 'Incomplete' }, autoComplete: { tag: 'NotSpecifed' },
    contents: [], dueFile: null, dueTag: { tag: 'NotSet' }, notes: '', tags: ['status/todo'], title: ['Work']
  }, subFields: [] };
  return { actions, task, markdown: () => markdown, replace: (value: string) => markdown = value, settings: () => settings };
}

beforeEach(() => { mockSaves.length = 0; mockNotices.length = 0; });

test('board creation appends a tagged task with deadline, duration and urgency to the chosen note', async () => {
  const state = fixture();
  state.actions.createCard({ boardIndex: 0, columnIndex: 0 });
  await mockSaves[0].save('Tasks.md', 'New work', 'due 31-12-26', { duration: '1.5', unit: 'd', urgent: true });
  expect(state.markdown()).toContain('\r\n\r\n- [ ] New work due 31-12-26 @estimate(1.5d) @urgent #status/todo\r\n');
});

test('creation rejects an invalid date and an escaping note path without writing', async () => {
  const state = fixture();
  const before = state.markdown();
  state.actions.createCard({ boardIndex: 0, columnIndex: 0 });
  await expect(mockSaves[0].save('Tasks.md', 'New', 'due 31-02-26', {})).rejects.toThrow('deadline');
  await expect(mockSaves[0].save('../Elsewhere.md', 'New', '', {})).rejects.toThrow('inside your vault');
  expect(state.markdown()).toBe(before);
});

test('moving a card writes its new status and preserves the note newline style', async () => {
  const state = fixture();
  await state.actions.moveCard({ boardIndex: 0, columnIndex: 1, taskItem: state.task });
  expect(state.markdown()).toContain('#status/doing\r\n');
  expect(state.markdown()).not.toContain('#status/todo');
  expect(mockNotices).toEqual([]);
});

test('a stale card is rejected without overwriting a newer note edit', async () => {
  const state = fixture();
  state.replace('# Tasks\n- [ ] Changed elsewhere\n');
  await state.actions.moveCard({ boardIndex: 0, columnIndex: 1, taskItem: state.task });
  expect(state.markdown()).toContain('Changed elsewhere');
  expect(mockNotices[0]).toContain('changed');
});

test('live inherited tags block an unsafe move even when the metadata cache is stale', async () => {
  const state = fixture('---\ntags: [status/todo]\n---\n- [ ] Work #status/todo\n');
  const before = state.markdown();
  await state.actions.moveCard({ boardIndex: 0, columnIndex: 1, taskItem: state.task });
  expect(state.markdown()).toBe(before);
  expect(mockNotices[0]).toContain('inherits tags');
});

test('assignment saves both task metadata and the shared person colour', async () => {
  const state = fixture();
  state.actions.assignCard({ boardIndex: 0, taskItem: state.task });
  await mockSaves[0].save('Alex Smith', '#112233');
  expect(state.markdown()).toContain('@assigned(Alex Smith)');
  expect(state.settings().data.globalSettings.people).toEqual([{ name: 'Alex Smith', color: '#112233' }]);
});

test('editing planning fields persists an estimate and urgent flag on the task', async () => {
  const state = fixture();
  state.actions.editPlanning({ boardIndex: 0, taskItem: state.task });
  await mockSaves[0].save({ duration: '2.5', unit: 'h', urgent: true });
  expect(state.markdown()).toContain('@estimate(2.5h) @urgent');
});

test('date validation agrees with leap-year and omitted-year rules', () => {
  expect(validPlainDue('due 29-02', 2024)).toBe(true);
  expect(validPlainDue('due 29-02', 2026)).toBe(false);
  expect(validPlainDue('due 31-12-27', 2026)).toBe(true);
});
