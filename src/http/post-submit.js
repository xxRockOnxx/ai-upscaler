const analyze = require("../analyze");
const validator = require("../validator");
const Storage = require("../storage");

module.exports = function postSubmit(queue, upscaler) {
  return async function (request, reply) {
    const id = request.cookies.queue;
    const queueList = await queue.getAll();
    const queueItem = queueList[id];

    if (queueItem.position !== 1) {
      reply.code(400).send("Waiting turn");
      return;
    }

    if (queueItem.status === "processing") {
      reply.code(400).send("Already processing");
      return;
    }

    const data = await request.file();
    const storage = new Storage(id);

    await storage.initialize();

    let outfile;
    let metadata;

    const errors = [];

    try {
      outfile = await storage.store(data.filename, data.file);
      metadata = await analyze(outfile);
    } catch (e) {
      await storage.destroy();
      throw e;
    }

    const validation = validator(metadata, {
      maxHeight: 720,
      maxDuration: 60 * 5,
    });

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

    await upscaler.add({
      id,
      metadata,
      workDir: storage.workDir,
      input: outfile,
    })
      .then(() => {
        queue.markAsStatus(id, "processing");

        reply.send({
          status: "processing",
        });
      })
      .catch((e) => {
        request.log.error("Failed to add job to queue");
        request.log.error(e);
        storage.destroy();
      })
  };
};
