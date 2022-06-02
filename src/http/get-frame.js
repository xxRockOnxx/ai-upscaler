const fs = require('fs');
const Storage = require('../storage');

module.exports = function getFrame() {
  return async function (request, reply) {
    const id = request.cookies.queue;
    const storage = new Storage(id);

    const enhanced = request.query.enhanced === "true";
    const directory = enhanced ? "enhanced_frames" : "frames";
    const stream = fs.createReadStream(
      storage.path(directory + "/" + request.params.frame)
    );

    stream.on("error", (err) => {
      if (err.code !== "ENOENT") {
        throw err;
      }

      reply.status(404).send();
    });

    stream.on("ready", () => {
      reply
        .type("image/png")
        .send(stream);
    })
  }
}
