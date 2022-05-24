
# AI Upscaler

A web-based video upscaling service powered by [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) and [FFMPEG](https://github.com/FFmpeg/FFmpeg).

Plans:

- [ ] Support Waifu2x
- [ ] Support Anime4K

I plan on hosting a forever free web-based upscaling service (both image and video)
so people who don't know how to setup AI-stuff and/or doesn't have the GPU power
can simply just use the service.


## Prerequisites

Because this project is by Real-ESRGAN and FFMPEG, these 2 must be installed or downloaded on your local machine.

Docker is used for NodeJS and Redis. You can use it if desired or just run natively on your host.

### NodeJS

To use NodeJS in Docker, you **must** be able to run Docker with GPU.

I haven't been able to use Docker with GPU so I **cannot** help you with this.

For Nvidia users, this might help: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html

This means I personally run NodeJS directly on the host.

### Redis

Redis can either be native to your host or via Docker.

By default, the app will attempt to connect to redis at `redis://127.0.0.1:6379`.

You can set `REDIS_HOST` and `REDIS_PORT` in `package.json` if needed.

### FFMPEG

Install FFMPEG through your package manager or by downloading static builds at https://johnvansickle.com/ffmpeg.

If you decided to just download a static build, putting it in the project directory will be convenient.

By default, the app will look for the `ffmpeg` and `ffprobe` in your path.

You can set `FFMPEG_PATH` and `FFPROBE_PATH` environment variables if needed.

### Real-ESRGAN

Download the correct build of Real-ESRGAN based on your architecture at https://github.com/xinntao/Real-ESRGAN/releases.

By default, the app will attempt to run `./realesrgan/realesrgan-ncnn-vulkan`.

You can set `REAL_ESRGAN_PATH` in `package.json` if needed.

## Run Locally

- Clone the project

```bash
  git clone https://github.com/xxRockOnxx/ai-upscaler
```

- Go to the project directory

```bash
  cd ai-upscaler
```

- Install dependencies

```bash
  yarn install
```

- Update environment variables in `package.json` if necessary

- Start the server

```bash
  yarn start
```

The server will listen on port 3000.
