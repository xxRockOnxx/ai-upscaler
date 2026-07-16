import fs from 'fs-extra';
import ffmpeg from 'fluent-ffmpeg';
import { enhanceFramesAnime4k } from './enhance-anime4k';

jest
  .mock('fs-extra')
  .mock('fluent-ffmpeg');

// Anime4K runs as a single ffmpeg pass (vf_libplacebo + GLSL shaders) over
// the whole frame sequence, so the tests stub fluent-ffmpeg's chainable
// command instead of spawning per-frame processes.
function createMockCommand() {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};

  const command = {
    outputOptions: jest.fn(),
    output: jest.fn(),
    on: jest.fn(),
    run: jest.fn(),
    kill: jest.fn(),
    // Test helper: invoke a registered event handler (returns its promise
    // for async handlers so emissions can be sequenced).
    emit: (event: string, ...args: unknown[]) => handlers[event]?.(...args),
  };

  command.outputOptions.mockReturnValue(command);
  command.output.mockReturnValue(command);
  command.on.mockImplementation((event: string, handler: () => unknown) => {
    handlers[event] = handler;
    return command;
  });

  return command;
}

describe('enhance-anime4k.ts', () => {
  const mockedFs = fs as jest.MockedObjectDeep<typeof fs>;
  const mockedFfmpeg = ffmpeg as unknown as jest.MockedFunction<typeof ffmpeg>;
  const originalPath = process.env.ANIME4K_PATH;

  beforeAll(() => {
    process.env.ANIME4K_PATH = '/app/anime4k/anime4k-mode-a-4x.glsl';
  });

  afterAll(() => {
    process.env.ANIME4K_PATH = originalPath;
  });

  beforeEach(() => {
    // The shared ffmpeg/fs mocks keep call records across tests,
    // which breaks assertions like `expect(mockedFfmpeg).not.toBeCalled()`.
    jest.clearAllMocks();
  });

  describe('command', () => {
    it('should upscale the whole sequence 4x through the Anime4K shaders', async () => {
      const command = createMockCommand();
      mockedFfmpeg.mockReturnValue(command as never);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore wrong detected type
      mockedFs.promises.readdir.mockResolvedValue(['frame_1.png', 'frame_2.png']);

      command.run.mockImplementation(() => {
        setImmediate(async () => {
          await command.emit('end');
        });
      });

      await enhanceFramesAnime4k({
        input: 'raw/frames',
        output: 'enhanced/frames',
      });

      expect(mockedFfmpeg).toHaveBeenCalledWith('raw/frames/frame_%d.png');
      expect(command.outputOptions).toHaveBeenCalledWith([
        '-vf', 'libplacebo=w=iw*4:h=ih*4:custom_shader_path=/app/anime4k/anime4k-mode-a-4x.glsl',
      ]);
      expect(command.output).toHaveBeenCalledWith('enhanced/frames/frame_%d.png');
      expect(command.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('progress', () => {
    it('should report frame-based progress and the newly written frames', async () => {
      const command = createMockCommand();
      mockedFfmpeg.mockReturnValue(command as never);

      const mockedReaddir = mockedFs.promises.readdir as unknown as jest.Mock;

      mockedReaddir
        // Counting the input frames
        .mockResolvedValueOnce(['frame_1.png', 'frame_2.png'])
        // Output directory when the first progress event fires
        .mockResolvedValueOnce(['frame_1.png'])
        // Output directory on the end event
        .mockResolvedValueOnce(['frame_1.png', 'frame_2.png']);

      command.run.mockImplementation(() => {
        setImmediate(async () => {
          // An image2 input has no duration, so the enhancer must use
          // `frames` rather than fluent-ffmpeg's `percent`.
          await command.emit('progress', { frames: 1 });
          await command.emit('end');
        });
      });

      const onProgress = jest.fn();

      await enhanceFramesAnime4k({
        input: 'raw/frames',
        output: 'enhanced/frames',
      }, { onProgress });

      // 1 out of 2 frames done = 50%
      expect(onProgress).toHaveBeenNthCalledWith(1, {
        percent: 50,
        frames: ['frame_1.png'],
      });

      // The end event reports 100% and the remaining new frames
      expect(onProgress).toHaveBeenNthCalledWith(2, {
        percent: 100,
        frames: ['frame_2.png'],
      });
    });
  });

  describe('cancellation', () => {
    it('should reject with the abort reason when the signal is already aborted', async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore wrong detected type
      mockedFs.promises.readdir.mockResolvedValue(['frame_1.png']);

      const reason = new Error('cancelled');
      const controller = new AbortController();
      controller.abort(reason);

      await expect(enhanceFramesAnime4k({
        input: '',
        output: '',
      }, { signal: controller.signal })).rejects.toThrowError(reason);

      expect(mockedFfmpeg).not.toBeCalled();
    });

    it('should kill ffmpeg and reject when the signal aborts mid-run', async () => {
      const command = createMockCommand();
      mockedFfmpeg.mockReturnValue(command as never);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore wrong detected type
      mockedFs.promises.readdir.mockResolvedValue(['frame_1.png', 'frame_2.png']);

      // A command that would otherwise keep running: killing it makes the
      // real fluent-ffmpeg emit an 'error' event.
      command.kill.mockImplementation(() => {
        command.emit('error', new Error('ffmpeg was killed with signal SIGKILL'));
      });

      const reason = new Error('cancelled');
      const controller = new AbortController();

      const promise = enhanceFramesAnime4k({
        input: '',
        output: '',
      }, { signal: controller.signal });

      // Let the readdir await settle so ffmpeg is actually started
      // before aborting — otherwise this test would only exercise
      // the pre-run abort check.
      await new Promise((resolve) => { setImmediate(resolve); });
      expect(command.run).toBeCalled();

      controller.abort(reason);

      await expect(promise).rejects.toThrowError(reason);
      expect(command.kill).toHaveBeenCalledWith('SIGKILL');
    });
  });

  describe('errors', () => {
    it('should throw an error when there are no frames to enhance', async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore wrong detected type
      mockedFs.promises.readdir.mockResolvedValue([]);

      await expect(enhanceFramesAnime4k({
        input: '',
        output: '',
      })).rejects.toThrowError();

      expect(mockedFfmpeg).not.toBeCalled();
    });

    it('should reject when ffmpeg reports an error', async () => {
      const command = createMockCommand();
      mockedFfmpeg.mockReturnValue(command as never);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore wrong detected type
      mockedFs.promises.readdir.mockResolvedValue(['frame_1.png']);

      const error = new Error('ffmpeg exited with code 1');

      command.run.mockImplementation(() => {
        setImmediate(() => {
          command.emit('error', error);
        });
      });

      await expect(enhanceFramesAnime4k({
        input: '',
        output: '',
      })).rejects.toThrowError(error);
    });
  });
});
