export interface TaskOption<T, R> {
  data: T
  onProgress(progress: number): void
  onDone(value: R): void
  onError(error: Error): void
}

export type Task<T, R> = (options: TaskOption<T, R>) => () => void
