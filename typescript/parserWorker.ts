import type { Flags, FromElm, ToElm } from '../src/Worker';

/** The Elm Platform.worker runtime is embedded in a real Web Worker. */
export class ParserWorker {
  private worker: Worker;
  private url: string;
  private listeners = new Set<(message: FromElm) => void>();
  private barriers = new Map<number, { resolve: () => void; reject: (error: Error) => void }>();
  private sequence = 0;
  private stopped = false;

  readonly ports = {
    interopFromElm: {
      subscribe: (listener: (message: FromElm) => void) => { this.listeners.add(listener); },
      unsubscribe: (listener: (message: FromElm) => void) => { this.listeners.delete(listener); }
    },
    interopToElm: { send: (message: ToElm) => {
      if (!this.stopped) this.worker.postMessage({ kind: 'message', message });
    } }
  };

  constructor(source: string, flags: Flags, onError: (error: Error) => void) {
    const bridge = `
      let app;
      self.onmessage = function(event) {
        try {
          const data = event.data;
          if (data.kind === 'init') {
            app = self.Elm.Worker.init({flags:data.flags});
            app.ports.interopFromElm.subscribe(message => self.postMessage({kind:'message',message}));
            self.postMessage({kind:'ready'});
          } else if (data.kind === 'barrier') {
            self.postMessage({kind:'barrier',id:data.id});
          } else {
            app.ports.interopToElm.send(data.message);
          }
        } catch(error) { self.postMessage({kind:'error',message:String(error)}); }
      };`;
    this.url = URL.createObjectURL(new Blob([source, '\n', bridge], { type: 'text/javascript' }));
    try { this.worker = new Worker(this.url); }
    catch (error) { URL.revokeObjectURL(this.url); throw error; }
    const fail = (error: Error) => { if (!this.stopped) { this.terminate(error); onError(error); } };
    this.worker.onerror = event => { event.preventDefault(); fail(new Error(event.message || 'Task parser failed.')); };
    this.worker.onmessage = event => {
      const data = event.data;
      if (data.kind === 'ready') URL.revokeObjectURL(this.url);
      else if (data.kind === 'error') fail(new Error(data.message));
      else if (data.kind === 'barrier') { this.barriers.get(data.id)?.resolve(); this.barriers.delete(data.id); }
      else if (data.kind === 'message') this.listeners.forEach(listener => listener(data.message));
    };
    this.worker.postMessage({ kind: 'init', flags });
  }

  /** Bound the queued note text while letting Obsidian's UI keep processing input. */
  flush(): Promise<void> {
    if (this.stopped) return Promise.reject(new Error('Task parser is stopped.'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.barriers.set(id, { resolve, reject }); this.worker.postMessage({ kind: 'barrier', id });
    });
  }

  terminate(error = new Error('Task parser stopped.')) {
    this.stopped = true;
    this.worker.terminate(); URL.revokeObjectURL(this.url);
    this.barriers.forEach(barrier => barrier.reject(error)); this.barriers.clear(); this.listeners.clear();
  }
}
