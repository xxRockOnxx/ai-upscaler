const fs = require('fs');

module.exports = function createGetDownload(downloads) {
  return async function getDownload(request, reply) {
    const id = request.cookies.queue;
    const download = await downloads.getById(id);

    if (!download) {
      return reply
        .code(404)
        .send({ message: 'Nothing to download' });
    }

    if (download.expire_at <= Date.now()) {
      return reply
        .code(410)
        .send({ message: 'File expired.' });
    }

    const stream = fs.createReadStream(download.file);

    stream.on('error', (err) => {
      downloads.set(id, 'active', false);
      throw err;
    });

    stream.on('end', () => {
      downloads.set(id, 'active', false);
    });

    stream.on('ready', () => {
      reply
        .header('Content-Type', 'video/mp4')
        .header('Content-Disposition', 'attachment; filename="enhanced.mp4"')
        .header('Content-Length', fs.statSync(download.file).size)
        .send(stream);

      downloads.set(id, 'active', true);
    });

    return reply;
  };
};
