const { ffprobe } = require('fluent-ffmpeg');

module.exports = async function analyze(input) {
  const { streams } = await new Promise((resolve, reject) => {
    ffprobe(input, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata);
      }
    });
  });

  const video = streams.find((stream) => stream.codec_type === 'video');

  if (!video) {
    throw new Error('No video stream found');
  }

  return video;
};
