import { App, Modal, Notice, Setting } from 'obsidian';

/** Every dismissal completes the task using the displayed fallback. */
export class CompletionDurationModal extends Modal {
  private hours: number;
  private settled = false;

  constructor(app: App, private taskTitle: string, private resolve: (hours: number) => void, private fallback = 1, private actual = false) {
    super(app);
    this.hours = fallback;
  }

  onOpen() {
    this.titleEl.setText(this.actual ? 'How long did this task actually take?' : 'How long did this task take?');
    this.contentEl.createEl('p', { text: this.taskTitle });
    this.contentEl.createEl('p', { text: (this.actual ? 'Enter Killian’s own hours. The estimate is preserved. ' : '') + 'Cancel, Escape, or click outside to complete using ' + this.fallback + ' hours.' });
    let value = '';
    new Setting(this.contentEl).setName('Hours spent')
      .addText(input => {
        input.setPlaceholder(String(this.fallback)).onChange(text => value = text);
        input.inputEl.inputMode = 'decimal';
        input.inputEl.focus();
      });
    new Setting(this.contentEl)
      .addButton(button => button.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(button => button.setButtonText('Complete task').setCta().onClick(() => {
        const input = value.trim();
        const hours = input ? Number(input) : this.fallback;
        if ((input && !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(input)) || !Number.isFinite(hours) || hours <= 0) {
          new Notice('Enter a positive number of hours.');
          return;
        }
        this.hours = hours;
        this.close();
      }));
  }

  onClose() {
    this.contentEl.empty();
    if (!this.settled) {
      this.settled = true;
      this.resolve(this.hours);
    }
  }
}

export function askCompletionDuration(app: App, title: string, fallback = 1, actual = false): Promise<number> {
  return new Promise(resolve => new CompletionDurationModal(app, title, resolve, fallback, actual).open());
}
