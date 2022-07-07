import { Readable } from 'stream';

export interface Storage {
  /**
   * Get the resource
   * @param id - name of the stored resource
   */
  get(id: string): Promise<Readable>;

  /**
   * Store the resource
   * @param id - name of the resource to be stored
   * @param file - the resource to be stored
   */
  store(id: string, file: Readable): Promise<void>

  /**
   * Delete the resource
   * @param id name of the resource to be deleted
   */
  delete(id: string): Promise<void>
}

export interface FrameStorage {
  getFrames(enhanced: boolean): Promise<string[]>
  getFrame(frame: string, enhanced: boolean): Promise<Readable | undefined>
  storeFrame(frame: string, file: Readable, enhanced: boolean): Promise<void>
  deleteFrames(enhanced: boolean): Promise<void>
}
