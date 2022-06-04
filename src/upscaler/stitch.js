const ffmpeg = require("fluent-ffmpeg");
const { CancelError } = require("./errors");

function stitchFrames(input, output, metadata, setProgress, onCancel) {
  return new Promise((resolve, reject) => {
    const [a, b] = metadata.r_frame_rate.split("/");
    const framerate = parseInt(a) / parseInt(b);

    let canceled = false;

    const command = ffmpeg(input)
      .inputOptions([`-r ${framerate}`])
      .output(output)
      .outputOptions(["-c:v libx264", "-pix_fmt yuv420p"])
      .on("progress", ({ percent }) => {
        setProgress(percent);
      })
      .on("end", resolve)
      .on("error", (err) => {
        if (canceled) {
          reject(new CancelError(err));
        } else {
          reject(err);
        }
      });

    onCancel(() => {
      console.log("Killing ffmpeg process");
      canceled = true;
      command.kill();
    });

    command.run();
  });
}

module.exports = async function (job) {
  job.progress(0);
  await stitchFrames(
    job.data.input,
    job.data.output,
    job.data.metadata,
    job.progress,
    job.onCancel,
  );
  job.progress(100);
};
