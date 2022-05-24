const uuid = require("uuid").v4;

module.exports = function postQueue(queue) {
  return async function (request, reply) {
    const id = request.cookies.queue ?? uuid();
    const list = await queue.getAll();
    const position = list[id]?.position ?? Object.keys(list).length + 1;

    await queue.save(id, {
      position,
      status: "waiting",
      updatedAt: new Date(),
    });

    reply
      .cookie("queue", id, {
        httpOnly: true,
      })
      .send({
        position,
      });
  };
};
