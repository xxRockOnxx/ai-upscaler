import fs from 'fs-extra';
import { spawn } from 'child_process';
import { enhanceFrames } from './enhance';

jest
  .mock('fs-extra')
  .mock('child_process');

// Used to imitate what REAL-ESRGAN might print to stderr while processing a frame.
function createPrintingSpawn(lines: string[]) {
  return jest.requireActual('child_process').spawn('node', [
    '-e', lines.map((line) => `process.stderr.write('${line}')`).join(';'),
  ]);
}

describe('enhance.ts', () => {
  beforeEach(() => {
    // The shared spawn/fs mocks keep call records across tests,
    // which breaks assertions like `expect(mockedSpawn).not.toBeCalled()`.
    jest.clearAllMocks();
  });

  describe('progress', () => {
    it('should report the progress printed', async () => {
      const mockedFs = fs as jest.MockedObjectDeep<typeof fs>;
      const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore wrong detected type
      mockedFs.promises.readdir.mockResolvedValue(['frame_001.png']);
      mockedSpawn.mockReturnValue(createPrintingSpawn(['10.00%\\n', '20.00%\\n']));

      const onProgress = jest.fn();

      await enhanceFrames({
        input: '',
        output: '',
      }, { onProgress });

      expect(onProgress).toBeCalledTimes(2);

      expect(onProgress).toHaveBeenNthCalledWith(1, {
        percent: 10,
        frames: [],
      });

      expect(onProgress).toHaveBeenNthCalledWith(2, {
        percent: 20,
        frames: [],
      });
    });

    it('should report the total progress and the frame done', async () => {
      const mockedFs = fs as jest.MockedObjectDeep<typeof fs>;
      const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore wrong detected type
      mockedFs.promises.readdir.mockResolvedValue(['frame_001.png', 'frame_002.png']);

      mockedSpawn.mockReturnValue(createPrintingSpawn([
        'raw/frames/frame_001.png -> enhanced/frames/frame_001.png done\\n',
        '50.00%\\n',
      ]));

      const onProgress = jest.fn();

      await enhanceFrames({
        input: 'raw/frames',
        output: 'enhanced/frames',
      }, { onProgress });

      // Expect 50% progress because 1 out of 2 frame is done
      expect(onProgress).toHaveBeenNthCalledWith(1, {
        percent: 50,
        frames: ['frame_001.png'],
      });

      // Exepect 75% progress because the second one is 50% done.
      expect(onProgress).toHaveBeenNthCalledWith(2, {
        percent: 75,
        frames: [],
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
      mockedSpawn.mockReturnValue(createPrintingSpawn(['10.00%\\n']));

      const reason = new Error('cancelled');
      const controller = new AbortController();
      controller.abort(reason);

      await expect(enhanceFrames({
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

      const promise = enhanceFrames({
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

      await expect(enhanceFrames({
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

      await expect(enhanceFrames({
        input: '',
        output: '',
      })).rejects.toThrowError();
    });
  });
});
