const fs = require('fs-extra');
const path = require('path');
const os = require('os');

module.exports = class Storage {
  constructor(id) {
    this.workDir = path.join(os.tmpdir(), 'ai-upscaler-downloads', id);
  }

  initialize() {
    return fs.ensureDir(this.workDir);
  }

  destroy() {
    return fs.remove(this.workDir, { recursive: true });
  }

  path(...args) {
    return path.join(this.workDir, ...args);
  }
};
