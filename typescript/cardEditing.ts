import { CardBoardPluginSettingsPostV11, Filter, TaskItem } from './types';

export type BoardConfig = CardBoardPluginSettingsPostV11['data']['boardConfigs'][number];
export type BoardColumn = BoardConfig['columns'][number];
export type TaskReplacement = { lineNumber: number; originalLine: string; newText: string };

export function isTagDestination(column: BoardColumn): boolean {
  return column.tag === 'namedTag' || column.tag === 'untagged';
}

export function matchesTag(pattern: string, tag: string): boolean {
  pattern = pattern.replace(/^#/, '').toLowerCase();
  tag = tag.replace(/^#/, '').toLowerCase();
  return pattern.endsWith('/')
    ? tag === pattern.slice(0, -1) || tag.startsWith(pattern)
    : tag === pattern;
}

// Match the token boundaries and character set used by the Elm task parser.
const tagPattern = /(^|[ \t])#([A-Za-z0-9_\-/\u0080-\uFFFF]+)/g;

export function lineTags(line: string): string[] {
  const tags: string[] = [];
  line.replace(tagPattern, (match, space: string, tag: string) => {
    if (!/^\d+$/.test(tag)) tags.push(tag);
    return match;
  });
  return tags;
}

export function insertBeforeBlockId(line: string, text: string): string {
  return line.replace(/([ \t]+\^[A-Za-z0-9-]+)?$/, (_, blockId: string) =>
    ` ${text}${blockId || ''}`);
}

export function moveReplacements(task: TaskItem, columns: BoardColumn[], target: BoardColumn,
                                 inheritedTags: string[]): TaskReplacement[] {
  if (!isTagDestination(target)) throw new Error('Choose a tag or Untagged column.');
  if (task.fields.completion.tag !== 'Incomplete') {
    throw new Error('Reopen this completed task with its checkbox before moving it.');
  }
  const boardTags = columns.flatMap(column => column.tag === 'namedTag' ? [column.data.tag] : []);
  const destination = target.tag === 'namedTag' ? target.data.tag.replace(/^#/, '').replace(/\/$/, '') : '';
  const remove = (tag: string) => target.tag === 'untagged' || boardTags.some(pattern => matchesTag(pattern, tag));
  const conflictingInherited = inheritedTags.filter(tag => remove(tag) &&
    (target.tag === 'untagged' || !matchesTag(destination, tag)));
  if (conflictingInherited.length) {
    throw new Error('This card inherits tags from its note properties (' + conflictingInherited.join(', ') +
      '). Edit those properties or move the task to another note first.');
  }

  return [task.fields, ...task.subFields].map((fields, index) => {
    let line = fields.originalLine.replace(tagPattern, (match, space: string, tag: string) =>
      !/^\d+$/.test(tag) && remove(tag) ? space : match);
    // Only the parent receives the destination tag. Subtasks keep their other tags.
    if (index === 0 && destination && !inheritedTags.some(tag => matchesTag(destination, tag))) {
      line = insertBeforeBlockId(line.trimEnd(), '#' + destination);
    }
    return { lineNumber: fields.lineNumber, originalLine: fields.originalLine, newText: line };
  });
}

/** Exact snapshot check inside Vault.process: stale cards never overwrite newer edits. */
export function applyTaskReplacements(markdown: string, replacements: TaskReplacement[], task?: TaskItem): string {
  const pieces = markdown.split(/(\r?\n)/);
  if (task) {
    const expected = task.fields.originalBlock.replace(/\r\n/g, '\n').trimEnd();
    const lineCount = expected.split('\n').length;
    const start = (task.fields.lineNumber - 1) * 2;
    const actual = pieces.slice(start, start + lineCount * 2 - 1).join('').replace(/\r\n/g, '\n').trimEnd();
    if (actual !== expected) throw new Error('This card changed in its note. Wait for the board to refresh and try again.');
  }
  for (const replacement of replacements) {
    const index = (replacement.lineNumber - 1) * 2;
    if (index < 0 || pieces[index] !== replacement.originalLine.replace(/\r$/, '')) {
      throw new Error('This card changed in its note. Wait for the board to refresh and try again.');
    }
    pieces[index] = replacement.newText.replace(/\r$/, '');
  }
  return pieces.join('');
}

export function appendTask(markdown: string, taskLine: string): string {
  const newline = markdown.includes('\r\n') ? '\r\n' : '\n';
  // A blank line keeps a new task out of the preceding task's notes or subtask block.
  return markdown + (markdown ? (markdown.endsWith('\n') ? newline : newline + newline) : '') + taskLine + newline;
}

export function boardAllowsTask(board: BoardConfig, filePath: string, tags: string[], subtaskTags: string[] = []): boolean {
  const match = (filter: Filter) => {
    switch (filter.tag) {
      case 'fileFilter': return filePath === filter.data;
      case 'pathFilter': return filePath.startsWith(filter.data.replace(/\/$/, '') + '/');
      case 'tagFilter': {
        const scopedTags = board.filterScope === 'SubTasksOnly' ? subtaskTags
          : board.filterScope === 'TopLevelOnly' ? tags : [...tags, ...subtaskTags];
        return scopedTags.some(tag => matchesTag(filter.data, tag));
      }
    }
  };
  const passes = (filters: Filter[]) => filters.length === 0 || (board.filterPolarity === 'Allow'
    ? filters.some(match) : filters.every(filter => !match(filter)));
  return passes(board.filters.filter(filter => filter.tag !== 'tagFilter')) &&
    passes(board.filters.filter(filter => filter.tag === 'tagFilter'));
}
