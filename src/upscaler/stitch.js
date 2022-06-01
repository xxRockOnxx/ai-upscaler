function stitchFrames(input, output, metadata, setProgress) {
  return new Promise((resolve, reject) => {
    const framerate = metadata.framerate * 2;

    ffmpeg(input)
      .inputOptions([`-r ${framerate}`])
      .output(output)
      .outputOptions(["-c:v libx264", "-pix_fmt yuv420p"])
      .on("progress", ({ percent }) => {
        setProgress(percent);
      })
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

module.exports = async function (job) {
  console.log("Stitching frames");
  job.progress(0);
  await stitchFrames(job.data.input, job.data.output, job.data.metadata, job.progress);
  console.log("Stitched frames");
  job.progress(100);
};
