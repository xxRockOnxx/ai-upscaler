const { Magic, MAGIC_MIME_TYPE } = require('mmmagic');
const uuid = require('uuid').v4;
const mimeTypes = require('mime-types');
const analyze = require('../analyze');
const Storage = require('../upscaler/storage');

function getMIME(filepath) {
  return new Promise((resolve, reject) => {
    const magic = new Magic(MAGIC_MIME_TYPE);

    magic.detectFile(filepath, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

function validateMIME(mime) {
  return mime.startsWith('video/');
}

function validateMetadata(metadata) {
  const errors = [];

  if (metadata.duration > 60 * 5) {
    errors.push('Duration currently only supports 5 minutes.');
  }

  if (metadata.height > 720) {
    errors.push('Height currently only supports up to 720p.');
  }

  return errors;
}

module.exports = function createPostSubmit(queue, upscaler) {
  return async function postSubmit(request, reply) {
    if (!request.isMultipart()) {
      reply.code(415).send({ message: 'Expected multipart/form-data' });
      return;
    }

    const data = await request.file();

    if (!data || data.fieldname !== 'file') {
      reply.code(400).send({ message: 'Expected `file` field' });
      return;
    }

    const id = request.cookies.queue;
    const queueList = await queue.getAll();
    const queueItem = queueList[id];

    if (queueItem.position !== 1) {
      reply.code(400).send({ message: 'Waiting turn' });
      return;
    }

    if (queueItem.status === 'processing') {
      reply.code(400).send({ message: 'Already processing' });
      return;
    }

    const storage = await new Storage(id).initialize();

    let outfile;
    let metadata;

    try {
      // Store with filename as UUID to prevent collisions.
      // Users may have different videos with the same name.
      const filename = uuid();

      // Store it without extension for now so we can validate it first.
      await storage.store(data.file, filename);

      const mime = await getMIME(storage.path(filename));

      if (!validateMIME(mime)) {
        reply.code(400).send({ message: 'Expected video/mp4' });
        return;
      }

      // Add the detected extension to the filename.
      const extension = mimeTypes.extension(mime);
      await storage.move(filename, `${filename}.${extension}`);
      outfile = storage.path(`${filename}.${extension}`);
      metadata = await analyze(outfile);
    } catch (e) {
      await storage.destroy();
      throw e;
    }

    const errors = validateMetadata(metadata);

    if (errors.length > 0) {
      reply.code(400).send({
        message: 'Video limit exceeded',
        errors,
      });
      return;
    }

    await upscaler
      .add({
        id,
        metadata,
        input: outfile,
      })
      .then(() => {
        queue.markAsStatus(id, 'processing');

        reply.send({
          status: 'processing',
        });
      })
      .catch((e) => {
        request.log.error('Failed to add job to queue');
        request.log.error(e);
        reply.code(500).send({ message: 'Something unexpected happened.' });
        storage.destroy();
      });
  };
};
