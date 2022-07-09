export interface Download {
  expire_at: Date
  active: boolean
}

export interface DownloadStore {
  get(id: string): Promise<string | undefined>
  save(id: string, file: string): Promise<void>
  delete(id: string): Promise<void>
}
