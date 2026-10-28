import { appendTask, applyTaskReplacements, BoardColumn, BoardConfig, boardAllowsTask,
         insertBeforeBlockId, matchesTag, moveReplacements } from '../typescript/cardEditing';
import { TaskItem, TaskItemFields } from '../typescript/types';

const todo: BoardColumn = { tag: 'namedTag', data: { name: 'Todo', tag: 'status/todo', collapsed: false } };
const doing: BoardColumn = { tag: 'namedTag', data: { name: 'Doing', tag: 'status/doing', collapsed: false } };
const untagged: BoardColumn = { tag: 'untagged', data: { name: 'Untagged', collapsed: false } };
const columns = [todo, doing, untagged];
const fields = (line: string, lineNumber: number): TaskItemFields => ({
  originalLine: line, lineNumber, completion: { tag: 'Incomplete' }, filePath: 'Projects/tasks.md',
  autoComplete: { tag: 'NotSpecifed' }, contents: [], dueFile: null, dueTag: { tag: 'NotSet' },
  notes: '', originalBlock: line, tags: [], title: ['Task']
});
const task = (line = '- [ ] Work #status/todo #client due 31-12-26 ^work'): TaskItem => ({
  fields: fields(line, 2), subFields: []
});
const board: BoardConfig = { columns, filters: [], filterPolarity: 'Allow', filterScope: 'Both',
  name: 'Board', showColumnTags: true, showFilteredTags: true };

test('a move replaces the status tag while preserving due text, unrelated tags and block ID', () => {
  const replacement = moveReplacements(task(), columns, doing, [])[0];
  expect(replacement.newText).toContain('#status/doing ^work');
  expect(replacement.newText).not.toContain('#status/todo');
  expect(replacement.newText).toContain('#client due 31-12-26');
});

test('moving an untagged task adds the destination tag without changing its title', () => {
  expect(moveReplacements(task('- [ ] Work'), columns, doing, [])[0].newText).toBe('- [ ] Work #status/doing');
});

test('nested column matching is case insensitive and respects exact tags and path boundaries', () => {
  expect(matchesTag('STATUS/', 'status/todo')).toBe(true);
  expect(matchesTag('status/', 'status')).toBe(true);
  expect(matchesTag('status/', 'statuses/todo')).toBe(false);
  expect(matchesTag('status/todo', 'status/todo/urgent')).toBe(false);
});

test('subtasks lose board status tags and retain unrelated tags, while notes remain untouched', () => {
  const card = task('- [ ] Parent #status/todo');
  card.fields.originalBlock += '\n  note #status/todo\n  - [ ] Child #status/todo #client';
  card.subFields = [fields('  - [ ] Child #status/todo #client', 4)];
  const markdown = '# Tasks\r\n' + card.fields.originalBlock.replace(/\n/g, '\r\n') + '\r\n';
  const changed = applyTaskReplacements(markdown, moveReplacements(card, columns, doing, []), card);
  expect(changed).toContain('  note #status/todo\r\n');
  expect(changed).toContain('  - [ ] Child  #client\r\n');
  expect(changed.match(/#status\/doing/g)).toHaveLength(1);
  expect(changed.replace(/\r\n/g, '')).not.toContain('\n');
});

test('moves to Untagged remove all task and subtask tags', () => {
  expect(moveReplacements(task(), columns, untagged, [])[0].newText).not.toMatch(/#\w/);
});

test('inherited source-column tags block a move without editing other tasks in the note', () => {
  expect(() => moveReplacements(task(), columns, doing, ['status/todo'])).toThrow('note properties');
  expect(() => moveReplacements(task(), columns, untagged, ['client'])).toThrow('note properties');
});

test('inherited unrelated tags do not block a status move', () => {
  expect(moveReplacements(task(), columns, doing, ['client'])).toHaveLength(1);
});

test('completed tasks must be reopened before moving into an incomplete tag column', () => {
  const card = task();
  card.fields.completion = { tag: 'Completed' };
  expect(() => moveReplacements(card, columns, doing, [])).toThrow('Reopen');
});

test('duplicate destination tags are not accumulated by repeated moves', () => {
  const line = moveReplacements(task('- [ ] Work #status/doing #status/doing'), columns, doing, [])[0].newText;
  expect(line.match(/#status\/doing/g)).toHaveLength(1);
});

test('a stale task line aborts the update', () => {
  const card = task();
  expect(() => applyTaskReplacements('# Tasks\n- [ ] Edited\n', moveReplacements(card, columns, doing, []), card))
    .toThrow('changed');
});

test('a changed child or note also invalidates a move snapshot', () => {
  const card = task('- [ ] Parent #status/todo');
  card.fields.originalBlock += '\n  Original note';
  expect(() => applyTaskReplacements('# Tasks\n- [ ] Parent #status/todo\n  New note\n',
    moveReplacements(card, columns, doing, []), card)).toThrow('changed');
});

test('an invalid line number aborts without modifying any line', () => {
  expect(() => applyTaskReplacements('content', [{ lineNumber: 0, originalLine: '', newText: 'lost' }]))
    .toThrow('changed');
});

test('appending to CRLF notes preserves their newline style and separates tasks', () => {
  expect(appendTask('# Tasks\r\n', '- [ ] New')).toBe('# Tasks\r\n\r\n- [ ] New\r\n');
  expect(appendTask('', '- [ ] New')).toBe('- [ ] New\n');
});

test('new metadata is inserted before a trailing block ID', () => {
  expect(insertBeforeBlockId('- [ ] Task ^id', 'due 31-12-26')).toBe('- [ ] Task due 31-12-26 ^id');
});

test('filesystem and tag allow filters must both match, using any filter within each group', () => {
  const filtered = { ...board, filters: [
    { tag: 'pathFilter' as const, data: 'Projects' }, { tag: 'tagFilter' as const, data: 'client' }
  ] };
  expect(boardAllowsTask(filtered, 'Projects/tasks.md', ['client'])).toBe(true);
  expect(boardAllowsTask(filtered, 'Projects2/tasks.md', ['client'])).toBe(false);
  expect(boardAllowsTask(filtered, 'Projects/tasks.md', ['status/doing'])).toBe(false);
});

test('subtask-only tag filters do not match a new parent card', () => {
  const filtered: BoardConfig = { ...board, filterScope: 'SubTasksOnly', filters: [{ tag: 'tagFilter', data: 'client' }] };
  expect(boardAllowsTask(filtered, 'Projects/tasks.md', ['client'])).toBe(false);
  expect(boardAllowsTask(filtered, 'Projects/tasks.md', [], ['client'])).toBe(true);
});

test('deny filters reject matching tasks', () => {
  const filtered: BoardConfig = { ...board, filterPolarity: 'Deny', filters: [{ tag: 'tagFilter', data: 'private/' }] };
  expect(boardAllowsTask(filtered, 'Projects/tasks.md', ['private/client'])).toBe(false);
  expect(boardAllowsTask(filtered, 'Projects/tasks.md', ['client'])).toBe(true);
});
