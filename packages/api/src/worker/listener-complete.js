const Storage = require('../upscaler/storage');

module.exports = function createOnJobCompleteListener(queueDB, downloadsDB) {
  return function onJobComplete(job) {
    // Clean up working directory.
    // Downloadable files are moved somewhere else.
    new Storage(job.data.id).destroy();

    queueDB
      .markAsStatus(job.data.id, 'finished')
      .then(() => queueDB.sort());

    downloadsDB.save(job.data.id, {
      file: job.returnvalue.output,
      expire_at: Date.now() + (1000 * 60 * 60 * 24),
    });
  };
};
