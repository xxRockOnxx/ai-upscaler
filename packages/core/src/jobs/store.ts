/**
 * This Store maps an ID to a Job/Queue processor ID
 */
export interface JobStore {
  save(id: string, job: string): Promise<void>
  get(id: string): Promise<string>
  delete(id: string): Promise<void>
}
