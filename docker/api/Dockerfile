FROM node:16-alpine

WORKDIR /app

# The app needs FFProbe to validate video files
RUN wget https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz && \
  mkdir ffmpeg && \
  tar -xvf ffmpeg-git-amd64-static.tar.xz -C ffmpeg --strip-components=1 && \
  rm ffmpeg-git-amd64-static.tar.xz

ENV FFMPEG_PATH=/app/ffmpeg/ffmpeg
ENV FFPROBE_PATH=/app/ffmpeg/ffprobe

# The mmmagic package seems to need these packages to compile properly
RUN apk add python3 make g++

COPY packages/api packages/api
COPY packages/core packages/core
COPY lerna.json package.json yarn.lock /app/

RUN adduser -S app
RUN chown -R app /app

USER app

RUN yarn install
RUN npx lerna bootstrap

EXPOSE 3000
WORKDIR /app/packages/api
CMD ["npx", "ts-node", "-T", "src/main.ts"]
