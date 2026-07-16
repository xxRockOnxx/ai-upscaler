// AbortSignal/AbortController members that exist at runtime (Node >= 17.2)
// but are missing from the pinned @types/node 18.0.0 declarations.

interface AbortSignal {
  readonly reason: unknown

  addEventListener(
    type: 'abort',
    listener: (this: AbortSignal) => void,
    options?: { once?: boolean },
  ): void

  removeEventListener(
    type: 'abort',
    listener: (this: AbortSignal) => void,
  ): void
}

interface AbortController {
  abort(reason?: unknown): void
}
