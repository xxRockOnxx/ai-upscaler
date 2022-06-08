const fs = require('fs-extra');
const { createWriteStream } = require('fs');
const os = require('os');
const util = require('util');
const path = require('path');
const pipeline = util.promisify(require('stream').pipeline);

const DIR_PREFIX = 'ai-upscaler-';

module.exports = class Storage {
  constructor(id) {
    this.workDir = path.join(os.tmpdir(), DIR_PREFIX + id);
  }

  path(relativePath) {
    return path.join(this.workDir, relativePath);
  }

  initialize() {
    return fs.emptyDir(this.workDir);
  }

  async store(relativePath, stream) {
    const outfile = this.path(relativePath);
    await pipeline(stream, createWriteStream(outfile));
    return outfile;
  }

  mkdir(relativePath) {
    return fs.mkdir(this.path(relativePath));
  }

  destroy() {
    return fs.remove(this.workDir);
  }
};
