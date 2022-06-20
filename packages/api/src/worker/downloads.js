const fs = require('fs-extra');

async function downloadsCleaner(downloadsDB) {
  const storedDownloads = await downloadsDB.getAll();

  // Redis returns null Object so there's no prototype.
  // eslint-disable-next-line no-restricted-syntax,guard-for-in
  for (const id in storedDownloads) {
    const download = storedDownloads[id];
    const expired = download.expire_at <= Date.now();

    if (!expired) {
      // eslint-disable-next-line no-continue
      continue;
    }

    // Only remove file if it's not currently being downloaded.
    if (!download.active) {
      fs.remove(download.file);
      return;
    }
  }
}

module.exports = function downloads(downloadsDB, bullQueue) {
  // 24 hours
  const expiry = 1000 * 60 * 60 * 24;

  // Remove expired downloadable files every hour.
  setInterval(() => downloadsCleaner(downloadsDB), expiry);

  bullQueue.on('complete', async (job, result) => {
    downloadsDB.save(job.data.id, {
      file: result.output,
      expire_at: new Date(Date.now() + expiry),
    });
  });
};
