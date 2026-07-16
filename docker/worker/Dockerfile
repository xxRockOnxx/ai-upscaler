# ---------------------------------------------------------------------------
# Stage 1: build a minimal ffmpeg with libplacebo (Anime4K GLSL shaders).
#
# Anime4K is a set of mpv GLSL shaders — there is no Linux CLI binary.
# Instead of Anime4KCPP (whose v3.0.0 release only ships Windows builds),
# the worker runs the shaders through ffmpeg's `libplacebo` filter.
# The build is intentionally minimal: just enough to
#   - ffprobe uploaded videos (json output is built into ffprobe),
#   - extract frames from common web formats (mp4/mov, mkv/webm, avi),
#   - upscale PNG frames with the Anime4K shaders (libplacebo + vulkan),
#   - stitch PNG frames back into an h264 mp4 (libx264 + yuv420p).
# ---------------------------------------------------------------------------
FROM ubuntu:jammy AS ffmpeg-builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git ca-certificates curl unzip pkg-config \
    cmake ninja-build python3-pip nasm \
    libx264-dev zlib1g-dev libshaderc-dev libvulkan-dev && \
  # jammy's meson (0.61.2) is too old for libplacebo (needs >= 0.63)
  pip3 install meson

# ffmpeg's --enable-vulkan needs Vulkan headers >= 1.3.277 (header-only
# check — the loader is dlopen'ed at runtime, nothing links against it).
RUN git clone --depth 1 --branch v1.3.290 https://github.com/KhronosGroup/Vulkan-Headers /src/vulkan-headers && \
  cmake -S /src/vulkan-headers -B /src/vulkan-headers/build -DCMAKE_INSTALL_PREFIX=/usr/local && \
  cmake --install /src/vulkan-headers/build

# libplacebo provides the vf_libplacebo GLSL runtime (vulkan + shaderc only)
RUN git clone --recursive --depth 1 --branch v7.349.0 https://github.com/haasn/libplacebo /src/libplacebo && \
  meson setup /src/libplacebo/build /src/libplacebo \
    --prefix=/usr/local --buildtype=release \
    -Dvulkan=enabled -Dshaderc=enabled -Dglslang=disabled \
    -Dopengl=disabled -Dd3d11=disabled -Dlcms=disabled \
    -Ddemos=false -Dtests=false && \
  ninja -C /src/libplacebo/build install

# Minimal ffmpeg: disable everything, then enable only what the worker uses.
# `mov` demuxer covers mp4/mov/m4v; `matroska` covers mkv+webm. The
# scale/format filters keep ffmpeg's automatic pixel format conversion
# working (RGB png -> yuv420p when stitching). ffprobe is built by default.
RUN git clone --depth 1 --branch n7.1.1 https://git.ffmpeg.org/ffmpeg.git /src/ffmpeg
RUN cd /src/ffmpeg && \
  PKG_CONFIG_PATH=/usr/local/lib/x86_64-linux-gnu/pkgconfig ./configure \
    --prefix=/opt/ffmpeg \
    --disable-autodetect --disable-everything \
    --disable-doc --disable-ffplay --disable-network \
    --disable-avdevice --disable-postproc --disable-debug \
    --enable-gpl --enable-zlib --enable-libx264 \
    --enable-vulkan --enable-libplacebo \
    --enable-demuxer=mov,matroska,avi,image2 \
    --enable-muxer=mp4,image2 \
    --enable-decoder=h264,hevc,vp8,vp9,mpeg4,png \
    --enable-encoder=libx264,png \
    --enable-parser=h264,hevc,vp8,vp9,mpeg4video,png \
    --enable-protocol=file,pipe \
    --enable-filter=libplacebo,scale,format,copy,null && \
  make -j"$(nproc)" && \
  make install

# Anime4K shaders: Mode A at 4x — restore + upscale x2, twice.
# The concatenated file is what ANIME4K_PATH points at.
RUN mkdir -p /opt/anime4k && cd /opt/anime4k && \
  curl -fsSL -o a4k.zip https://github.com/bloc97/Anime4K/releases/download/v4.0.1/Anime4K_v4.0.zip && \
  unzip a4k.zip && \
  cat Anime4K_Clamp_Highlights.glsl \
      Anime4K_Restore_CNN_VL.glsl \
      Anime4K_Upscale_CNN_x2_VL.glsl \
      Anime4K_Restore_CNN_M.glsl \
      Anime4K_Upscale_CNN_x2_M.glsl \
      > anime4k-mode-a-4x.glsl && \
  rm a4k.zip

# ---------------------------------------------------------------------------
# Stage 2: runtime
# ---------------------------------------------------------------------------
FROM ubuntu:jammy

WORKDIR /app

RUN apt update && \
  apt install -y wget unzip software-properties-common && \
  add-apt-repository ppa:oibaf/graphics-drivers && \
  apt install -y libvulkan1 libgomp1 libx264-163 libshaderc1 zlib1g

# The app needs FFProbe to validate video files, FFMPEG to extract and
# stitch frames, and ffmpeg's libplacebo filter to run the Anime4K shaders
COPY --from=ffmpeg-builder /opt/ffmpeg/bin/ffmpeg /opt/ffmpeg/bin/ffprobe /app/ffmpeg/
COPY --from=ffmpeg-builder /usr/local/lib/x86_64-linux-gnu/libplacebo.so* /usr/local/lib/
RUN ldconfig

ENV FFMPEG_PATH=/app/ffmpeg/ffmpeg
ENV FFPROBE_PATH=/app/ffmpeg/ffprobe

# Anime4K is applied by ffmpeg (vf_libplacebo), so the "binary" is just the
# combined GLSL shader chain built in the ffmpeg-builder stage.
COPY --from=ffmpeg-builder /opt/anime4k/anime4k-mode-a-4x.glsl /app/anime4k/anime4k-mode-a-4x.glsl

ENV ANIME4K_PATH=/app/anime4k/anime4k-mode-a-4x.glsl

# Download and extract Real-ESRGAN
RUN wget https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip && \
  unzip -d realesrgan realesrgan-ncnn-vulkan-20220424-ubuntu.zip && \
  rm realesrgan-ncnn-vulkan-20220424-ubuntu.zip

ENV REAL_ESRGAN_PATH=/app/realesrgan/realesrgan-ncnn-vulkan

# Download and extract waifu2x
RUN wget https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/20250915/waifu2x-ncnn-vulkan-20250915-linux.zip && \
  unzip waifu2x-ncnn-vulkan-20250915-linux.zip && \
  mv waifu2x-ncnn-vulkan-20250915-linux waifu2x && \
  rm waifu2x-ncnn-vulkan-20250915-linux.zip

ENV WAIFU2X_PATH=/app/waifu2x/waifu2x-ncnn-vulkan

# Download and extract rife (frame interpolation)
RUN wget https://github.com/nihui/rife-ncnn-vulkan/releases/download/20221029/rife-ncnn-vulkan-20221029-ubuntu.zip && \
  unzip rife-ncnn-vulkan-20221029-ubuntu.zip && \
  mv rife-ncnn-vulkan-20221029-ubuntu rife && \
  rm rife-ncnn-vulkan-20221029-ubuntu.zip

ENV RIFE_PATH=/app/rife/rife-ncnn-vulkan

# Download and extract cain (frame interpolation)
RUN wget https://github.com/nihui/cain-ncnn-vulkan/releases/download/20220728/cain-ncnn-vulkan-20220728-ubuntu.zip && \
  unzip cain-ncnn-vulkan-20220728-ubuntu.zip && \
  mv cain-ncnn-vulkan-20220728-ubuntu cain && \
  rm cain-ncnn-vulkan-20220728-ubuntu.zip

ENV CAIN_PATH=/app/cain/cain-ncnn-vulkan

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
