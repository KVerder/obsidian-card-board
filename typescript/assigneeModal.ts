import { App, ColorComponent, Modal, Notice, Setting, TextComponent } from 'obsidian';
import { defaultPersonColor, Person } from './assignees';

export class AssigneeModal extends Modal {
  constructor(app: App, private people: Person[], private initialName: string,
              private save: (name: string, color: string) => Promise<void>) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText('Assign person and colour');
    let name = this.initialName;
    let color = defaultPersonColor(name, this.people);
    let colorInput: ColorComponent;
    let nameInput: TextComponent;
    new Setting(this.contentEl).setName('Person').setDesc('Choose an existing person or enter a new name. Leave blank to unassign.')
      .addText(text => {
        nameInput = text;
        text.setValue(name).setPlaceholder('Person name').onChange(value => {
          name = value;
          color = defaultPersonColor(name, this.people);
          colorInput?.setValue(color);
        });
        const list = this.contentEl.createEl('datalist', { attr: { id: 'card-board-people' } });
        this.people.forEach(person => list.createEl('option', { value: person.name }));
        text.inputEl.setAttribute('list', list.id);
      });
    new Setting(this.contentEl).setName('Person colour')
      .setDesc('Applies to all cards assigned to this person. The left border continues to show the deadline.')
      .addColorPicker(picker => {
        colorInput = picker;
        picker.setValue(color).onChange(value => color = value);
      });
    new Setting(this.contentEl)
      .addButton(button => button.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(button => button.setButtonText('Save').setCta().onClick(async () => {
        button.setDisabled(true);
        try {
          await this.save(name.trim(), color);
          this.close();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : 'Could not assign person.');
        } finally {
          button.setDisabled(false);
        }
      }));
    nameInput!.inputEl.focus();
  }

  onClose() {
    this.contentEl.empty();
  }
}
