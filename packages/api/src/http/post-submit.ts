import { RouteHandler } from 'fastify';
import { Magic, MAGIC_MIME_TYPE } from 'mmmagic';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import { FfprobeStream } from 'fluent-ffmpeg';
import { QueueStore } from '@ai-upscaler/core/src/queue/store';
import { LocalStorage } from '@ai-upscaler/core/src/storage/local';
import { Storage } from '@ai-upscaler/core/src/storage/storage';
import { JobStore } from '@ai-upscaler/core/src/jobs/store';
import analyze from '../analyze';

function getMIME(filepath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const magic = new Magic(MAGIC_MIME_TYPE);

    magic.detectFile(filepath, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result as string);
      }
    });
  });
}

function validateMIME(mime: string): boolean {
  return mime.startsWith('video/');
}

function validateMetadata(metadata: FfprobeStream): string[] {
  const errors = [];

  if (Number(metadata.duration) > 60 * 5) {
    errors.push('Duration currently only supports 5 minutes.');
  }

  if (metadata.height > 720) {
    errors.push('Height currently only supports up to 720p.');
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

    let metadata;

    try {
      await tmpStorage.store(user, data.file);

      if (!validateMIME(await getMIME(tmpStorage.path(user)))) {
        return reply
          .code(400)
          .send({ message: 'Expected video/mp4' });
      }

      metadata = await analyze(tmpStorage.path(user));
    } catch (e) {
      await tmpStorage.delete(user);
      throw e;
    }

    const errors = validateMetadata(metadata);

    if (errors.length > 0) {
      return reply
        .code(400)
        .send({
          message: 'Video limit exceeded',
          errors,
        });
    }

    await uploadStorage
      .store(user, fs.createReadStream(tmpStorage.path(user)))
      .finally(() => tmpStorage.delete(user));

    try {
      const job = await bull.add('upscale', {
        user,
      });

      await queue.markAsStatus(user, 'processing');
      await jobs.save(user, job.id);

      return reply
        .code(201)
        .send({
          job: job.id,
        });
    } catch (e) {
      request.log.error(e);

      return reply
        .code(500)
        .send({ message: 'Failed to add job to queue' });
    }
  };
}
