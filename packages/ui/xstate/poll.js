import { createMachine } from 'xstate'

export default function createPollMachine ({
  callback,
  timeout,
  onDone
}) {
  return createMachine({
    id: 'poll',

    initial: 'active',

    states: {
      active: {
        invoke: {
          src: () => callback(),
          onDone: {
            target: 'waiting',
            actions: onDone
          }
        }
      },

      waiting: {
        after: {
          [timeout]: 'active'
        }
      }
    }
  })
}
