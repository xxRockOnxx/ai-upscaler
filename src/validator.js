module.exports = function validator(metadata, options) {
  return {
    validHeight: metadata.height <= options.maxHeight,
    validDuration: metadata.duration <= options.maxDuration,
  };
};
