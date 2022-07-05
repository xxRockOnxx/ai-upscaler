import { EventEmitter } from 'events';
import scopeEventEmitter from './events';

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

    scoped.on('closed', () => undefined);
    eventEmitter.on('closed', () => undefined);

    expect(scoped.eventNames()).toEqual(['closed:user-1']);
    expect(scoped.listenerCount('closed')).toBe(1);
  });
});
