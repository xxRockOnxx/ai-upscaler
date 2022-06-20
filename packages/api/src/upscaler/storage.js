const fs = require('fs-extra');
const os = require('os');
const util = require('util');
const path = require('path');
const pipeline = util.promisify(require('stream').pipeline);

const DIR_ROOT = path.join(os.tmpdir(), 'ai-upscaler');
const DIR_FRAMES = 'frames';
const DIR_ENHANCED = 'enhanced_frames';

module.exports = class Storage {
  constructor(id) {
    this.workDir = path.join(DIR_ROOT, id);
  }

  async initialize() {
    await fs.emptyDir(this.workDir);
    return this;
  }

  destroy() {
    return fs.remove(this.workDir);
  }

  path(...args) {
    return path.join(this.workDir, ...args);
  }

  framesPath(...args) {
    return this.path(DIR_FRAMES, ...args);
  }

  async mkFramesDir() {
    await this.mkdir(DIR_FRAMES);
    return this;
  }

  enhancedPath(...args) {
    return this.path(DIR_ENHANCED, ...args);
  }

  async mkEnhancedDir() {
    await this.mkdir(DIR_ENHANCED);
    return this;
  }

  async store(stream, relativePath) {
    const outfile = this.path(relativePath);
    await pipeline(stream, fs.createWriteStream(outfile));
    return outfile;
  }

  async mkdir(relativePath) {
    await fs.mkdir(this.path(relativePath));
    return this;
  }
};
