export interface TaskProgress {
  percent: number
  frames: string[]
}

export interface TaskOptions<Progress = TaskProgress> {
  // Aborting the signal cancels the task.
  // The task rejects with the signal's abort reason.
  signal?: AbortSignal
  onProgress?: (progress: Progress) => void
}

export type Task<Data, Result, Progress = TaskProgress> =
  (data: Data, options?: TaskOptions<Progress>) => Promise<Result>
