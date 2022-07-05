FROM ubuntu:jammy

WORKDIR /app

RUN apt update && \
  apt install -y wget unzip software-properties-common && \
  add-apt-repository ppa:oibaf/graphics-drivers && \
  apt install -y libvulkan1 libgomp1

# The app needs FFProbe to validate video files
# and FFMPEG to extract and stitch frames
RUN wget https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz && \
  mkdir ffmpeg && \
  tar -xvf ffmpeg-git-amd64-static.tar.xz -C ffmpeg --strip-components=1 && \
  rm ffmpeg-git-amd64-static.tar.xz

ENV FFMPEG_PATH=/app/ffmpeg/ffmpeg
ENV FFPROBE_PATH=/app/ffmpeg/ffprobe

# Download and extract Real-ESRGAN
RUN wget https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip && \
  unzip -d realesrgan realesrgan-ncnn-vulkan-20220424-ubuntu.zip && \
  rm realesrgan-ncnn-vulkan-20220424-ubuntu.zip

ENV REAL_ESRGAN_PATH=/app/realesrgan/realesrgan-ncnn-vulkan

# Install Node.js and enable Yarn
RUN wget -qO- https://deb.nodesource.com/setup_16.x | bash - && \
  apt update && \
  apt install -y nodejs && \
  npm install -g yarn

COPY packages/worker packages/worker
COPY packages/core packages/core
COPY lerna.json package.json yarn.lock /app/

RUN adduser -S app
RUN chown -R app /app

USER app

RUN yarn install
RUN npx lerna bootstrap

WORKDIR /app/packages/worker
CMD ["npx", "ts-node", "-T", "src/main.ts"]
