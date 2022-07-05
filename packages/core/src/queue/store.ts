export interface Queue {
  status: 'waiting' | 'ready' | 'processing' | 'finished' | 'failed'
  position: number
  updatedAt: Date
}

export interface QueueStore {
  getAll(): Promise<Record<string, Queue>>
  join(id: string, forced?: boolean): Promise<void>
  refresh(id: string): Promise<void>
  markAsStatus(id: string, status: Queue['status']): Promise<void>
  save(id: string, data: Queue): Promise<void>
  removeIfExpired(id: string): Promise<boolean>
  sort(): Promise<void>
}

export class QueueError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QueueError';
  }
}
