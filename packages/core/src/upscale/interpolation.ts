export const INTERPOLATIONS = ['none', 'rife', 'cain'] as const;

export type Interpolation = typeof INTERPOLATIONS[number];

export const DEFAULT_INTERPOLATION: Interpolation = 'none';

export function isInterpolation(value: unknown): value is Interpolation {
  return typeof value === 'string' && (INTERPOLATIONS as readonly string[]).includes(value);
}
