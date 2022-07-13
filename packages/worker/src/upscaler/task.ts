import type { EventEmitter } from 'events';

export interface TaskEventEmitter<R> extends EventEmitter {
  on(event: 'cancel', listener: () => void): this;
  on(event: 'cancelled', listener: (error: Error) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'done', listener: (value: R) => void): this;
  on(event: 'progress', listener: (data: { percent: number, frames: string[] }) => void): this;

  once(event: 'cancel', listener: () => void): this;
  once(event: 'cancelled', listener: (error: Error) => void): this;
  once(event: 'error', listener: (error: Error) => void): this;
  once(event: 'done', listener: (value: R) => void): this;
  once(event: 'progress', listener: (data: { percent: number, frames: string[] }) => void): this;

  emit(event: 'cancel'): boolean;
  emit(event: 'cancelled', error: Error): boolean;
  emit(event: 'error', error: Error): boolean;
  emit(event: 'done', value: R): boolean;
  emit(event: 'progress', data: { percent: number, frames: string[] }): boolean;
}

export type Task<T, R> = (data: T) => TaskEventEmitter<R>
