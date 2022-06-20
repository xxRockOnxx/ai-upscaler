const ffmpeg = require('fluent-ffmpeg');
const { CancelError } = require('./errors');

function extractFrames(input, output, setProgress, onCancel) {
  return new Promise((resolve, reject) => {
    let canceled = false;

    const command = ffmpeg(input)
      .output(output)
      .outputOptions([
        '-qscale:v 1',
        '-qmin 1',
        '-qmax 1',
        '-vsync passthrough',
      ])
      .on('progress', ({ percent }) => {
        setProgress(percent);
      })
      .on('end', resolve)
      .on('error', (err) => {
        if (canceled) {
          reject(new CancelError(err));
        } else {
          reject(err);
        }
      });

    onCancel(() => {
      console.log('Killing ffmpeg process');
      canceled = true;
      command.kill();
    });

    command.run();
  });
}

module.exports = async function extract(job) {
  job.progress(0);
  await extractFrames(
    job.data.input,
    job.data.output,
    job.progress,
    job.onCancel,
  );
  job.progress(100);
};
