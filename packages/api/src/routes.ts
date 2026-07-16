import { createAssertQueue } from './http/prehandlers/assert-queue';
import { createAssertJob } from './http/prehandlers/assert-job';
import getQueue from './http/get-queue';
import getAvailability from './http/get-availability';
import getProgress from './http/get-progress';
import putQueue from './http/put-queue';
import postSubmit from './http/post-submit';
import putCancel from './http/put-cancel';
import getFrame from './http/get-frame';
import getFrames from './http/get-frames';
import getDownload from './http/get-download';
import type createServer from './server';
import type { Dependencies } from './deps';

type Server = Awaited<ReturnType<typeof createServer>>;

export default function registerRoutes(server: Server, {
  redisDB,
  minioClient,
  queue,
  jobs,
  downloads,
  uploadStorage,
  downloadStorage,
  tmpStorage,
  upscaleQueue,
}: Dependencies): void {
  server
    .get('/availability', getAvailability({ queue: upscaleQueue }))
    .get('/queue', getQueue({ queue, jobs }))
    .put('/queue', putQueue({
      queue,
      cancelJob: (id) => {
        jobs
          .get(id)
          .then((job) => redisDB.publish('cancel', JSON.stringify({ id: job })));
      },
    }));

  server.route({
    method: 'POST',
    url: '/submit',
    preHandler: [createAssertQueue(queue)],
    handler: postSubmit({
      bull: upscaleQueue,
      queue,
      jobs,
      tmpStorage,
      uploadStorage,
    }),
  });

  // We allow fetching of progress by a specific job
  // instead of automatically getting the current job
  // like the other routes because when a job is completed,
  // the user's current job will be cleared from the store.
  // The UI won't be able to see the finished progress because of this.
  server.route({
    method: 'GET',
    url: '/jobs/:job/progress',
    preHandler: [createAssertQueue(queue)],
    handler: getProgress({
      bull: upscaleQueue,
    }),
  });

  server.route({
    method: 'GET',
    url: '/download',
    preHandler: [createAssertQueue(queue)],
    handler: getDownload({
      async getDownloadFile(id) {
        const jobId = await jobs.get(id);

        // No current job is being processed.
        // Return the last saved file.
        if (!jobId) {
          const downloadId = await downloads.get(id);
          return downloadStorage.get(downloadId);
        }

        // We only allow 1 file to be saved for each user/queue/cookie.
        return undefined;
      },
    }),
  });

  // Routes that are related to the current job of this request/user/queue
  server
    .route({
      method: 'GET',
      url: '/frames',
      preHandler: [
        createAssertQueue(queue),
        createAssertJob(jobs),
      ],
      handler: getFrames({
        async getFramesProcessed(id) {
          const jobId = await jobs.get(id);
          let count = 0;

          return new Promise((resolve, reject) => {
            minioClient
              .listObjects('frames', `${jobId}/enhanced`, true)
              .on('data', () => {
                count += 1;
              })
              .once('end', () => resolve(count))
              .once('error', reject);
          });
        },
      }),
    })
    .route({
      method: 'GET',
      url: '/frames/:frame',
      preHandler: [
        createAssertQueue(queue),
        createAssertJob(jobs),
      ],
      handler: getFrame({
        async getFrameStream(id, frame, enhanced) {
          const jobId = await jobs.get(id);
          const directory = enhanced ? 'enhanced' : 'raw';
          return minioClient
            .getObject('frames', `${jobId}/${directory}/frame_${frame}.png`)
            .catch((e) => {
              if (e.code === 'NoSuchKey') {
                return undefined;
              }
              throw e;
            });
        },
      }),
    })
    .route({
      method: 'PUT',
      url: '/cancel',
      preHandler: [
        createAssertQueue(queue),
        createAssertJob(jobs),
      ],
      handler: putCancel({
        publish: redisDB,
        jobs,
        queue,
      }),
    });
}
