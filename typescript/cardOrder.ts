import { applyTaskReplacements, TaskReplacement } from './cardEditing';
import { TaskItem } from './types';

export type CardOrder = { board: string; column: string; tasks: string[] };
export type ReorderRequest = {
  boardIndex: number; columnIndex: number; sourceColumnIndex: number;
  beforeTask: TaskItem | null; taskItem: TaskItem; columnTasks: TaskItem[];
};

export const taskId = (task: TaskItem): string => {
  // Reordering requests also carry the actual rendered ID; this helper is only for snapshot lookup.
  return task.fields.filePath + ':' + task.fields.lineNumber;
};

export function blockId(line: string): string | null {
  return /(?:^|[ \t])\^([A-Za-z0-9-]+)[ \t]*$/.exec(line)?.[1] || null;
}

export function orderKey(task: TaskItem, line = task.fields.originalLine): string {
  const id = blockId(line);
  if (!id) throw new Error('An ordered task needs a stable block ID.');
  return task.fields.filePath + '#^' + id;
}

export function reorderKeys(keys: string[], moved: string, before: string | null): string[] {
  const rest = Array.from(new Set(keys)).filter(key => key !== moved);
  if (before === moved) return Array.from(new Set(keys));
  const index = before === null ? rest.length : rest.indexOf(before);
  if (index < 0) throw new Error('The destination card changed. Wait for the board to refresh and try again.');
  return [...rest.slice(0, index), moved, ...rest.slice(index)];
}

export function withBlockId(line: string, makeId: () => string): string {
  return blockId(line) ? line : line.trimEnd() + ' ^cb-' + makeId();
}

export function prepareOrder(tasks: TaskItem[], moved: TaskItem, beforeTask: TaskItem | null,
                             makeId: () => string): { tasks: TaskItem[]; replacements: TaskReplacement[]; order: string[] } {
  const unique = [...tasks.filter(task => taskId(task) !== taskId(moved)), moved];
  const replacements = unique.map(task => ({ lineNumber: task.fields.lineNumber, originalLine: task.fields.originalLine,
    newText: withBlockId(task.fields.originalLine, makeId) }));
  const key = (task: TaskItem) => {
    const index = unique.findIndex(other => taskId(other) === taskId(task));
    if (index < 0) throw new Error('The destination card is no longer on this board.');
    return orderKey(task, replacements[index].newText);
  };
  return { tasks: unique, replacements,
    order: reorderKeys(tasks.map(key), key(moved), beforeTask ? key(beforeTask) : null) };
}

export function validateSnapshots(markdown: string, tasks: TaskItem[]): void {
  for (const task of tasks) applyTaskReplacements(markdown, [], task);
}


export function renameOrderPaths(orders: CardOrder[], oldPath: string, newPath: string): CardOrder[] {
  return orders.map(order => ({ ...order, tasks: order.tasks.map(key =>
    key.startsWith(oldPath + '#^') || key.startsWith(oldPath + '/') ? newPath + key.slice(oldPath.length) : key) }));
}
