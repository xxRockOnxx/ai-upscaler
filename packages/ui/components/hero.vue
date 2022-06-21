<template>
  <div
    style="background-image: linear-gradient( 135deg, #3C8CE7 10%, #00EAFF 100%);"
  >
    <div class="container px-4 py-12 xl:flex xl:items-center xl:gap-28 xl:py-28">
      <div class="xl:w-1/2">
        <h1 class="text-lg font-bold text-white md:text-2xl lg:text-4xl lg:leading-normal">
          Free Online AI Video Upscaler
        </h1>

        <p class="mt-4 text-white md:text-xl md:leading-normal lg:text-2xl lg:leading-loose">
          Enhance low resolution videos to 4x of the original size with the power of AI for free.
        </p>

        <div class="flex flex-col mt-4">
          <div class="text-white md:text-xl lg:text-2xl">
            Source code:

            <a
              href="https://github.com/xxRockOnxx/ai-upscaler"
              class="font-bold underline"
            >
              Github
            </a>
          </div>

          <div class="text-white md:text-xl md:mt-2 lg:mt-4 lg:text-2xl">
            Powered by:

            <a
              href="https://github.com/xinntao/Real-ESRGAN"
              class="font-bold underline"
            >
              Real-ESRGAN
            </a>
          </div>
        </div>
      </div>

      <div class="mt-5 lg:mt-10 xl:w-1/2">
        <img
          class="w-full"
          src="https://raw.githubusercontent.com/xinntao/public-figures/master/Real-ESRGAN/cmp_realesrgan_anime_1.png"
          alt="Demo"
        >
      </div>
    </div>
  </div>
</template>

<script>
export default {}
</script>

<style></style>
