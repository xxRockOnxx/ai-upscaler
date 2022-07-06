import { EventEmitter } from 'events';
import scopeEventEmitter from '../events';

export default function createCancel(event: EventEmitter) {
  return function cancel(id: string) {
    scopeEventEmitter(event, id).emit('cancel');
  };
}
