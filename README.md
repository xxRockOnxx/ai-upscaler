
# AI Upscaler

[![codecov](https://codecov.io/gh/xxRockOnxx/ai-upscaler/branch/master/graph/badge.svg?token=QTYY6Z1NMQ)](https://codecov.io/gh/xxRockOnxx/ai-upscaler)

A web-based video upscaling service powered by [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) and [FFMPEG](https://github.com/FFmpeg/FFmpeg).

Plans:

- [ ] Support [waifu2x](https://github.com/nagadomi/waifu2x) as processor
- [ ] Support [Anime4K](https://github.com/bloc97/Anime4K) as processor
- [ ] Add [RIFE](https://github.com/hzwer/arXiv2021-RIFE) for frame interpolation
- [ ] Add an option to use different REAL-ESRGAN models

## Prerequisites

Real-ESRGAN and FFMPEG must be installed or downloaded on your local machine.

Docker is used for NodeJS, Redis, and Minio. You can use Docker if desired or just run natively on your host.

Only the "Worker" at the moment is not working correctly with Docker and so it must be run natively.

If you figure out how to use Nvidia + Vulkan with Docker then please let me know.

### Environment Variables

If running the applications (API and Worker) natively, you can rename the `.env.example` inside the packages to `.env`
and update the variables as necessary. This will automatically be read when started via `yarn start`.

Otherwise if the applications are used with Docker, then the required variables are found in `.env.example`.
The available `docker-compose.yml` is also already pre-filled with the required variables.

### FFMPEG

Install FFMPEG through your package manager or by downloading static builds at https://johnvansickle.com/ffmpeg.

By default, the app will look for the `ffmpeg` and `ffprobe` in your path.

Set the absolute path in `FFMPEG_PATH` and `FFPROBE_PATH` environment variables if needed.

### Real-ESRGAN

Download the correct build of Real-ESRGAN based on your architecture at https://github.com/xinntao/Real-ESRGAN/releases.

Set the absolute path of the binary to `REAL_ESRGAN_PATH` environment variable.

## Run Locally

Clone the project

```bash
  git clone https://github.com/xxRockOnxx/ai-upscaler
```

Go to the project directory

```bash
  cd ai-upscaler
```

Install dependencies

```bash
  yarn install
  npx lerna bootstrap
```

Set the required environment variables or simply just rename `.env.example` inside the packages to `.env`. See [Environment Variables](#environment-variables).

Start the apps:

API:

```bash
  cd packages/api
  yarn start
```

Worker:

```bash
  cd packages/worker
  yarn start
```

UI:

```bash
  cd packages/ui
  yarn generate
  yarn start
```

You can also use [pm2](https://pm2.keymetrics.io/) for convenience if you are not using Docker.

Example:

```bash
  cd packages/api
  pm2 start npm --name http -- run start
```
