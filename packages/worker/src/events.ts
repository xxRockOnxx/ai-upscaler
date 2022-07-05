import { EventEmitter } from 'events';

export default function scopeEventEmitter(events: EventEmitter, scope: string): EventEmitter {
  return {
    eventNames: () => events.eventNames().filter((name) => typeof name === 'string' && name.endsWith(`:${scope}`)),

    on(event: string, listener) {
      events.on(`${event}:${scope}`, listener);
      return this;
    },

    addListener(event: string, listener) {
      events.on(`${event}:${scope}`, listener);
      return this;
    },

    off(event: string, listener) {
      events.off(`${event}:${scope}`, listener);
      return this;
    },

    removeListener(event: string, listener) {
      events.off(`${event}:${scope}`, listener);
      return this;
    },

    once(event: string, listener) {
      events.once(`${event}:${scope}`, listener);
      return this;
    },

    emit(event: string, ...args) {
      events.emit(`${event}:${scope}`, ...args);
      return this;
    },

    prependListener(event: string, listener) {
      events.prependListener(`${event}:${scope}`, listener);
      return this;
    },

    prependOnceListener(event: string, listener) {
      events.prependOnceListener(`${event}:${scope}`, listener);
      return this;
    },

    removeAllListeners(event?: string) {
      if (event) {
        events.removeAllListeners(`${event}:${scope}`);
        return this;
      }

      this.eventNames().forEach((registeredEvent) => {
        events.removeAllListeners(`${scope}:${registeredEvent}`);
      });

      return this;
    },

    listeners: (event: string) => events.listeners(`${event}:${scope}`),
    listenerCount: (event: string) => events.listeners(`${event}:${scope}`).length,
    rawListeners: (event: string) => events.rawListeners(`${event}:${scope}`),
    getMaxListeners: () => events.getMaxListeners(),
    setMaxListeners: (n: number) => events.setMaxListeners(n),
  };
}
