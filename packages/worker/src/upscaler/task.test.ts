import { EventEmitter } from 'events';
import { makeTaskEmitEvents, taskEventToPromise } from './task';

describe('makeTaskEmitEvents', () => {
  it('should emit `task:progress` when `onProgress` called', () => {
    const emitter = new EventEmitter();
    const mock = jest.fn();

    emitter.on('task:progress', mock);

    makeTaskEmitEvents(emitter, {
      name: 'task',
      data: {},
      callback: ({ onProgress }) => {
        onProgress(1);
        return () => undefined;
      },
    });

    expect(mock).toHaveBeenCalledWith(1);
  });

  it('should emit `task:done` when `onDone` called', () => {
    const emitter = new EventEmitter();
    const mock = jest.fn();

    emitter.on('task:done', mock);

    makeTaskEmitEvents(emitter, {
      name: 'task',
      data: {},
      callback: ({ onDone }) => {
        onDone(1);
        return () => undefined;
      },
    });

    expect(mock).toHaveBeenCalledWith(1);
  });

  it('should emit `task:error` when `onError` called', () => {
    const emitter = new EventEmitter();
    const mock = jest.fn();

    emitter.on('task:error', mock);

    makeTaskEmitEvents(emitter, {
      name: 'task',
      data: {},
      callback: ({ onError }) => {
        onError(new Error('error'));
        return () => undefined;
      },
    });

    expect(mock).toHaveBeenCalledWith(new Error('error'));
  });

  it('should emit `task:cancelled` when `task:cancel` event is received', () => {
    const emitter = new EventEmitter();
    const mock = jest.fn();

    emitter.on('task:cancelled', mock);

    makeTaskEmitEvents(emitter, {
      name: 'task',
      data: {},
      callback: () => () => undefined,
    });

    emitter.emit('task:cancel');

    expect(mock).toHaveBeenCalled();
  });

  it('should not receive `task:cancel` when `onDone` is already called', () => {
    const emitter = new EventEmitter();
    const mock = jest.fn();

    emitter.on('task:cancelled', mock);

    makeTaskEmitEvents(emitter, {
      name: 'task',
      data: {},
      callback: ({ onDone }) => {
        onDone(1);
        return () => undefined;
      },
    });

    emitter.emit('task:cancel');

    expect(mock).not.toHaveBeenCalled();
  });

  it('should not receive `task:cancel` when `onError` is already called', () => {
    const emitter = new EventEmitter();
    const mock = jest.fn();

    emitter.on('task:cancelled', mock);

    makeTaskEmitEvents(emitter, {
      name: 'task',
      data: {},
      callback: ({ onError }) => {
        onError(new Error('error'));
        return () => undefined;
      },
    });

    emitter.emit('task:cancel');

    expect(mock).not.toHaveBeenCalled();
  });
});

describe('taskEventToPromise', () => {
  it('should resolve when `task:done` event is received', async () => {
    const emitter = new EventEmitter();

    const promise = taskEventToPromise(emitter, 'task');

    makeTaskEmitEvents(emitter, {
      name: 'task',
      data: {},
      callback: ({ onDone }) => {
        onDone(1);
        return () => undefined;
      },
    });

    await expect(promise).resolves.toBe(1);
  });

  it('should reject when `task:error` event is received', async () => {
    const emitter = new EventEmitter();

    const promise = taskEventToPromise(emitter, 'task');

    makeTaskEmitEvents(emitter, {
      name: 'task',
      data: {},
      callback: ({ onError }) => {
        onError(new Error('error'));
        return () => undefined;
      },
    });

    await expect(promise).rejects.toThrow('error');
  });

  it('should reject when `task:cancelled` event is received', async () => {
    const emitter = new EventEmitter();

    const promise = taskEventToPromise(emitter, 'task');

    makeTaskEmitEvents(emitter, {
      name: 'task',
      data: {},
      callback: () => () => undefined,
    });

    emitter.emit('task:cancel');

    await expect(promise).rejects.toThrow('Task cancelled');
  });
});
