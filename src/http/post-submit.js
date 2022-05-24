const analyze = require("../analyze");
const validator = require("../validator");
const Storage = require("../storage");

module.exports = function postSubmit(queue, upscaler) {
  return async function (request, reply) {
    const queueList = await queue.getAll();
    const queueItem = queueList[request.cookies.queue];

    if (queueItem.position !== 1) {
      reply.code(400).send("Waiting turn");
      return;
    }

    if (queueItem.status === "processing") {
      reply.code(400).send("Already processing");
      return;
    }

    const data = await request.file();
    const storage = new Storage(request.cookies.queue);

    await storage.initialize();

    try {
      const outfile = await storage.store(data.filename, data.file);
      const metadata = await analyze(outfile);
      const validation = validator(metadata, {
        maxHeight: 720,
        maxDuration: 60 * 5,
      });

      const errors = [];

      if (!validation.validDuration) {
        errors.push("Duration currently only supports 5 minutes.");
      }

      if (!validation.validHeight) {
        errors.push("Height currently only supports up to 720p.");
      }

      if (errors.length > 0) {
        reply.code(400).send({ errors });
        return;
      }

      await queue.upsert(request.cookies.queue, {
        status: "processing",
        updatedAt: new Date(),
      });

      upscaler.upscale(request.cookies.queue, storage.workDir, metadata, outfile);

      reply.send({
        status: "processing",
      });
    } catch (e) {
      await storage.destroy();
      await queue.upsert(request.cookies.queue, {
        status: "failed",
        updatedAt: new Date(),
      });
      throw e;
    }
  };
};
