export interface Download {
  expire_at: Date
  active: boolean
}

export interface DownloadStore {
  getAll(): Promise<Record<string, Download>>
  getById(id: string): Promise<Download | null>
  set<T extends keyof Download>(id: string, key: T, value: Download[T]): Promise<void>
  save(id: string, data: Download): Promise<void>
}
