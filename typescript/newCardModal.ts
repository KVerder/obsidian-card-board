import { App, Modal, Notice, Setting, TextComponent } from 'obsidian';
import { Planning } from './planning';
import { addPlanningFields } from './planningModal';

export class NewCardModal extends Modal {
  constructor(app: App, private columnName: string, private initialPath: string,
              private save: (path: string, title: string, due: string, planning: Planning) => Promise<void>) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText('Add card to ' + this.columnName);
    let path = this.initialPath;
    let title = '';
    let due = '';
    let titleInput: TextComponent;
    new Setting(this.contentEl).setName('Task').addText(text => {
      titleInput = text;
      text.setPlaceholder('Task title').onChange(value => title = value);
      text.inputEl.addClass('card-board-new-card-title');
    });
    new Setting(this.contentEl).setName('Note')
      .setDesc('Append to an existing Markdown note, or create a new note at this path.')
      .addText(text => {
        text.setValue(path).setPlaceholder('CardBoard.md').onChange(value => path = value);
        const list = this.contentEl.createEl('datalist', { attr: { id: 'card-board-note-paths' } });
        for (const file of this.app.vault.getMarkdownFiles()) list.createEl('option', { value: file.path });
        text.inputEl.setAttribute('list', list.id);
      });
    new Setting(this.contentEl).setName('Deadline (optional)')
      .setDesc('due dd-mm-yy or due dd-mm (current year). You can also put it in the task title.')
      .addText(text => text.setPlaceholder('due 31-12-26').onChange(value => due = value));
    const planning = addPlanningFields(this.contentEl, { duration: '', unit: 'h', urgent: false });
    new Setting(this.contentEl)
      .addButton(button => button.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(button => button.setButtonText('Add card').setCta().onClick(async () => {
        button.setDisabled(true);
        try {
          await this.save(path, title, due, planning);
          this.close();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : 'Could not add card.');
        } finally {
          button.setDisabled(false);
        }
      }));
    titleInput!.inputEl.focus();
  }

  onClose() {
    this.contentEl.empty();
  }
}
