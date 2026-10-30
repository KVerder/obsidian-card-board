import { assigneesFromLine } from './assignees';
import { insertBeforeBlockId, TaskReplacement } from './cardEditing';
import { readPlanning, writePlanning } from './planning';

export function needsCompletionDuration(task: TaskReplacement): boolean {
  return /^\s*[-+*] \[ \] /.test(task.originalLine)
    && /^\s*[-+*] \[[xX]\] /.test(task.newText)
    && (isKillianTask(task) || !readPlanning(task.originalLine).duration);
}

export function withCompletionDuration(task: TaskReplacement, hours: number): TaskReplacement {
  if (!Number.isFinite(hours) || hours <= 0) throw new Error('Enter a positive number of hours.');
  if (isKillianTask(task)) {
    const clean = task.newText.replace(/[ \t]+@spent\([^()\r\n]*\)(?=$|[ \t])/g, '').trimEnd();
    return { ...task, newText: insertBeforeBlockId(clean, '@spent(' + hours + 'h)') };
  }
  return { ...task, newText: writePlanning(task.newText,
    { ...readPlanning(task.newText), duration: String(hours), unit: 'h' }) };
}


export function isKillianTask(task: TaskReplacement): boolean {
  return assigneesFromLine(task.originalLine).some(name => name.toLowerCase() === 'killian');
}

export function completionDefaultHours(task: TaskReplacement): number {
  if (!isKillianTask(task)) return 1;
  const estimate = readPlanning(task.originalLine);
  return estimate.duration ? Number(estimate.duration) * (estimate.unit === 'd' ? 8 : 1) : 1;
}
