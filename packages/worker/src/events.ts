import { EventEmitter } from 'events';

export type ScopedEvent<Scope extends string, Event extends string> = `${Scope}:${Event}`;

// eslint-disable-next-line max-len
export function scopeEventEmitter<S extends string>(events: EventEmitter, scope: S): EventEmitter {
  return {
    eventNames: () => events.eventNames()
      .filter((name) => typeof name === 'string' && name.startsWith(`${scope}:`))
      .map((name: string) => name.replace(`${scope}:`, '')),

    on(event: string, listener) {
      events.on(`${scope}:${event}`, listener);
      return this;
    },

    addListener(event: string, listener) {
      events.on(`${scope}:${event}`, listener);
      return this;
    },

    off(event: string, listener) {
      events.off(`${scope}:${event}`, listener);
      return this;
    },

    removeListener(event: string, listener) {
      events.off(`${scope}:${event}`, listener);
      return this;
    },

    once(event: string, listener) {
      events.once(`${scope}:${event}`, listener);
      return this;
    },

    emit(event: string, ...args) {
      events.emit(`${scope}:${event}`, ...args);
      return this;
    },

    prependListener(event: string, listener) {
      events.prependListener(`${scope}:${event}`, listener);
      return this;
    },

    prependOnceListener(event: string, listener) {
      events.prependOnceListener(`${scope}:${event}`, listener);
      return this;
    },

    removeAllListeners(event?: string) {
      if (event) {
        events.removeAllListeners(`${scope}:${event}`);
        return this;
      }

      this.eventNames().forEach((registeredEvent) => {
        events.removeAllListeners(`${scope}:${registeredEvent}`);
      });

      return this;
    },

    listeners: (event: string) => events.listeners(`${scope}:${event}`),
    listenerCount: (event: string) => events.listeners(`${scope}:${event}`).length,
    rawListeners: (event: string) => events.rawListeners(`${scope}:${event}`),
    getMaxListeners: () => events.getMaxListeners(),
    setMaxListeners: (n: number) => events.setMaxListeners(n),
  };
}
