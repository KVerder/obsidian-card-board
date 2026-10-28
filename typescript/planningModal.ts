import { App, Modal, Notice, Setting } from 'obsidian';
import { Planning } from './planning';

export function addPlanningFields(container: HTMLElement, initial: Planning): Planning {
  const planning = { ...initial };
  new Setting(container).setName('Time to complete (optional)')
    .setDesc('Required for scheduling. One working day is 8 hours.')
    .addText(text => text.setValue(planning.duration).setPlaceholder('e.g. 2.5').onChange(value => planning.duration = value))
    .addDropdown(dropdown => dropdown.addOption('h', 'Hours').addOption('d', 'Working days')
      .setValue(planning.unit).onChange(value => planning.unit = value === 'd' ? 'd' : 'h'));
  new Setting(container).setName('Urgent').setDesc('Schedule before non-urgent tasks, then by deadline and duration.')
    .addToggle(toggle => toggle.setValue(planning.urgent).onChange(value => planning.urgent = value));
  return planning;
}

export class PlanningModal extends Modal {
  constructor(app: App, private initial: Planning, private save: (planning: Planning) => Promise<void>) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText('Task estimate and urgency');
    const planning = addPlanningFields(this.contentEl, this.initial);
    new Setting(this.contentEl)
      .addButton(button => button.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(button => button.setButtonText('Save').setCta().onClick(async () => {
        button.setDisabled(true);
        try {
          await this.save(planning);
          this.close();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : 'Could not save planning fields.');
        } finally {
          button.setDisabled(false);
        }
      }));
  }

  onClose() { this.contentEl.empty(); }
}
