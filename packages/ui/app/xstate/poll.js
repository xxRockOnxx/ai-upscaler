import { fromCallback } from 'xstate';

/**
 * Reusable polling actor. Calls `input.callback` and, once it resolves, waits
 * `input.timeout` ms before calling it again (sequential, not fixed-rate).
 *
 * When `input.event` is set, each result is sent back to the invoking machine
 * as `{ type: input.event, data }`; omit it for fire-and-forget polling.
 *
 * The returned teardown clears the pending timer — invoking this actor and
 * leaving the state stops the poll automatically (no manual bookkeeping).
 */
const pollLogic = fromCallback(({ sendBack, input }) => {
  const {
    callback, timeout, event, onError = console.error,
  } = input;

  let timer;
  let stopped = false;

  const loop = async () => {
    try {
      const data = await callback();

      if (event && !stopped) {
        sendBack({ type: event, data });
      }
    } catch (e) {
      onError(e);
    }

    if (!stopped) {
      timer = setTimeout(loop, timeout);
    }
  };

  loop();

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
});

export default pollLogic;
