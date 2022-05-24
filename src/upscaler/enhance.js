const fs = require('fs').promises;
const path = require('path');
const exec = require('child_process').exec

function enhanceFrame(input, output, setCancel) {
  return new Promise((resolve, reject) => {
    const args = [
      "-i",
      input,

      "-o",
      output,

      "-s",
      "2",

      "-f",
      "png",

      "-n",
      "realesrgan-x4plus",
    ];

    const command = `${process.env.REAL_ESRGAN_PATH} ${args.join(" ")}`;

    console.log(command);

    const proc = exec(command, (code, out, err) => {
      console.log(out);

      if (code) {
        console.error(err);
        reject();
      } else {
        resolve();
      }
    });

    // setCancel(() => {
    //   proc.kill();
    // });
  });
}

module.exports = async function (job) {
  const frames = await fs.readdir(job.data.input);

  console.log(`Enhancing ${frames.length} frames`);
  job.log(`Enhancing ${frames.length} frames`);

  for (const [i, frame] of frames.entries()) {
    job.progress(i / frames.length * 100);
    job.log(`Enhancing frame ${i + 1} of ${frames.length}`);

    await enhanceFrame(
      path.join(job.data.input, frame),
      path.join(job.data.output, frame)
    );
  }

  console.log("Enhancement complete");
  job.log("Enhancement complete");
}
