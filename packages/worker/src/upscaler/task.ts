import { ScopedEvent, ScopedEventEmitter } from '../events';

export interface TaskOption<T, R> {
  data: T
  onProgress(progress: number): void
  onDone(value: R): void
  onError(error: Error): void
}

export type Task<T, R> = (options: TaskOption<T, R>) => () => void

export interface DeferredTask<N, T, R = void> {
  name: N
  data: T
  callback: Task<T, R>
}

export interface TaskEventEmitter<T extends string, R = any> extends ScopedEventEmitter<T> {
  on(event: ScopedEvent<T, 'cancel'>, listener: () => void): this;
  on(event: ScopedEvent<T, 'cancelled'>, listener: (error: Error) => void): this;
  on(event: ScopedEvent<T, 'error'>, listener: (error: Error) => void): this;
  on(event: ScopedEvent<T, 'done'>, listener: (value: R) => void): this;
  on(event: ScopedEvent<T, 'progress'>, listener: (progress: number, ...args: any[]) => void): this;

  once(event: ScopedEvent<T, 'cancel'>, listener: () => void): this;
  once(event: ScopedEvent<T, 'cancelled'>, listener: (error: Error) => void): this;
  once(event: ScopedEvent<T, 'error'>, listener: (error: Error) => void): this;
  once(event: ScopedEvent<T, 'done'>, listener: (value: R) => void): this;
  once(event: ScopedEvent<T, 'progress'>, listener: (progress: number, ...args: any[]) => void): this;

  emit(event: ScopedEvent<T, 'cancel'>): boolean;
  emit(event: ScopedEvent<T, 'cancelled'>, error: Error): boolean;
  emit(event: ScopedEvent<T, 'error'>, error: Error): boolean;
  emit(event: ScopedEvent<T, 'done'>, value: R): boolean;
  emit(event: ScopedEvent<T, 'progress'>, progress: number, ...args: any[]): boolean;
}

export function makeTaskEmitEvents<N extends string, T, R>(
  events: TaskEventEmitter<N, R>,
  task: DeferredTask<N, T, R>,
) {
  let cancelFn;

  function cancelListener() {
    events
      .off(`${task.name}:cancel`, cancelListener)
      .emit(`${task.name}:cancelled`, new Error('Task cancelled'));

    cancelFn();
  }

  events.once(`${task.name}:cancel`, cancelListener);

  cancelFn = task.callback({
    data: task.data,

    onDone(value) {
      events.emit(`${task.name}:done`, value);
      events.off(`${task.name}:cancel`, cancelListener);
    },

    onError(error) {
      events.emit(`${task.name}:error`, error);
      events.off(`${task.name}:cancel`, cancelListener);
    },

    onProgress(progress) {
      events.emit(`${task.name}:progress`, progress);
    },
  });
}

export function taskEventToPromise<N extends string, R = any>(
  events: TaskEventEmitter<N, R>,
  task: N,
): Promise<R> {
  return new Promise((resolve, reject) => {
    events
      .once(`${task}:done`, resolve)
      .once(`${task}:error`, reject)
      .once(`${task}:cancelled`, reject);
  });
}
