import { EventEmitter } from 'events';
import { scopeEventEmitter } from './events';

describe('events.ts', () => {
  let eventEmitter: EventEmitter;

  beforeAll(() => {
    eventEmitter = new EventEmitter();
  });

  beforeEach(() => {
    eventEmitter.removeAllListeners();
  });

  it('should scope event', async () => {
    const scoped = scopeEventEmitter(eventEmitter, 'job-1');
    const listener = jest.fn();

    eventEmitter.on('completed', () => {
      throw new Error('should not be called');
    });

    scoped
      .on('completed', listener)
      .emit('completed');

    expect(listener).toHaveBeenCalled();
  });

  it('should return scoped events only', () => {
    const scoped = scopeEventEmitter(eventEmitter, 'user-1');

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    scoped.on('closed', () => undefined);
    eventEmitter.on('closed', () => undefined);

    expect(eventEmitter.eventNames()).toEqual(expect.arrayContaining(['closed', 'user-1:closed']));
    expect(scoped.eventNames()).toEqual(['closed']);
    expect(scoped.listenerCount('closed')).toBe(1);
  });

  it('should remove scoped events only', () => {
    const scoped = scopeEventEmitter(eventEmitter, 'user-1');

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    scoped.on('closed', () => undefined);
    eventEmitter.on('closed', () => undefined);

    scoped.removeAllListeners();

    expect(scoped.eventNames()).toEqual([]);
    expect(eventEmitter.eventNames()).toEqual(expect.arrayContaining(['closed']));
  });
});
