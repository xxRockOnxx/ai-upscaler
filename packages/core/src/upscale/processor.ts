export const PROCESSORS = ['real-esrgan', 'waifu2x'] as const;

export type Processor = typeof PROCESSORS[number];

export const DEFAULT_PROCESSOR: Processor = 'real-esrgan';

export function isProcessor(value: unknown): value is Processor {
  return typeof value === 'string' && (PROCESSORS as readonly string[]).includes(value);
}
