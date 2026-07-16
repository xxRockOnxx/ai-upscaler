import fs from 'fs-extra';
import { spawn } from 'child_process';
import { enhanceFramesWaifu2x } from './enhance-waifu2x';

jest
  .mock('fs-extra')
  .mock('child_process');

// Used to imitate what waifu2x-ncnn-vulkan might print to stdout while
// processing a frame (waifu2x prints its `done` line to stdout, not stderr).
function createPrintingSpawn(lines: string[]) {
  return jest.requireActual('child_process').spawn('node', [
    '-e', lines.map((line) => `process.stdout.write('${line}')`).join(';'),
  ]);
}

describe('enhance-waifu2x.ts', () => {
  const originalPath = process.env.WAIFU2X_PATH;

  beforeAll(() => {
    // The enhancer derives its model path from the binary path, so it must
    // be set even though `spawn` itself is mocked.
    process.env.WAIFU2X_PATH = '/app/waifu2x/waifu2x-ncnn-vulkan';
  });

  afterAll(() => {
    process.env.WAIFU2X_PATH = originalPath;
  });

  beforeEach(() => {
    // The shared spawn/fs mocks keep call records across tests,
    // which breaks assertions like `expect(mockedSpawn).not.toBeCalled()`.
    jest.clearAllMocks();
  });

  describe('progress', () => {
    it('should report per-frame progress on each done line', async () => {
      const mockedFs = fs as jest.MockedObjectDeep<typeof fs>;
      const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore wrong detected type
      mockedFs.promises.readdir.mockResolvedValue(['frame_001.png', 'frame_002.png']);

      mockedSpawn.mockReturnValue(createPrintingSpawn([
        'raw/frames/frame_001.png -> enhanced/frames/frame_001.png done\\n',
        'raw/frames/frame_002.png -> enhanced/frames/frame_002.png done\\n',
      ]));

      const onProgress = jest.fn();

      await enhanceFramesWaifu2x({
        input: 'raw/frames',
        output: 'enhanced/frames',
      }, { onProgress });

      // 1 out of 2 frames done = 50%
      expect(onProgress).toHaveBeenNthCalledWith(1, {
        percent: 50,
        frames: ['frame_001.png'],
      });

      // 2 out of 2 frames done = 100%
      expect(onProgress).toHaveBeenNthCalledWith(2, {
        percent: 100,
        frames: ['frame_002.png'],
      });
    });
  });

  describe('cancellation', () => {
    it('should reject with the abort reason when the signal is already aborted', async () => {
      const mockedFs = fs as jest.MockedObjectDeep<typeof fs>;
      const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore wrong detected type
      mockedFs.promises.readdir.mockResolvedValue(['frame_001.png']);
      mockedSpawn.mockReturnValue(createPrintingSpawn([
        'raw/frames/frame_001.png -> enhanced/frames/frame_001.png done\\n',
      ]));

      const reason = new Error('cancelled');
      const controller = new AbortController();
      controller.abort(reason);

      await expect(enhanceFramesWaifu2x({
        input: '',
        output: '',
      }, { signal: controller.signal })).rejects.toThrowError(reason);

      expect(mockedSpawn).not.toBeCalled();
    });

    it('should kill the process and reject when the signal aborts mid-run', async () => {
      const mockedFs = fs as jest.MockedObjectDeep<typeof fs>;
      const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore wrong detected type
      mockedFs.promises.readdir.mockResolvedValue(['frame_001.png']);

      // A process that would otherwise keep running.
      mockedSpawn.mockReturnValue(jest.requireActual('child_process').spawn('node', [
        '-e', 'setTimeout(() => {}, 10_000)',
      ]));

      const reason = new Error('cancelled');
      const controller = new AbortController();

      const promise = enhanceFramesWaifu2x({
        input: '',
        output: '',
      }, { signal: controller.signal });

      // Let the readdir await settle so the process is actually
      // spawned before aborting — otherwise this test would only
      // exercise the pre-spawn abort check.
      await new Promise((resolve) => { setImmediate(resolve); });
      expect(mockedSpawn).toBeCalled();

      controller.abort(reason);

      await expect(promise).rejects.toThrowError(reason);
    });
  });

  describe('errors', () => {
    it('should throw an error when there are no frames to enhance', async () => {
      const mockedFs = fs as jest.MockedObjectDeep<typeof fs>;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore wrong detected type
      mockedFs.promises.readdir.mockResolvedValue([]);

      await expect(enhanceFramesWaifu2x({
        input: '',
        output: '',
      })).rejects.toThrowError();
    });

    it('should throw an error when program did not exit with code 0', async () => {
      const mockedFs = fs as jest.MockedObjectDeep<typeof fs>;
      const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore wrong detected type
      mockedFs.promises.readdir.mockResolvedValue(['frame_001.png']);

      mockedSpawn.mockReturnValue(jest.requireActual('child_process').spawn('node', [
        '-e', 'process.exit(100)',
      ]));

      await expect(enhanceFramesWaifu2x({
        input: '',
        output: '',
      })).rejects.toThrowError();
    });
  });
});
