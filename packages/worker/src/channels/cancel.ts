import { EventEmitter } from 'events';
import { scopeEventEmitter } from '../events';

export default function createCancel(event: EventEmitter) {
  return function cancel(id: string): void {
    scopeEventEmitter(event, id).emit('extract:cancel');
    scopeEventEmitter(event, id).emit('enhance:cancel');
    scopeEventEmitter(event, id).emit('stitch:cancel');
  };
}
