const ffmpeg = require("fluent-ffmpeg");

function extractFrames(input, output, setProgress, setCancel) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(input)
      .output(output)
      .outputOptions([
        "-qscale:v 1",
        "-qmin 1",
        "-qmax 1",
        "-vsync passthrough",
      ])
      .on('progress', ({ percent }) => {
        console.log(percent);
        setProgress(percent);
      })
      .on("end", resolve)
      .on("error", reject);

    // setCancel(command.kill);

    command.run();
  });
}

module.exports = async function (job) {
  console.log("Extracting frames");
  job.progress(0);
  await extractFrames(job.data.input, job.data.output, job.progress);
  console.log("Extracted frames");
  job.progress(100);
};
