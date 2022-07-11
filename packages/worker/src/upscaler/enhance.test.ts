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
  describe('progress', () => {
    it('should emit the progress printed', async () => {
      const mockedFs = fs as jest.MockedObjectDeep<typeof fs>;
      const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore wrong detected type
      mockedFs.promises.readdir.mockResolvedValue(['frame_001.png']);
      mockedSpawn.mockReturnValue(createPrintingSpawn(['10.00%\\n', '20.00%\\n']));

      const onProgress = jest.fn();

      await new Promise((resolve, reject) => {
        enhanceFrames({
          data: {
            input: '',
            output: '',
          },
          onProgress,
          onDone: resolve,
          onError: reject,
        });
      });

      expect(onProgress).toBeCalledTimes(2);
      expect(onProgress).toHaveBeenNthCalledWith(1, 10, []);
      expect(onProgress).toHaveBeenNthCalledWith(2, 20, []);
    });

    it('should emit the total progress and the frame done', async () => {
      const mockedFs = fs as jest.MockedObjectDeep<typeof fs>;
      const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

      mockedFs.promises.readdir.mockResolvedValue([
        'frame_001.png',
        'frame_002.png',
      ]);

      mockedSpawn.mockReturnValue(createPrintingSpawn([
        'raw/frames/frame_001.png -> enhanced/frames/frame_001.png done\\n',
        '50.00%\\n',
      ]));

      const onProgress = jest.fn();

      await new Promise((resolve, reject) => {
        enhanceFrames({
          data: {
            input: 'raw/frames',
            output: 'enhanced/frames',
          },
          onProgress,
          onDone: resolve,
          onError: reject,
        });
      });

      // Expect 50% progress because 1 out of 2 frame is done
      expect(onProgress).toHaveBeenNthCalledWith(1, 50, ['frame_001.png']);

      // Exepect 75% progresse because the second one is 50% done.
      expect(onProgress).toHaveBeenNthCalledWith(2, 75, []);
    });
  });

  describe('errors', () => {
    it('should throw an error when there are no frames to enhance', async () => {
      const mockedFs = fs as jest.MockedObjectDeep<typeof fs>;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore wrong detected type
      mockedFs.promises.readdir.mockResolvedValue([]);

      const promise = new Promise((resolve, reject) => {
        enhanceFrames({
          data: {
            input: '',
            output: '',
          },
          onProgress: () => null,
          onDone: resolve,
          onError: reject,
        });
      });

      await expect(promise).rejects.toThrowError();
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

      const promise = new Promise((resolve, reject) => {
        enhanceFrames({
          data: {
            input: '',
            output: '',
          },
          onProgress: () => null,
          onDone: resolve,
          onError: reject,
        });
      });

      await expect(promise).rejects.toThrowError();
    });
  });
});
