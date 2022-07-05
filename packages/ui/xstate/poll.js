import { createMachine } from 'xstate'

export default function createPollMachine ({
  callback,
  timeout,
  onDone,
  // eslint-disable-next-line no-console
  onError = console.error
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
          },
          onError: {
            target: 'waiting',
            actions: onError
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
