const fs = require("fs").promises;
const path = require("path");
const exec = require("child_process").exec;
const { CancelError } = require("./errors");

function enhanceFrame(input, output, onCancel) {
  return new Promise((resolve, reject) => {
    const args = [
      "-i",
      input,

      "-o",
      output,

      "-s",
      "4",

      "-f",
      "png",

      "-n",
      "realesrgan-x4plus",
    ];

    const command = `${process.env.REAL_ESRGAN_PATH} ${args.join(" ")}`;
    let canceled = false;

    const proc = exec(command, (code, out, err) => {
      if (code) {
        const computedError = canceled ? new CancelError(err) : new Error(err);
        reject(computedError);
      } else {
        resolve();
      }
    });

    onCancel(() => {
      console.log("Killing enhance process");
      canceled = true;
      proc.kill();
    });
  });
}

module.exports = async function (job) {
  const frames = await fs.readdir(job.data.input);

  for (const [i, frame] of frames.entries()) {
    await enhanceFrame(
      path.join(job.data.input, frame),
      path.join(job.data.output, frame),
      job.onCancel
    );

    job.progress(((i + 1) / frames.length) * 100);
  }
};
