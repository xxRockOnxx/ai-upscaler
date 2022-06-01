const path = require("path");
const fs = require("fs").promises;
const Bull = require("bull");

function getFrameDir(workDir) {
  return path.join(workDir, "frames");
}

function getEnhancedFrameDir(workDir) {
  return path.join(workDir, "enhanced_frames");
}

function waitForJob(job) {
  return new Promise((resolve, reject) => {
    function onComplete(completedJob, result) {
      if (job.id !== completedJob.id) {
        return;
      }

      job.queue.off("completed", onComplete);
      resolve(result);
    }

    function onFailed(failedJob, err) {
      if (job.id !== failedJob.id) {
        return;
      }

      job.queue.off("failed", onFailed);
      reject(err);
    }

    job.queue.on("completed", onComplete);
    job.queue.on("failed", onFailed);
  });
}

function createQueue(name, opts) {
  const queue = new Bull(name, opts);

  queue.on("error", console.error)
  queue.on("failed", (job, err) => console.error(err, job.data));

  return queue
}

function createUpscaler({ jobs, redis }) {
  const upscaleQueue = createQueue("upscale", { redis });
  const extractQueue = createQueue("extract", { redis });
  const enhanceQueue = createQueue("enhance", { redis });
  const stitchQueue = createQueue("stitch", { redis });

  upscaleQueue.process(async (job) => {
    await Promise.all([
      fs.mkdir(getFrameDir(job.data.workDir)),
      fs.mkdir(getEnhancedFrameDir(job.data.workDir)),
    ]);

    job.progress(1);
    job.log("Extracting frames");

    const extractJob = await extractQueue.add({
      id: job.data.id,
      input: job.data.input,
      output: path.join(getFrameDir(job.data.workDir), "frame_%03d.png"),
    });

    await waitForJob(extractJob);

    job.progress(2);
    job.log("Enhancing frames");

    const enhanceJob = await enhanceQueue.add({
      id: job.data.id,
      input: getFrameDir(job.data.workDir),
      output: getEnhancedFrameDir(job.data.workDir),
    });

    await waitForJob(enhanceJob);

    job.progress(3);
    job.log("Stitching frames");

    const extName = path.extname(job.data.input);
    const filename = path.basename(job.data.input, extName);
    const enhancedName = filename.replace(extName, "_enhanced" + extName);

    const stitchJob = await stitchQueue.add({
      id: job.data.id,
      metadata: job.data.metadata,
      input: path.join(getEnhancedFrameDir(job.data.workDir), "frame_%03d.png"),
      output: path.join(job.data.workDir, enhancedName),
    });

    await waitForJob(stitchJob);
  });

  extractQueue.process(require.resolve("./extract.js"));
  enhanceQueue.process(require.resolve("./enhance.js"));
  stitchQueue.process(require.resolve("./stitch.js"));

  upscaleQueue.on("active", (job) => {
    // Use `save` instead of `set` to override previous job if there's any.
    jobs.save(job.data.id, {
      upscaling: job.id
    })
  })

  extractQueue.on("active", (job) => {
    jobs.set(job.data.id, "extracting", job.id);
  })

  enhanceQueue.on("active", (job) => {
    jobs.set(job.data.id, "enhancing", job.id);
  })

  stitchQueue.on("active", (job) => {
    jobs.set(job.data.id, "stitching", job.id);
  })

  upscaleQueue.on("completed", (job, result) => {
    Promise.all([
      fs.rm(getFrameDir(job.data.workDir), { recursive: true }),
      fs.rm(getEnhancedFrameDir(job.data.workDir), { recursive: true }),
    ]).catch((e) => {
      console.error(e);
    });
  })

  return {
    queue: {
      upscale: upscaleQueue,
      extract: extractQueue,
      enhance: enhanceQueue,
      stitch: stitchQueue,
    },

    upscale(id, workDir, metadata, input) {
      return upscaleQueue
        .add({
          id,
          workDir,
          metadata,
          input,
        })
    },
  };
}

module.exports = createUpscaler;
