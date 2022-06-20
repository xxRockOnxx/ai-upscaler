const Storage = require('../upscaler/storage');

module.exports = function createOnJobCompleteListener(queueDB) {
  return function onJobComplete(job) {
    // Clean up working directory.
    // Downloadable files are moved somewhere else.
    new Storage(job.data.id).destroy();

    queueDB
      .markAsStatus(job.data.id, 'finished')
      .then(() => queueDB.sort());
  };
};
