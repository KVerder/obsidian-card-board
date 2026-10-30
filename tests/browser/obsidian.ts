export class App {}
export class TFile { extension = 'md'; constructor(public path: string) {} }
export class Notice { constructor(message: string) { (window as any).fixtureNotices.push(message); } }
export class Menu {}
export const normalizePath = (path: string) => path;
export const parseFrontMatterTags = () => [] as string[];
export const parseYaml = () => ({});
const element = (tag = 'div', parent?: HTMLElement, options: any = {}): any => {
  const el: any = document.createElement(tag);
  if (options.text) el.textContent = options.text;
  if (options.value !== undefined) el.value = options.value;
  for (const [key, value] of Object.entries(options.attr || {})) el.setAttribute(key, value as string);
  el.empty = () => el.replaceChildren(); el.setText = (text: string) => el.textContent = text;
  el.createEl = (tag: string, options: any) => element(tag, el, options);
  el.createDiv = () => element('div', el);
  parent?.appendChild(el); return el;
};
export class Modal {
  containerEl = element(); modalEl = element('div', this.containerEl); titleEl = element('h2', this.modalEl); contentEl = element('div', this.modalEl);
  constructor(_app: any) { this.containerEl.className = 'modal-container'; this.modalEl.className = 'modal'; }
  onOpen() {} onClose() {}
  private key = (event: KeyboardEvent) => { if (event.key === 'Escape') this.close(); };
  open() { document.body.appendChild(this.containerEl); this.containerEl.addEventListener('click', (event: MouseEvent) => { if (event.target === this.containerEl) this.close(); }); document.addEventListener('keydown', this.key); this.onOpen(); }
  close() { this.containerEl.remove(); document.removeEventListener('keydown', this.key); this.onClose(); }
}
export class Setting {
  private control: HTMLElement;
  constructor(container: HTMLElement) { const row = element('div', container); row.className = 'setting-item'; this.control = row; }
  setName(name: string) { element('span', this.control, { text: name }); return this; }
  setDesc(text: string) { element('span', this.control, { text }); return this; }
  addText(callback: any) { const inputEl = element('input', this.control); const control: any = { inputEl, setValue: (value: string) => { inputEl.value = value; return control; }, setPlaceholder: (text: string) => { inputEl.placeholder = text; return control; }, onChange: (fn: any) => { inputEl.addEventListener('input', () => fn(inputEl.value)); return control; } }; callback(control); return this; }
  addDropdown(callback: any) { const selectEl = element('select', this.control); const control: any = { selectEl, addOption: (value: string, text: string) => { element('option', selectEl, {value, text}); return control; }, setValue: (value: string) => { selectEl.value = value; return control; }, onChange: (fn: any) => { selectEl.addEventListener('change', () => fn(selectEl.value)); return control; } }; callback(control); return this; }
  addColorPicker(callback: any) { const inputEl = element('input', this.control); inputEl.type = 'color'; const control: any = { setValue: (value: string) => { inputEl.value = value; return control; }, onChange: (fn: any) => { inputEl.addEventListener('input', () => fn(inputEl.value)); return control; } }; callback(control); return this; }
  addButton(callback: any) { const buttonEl = element('button', this.control); const control: any = { buttonEl, setButtonText: (text: string) => { buttonEl.textContent = text; return control; }, setCta: () => control, setDisabled: (value: boolean) => { buttonEl.disabled = value; return control; }, onClick: (fn: any) => { buttonEl.addEventListener('click', fn); return control; } }; callback(control); return this; }
}
