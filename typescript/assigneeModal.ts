import { App, Modal, Notice, Setting } from 'obsidian';
import { defaultPersonColor, Person, validatePerson } from './assignees';

export class AssigneeModal extends Modal {
  constructor(app: App, private people: Person[], private initialNames: string[],
              private save: (people: Person[]) => Promise<void>, private currentNames: string[] = []) { super(app); }

  onOpen() {
    this.titleEl.setText('Assign people and colours');
    const selected: Person[] = this.initialNames.map(name => ({ name, color: defaultPersonColor(name, this.people) }));
    if (!selected.length) selected.push({ name: '', color: defaultPersonColor('', this.people) });
    const rows = this.contentEl.createDiv();
    const draw = () => {
      rows.empty();
      selected.forEach((person, index) => {
        let picker: { setValue(value: string): unknown };
        let nameInput: { setValue(value: string): unknown };
        const choose = (value: string) => {
          person.name = value;
          person.color = defaultPersonColor(value, [...this.people, ...selected.filter(other => other !== person)]);
          picker?.setValue(person.color); nameInput?.setValue(value);
        };
        new Setting(rows).setName('Person ' + (index + 1))
          .addDropdown(dropdown => {
            dropdown.addOption('', 'Choose an assigned person…');
            this.currentNames.forEach(name => dropdown.addOption(name, name));
            dropdown.setValue(this.currentNames.includes(person.name) ? person.name : '').onChange(value => { if (value) choose(value); });
            dropdown.selectEl.setAttribute('aria-label', 'Choose an assigned person');
          })
          .addText(text => {
            nameInput = text;
            text.setValue(person.name).setPlaceholder('Person name').onChange(value => {
              person.name = value;
              person.color = defaultPersonColor(value, [...this.people, ...selected.filter(other => other !== person)]);
              picker?.setValue(person.color);
            });
            const list = rows.createEl('datalist', { attr: { id: 'card-board-person-' + index } });
            this.currentNames.forEach(name => list.createEl('option', { value: name }));
            text.inputEl.setAttribute('list', list.id);
          })
          .addColorPicker(color => { picker = color; color.setValue(person.color).onChange(value => person.color = value); })
          .addButton(button => button.setButtonText('Remove').onClick(() => { selected.splice(index, 1); draw(); }));
      });
      if (selected.length < 4) new Setting(rows).addButton(button => button.setButtonText('Add person').onClick(() => {
        selected.push({ name: '', color: defaultPersonColor('', [...this.people, ...selected]) }); draw();
      }));
    };
    draw();
    this.contentEl.createEl('p', { text: 'Up to four people. Colours apply to all their cards. The left border marks the deadline. Remove all people to unassign.' });
    new Setting(this.contentEl)
      .addButton(button => button.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(button => button.setButtonText('Save').setCta().onClick(async () => {
        button.setDisabled(true);
        try {
          const people = selected.map(person => ({ ...person, name: person.name.trim() })).filter(person => person.name);
          people.forEach(person => validatePerson(person.name, person.color));
          if (new Set(people.map(person => person.name.toLowerCase())).size !== people.length) throw new Error('Choose each person only once.');
          await this.save(people); this.close();
        } catch (error) { new Notice(error instanceof Error ? error.message : 'Could not assign people.'); }
        finally { button.setDisabled(false); }
      }));
  }
  onClose() { this.contentEl.empty(); }
}
