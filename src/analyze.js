const ffprobe = require('fluent-ffmpeg').ffprobe

module.exports = async function (input) {
  const metadata = await new Promise((resolve, reject) => {
    ffprobe(input, (err, metadata) => {
      if (err) {
        return reject(err)
      }

      resolve(metadata)
    })
  })

  const video = metadata.streams.find(stream => stream.codec_type === 'video')

  if (!video) {
    throw new Error('No video stream found')
  }

  return video
}
