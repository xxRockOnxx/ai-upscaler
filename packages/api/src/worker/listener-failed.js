const Storage = require('../upscaler/storage');

module.exports = function createOnJobFailedHandler(queueDB) {
  return function onJobFailed(job) {
    // Clean up working directory.
    // Nothing can be reused/downloaded.
    // @TODO: retry job if possible.
    new Storage(job.data.id).destroy();

    queueDB
      .markAsStatus(job.data.id, 'failed')
      .then(() => queueDB.sort());
  };
};
