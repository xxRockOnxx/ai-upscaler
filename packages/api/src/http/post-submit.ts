import { RouteHandler } from 'fastify';
import { Job, Queue } from 'bullmq';
import * as fs from 'fs';
import { FfprobeStream } from 'fluent-ffmpeg';
import { QueueStore } from '@ai-upscaler/core/src/queue/store';
import { LocalStorage } from '@ai-upscaler/core/src/storage/local';
import { Storage } from '@ai-upscaler/core/src/storage/storage';
import { JobStore } from '@ai-upscaler/core/src/jobs/store';
import { DEFAULT_PROCESSOR, isProcessor } from '@ai-upscaler/core/src/upscale/processor';
import { DEFAULT_INTERPOLATION, isInterpolation } from '@ai-upscaler/core/src/upscale/interpolation';
import analyze from '../analyze';

function validateMetadata(metadata: FfprobeStream): string[] {
  const errors = [];

  if (Number(metadata.duration) > 60 * 5) {
    errors.push('Max duration supported is currently only up to 5 minutes.');
  }

  if (metadata.height > 720) {
    errors.push('Max height supported is currently only up to 720p.');
  }

  return errors;
}

interface PostSubmitOptions {
  queue: QueueStore
  jobs: JobStore
  bull: Queue
  tmpStorage: LocalStorage
  uploadStorage: Storage
}

export default function createPostSubmit({
  queue,
  jobs,
  bull,
  tmpStorage,
  uploadStorage,
}: PostSubmitOptions): RouteHandler {
  return async function postSubmit(request, reply) {
    if (!request.isMultipart()) {
      return reply
        .code(415)
        .send({ message: 'Expected multipart/form-data' });
    }

    const data = await request.file();

    if (!data || data.fieldname !== 'file') {
      return reply
        .code(400)
        .send({ message: 'Expected `file` field' });
    }

    // The `processor` text field is sent before the file part, so it is
    // available on `data.fields`. Fall back to the default for older clients
    // or an unrecognised value rather than rejecting the upload.
    const processorField = data.fields?.processor;
    const processorValue = Array.isArray(processorField)
      ? undefined
      : (processorField as { value?: unknown } | undefined)?.value;
    const processor = isProcessor(processorValue) ? processorValue : DEFAULT_PROCESSOR;

    // Same convention as `processor`: sent before the file part, defaults
    // to `none` for older clients or an unrecognised value.
    const interpolationField = data.fields?.interpolation;
    const interpolationValue = Array.isArray(interpolationField)
      ? undefined
      : (interpolationField as { value?: unknown } | undefined)?.value;
    const interpolation = isInterpolation(interpolationValue)
      ? interpolationValue
      : DEFAULT_INTERPOLATION;

    const user = request.cookies.queue;
    const queueItem = await queue.get(user);

    if (queueItem.position !== 1) {
      return reply
        .code(400)
        .send({ message: 'Waiting turn' });
    }

    if (queueItem.status === 'processing') {
      return reply
        .code(400)
        .send({ message: 'Already processing' });
    }

    // Claim the slot *before* any heavy I/O. The status check above is
    // check-then-act: without an early claim, a concurrent submit from the
    // same user could pass it while this request is still storing/probing
    // the upload and enqueue a duplicate job. The claim itself is still two
    // Redis round-trips (get + hset), so the window is narrowed rather than
    // eliminated — a full fix needs a compare-and-set in the QueueStore.
    await queue.markAsStatus(user, 'processing');

    async function releaseClaim() {
      try {
        await queue.markAsStatus(user, 'ready');
      } catch (err) {
        request.log.warn(err, 'Failed to release queue claim');
      }
    }

    async function rollback() {
      try {
        await tmpStorage.delete(user);
      } catch (err) {
        request.log.warn(err, 'Failed to remove tmp upload');
      }
      await releaseClaim();
    }

    try {
      await tmpStorage.store(user, data.file);
    } catch (e) {
      await rollback();
      throw e;
    }

    let metadata;

    try {
      // With the MIME sniff gone, ffprobe is the only arbiter of whether
      // the upload is a video, so a probe failure is a client error (400),
      // not a server error.
      metadata = await analyze(tmpStorage.path(user));
    } catch (e) {
      request.log.info(e, 'Rejected upload: not a readable video');
      await rollback();

      return reply
        .code(400)
        .send({ message: 'Expected video to be uploaded' });
    }

    const errors = validateMetadata(metadata);

    if (errors.length > 0) {
      await rollback();

      return reply
        .code(400)
        .send({
          message: 'Video limit exceeded',
          errors,
        });
    }

    try {
      await uploadStorage.store(user, fs.createReadStream(tmpStorage.path(user)));
    } catch (e) {
      await rollback();
      throw e;
    }

    await tmpStorage.delete(user)
      .catch((err) => request.log.warn(err, 'Failed to remove tmp upload'));

    let job: Job;

    try {
      job = await bull.add('upscale', {
        user,
        processor,
        interpolation,
      });

      await jobs.save(user, job.id);

      return reply
        .code(201)
        .send({
          job: job.id,
        });
    } catch (e) {
      request.log.error(e);

      // Nothing will ever consume the upload (and a bull job without a
      // saved job id is unreachable), so remove both and release the
      // claim to let the user retry.
      if (job) {
        await job.remove()
          .catch((err) => request.log.warn(err, 'Failed to remove orphaned bull job'));
      }

      await uploadStorage.delete(user)
        .catch((err) => request.log.warn(err, 'Failed to remove orphaned upload'));

      await releaseClaim();

      return reply
        .code(500)
        .send({ message: 'Failed to add job to queue' });
    }
  };
}
