export interface Queue {
  status: 'waiting' | 'ready' | 'processing' | 'finished' | 'failed'
  position: number
  updatedAt: Date
}

export interface QueueStore {
  getAll(): Promise<Record<string, Queue>>
  get(id: string): Promise<Queue | undefined>
  waitingCount(): Promise<number>
  join(id: string, forced?: boolean): Promise<void>
  refresh(id: string): Promise<void>
  markAsStatus(id: string, status: Queue['status']): Promise<void>
  save(id: string, data: Queue): Promise<void>
  removeExpired(): Promise<void>
  removeIfExpired(id: string): Promise<boolean>
  sortWaiting(): Promise<void>
}

export class QueueError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QueueError';
  }
}
